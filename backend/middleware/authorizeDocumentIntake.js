const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');

async function authorizeDocumentIntake(request, _response, next) {
  try {
    const patient = await Patient.findOne({
      intakeCredentialHash: request.intakeCredentialHash,
      intakeExpiresAt: { $gt: new Date() },
      'consent.caseTaking': true,
      'consent.documentProcessing': true,
      caseStatus: { $ne: 'completed' },
    }).select('+intakeCredentialHash +intakeExpiresAt');
    if (!patient) throw new AppError('Document upload needs active check-in and document-processing consent.', 403);
    request.documentPatient = patient;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authorizeDocumentIntake;
