const fs = require('node:fs');
const path = require('node:path');
const MedicalDocument = require('../models/MedicalDocument');
const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { removeStoredFile, runOcr, uploadRoot, validateDocumentFile } = require('../services/documentService');

const categories = new Set([
  'prescription',
  'lab_report',
  'radiology_report',
  'discharge_summary',
  'diagnostic_report',
  'clinical_notes',
  'immunization_record',
  'ayush_prescription',
  'other',
]);

async function uploadPatientDocument(request, response) {
  const { file } = request;
  if (!file) throw new AppError('Choose a document to upload.', 400);
  if (!categories.has(request.body.category)) {
    await removeStoredFile(file.filename);
    throw new AppError('Choose a supported document category.', 400);
  }
  if (!(await validateDocumentFile(file))) {
    await removeStoredFile(file.filename);
    throw new AppError('The file content does not match its selected document type.', 415);
  }

  const originalName = path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'medical-document';
  let document;
  try {
    document = await MedicalDocument.create({
      patient: request.documentPatient._id,
      patientId: request.documentPatient.patientId,
      category: request.body.category,
      originalName,
      storageName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      ocrStatus: 'pending',
      verificationStatus: 'unverified',
    });
  } catch (error) {
    await removeStoredFile(file.filename);
    throw error;
  }

  try {
    const result = await runOcr(file.path, file.mimetype, request.documentPatient.preferredLanguage);
    document.ocrStatus = 'extracted';
    document.extractedText = result.text;
    document.extractionCandidates = result.candidates || {};
  } catch (error) {
    document.ocrStatus = error.statusCode === 503 ? 'unavailable' : 'failed';
    document.ocrMessage = String(error.message || 'OCR extraction failed.').slice(0, 500);
  }
  await document.save();
  await recordAudit(request, {
    action: 'patient.document.upload',
    resourceType: 'patient',
    resourceId: document.patientId,
    details: { documentId: document._id.toString(), category: document.category, mimeType: document.mimeType },
  });
  response.status(201).json({ document: document.toJSON() });
}

async function getPatientDocument(request, response) {
  const document = await MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId })
    .populate('verifiedBy', 'name email role')
    .populate('reviewedBy', 'name email role');

  if (!document) throw new AppError('Medical document not found.', 404);
  await recordAudit(request, {
    action: 'patient.document.view',
    resourceType: 'patient',
    resourceId: document.patientId,
    details: { documentId: document._id.toString(), category: document.category, mimeType: document.mimeType, verificationStatus: document.verificationStatus },
  });
  response.json({ document });
}

async function downloadPatientDocument(request, response) {
  const document = await MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId }).select('+storageName');
  if (!document) throw new AppError('Medical document not found.', 404);
  const storageName = path.basename(document.storageName);
  const filePath = path.join(uploadRoot, storageName);
  await fs.promises.access(filePath).catch(() => { throw new AppError('The stored original document is unavailable.', 404); });
  await recordAudit(request, {
    action: 'patient.document.download',
    resourceType: 'patient',
    resourceId: document.patientId,
    details: { documentId: document._id.toString(), originalName: document.originalName, mimeType: document.mimeType },
  });
  response.setHeader('Content-Type', document.mimeType);
  response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(response);
}

async function reviewPatientDocument(request, response) {
  const [patient, document] = await Promise.all([
    Patient.findOne({ patientId: request.params.patientId }),
    MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId }),
  ]);
  if (!patient || !document) throw new AppError('Medical document not found.', 404);

  const { reviewedText, reviewNotes, reviewStatus, verificationStatus, category, verificationNotes } = request.validatedBody;

  if (reviewedText !== undefined) document.reviewedText = reviewedText;
  if (reviewNotes !== undefined) document.reviewNotes = reviewNotes;
  if (reviewStatus) {
    document.reviewStatus = reviewStatus;
    document.reviewedBy = reviewStatus === 'reviewed' ? request.user._id : null;
    document.reviewedAt = reviewStatus === 'reviewed' ? new Date() : null;
  }
  if (category) document.category = category;
  if (verificationStatus) {
    document.verificationStatus = verificationStatus;
    if (['verified', 'rejected', 'inconclusive'].includes(verificationStatus)) {
      document.verifiedBy = request.user._id;
      document.verifiedAt = new Date();
    }
  }
  if (verificationNotes !== undefined) document.verificationNotes = verificationNotes;

  await document.save();
  await recordAudit(request, {
    action: `patient.document.${document.reviewStatus}`,
    resourceType: 'patient',
    resourceId: document.patientId,
    details: {
      documentId: document._id.toString(),
      reviewStatus: document.reviewStatus,
      verificationStatus: document.verificationStatus,
      category: document.category,
      notesUpdated: Boolean(reviewNotes || verificationNotes),
    },
  });
  response.json({ document });
}

async function verifyPatientDocument(request, response) {
  const [patient, document] = await Promise.all([
    Patient.findOne({ patientId: request.params.patientId }),
    MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId }),
  ]);
  if (!patient || !document) throw new AppError('Medical document not found.', 404);

  const { verificationStatus, category, verificationNotes, verificationConfidence, verifiedData } = request.validatedBody;

  const previousStatus = document.verificationStatus;
  document.verificationStatus = verificationStatus;
  document.verificationNotes = verificationNotes || '';
  document.verificationConfidence = verificationConfidence || 'unspecified';
  if (verifiedData !== undefined) document.verifiedData = verifiedData;
  if (category) document.category = category;

  if (['verified', 'rejected', 'inconclusive'].includes(verificationStatus)) {
    document.verifiedBy = request.user._id;
    document.verifiedAt = new Date();
    // Auto-complete review status upon clinician verification
    document.reviewStatus = 'reviewed';
    document.reviewedBy = request.user._id;
    document.reviewedAt = new Date();
  }

  await document.save();

  await recordAudit(request, {
    action: `patient.document.verify.${verificationStatus}`,
    resourceType: 'patient',
    resourceId: document.patientId,
    details: {
      documentId: document._id.toString(),
      category: document.category,
      previousStatus,
      verificationStatus,
      confidence: document.verificationConfidence,
      notesRecorded: Boolean(verificationNotes),
    },
  });

  const populated = await MedicalDocument.findById(document._id)
    .populate('verifiedBy', 'name email role')
    .populate('reviewedBy', 'name email role');

  response.json({ document: populated });
}

async function categorizePatientDocument(request, response) {
  const [patient, document] = await Promise.all([
    Patient.findOne({ patientId: request.params.patientId }),
    MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId }),
  ]);
  if (!patient || !document) throw new AppError('Medical document not found.', 404);

  const previousCategory = document.category;
  document.category = request.validatedBody.category;
  await document.save();

  await recordAudit(request, {
    action: 'patient.document.categorize',
    resourceType: 'patient',
    resourceId: document.patientId,
    details: {
      documentId: document._id.toString(),
      previousCategory,
      newCategory: document.category,
    },
  });

  response.json({ document });
}

module.exports = {
  categorizePatientDocument,
  downloadPatientDocument,
  getPatientDocument,
  reviewPatientDocument,
  uploadPatientDocument,
  verifyPatientDocument,
};
