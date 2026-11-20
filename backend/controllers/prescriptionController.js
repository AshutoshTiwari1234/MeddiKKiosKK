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

  const input = request.validatedBody;
  const { medications } = input;
  const warnings = checkDrugInteractions(medications);
  const now = new Date();
  patient.prescription ??= {};
  const prescription = patient.prescription;
  const storedVersion = prescription.version;
  // Prescriptions saved by the original builder have a timestamp and no version.
  const previousVersion = storedVersion || (prescription.prescribedAt || prescription.medications?.length ? 1 : 0);
  if (previousVersion) {
    const { history, updatedAt, ...previous } = prescription.toObject();
    prescription.history ??= [];
    prescription.history.push({
      ...previous,
      version: previousVersion,
      prescribedAt: previous.prescribedAt || updatedAt || null,
    });
  }

  for (const field of ['instructions', 'investigations', 'generalAdvice']) {
    if (Object.hasOwn(input, field)) prescription[field] = input[field];
  }
  for (const field of ['pathya', 'apathya']) {
    if (Object.hasOwn(input.ayushAdvice ?? {}, field)) {
      prescription.set(`ayushAdvice.${field}`, input.ayushAdvice[field]);
    }
  }
  if (Object.hasOwn(input, 'followUpDate')) {
    prescription.followUpDate = input.followUpDate ? new Date(`${input.followUpDate}T00:00:00.000Z`) : null;
  }

  const nextVersion = previousVersion + 1;
  prescription.version = nextVersion;
  prescription.medications = medications;
  prescription.warnings = warnings;
  prescription.prescribedBy = request.user._id;
  prescription.prescribedAt = now;
  prescription.updatedAt = now;

  // Match the version we read so concurrent saves cannot append the same revision.
  patient.$where = { 'prescription.version': storedVersion || { $in: [0, null] } };
  try {
    await patient.save();
  } catch (error) {
    if (error.name === 'DocumentNotFoundError') {
      throw new AppError('This prescription changed while you were editing. Reload the patient record before saving again.', 409);
    }
    throw error;
  }

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
