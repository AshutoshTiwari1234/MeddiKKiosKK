const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  dates: { type: [String], default: [] },
  measurementLines: { type: [String], default: [] },
}, { _id: false });

const medicalDocumentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  patientId: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: [
      'prescription',
      'lab_report',
      'radiology_report',
      'discharge_summary',
      'diagnostic_report',
      'clinical_notes',
      'immunization_record',
      'ayush_prescription',
      'other',
    ],
    required: true,
    index: true,
  },
  originalName: { type: String, required: true, trim: true, maxlength: 180 },
  storageName: { type: String, required: true, unique: true, select: false },
  mimeType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'], required: true },
  sizeBytes: { type: Number, min: 1, max: 10 * 1024 * 1024, required: true },
  ocrStatus: { type: String, enum: ['pending', 'extracted', 'unavailable', 'failed'], default: 'pending' },
  ocrMessage: { type: String, trim: true, maxlength: 500, default: '' },
  extractedText: { type: String, maxlength: 20_000, default: '' },
  extractionCandidates: { type: candidateSchema, default: () => ({}) },
  reviewedText: { type: String, maxlength: 20_000, default: '' },
  reviewNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  reviewStatus: { type: String, enum: ['pending', 'reviewed'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending_verification', 'verified', 'rejected', 'inconclusive'],
    default: 'unverified',
    index: true,
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  verificationNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  verificationConfidence: { type: String, enum: ['high', 'medium', 'low', 'unspecified'], default: 'unspecified' },
  verifiedData: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true, versionKey: false });

medicalDocumentSchema.index({ patientId: 1, createdAt: -1 });

medicalDocumentSchema.set('toJSON', {
  transform(_document, value) {
    delete value.storageName;
    return value;
  },
});

module.exports = mongoose.model('MedicalDocument', medicalDocumentSchema);
