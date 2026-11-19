const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const EmergencyAlert = require('../models/EmergencyAlert');

test('EmergencyAlert model validates status enum including escalated', () => {
  const alert = new EmergencyAlert({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-9999',
    status: 'escalated',
    severity: 'critical',
    escalationReason: 'Patient unresponsive with severe respiratory distress',
    escalationLevel: 'rapid_response',
  });

  assert.equal(alert.status, 'escalated');
  assert.equal(alert.severity, 'critical');
  assert.equal(alert.escalationLevel, 'rapid_response');
  assert.ok(alert.escalationReason.includes('respiratory distress'));
});

test('EmergencyAlert model rejects unsupported status', () => {
  const alert = new EmergencyAlert({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-9999',
    status: 'closed', // not in enum
  });

  const error = alert.validateSync();
  assert.ok(error.errors.status);
});

test('EmergencyAlert tracks acknowledgement metadata', () => {
  const userId = new mongoose.Types.ObjectId();
  const alert = new EmergencyAlert({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-1111',
    status: 'acknowledged',
    acknowledgedBy: userId,
    acknowledgedAt: new Date(),
    acknowledgementNote: 'Nurse dispatched to triage bay.',
  });

  assert.equal(alert.status, 'acknowledged');
  assert.equal(alert.acknowledgedBy.toString(), userId.toString());
  assert.ok(alert.acknowledgedAt instanceof Date);
  assert.equal(alert.acknowledgementNote, 'Nurse dispatched to triage bay.');
});

test('EmergencyAlert tracks escalation and resolution metadata', () => {
  const doctorId = new mongoose.Types.ObjectId();
  const alert = new EmergencyAlert({
    patient: new mongoose.Types.ObjectId(),
    patientId: 'MK-20261119-2222',
    status: 'resolved',
    resolvedBy: doctorId,
    resolvedAt: new Date(),
    resolutionNotes: 'Patient stabilized, oxygen administered, transferred to observation ward.',
  });

  assert.equal(alert.status, 'resolved');
  assert.equal(alert.resolvedBy.toString(), doctorId.toString());
  assert.ok(alert.resolvedAt instanceof Date);
  assert.ok(alert.resolutionNotes.includes('stabilized'));
});
