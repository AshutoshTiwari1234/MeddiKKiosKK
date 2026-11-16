const MedicalDocument = require('../models/MedicalDocument');
const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { requestClinicalSummary } = require('../services/aiService');

const summaryFields = [
  ['Chief complaint', 'chiefComplaint'], ['Onset', 'onset'], ['Duration', 'duration'], ['Location', 'location'],
  ['Character', 'character'], ['Severity (patient reported)', 'severity'], ['Timing', 'timing'],
  ['Aggravating factors', 'aggravatingFactors'], ['Relieving factors', 'relievingFactors'],
  ['Associated symptoms', 'associatedSymptoms'], ['Past medical history', 'pastMedicalHistory'],
  ['Surgical history', 'surgicalHistory'], ['Family history', 'familyHistory'], ['Personal history', 'personalHistory'],
  ['Medication history', 'medicationHistory'], ['Allergies', 'allergies'], ['Review of systems', 'reviewOfSystems'],
];

function section(title, lines) {
  return `${title}\n${lines.length ? lines.join('\n') : 'Not provided'}`;
}

function buildSummary(patient, documents) {
  const reported = patient.caseHistory.toObject();
  const verified = patient.clinicalReview.verifiedHistory.toObject();
  const fields = summaryFields.map(([label, key]) => {
    const value = verified[key] !== '' && verified[key] !== null && verified[key] !== undefined ? verified[key] : reported[key];
    return [label, typeof value === 'string' && value.length > 240 ? `${value.slice(0, 240)}…` : value];
  });
  const historyText = fields.map(([label, value]) => `${label}: ${value === '' || value === null || value === undefined ? 'Not provided' : value}`);
  const documentText = documents.slice(0, 3).map((document) => `${document.category.replaceAll('_', ' ')}\n${document.reviewedText.slice(0, 500)}`).join('\n\n');
  const assessment = patient.ayurvedaAssessment;
  const ayurvedaLines = assessment.assessedAt ? [
    `Prakriti: ${assessment.prakriti}`, `Vikriti: ${assessment.vikriti}`, `Sara: ${(assessment.sara || 'Not documented').slice(0, 200)}`,
    `Samhanana: ${(assessment.samhanana || 'Not documented').slice(0, 200)}`, `Pramana: ${(assessment.pramana || 'Not documented').slice(0, 200)}`,
    `Satmya: ${(assessment.satmya || 'Not documented').slice(0, 200)}`, `Sattva: ${(assessment.sattva || 'Not documented').slice(0, 200)}`,
    `Ahara Shakti: ${(assessment.aharaShakti || 'Not documented').slice(0, 200)}`, `Vyayama Shakti: ${(assessment.vyayamaShakti || 'Not documented').slice(0, 200)}`,
    `Vaya: ${assessment.vaya}`, `Agni: ${assessment.agni}`, `Koshtha: ${assessment.koshtha}`, `Nidana: ${(assessment.nidana || 'Not documented').slice(0, 200)}`,
  ] : [];
  const missing = fields.filter(([, value]) => value === '' || value === null || value === undefined).map(([label]) => label);

  return [
    `MediKiosk structured history draft — ${patient.patientId}`,
    `Patient: ${patient.fullName} | Preferred language: ${patient.preferredLanguage}`,
    section('Presenting history (clinician-verified values take precedence where entered)', historyText),
    section('Allergies and medications', [`Allergies: ${verified.allergies || reported.allergies || 'Not provided'}`, `Medication history: ${verified.medicationHistory || reported.medicationHistory || 'Not provided'}`]),
    section('Reviewed document text (OCR, verified by clinician)', documents.length ? [documentText] : []),
    section('Ayurveda assessment', ayurvedaLines),
    section('Information not provided', missing),
    'Verification: This draft assembles patient-reported history, clinician-entered values, and only clinician-reviewed document text. Verify against source records before clinical use. It contains no diagnosis or treatment recommendation.',
  ].join('\n\n').slice(0, 12000);
}

function retainPreviousVersion(patient, actorId) {
  const summary = patient.clinicalSummary;
  if (!summary.text) return;
  summary.history.push({ status: summary.status === 'approved' ? 'approved' : 'draft', text: summary.text, changedBy: actorId, changedAt: new Date() });
  if (summary.history.length > 20) summary.history.splice(0, summary.history.length - 20);
}

async function generateClinicalSummary(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const documents = await MedicalDocument.find({ patientId: patient.patientId, reviewStatus: 'reviewed' }).sort({ createdAt: 1 }).lean();
  let generated = null;
  if (patient.consent.aiAssistance) {
    const assessment = patient.ayurvedaAssessment.toObject();
    delete assessment.assessedBy;
    delete assessment.assessedAt;
    generated = await requestClinicalSummary({
      language: patient.preferredLanguage === 'hi' ? 'hi' : 'en',
      patientReported: patient.caseHistory.toObject(),
      verifiedHistory: patient.clinicalReview.verifiedHistory.toObject(),
      ayurvedaAssessment: assessment,
      reviewedDocuments: documents.map((document) => ({ category: document.category, text: document.reviewedText.slice(0, 4000) })),
      allowExternalModel: true,
    });
  }
  retainPreviousVersion(patient, request.user._id);
  patient.clinicalSummary.status = 'draft';
  patient.clinicalSummary.text = generated?.text || buildSummary(patient, documents);
  patient.clinicalSummary.generationMode = generated?.mode || 'assembled';
  patient.clinicalSummary.generatedAt = new Date();
  patient.clinicalSummary.generatedBy = request.user._id;
  patient.clinicalSummary.updatedAt = new Date();
  patient.clinicalSummary.updatedBy = request.user._id;
  patient.clinicalSummary.approvedAt = null;
  patient.clinicalSummary.approvedBy = null;
  await patient.save();
  await recordAudit(request, { action: 'patient.summary.generate', resourceType: 'patient', resourceId: patient.patientId });
  response.json({ clinicalSummary: patient.clinicalSummary });
}

async function updateClinicalSummary(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  const { text, status } = request.validatedBody;
  if (status === 'approved' && patient.caseStatus !== 'completed') {
    throw new AppError('Complete patient case-taking before approving the summary.', 409);
  }
  retainPreviousVersion(patient, request.user._id);
  patient.clinicalSummary.text = text;
  patient.clinicalSummary.status = status;
  patient.clinicalSummary.updatedAt = new Date();
  patient.clinicalSummary.updatedBy = request.user._id;
  patient.clinicalSummary.approvedAt = status === 'approved' ? new Date() : null;
  patient.clinicalSummary.approvedBy = status === 'approved' ? request.user._id : null;
  await patient.save();
  await recordAudit(request, { action: `patient.summary.${status}`, resourceType: 'patient', resourceId: patient.patientId });
  response.json({ clinicalSummary: patient.clinicalSummary });
}

module.exports = { generateClinicalSummary, updateClinicalSummary };
