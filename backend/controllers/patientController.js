const crypto = require('node:crypto');
const Patient = require('../models/Patient');
const MedicalDocument = require('../models/MedicalDocument');
const EmergencyAlert = require('../models/EmergencyAlert');
const AppError = require('../utils/AppError');
const { hashIntakeToken } = require('../utils/intakeToken');
const { recordAudit } = require('../services/auditService');
const { hasUrgentPhrase, requestConversation, urgentReply } = require('../services/aiService');

const INTAKE_WINDOW_MS = 2 * 60 * 60 * 1000;
const CASE_FIELDS = [
  'chiefComplaint', 'onset', 'duration', 'location', 'character', 'aggravatingFactors',
  'relievingFactors', 'timing', 'severity', 'associatedSymptoms', 'pastMedicalHistory',
  'surgicalHistory', 'familyHistory', 'personalHistory', 'medicationHistory',
  'allergies', 'reviewOfSystems',
];

const VERIFIED_HISTORY_FIELDS = CASE_FIELDS;

async function registerPatient(request, response) {
  const { consent, dateOfBirth, ...details } = request.validatedBody;
  const intakeToken = crypto.randomBytes(32).toString('hex');
  const patient = await Patient.create({
    ...details,
    dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null,
    consent: { ...consent, recordedAt: new Date(), policyVersion: '1.0' },
    consentHistory: [{ ...consent, recordedAt: new Date(), policyVersion: '1.0', source: 'kiosk' }],
    registrationSource: 'kiosk',
    intakeCredentialHash: hashIntakeToken(intakeToken),
    intakeExpiresAt: new Date(Date.now() + INTAKE_WINDOW_MS),
  });

  await recordAudit(request, { action: 'patient.register', resourceType: 'patient', resourceId: patient.patientId });
  response.status(201).json({ patient: patient.toJSON(), intakeToken });
}

async function saveIntakeProgress(request, response) {
  const patient = await Patient.findOne({
    intakeCredentialHash: request.intakeCredentialHash,
    intakeExpiresAt: { $gt: new Date() },
    'consent.caseTaking': true,
    caseStatus: { $ne: 'completed' },
  }).select('+intakeCredentialHash +intakeExpiresAt');
  if (!patient) throw new AppError('This check-in session has expired. Please ask reception for help.', 401);

  const { complete, ...answers } = request.validatedBody;
  for (const field of CASE_FIELDS) {
    if (Object.hasOwn(answers, field)) patient.set(`caseHistory.${field}`, answers[field]);
  }

  if (complete && !patient.caseHistory.chiefComplaint?.trim()) {
    throw new AppError('Please answer the main concern before completing your history.', 400);
  }

  patient.caseStatus = complete ? 'completed' : 'in_progress';
  patient.caseHistoryUpdatedAt = new Date();
  if (complete) {
    patient.intakeCredentialHash = undefined;
    patient.intakeExpiresAt = null;
  }
  await patient.save();
  await recordAudit(request, {
    action: complete ? 'patient.case_history.complete' : 'patient.case_history.update',
    resourceType: 'patient',
    resourceId: patient.patientId,
  });
  response.json({ status: patient.caseStatus, updatedAt: patient.caseHistoryUpdatedAt });
}

async function getConversationReply(request, response) {
  const patient = await Patient.findOne({
    intakeCredentialHash: request.intakeCredentialHash,
    intakeExpiresAt: { $gt: new Date() },
    'consent.caseTaking': true,
    caseStatus: { $ne: 'completed' },
  }).select('+intakeCredentialHash +intakeExpiresAt consent.aiAssistance');
  if (!patient) throw new AppError('This check-in session has expired. Please ask reception for help.', 401);

  if (hasUrgentPhrase(request.validatedBody.answer)) {
    const result = urgentReply(request.validatedBody.language);
    const existingAlert = await EmergencyAlert.exists({ patient: patient._id, status: { $in: ['open', 'acknowledged'] } });
    if (!existingAlert) await EmergencyAlert.create({ patient: patient._id, patientId: patient.patientId, source: 'intake_phrase' });
    await recordAudit(request, { action: 'patient.emergency_alert.create', resourceType: 'patient', resourceId: patient.patientId });
    return response.json(result);
  }

  if (!patient.consent.aiAssistance) {
    return response.json({
      mode: 'guided',
      reply: request.validatedBody.language === 'hi' ? 'धन्यवाद। अगला प्रश्न आपकी जानकारी को समझने में मदद करेगा।' : 'Thank you for sharing. The next question will help your care team understand your experience.',
      followUpQuestion: null,
      urgent: false,
    });
  }

  const result = await requestConversation(request.validatedBody);
  if (result.urgent) {
    const existingAlert = await EmergencyAlert.exists({ patient: patient._id, status: { $in: ['open', 'acknowledged'] } });
    if (!existingAlert) await EmergencyAlert.create({ patient: patient._id, patientId: patient.patientId, source: 'intake_phrase' });
  }
  await recordAudit(request, { action: 'patient.ai_assistance.prompt', resourceType: 'patient', resourceId: patient.patientId });
  response.json(result);
}

async function updateIntakeConsent(request, response) {
  const patient = await Patient.findOne({
    intakeCredentialHash: request.intakeCredentialHash,
    intakeExpiresAt: { $gt: new Date() },
    'consent.caseTaking': true,
    caseStatus: { $ne: 'completed' },
  }).select('+intakeCredentialHash +intakeExpiresAt');
  if (!patient) throw new AppError('This check-in session has expired. Please ask reception for help.', 401);

  for (const [key, value] of Object.entries(request.validatedBody)) patient.set(`consent.${key}`, value);
  patient.consent.recordedAt = new Date();
  patient.consent.policyVersion = '1.0';
  patient.consentHistory.push({
    caseTaking: patient.consent.caseTaking,
    documentProcessing: patient.consent.documentProcessing,
    aiAssistance: patient.consent.aiAssistance,
    recordedAt: new Date(),
    policyVersion: '1.0',
    source: 'kiosk',
  });
  if (!patient.consent.caseTaking) {
    patient.intakeCredentialHash = undefined;
    patient.intakeExpiresAt = null;
  }
  await patient.save();
  await recordAudit(request, { action: 'patient.consent.update', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ consent: patient.consent, revoked: !patient.consent.caseTaking });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listPatients(request, response, filters = request.query) {
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit, 10) || 20));
  const filter = {};
  const search = request.method === 'GET' ? '' : (typeof filters.q === 'string' ? filters.q.trim().slice(0, 100) : '');
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { patientId: { $regex: safeSearch, $options: 'i' } },
      { fullName: { $regex: safeSearch, $options: 'i' } },
      { phone: { $regex: safeSearch, $options: 'i' } },
    ];
  }
  if (['not_started', 'in_progress', 'completed'].includes(filters.status)) {
    filter.caseStatus = filters.status;
  }
  if (filters.today === 'true') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    filter.createdAt = { $gte: start };
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter).select('patientId fullName dateOfBirth gender phone preferredLanguage caseStatus clinicalReview.status createdAt caseHistoryUpdatedAt')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  await recordAudit(request, { action: search ? 'patient.search' : 'patient.list', resourceType: 'patient' });
  response.json({ patients, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function searchPatients(request, response) {
  return listPatients(request, response, request.validatedBody);
}

async function getPatient(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId }).select('+abhaId');
  if (!patient) throw new AppError('Patient record not found.', 404);
  await recordAudit(request, { action: 'patient.view', resourceType: 'patient', resourceId: patient.patientId });
  const patientData = patient.toJSON();
  const role = request.user.role === 'admin' ? 'administrator' : request.user.role;
  if (role === 'receptionist') {
    delete patientData.caseHistory;
    delete patientData.clinicalReview;
    delete patientData.ayurvedaAssessment;
    delete patientData.clinicalSummary;
  }
  else {
    patientData.abhaId = patient.abhaId || '';
    patientData.documents = await MedicalDocument.find({ patientId: patient.patientId }).sort({ createdAt: -1 }).lean();
  }
  response.json({ patient: patientData });
}

async function updateClinicalReview(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const { status, doctorNotes, verifiedHistory } = request.validatedBody;
  if (status === 'approved' && patient.caseStatus !== 'completed') {
    throw new AppError('Complete patient case-taking before approving the history.', 409);
  }

  const priorVerified = patient.clinicalReview.verifiedHistory.toObject();
  const hasPriorEntries = Object.values(priorVerified).some((value) => value !== '' && value !== null && value !== undefined);
  if (patient.clinicalReview.reviewedAt || hasPriorEntries || patient.clinicalReview.doctorNotes) {
    patient.clinicalReview.history.push({
      verifiedHistory: priorVerified,
      doctorNotes: patient.clinicalReview.doctorNotes,
      status: patient.clinicalReview.status,
      changedBy: request.user._id,
      changedAt: new Date(),
    });
  }

  for (const field of VERIFIED_HISTORY_FIELDS) {
    if (Object.hasOwn(verifiedHistory, field)) patient.set(`clinicalReview.verifiedHistory.${field}`, verifiedHistory[field]);
  }
  patient.clinicalReview.doctorNotes = doctorNotes;
  patient.clinicalReview.status = status;
  patient.clinicalReview.reviewedBy = status === 'pending' ? null : request.user._id;
  patient.clinicalReview.reviewedAt = status === 'pending' ? null : new Date();
  await patient.save();
  await recordAudit(request, { action: `patient.clinical_review.${status}`, resourceType: 'patient', resourceId: patient.patientId });
  response.json({ clinicalReview: patient.clinicalReview });
}

async function updateAyurvedaAssessment(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  patient.ayurvedaAssessment = { ...request.validatedBody, assessedBy: request.user._id, assessedAt: new Date() };
  await patient.save();
  await recordAudit(request, { action: 'patient.ayurveda_assessment.update', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ ayurvedaAssessment: patient.ayurvedaAssessment });
}

module.exports = { getConversationReply, getPatient, listPatients, registerPatient, saveIntakeProgress, searchPatients, updateAyurvedaAssessment, updateClinicalReview, updateIntakeConsent };
