const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAbhaId, normalizeAbhaId, verifyAbha, isAbhaNumber, isAbhaAddress } = require('../services/abhaService');
const { registrationSchema } = require('../schemas/patientSchemas');

test('isAbhaNumber correctly identifies 14-digit numbers with and without hyphens', () => {
  assert.equal(isAbhaNumber('12-3456-7890-1234'), true);
  assert.equal(isAbhaNumber('12345678901234'), true);
  assert.equal(isAbhaNumber('12-3456-7890'), false);
  assert.equal(isAbhaNumber('123456789012345'), false);
  assert.equal(isAbhaNumber('ab-cdef-ghij-klmn'), false);
});

test('normalizeAbhaId standardizes continuous 14-digit numbers into hyphenated ABDM format', () => {
  assert.equal(normalizeAbhaId('12345678901234'), '12-3456-7890-1234');
  assert.equal(normalizeAbhaId('91827364501928'), '91-8273-6450-1928');
  assert.equal(normalizeAbhaId('12-3456-7890-1234'), '12-3456-7890-1234');
});

test('isAbhaAddress identifies valid PHR addresses', () => {
  assert.equal(isAbhaAddress('bhargavi@abdm'), true);
  assert.equal(isAbhaAddress('patient.portal@sbx'), true);
  assert.equal(isAbhaAddress('user_123@ndhm'), true);
  assert.equal(isAbhaAddress('user@gmail.com'), false);
  assert.equal(isAbhaAddress('ab@abdm'), false); // too short
  assert.equal(isAbhaAddress('plainusername'), false);
});

test('validateAbhaId validates and normalizes valid ABHA inputs', () => {
  const numberResult = validateAbhaId('91234567890123');
  assert.equal(numberResult.valid, true);
  assert.equal(numberResult.type, 'ABHA_NUMBER');
  assert.equal(numberResult.normalized, '91-2345-6789-0123');

  const hyphenResult = validateAbhaId('91-2345-6789-0123');
  assert.equal(hyphenResult.valid, true);
  assert.equal(hyphenResult.type, 'ABHA_NUMBER');
  assert.equal(hyphenResult.normalized, '91-2345-6789-0123');

  const addressResult = validateAbhaId('bhargavi@abdm');
  assert.equal(addressResult.valid, true);
  assert.equal(addressResult.type, 'ABHA_ADDRESS');
  assert.equal(addressResult.normalized, 'bhargavi@abdm');
});

test('validateAbhaId rejects invalid or dummy ABHA IDs', () => {
  assert.equal(validateAbhaId('00-0000-0000-0000').valid, false);
  assert.equal(validateAbhaId('11111111111111').valid, false);
  assert.equal(validateAbhaId('12345').valid, false);
  assert.equal(validateAbhaId('invalid-string').valid, false);
  assert.equal(validateAbhaId('').valid, false);
});

test('verifyAbha implements proposed verification logic with ABDM auth modes', async () => {
  const verified = await verifyAbha('91-2345-6789-0123');
  assert.equal(verified.valid, true);
  assert.equal(verified.verified, true);
  assert.equal(verified.type, 'ABHA_NUMBER');
  assert.equal(verified.status, 'active');
  assert.ok(verified.authMethods.includes('AADHAAR_OTP'));
  assert.ok(verified.authMethods.includes('MOBILE_OTP'));
  assert.equal(verified.verificationMethod, 'proposed_abdm_gateway');
  assert.ok(verified.verifiedAt);
});

test('registrationSchema validates ABHA ID and allows optional empty string', () => {
  const validBase = {
    fullName: 'Test Patient',
    preferredLanguage: 'en',
    consent: { caseTaking: true, documentProcessing: false, aiAssistance: false },
  };

  // Optional empty string
  assert.equal(registrationSchema.parse({ ...validBase, abhaId: '' }).abhaId, '');

  // Valid hyphenated ABHA
  assert.equal(registrationSchema.parse({ ...validBase, abhaId: '12-3456-7890-1234' }).abhaId, '12-3456-7890-1234');

  // Valid 14-digit raw ABHA
  assert.equal(registrationSchema.parse({ ...validBase, abhaId: '12345678901234' }).abhaId, '12345678901234');

  // Valid ABHA address
  assert.equal(registrationSchema.parse({ ...validBase, abhaId: 'test@abdm' }).abhaId, 'test@abdm');

  // Rejects invalid format
  assert.throws(() => registrationSchema.parse({ ...validBase, abhaId: 'random-junk-id' }));
  assert.throws(() => registrationSchema.parse({ ...validBase, abhaId: '12345' }));
});
