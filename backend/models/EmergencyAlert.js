const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  patientId: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'acknowledged', 'escalated', 'resolved'], default: 'open', index: true },
  severity: { type: String, enum: ['critical', 'high', 'moderate'], default: 'high', index: true },
  source: { type: String, enum: ['intake_phrase', 'clinician_override', 'vital_signs'], default: 'intake_phrase' },
  createdAt: { type: Date, default: Date.now, immutable: true },

  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  acknowledgementNote: { type: String, trim: true, maxlength: 1000, default: '' },

  escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  escalatedAt: { type: Date, default: null },
  escalationReason: { type: String, trim: true, maxlength: 2000, default: '' },
  escalationLevel: { type: String, enum: ['rapid_response', 'senior_doctor', 'icu', 'general_medical'], default: 'senior_doctor' },

  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNotes: { type: String, trim: true, maxlength: 3000, default: '' },
}, { timestamps: true, versionKey: false });

emergencyAlertSchema.index({ status: 1, createdAt: -1 });
emergencyAlertSchema.index({ severity: 1, status: 1 });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
