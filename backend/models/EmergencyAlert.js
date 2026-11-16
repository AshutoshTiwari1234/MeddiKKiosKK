const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  patientId: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
  source: { type: String, enum: ['intake_phrase'], default: 'intake_phrase' },
  createdAt: { type: Date, default: Date.now, immutable: true },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

emergencyAlertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
