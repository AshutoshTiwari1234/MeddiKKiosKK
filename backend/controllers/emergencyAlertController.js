const mongoose = require('mongoose');
const EmergencyAlert = require('../models/EmergencyAlert');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');

async function listEmergencyAlerts(request, response) {
  const { status, severity } = request.query;
  const filter = {};

  if (status === 'all') {
    // Show all statuses
  } else if (status && ['open', 'acknowledged', 'escalated', 'resolved'].includes(status)) {
    filter.status = status;
  } else {
    // Default active alerts requiring staff visibility
    filter.status = { $in: ['open', 'acknowledged', 'escalated'] };
  }

  if (severity && ['critical', 'high', 'moderate'].includes(severity)) {
    filter.severity = severity;
  }

  const alerts = await EmergencyAlert.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: 'patient', select: 'patientId fullName phone gender preferredLanguage' })
    .populate({ path: 'acknowledgedBy', select: 'name email role' })
    .populate({ path: 'escalatedBy', select: 'name email role' })
    .populate({ path: 'resolvedBy', select: 'name email role' })
    .lean();

  await recordAudit(request, {
    action: 'emergency_alert.list',
    resourceType: 'emergency_alert',
    details: { filterStatus: status || 'active', count: alerts.length },
  });

  response.json({ alerts });
}

async function getEmergencyAlert(request, response) {
  if (!mongoose.isValidObjectId(request.params.alertId)) {
    throw new AppError('Emergency alert not found.', 404);
  }

  const alert = await EmergencyAlert.findById(request.params.alertId)
    .populate({ path: 'patient', select: 'patientId fullName phone gender preferredLanguage' })
    .populate({ path: 'acknowledgedBy', select: 'name email role' })
    .populate({ path: 'escalatedBy', select: 'name email role' })
    .populate({ path: 'resolvedBy', select: 'name email role' });

  if (!alert) throw new AppError('Emergency alert not found.', 404);

  await recordAudit(request, {
    action: 'emergency_alert.view',
    resourceType: 'emergency_alert',
    resourceId: alert._id.toString(),
    details: { patientId: alert.patientId, status: alert.status },
  });

  response.json({ alert });
}

async function acknowledgeEmergencyAlert(request, response) {
  if (!mongoose.isValidObjectId(request.params.alertId)) {
    throw new AppError('Emergency alert not found.', 404);
  }

  const alert = await EmergencyAlert.findById(request.params.alertId);
  if (!alert) throw new AppError('Emergency alert not found.', 404);

  if (alert.status === 'resolved') {
    throw new AppError('Cannot acknowledge an alert that has already been resolved.', 409);
  }

  alert.status = 'acknowledged';
  alert.acknowledgedBy = request.user._id;
  alert.acknowledgedAt = new Date();
  if (request.body.note) {
    alert.acknowledgementNote = String(request.body.note).slice(0, 1000);
  }

  await alert.save();

  await recordAudit(request, {
    action: 'emergency_alert.acknowledged',
    resourceType: 'patient',
    resourceId: alert.patientId,
    details: {
      alertId: alert._id.toString(),
      hasNote: Boolean(request.body.note),
    },
  });

  response.json({ alert });
}

async function escalateEmergencyAlert(request, response) {
  if (!mongoose.isValidObjectId(request.params.alertId)) {
    throw new AppError('Emergency alert not found.', 404);
  }

  const alert = await EmergencyAlert.findById(request.params.alertId);
  if (!alert) throw new AppError('Emergency alert not found.', 404);

  if (alert.status === 'resolved') {
    throw new AppError('Cannot escalate an alert that has already been resolved.', 409);
  }

  const { reason, level, severity } = request.body;

  alert.status = 'escalated';
  alert.escalatedBy = request.user._id;
  alert.escalatedAt = new Date();
  alert.escalationReason = reason ? String(reason).slice(0, 2000) : 'Escalated for immediate clinical intervention.';
  if (level && ['rapid_response', 'senior_doctor', 'icu', 'general_medical'].includes(level)) {
    alert.escalationLevel = level;
  }
  if (severity && ['critical', 'high', 'moderate'].includes(severity)) {
    alert.severity = severity;
  } else {
    alert.severity = 'critical'; // Escalation defaults to critical severity
  }

  await alert.save();

  await recordAudit(request, {
    action: 'emergency_alert.escalated',
    resourceType: 'patient',
    resourceId: alert.patientId,
    details: {
      alertId: alert._id.toString(),
      escalationLevel: alert.escalationLevel,
      severity: alert.severity,
      reason: alert.escalationReason,
    },
  });

  response.json({ alert });
}

async function resolveEmergencyAlert(request, response) {
  if (!mongoose.isValidObjectId(request.params.alertId)) {
    throw new AppError('Emergency alert not found.', 404);
  }

  const alert = await EmergencyAlert.findById(request.params.alertId);
  if (!alert) throw new AppError('Emergency alert not found.', 404);

  if (alert.status === 'open') {
    throw new AppError('A staff member must acknowledge or escalate the alert before resolving it.', 409);
  }

  alert.status = 'resolved';
  alert.resolvedBy = request.user._id;
  alert.resolvedAt = new Date();
  if (request.body.resolutionNotes || request.body.notes) {
    alert.resolutionNotes = String(request.body.resolutionNotes || request.body.notes).slice(0, 3000);
  }

  await alert.save();

  await recordAudit(request, {
    action: 'emergency_alert.resolved',
    resourceType: 'patient',
    resourceId: alert.patientId,
    details: {
      alertId: alert._id.toString(),
      resolutionNotes: alert.resolutionNotes,
    },
  });

  response.json({ alert });
}

async function updateEmergencyAlert(request, response) {
  const { status } = request.validatedBody;

  if (status === 'acknowledged') {
    return acknowledgeEmergencyAlert(request, response);
  }

  if (status === 'escalated') {
    return escalateEmergencyAlert(request, response);
  }

  if (status === 'resolved') {
    return resolveEmergencyAlert(request, response);
  }

  throw new AppError('Invalid alert status transition.', 400);
}

module.exports = {
  acknowledgeEmergencyAlert,
  escalateEmergencyAlert,
  getEmergencyAlert,
  listEmergencyAlerts,
  resolveEmergencyAlert,
  updateEmergencyAlert,
};
