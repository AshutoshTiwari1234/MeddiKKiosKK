const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const MedicalDocument = require('../models/MedicalDocument');
const {
  documentCategoryEnum,
  documentCategoryUpdateSchema,
  documentReviewSchema,
  documentVerificationSchema,
} = require('../schemas/patientSchemas');

test('MedicalDocument model accepts all valid medical document categories', () => {
  const supportedCategories = [
    'prescription',
    'lab_report',
    'radiology_report',
    'discharge_summary',
    'diagnostic_report',
    'clinical_notes',
    'immunization_record',
    'ayush_prescription',
    'other',
  ];

  for (const category of supportedCategories) {
    const doc = new MedicalDocument({
      patient: new mongoose.Types.ObjectId(),
      patientId: 'MK-20261119-0001',
      category,
      originalName: `test-${category}.pdf`,
      storageName: `uuid-${category}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    assert.equal(doc.category, category);
    assert.equal(doc.verificationStatus, 'unverified');
  }
});

test('MedicalDocument model rejects unsupported document categories', () => {
  const invalidDoc = new MedicalDocument({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-0001',
    category: 'unsupported_category',
    originalName: 'test.pdf',
    storageName: 'uuid.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });

  const error = invalidDoc.validateSync();
  assert.ok(error.errors.category);
});

test('MedicalDocument model tracks verification status and clinician metadata', () => {
  const doctorId = new mongoose.Types.ObjectId();
  const doc = new MedicalDocument({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-0002',
    category: 'lab_report',
    originalName: 'cbc-blood-test.pdf',
    storageName: 'cbc-uuid.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    verificationStatus: 'verified',
    verifiedBy: doctorId,
    verifiedAt: new Date(),
    verificationNotes: 'Report values match clinical observations. Hemoglobin: 13.8 g/dL.',
    verificationConfidence: 'high',
    verifiedData: { testName: 'Complete Blood Count', hb: 13.8 },
  });

  assert.equal(doc.verificationStatus, 'verified');
  assert.equal(doc.verifiedBy.toString(), doctorId.toString());
  assert.ok(doc.verifiedAt instanceof Date);
  assert.equal(doc.verificationConfidence, 'high');
  assert.equal(doc.verifiedData.hb, 13.8);
});

test('documentVerificationSchema validates verification requests', () => {
  const valid = documentVerificationSchema.parse({
    verificationStatus: 'verified',
    category: 'prescription',
    verificationNotes: 'Signed by registered medical practitioner Dr. Bhargavi.',
    verificationConfidence: 'high',
    verifiedData: { doctorName: 'Dr. Bhargavi', regNumber: '12345' },
  });

  assert.equal(valid.verificationStatus, 'verified');
  assert.equal(valid.category, 'prescription');
  assert.equal(valid.verificationConfidence, 'high');

  // Rejects invalid status
  assert.throws(() => documentVerificationSchema.parse({ verificationStatus: 'unknown' }));
});

test('documentCategoryUpdateSchema validates category modifications', () => {
  assert.equal(documentCategoryUpdateSchema.parse({ category: 'lab_report' }).category, 'lab_report');
  assert.equal(documentCategoryUpdateSchema.parse({ category: 'ayush_prescription' }).category, 'ayush_prescription');
  assert.throws(() => documentCategoryUpdateSchema.parse({ category: 'invalid_category' }));
});

test('documentReviewSchema accepts review text and optional verification status', () => {
  const review = documentReviewSchema.parse({
    reviewedText: 'Verified OCR text: Glucose Fasting 98 mg/dL',
    reviewNotes: 'Normal range confirmed.',
    reviewStatus: 'reviewed',
    verificationStatus: 'verified',
    category: 'lab_report',
  });

  assert.equal(review.reviewStatus, 'reviewed');
  assert.equal(review.verificationStatus, 'verified');
  assert.equal(review.category, 'lab_report');
});
