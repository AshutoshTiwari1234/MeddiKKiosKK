const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, maxlength: 80 },
  resourceType: { type: String, required: true, maxlength: 60 },
  resourceId: { type: String, default: '', maxlength: 80 },
  outcome: { type: String, enum: ['success', 'denied'], default: 'success' },
  ipAddress: { type: String, default: '', maxlength: 64 },
  userAgent: { type: String, default: '', maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

auditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);
