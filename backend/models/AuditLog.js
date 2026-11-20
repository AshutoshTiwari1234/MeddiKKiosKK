const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorName: { type: String, default: '', maxlength: 120 },
  actorRole: { type: String, default: '', maxlength: 40, index: true },
  action: { type: String, required: true, maxlength: 80, index: true },
  resourceType: { type: String, required: true, maxlength: 60, index: true },
  resourceId: { type: String, default: '', maxlength: 80, index: true },
  outcome: { type: String, enum: ['success', 'denied'], default: 'success' },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: '', maxlength: 64 },
  userAgent: { type: String, default: '', maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
