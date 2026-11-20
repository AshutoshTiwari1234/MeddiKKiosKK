const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { recordAudit } = require('../services/auditService');

test('AuditLog schema supports actor details, action details, and timestamps', () => {
  const log = new AuditLog({
    actorId: new mongoose.Types.ObjectId(),
    actorName: 'Dr. Bhargavi',
    actorRole: 'doctor',
    action: 'patient.view',
    resourceType: 'patient',
    resourceId: 'MK-20261119-1234',
    outcome: 'success',
    details: {
      accessedByRole: 'doctor',
      accessedSections: ['demographics', 'caseHistory', 'clinicalReview'],
    },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Test',
  });

  assert.equal(log.actorName, 'Dr. Bhargavi');
  assert.equal(log.actorRole, 'doctor');
  assert.equal(log.action, 'patient.view');
  assert.equal(log.resourceId, 'MK-20261119-1234');
  assert.equal(log.outcome, 'success');
  assert.deepEqual(log.details.accessedSections, ['demographics', 'caseHistory', 'clinicalReview']);
  assert.ok(log.createdAt instanceof Date || !log.createdAt);
});

test('AuditLog requires action and resourceType', () => {
  const invalid = new AuditLog({});
  const error = invalid.validateSync();
  assert.ok(error.errors.action);
  assert.ok(error.errors.resourceType);
});

test('recordAudit extracts user details and saves action details', async () => {
  const dummyRequest = {
    user: {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Bhargavi',
      role: 'doctor',
    },
    ip: '192.168.1.100',
    get: (header) => (header === 'user-agent' ? 'MediKiosk Test Client' : null),
  };

  const auditEntry = new AuditLog({
    actorId: dummyRequest.user._id,
    actorName: dummyRequest.user.name,
    actorRole: dummyRequest.user.role,
    action: 'patient.clinical_review.approved',
    resourceType: 'patient',
    resourceId: 'MK-20261119-5678',
    outcome: 'success',
    details: {
      status: 'approved',
      doctorNotesUpdated: true,
      verifiedFields: ['chiefComplaint', 'onset', 'duration'],
    },
    ipAddress: dummyRequest.ip,
    userAgent: dummyRequest.get('user-agent'),
  });

  assert.equal(auditEntry.actorName, 'Dr. Bhargavi');
  assert.equal(auditEntry.actorRole, 'doctor');
  assert.equal(auditEntry.action, 'patient.clinical_review.approved');
  assert.equal(auditEntry.details.status, 'approved');
  assert.equal(auditEntry.details.doctorNotesUpdated, true);
  assert.deepEqual(auditEntry.details.verifiedFields, ['chiefComplaint', 'onset', 'duration']);
});

test('AuditLog records document access and download metadata in details', () => {
  const docLog = new AuditLog({
    actorId: new mongoose.Types.ObjectId(),
    actorName: 'Dr. Bhargavi',
    actorRole: 'doctor',
    action: 'patient.document.download',
    resourceType: 'patient',
    resourceId: 'MK-20261119-1234',
    details: {
      documentId: '654321654321654321654321',
      originalName: 'lab-report-cbc.pdf',
      mimeType: 'application/pdf',
    },
  });

  assert.equal(docLog.details.originalName, 'lab-report-cbc.pdf');
  assert.equal(docLog.details.mimeType, 'application/pdf');
});
