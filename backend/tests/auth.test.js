const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'phase-two-test-secret-with-at-least-32-characters';

const { changePasswordSchema, createUserSchema, loginSchema } = require('../schemas/authSchemas');
const { caseHistoryPatchSchema, clinicalSummarySchema, conversationSchema, documentReviewSchema, registrationSchema } = require('../schemas/patientSchemas');
const { signSession, verifySession } = require('../utils/auth');

test('login validation normalizes email and rejects unknown fields', () => {
  const valid = loginSchema.parse({ email: '  DOCTOR@Hospital.org ', password: 'example' });
  assert.equal(valid.email, 'doctor@hospital.org');
  assert.throws(() => loginSchema.parse({ email: 'doctor@hospital.org', password: 'example', role: 'administrator' }));
});

test('staff creation requires a long password and a supported role', () => {
  const valid = createUserSchema.parse({ name: 'Asha Sharma', email: 'asha@hospital.org', password: 'a-long-demo-password', role: 'doctor' });
  assert.equal(valid.role, 'doctor');
  assert.equal(valid.department, '');
  assert.throws(() => createUserSchema.parse({ name: 'Asha Sharma', email: 'asha@hospital.org', password: 'short', role: 'patient' }));
});

test('password update validates the new password length', () => {
  assert.throws(() => changePasswordSchema.parse({ currentPassword: 'old', newPassword: 'tiny' }));
  assert.equal(changePasswordSchema.parse({ currentPassword: 'old', newPassword: 'a-new-password-123' }).newPassword, 'a-new-password-123');
});

test('JWT session is tied to a user and session version', () => {
  const token = signSession('507f1f77bcf86cd799439011', 4);
  const payload = verifySession(token);
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.equal(payload.sv, 4);
  assert.throws(() => verifySession(`${token}bad`));
});

test('patient registration requires case-taking consent', () => {
  const input = {
    fullName: 'Demo Patient',
    preferredLanguage: 'hi',
    consent: { caseTaking: true, documentProcessing: false, aiAssistance: false },
  };
  assert.equal(registrationSchema.parse(input).consent.caseTaking, true);
  assert.throws(() => registrationSchema.parse({ ...input, consent: { ...input.consent, caseTaking: false } }));
});

test('case-history patches accept only bounded clinical fields', () => {
  assert.equal(caseHistoryPatchSchema.parse({ chiefComplaint: 'Headache', severity: 7 }).severity, 7);
  assert.throws(() => caseHistoryPatchSchema.parse({ severity: 11 }));
  assert.throws(() => caseHistoryPatchSchema.parse({ diagnosis: 'migraine' }));
});

test('conversation requests allow only supported fields and languages', () => {
  const result = conversationSchema.parse({ field: 'chiefComplaint', answer: 'Headache', language: 'en' });
  assert.equal(result.followUpAnswer, false);
  assert.throws(() => conversationSchema.parse({ field: 'diagnosis', answer: 'Migraine', language: 'en' }));
  assert.throws(() => conversationSchema.parse({ field: 'allergies', answer: 'None', language: 'fr' }));
});

test('document review and clinical summary accept bounded clinician edits', () => {
  assert.equal(documentReviewSchema.parse({ reviewedText: 'Corrected OCR', reviewStatus: 'reviewed' }).reviewNotes, '');
  assert.throws(() => documentReviewSchema.parse({ reviewedText: 'x'.repeat(20001), reviewStatus: 'reviewed' }));
  assert.equal(clinicalSummarySchema.parse({ text: 'Draft summary', status: 'draft' }).text, 'Draft summary');
  assert.throws(() => clinicalSummarySchema.parse({ text: '', status: 'approved' }));
});
