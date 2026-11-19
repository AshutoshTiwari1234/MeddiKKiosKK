const fs = require('node:fs');
const path = require('node:path');
const MedicalDocument = require('../models/MedicalDocument');
const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { removeStoredFile, runOcr, uploadRoot, validateDocumentFile } = require('../services/documentService');

const categories = new Set(['prescription', 'lab_report', 'discharge_summary', 'other']);

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
    const isUnavailable = error.statusCode === 503 || error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(error.message);
    document.ocrStatus = isUnavailable ? 'unavailable' : 'failed';
    document.ocrMessage = String(error.message || 'OCR extraction failed.').slice(0, 500);
  }
  await document.save();
  await recordAudit(request, { action: 'patient.document.upload', resourceType: 'patient', resourceId: document.patientId });
  response.status(201).json({ document: document.toJSON() });
}

async function getPatientDocument(request, response) {
  const document = await MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId });
  if (!document) throw new AppError('Medical document not found.', 404);
  await recordAudit(request, { action: 'patient.document.view', resourceType: 'patient', resourceId: document.patientId });
  response.json({ document });
}

async function downloadPatientDocument(request, response) {
  const document = await MedicalDocument.findOne({ _id: request.params.documentId, patientId: request.params.patientId }).select('+storageName');
  if (!document) throw new AppError('Medical document not found.', 404);
  const storageName = path.basename(document.storageName);
  const filePath = path.join(uploadRoot, storageName);
  await fs.promises.access(filePath).catch(() => { throw new AppError('The stored original document is unavailable.', 404); });
  await recordAudit(request, { action: 'patient.document.download', resourceType: 'patient', resourceId: document.patientId });
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
  Object.assign(document, request.validatedBody, {
    reviewedBy: request.validatedBody.reviewStatus === 'reviewed' ? request.user._id : null,
    reviewedAt: request.validatedBody.reviewStatus === 'reviewed' ? new Date() : null,
  });
  await document.save();
  await recordAudit(request, { action: `patient.document.${document.reviewStatus}`, resourceType: 'patient', resourceId: document.patientId });
  response.json({ document });
}

module.exports = { downloadPatientDocument, getPatientDocument, reviewPatientDocument, uploadPatientDocument };
