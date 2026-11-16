const AuditLog = require('../models/AuditLog');

function recordAudit(request, { actorId = request.user?._id || null, action, resourceType, resourceId = '', outcome = 'success' }) {
  return AuditLog.create({
    actorId,
    action,
    resourceType,
    resourceId: String(resourceId || ''),
    outcome,
    ipAddress: request.ip || '',
    userAgent: String(request.get('user-agent') || '').slice(0, 300),
  });
}

module.exports = { recordAudit };
