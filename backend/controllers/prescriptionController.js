const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { checkDrugInteractions } = require('../services/interactionService');

async function getPrescription(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId })
    .populate('prescription.prescribedBy', 'name email role')
    .populate('prescription.history.prescribedBy', 'name email role');

  if (!patient) throw new AppError('Patient record not found.', 404);

  response.json({
    prescription: patient.prescription || {
      version: 0,
      medications: [],
      instructions: '',
      warnings: [],
      history: [],
    },
  });
}

async function updatePrescription(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);

  const { medications, instructions } = request.validatedBody;

  // Run automated drug-drug and herb-drug interaction checks
  const warnings = checkDrugInteractions(medications);

  const current = patient.prescription || {};
  const hasExistingMedications = Array.isArray(current.medications) && current.medications.length > 0;

  // Retain previous version in prescription history
  if (hasExistingMedications) {
    if (!Array.isArray(patient.prescription.history)) {
      patient.prescription.history = [];
    }

    patient.prescription.history.push({
      version: current.version || 1,
      medications: current.medications,
      instructions: current.instructions || '',
      warnings: current.warnings || [],
      prescribedBy: current.prescribedBy || request.user._id,
      prescribedAt: current.prescribedAt || current.updatedAt || new Date(),
    });
  }

  const nextVersion = (current.version || 0) + 1;
  patient.prescription.version = nextVersion;
  patient.prescription.medications = medications;
  patient.prescription.instructions = instructions || '';
  patient.prescription.warnings = warnings;
  patient.prescription.prescribedBy = request.user._id;
  patient.prescription.prescribedAt = new Date();
  patient.prescription.updatedAt = new Date();

  await patient.save();

  await recordAudit(request, {
    action: 'patient.prescription.update',
    resourceType: 'patient',
    resourceId: patient.patientId,
    details: {
      version: nextVersion,
      medicationCount: medications.length,
      warningCount: warnings.length,
      criticalWarnings: warnings.filter((w) => w.severity === 'critical').length,
    },
  });

  response.json({
    prescription: patient.prescription,
    warnings,
  });
}

async function getPrescriptionHistory(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId })
    .populate('prescription.history.prescribedBy', 'name email role');

  if (!patient) throw new AppError('Patient record not found.', 404);

  const current = patient.prescription || {};
  response.json({
    patientId: patient.patientId,
    currentVersion: current.version || 0,
    history: current.history || [],
  });
}

async function checkInteractionsHandler(request, response) {
  const { medications } = request.validatedBody;
  const warnings = checkDrugInteractions(medications);

  response.json({
    count: medications.length,
    warnings,
    hasCritical: warnings.some((w) => w.severity === 'critical'),
    hasMajor: warnings.some((w) => w.severity === 'major'),
  });
}

module.exports = {
  checkInteractionsHandler,
  getPrescription,
  getPrescriptionHistory,
  updatePrescription,
};
