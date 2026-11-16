const EmergencyAlert = require('../models/EmergencyAlert');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const mongoose = require('mongoose');

async function listEmergencyAlerts(request, response) {
  const alerts = await EmergencyAlert.find({ status: { $in: ['open', 'acknowledged'] } })
    .sort({ createdAt: -1 }).limit(100)
    .populate({ path: 'patient', select: 'patientId fullName' }).lean();
  await recordAudit(request, { action: 'emergency_alert.list', resourceType: 'emergency_alert' });
  response.json({ alerts });
}

async function updateEmergencyAlert(request, response) {
  if (!mongoose.isValidObjectId(request.params.alertId)) throw new AppError('Emergency alert not found.', 404);
  const alert = await EmergencyAlert.findById(request.params.alertId);
  if (!alert) throw new AppError('Emergency alert not found.', 404);
  if (request.validatedBody.status === 'acknowledged') {
    if (alert.status === 'open') {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = request.user._id;
      alert.acknowledgedAt = new Date();
    }
  } else {
    if (alert.status === 'open') throw new AppError('A staff member must acknowledge the alert before resolving it.', 409);
    alert.status = 'resolved';
    alert.resolvedBy = request.user._id;
    alert.resolvedAt = new Date();
  }
  await alert.save();
  await recordAudit(request, { action: `emergency_alert.${alert.status}`, resourceType: 'patient', resourceId: alert.patientId });
  response.json({ alert });
}

module.exports = { listEmergencyAlerts, updateEmergencyAlert };
