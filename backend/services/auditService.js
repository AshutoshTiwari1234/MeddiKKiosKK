const AuditLog = require('../models/AuditLog');

function recordAudit(request, {
  actorId = request?.user?._id || null,
  actorName = request?.user?.name || '',
  actorRole = request?.user?.role || '',
  action,
  resourceType,
  resourceId = '',
  outcome = 'success',
  details = null,
}) {
  return AuditLog.create({
    actorId,
    actorName: String(actorName || '').slice(0, 120),
    actorRole: String(actorRole || '').slice(0, 40),
    action,
    resourceType,
    resourceId: String(resourceId || ''),
    outcome,
    details: details ? (typeof details === 'object' ? details : { info: details }) : null,
    ipAddress: request?.ip || '',
    userAgent: String(request?.get ? request.get('user-agent') || '' : '').slice(0, 300),
  });
}

module.exports = { recordAudit };
