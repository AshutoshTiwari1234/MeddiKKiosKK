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
  const { consent, dateOfBirth, department = 'General Medicine', ...details } = request.validatedBody;
  const intakeToken = crypto.randomBytes(32).toString('hex');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await Patient.countDocuments({ createdAt: { $gte: todayStart } });
  const tokenNum = 101 + todayCount;
  const prefixMap = {
    'Ayurveda / AYUSH': { prefix: 'AY', room: 'Room 3 (AYUSH OPD)' },
    'General Medicine': { prefix: 'GM', room: 'Room 1 (General OPD)' },
    'Pediatrics': { prefix: 'PED', room: 'Room 2 (Pediatrics)' },
    'Orthopedics': { prefix: 'ORT', room: 'Room 4 (Orthopedics)' },
    'Cardiology': { prefix: 'CARD', room: 'Room 5 (Cardiology)' },
    'Dermatology': { prefix: 'DERM', room: 'Room 6 (Dermatology)' },
  };
  const { prefix, room } = prefixMap[department] || { prefix: 'OPD', room: 'Room 1 (General OPD)' };
  const queueToken = `${prefix}-${tokenNum}`;

  const patient = await Patient.create({
    ...details,
    department,
    queueToken,
    roomNumber: room,
    callStatus: 'waiting',
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
  }).select('+intakeCredentialHash +intakeExpiresAt patientId consent.aiAssistance');
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
    Patient.find(filter).select('patientId fullName dateOfBirth gender phone preferredLanguage department queueToken roomNumber callStatus caseStatus clinicalReview.status createdAt caseHistoryUpdatedAt vitals')
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

function toVitalsReading(vitals) {
  return {
    bloodPressure: {
      systolic: vitals.bloodPressure?.systolic ?? null,
      diastolic: vitals.bloodPressure?.diastolic ?? null,
    },
    pulseRate: vitals.pulseRate ?? null,
    spo2: vitals.spo2 ?? null,
    temperature: vitals.temperature ?? null,
    weight: vitals.weight ?? null,
    bmi: vitals.bmi ?? null,
    recordedAt: vitals.recordedAt,
    recordedBy: vitals.recordedBy ?? null,
  };
}

async function getVitalsHistory(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId }).select('patientId vitals vitalsHistory').lean();
  if (!patient) throw new AppError('Patient record not found.', 404);
  let readings = patient.vitalsHistory || [];
  if (!readings.length && patient.vitals?.recordedAt) readings = [toVitalsReading(patient.vitals)];
  readings = readings.slice().sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  await recordAudit(request, { action: 'patient.vitals.history', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ patientId: patient.patientId, readings });
}

async function updatePatientVitals(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const vitalsData = request.validatedBody;
  const previousVitals = patient.vitals?.toObject ? patient.vitals.toObject() : patient.vitals;
  let bmi = null;
  if (vitalsData.weight && vitalsData.height) {
    const heightInMeters = vitalsData.height / 100;
    bmi = Number((vitalsData.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }
  const recordedAt = new Date();
  patient.vitals = {
    ...vitalsData,
    bmi: bmi !== null ? bmi : patient.vitals?.bmi || null,
    recordedAt,
    recordedBy: request.user._id,
  };
  // Keep the earlier reading for legacy records that predate vitals history.
  if (!patient.vitalsHistory.length && previousVitals?.recordedAt) {
    patient.vitalsHistory.push(toVitalsReading(previousVitals));
  }
  patient.vitalsHistory.push(toVitalsReading(patient.vitals));
  if (patient.vitalsHistory.length > Patient.VITALS_HISTORY_LIMIT) {
    patient.vitalsHistory.splice(0, patient.vitalsHistory.length - Patient.VITALS_HISTORY_LIMIT);
  }
  await patient.save();
  await recordAudit(request, { action: 'patient.vitals.update', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ vitals: patient.vitals, vitalsHistory: patient.vitalsHistory });
}

async function updatePatientPrescription(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const { followUpDate, ...rest } = request.validatedBody;
  patient.prescription = {
    ...rest,
    followUpDate: followUpDate ? new Date(`${followUpDate}T00:00:00.000Z`) : null,
    prescribedAt: new Date(),
    prescribedBy: request.user._id,
  };
  await patient.save();
  await recordAudit(request, { action: 'patient.prescription.update', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ prescription: patient.prescription });
}

async function callPatientToken(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const { status = 'called' } = request.body || {};
  patient.callStatus = status;
  await patient.save();
  await recordAudit(request, { action: `patient.call_status.${status}`, resourceType: 'patient', resourceId: patient.patientId });
  response.json({ patientId: patient.patientId, queueToken: patient.queueToken, callStatus: patient.callStatus, roomNumber: patient.roomNumber });
}

async function getLiveQueue(request, response) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const patients = await Patient.find({ createdAt: { $gte: today } })
    .select('patientId fullName department queueToken roomNumber callStatus caseStatus clinicalReview.status createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const nowCalling = patients.filter((p) => p.callStatus === 'called');
  const waiting = patients.filter((p) => p.callStatus === 'waiting' && p.caseStatus !== 'not_started');
  const completed = patients.filter((p) => p.clinicalReview?.status === 'approved' || p.callStatus === 'done');

  response.json({
    date: new Date().toISOString(),
    totalToday: patients.length,
    nowCalling,
    waiting,
    completed,
    patients,
  });
}

module.exports = {
  callPatientToken,
  getConversationReply,
  getLiveQueue,
  getPatient,
  getVitalsHistory,
  listPatients,
  registerPatient,
  saveIntakeProgress,
  searchPatients,
  updateAyurvedaAssessment,
  updateClinicalReview,
  updateIntakeConsent,
  updatePatientPrescription,
  updatePatientVitals,
};
