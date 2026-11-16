const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');

require('../../config/loadEnv');
const baseUri = new URL(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medikiosk_dev');
baseUri.pathname = `/medikiosk_phase2_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.MONGODB_URI = baseUri.toString();
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.FRONTEND_URL = 'http://localhost:5173';

const app = require('../../server');
const User = require('../../models/User');
const MedicalDocument = require('../../models/MedicalDocument');
const { uploadRoot } = require('../../services/documentService');
let server;
let apiUrl;
let administratorCookie;
let receptionistCookie;

before(async () => {
  await mongoose.connect(baseUri.toString());
  await User.create({
    name: 'Integration Administrator',
    email: 'integration-admin@medikiosk.test',
    passwordHash: await bcrypt.hash('integration-admin-password', 4),
    role: 'administrator',
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState === 1) {
    const documents = await MedicalDocument.find().select('+storageName').lean();
    await Promise.all(documents.map((document) => fs.rm(`${uploadRoot}/${document.storageName}`, { force: true })));
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test('staff sessions, role authorization, account provisioning and password invalidation', async () => {
  const unauthenticated = await fetch(`${apiUrl}/api/auth/me`);
  assert.equal(unauthenticated.status, 401);

  const login = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'INTEGRATION-ADMIN@MEDIKIOSK.TEST', password: 'integration-admin-password' }),
  });
  assert.equal(login.status, 200);
  const loggedIn = await login.json();
  assert.equal(loggedIn.user.role, 'administrator');
  assert.equal(Object.hasOwn(loggedIn.user, 'passwordHash'), false);
  administratorCookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);

  const registration = await fetch(`${apiUrl}/api/patients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Integration Patient',
      dateOfBirth: '1990-01-02',
      gender: 'prefer_not_to_say',
      phone: '+91 98765 43210',
      email: '',
      preferredLanguage: 'en',
      emergencyContact: { name: '', relationship: '', phone: '' },
      abhaId: 'demo-abha-id',
      consent: { caseTaking: true, documentProcessing: false, aiAssistance: false },
    }),
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.match(registered.patient.patientId, /^MK-[A-F0-9]{10}$/);
  assert.equal(Object.hasOwn(registered.patient, 'abhaId'), false);
  assert.equal(Object.hasOwn(registered.patient, 'intakeCredentialHash'), false);

  const noAiConsent = await fetch(`${apiUrl}/api/patients/intake/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-intake-token': registered.intakeToken },
    body: JSON.stringify({ field: 'chiefComplaint', answer: 'pain', language: 'en' }),
  });
  assert.equal(noAiConsent.status, 200);
  assert.equal((await noAiConsent.json()).mode, 'guided');

  const noDocumentConsentForm = new FormData();
  noDocumentConsentForm.append('category', 'lab_report');
  const syntheticPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==', 'base64');
  noDocumentConsentForm.append('document', new Blob([syntheticPng], { type: 'image/png' }), 'report.png');
  const noDocumentConsent = await fetch(`${apiUrl}/api/patients/intake/documents`, {
    method: 'POST', headers: { 'x-intake-token': registered.intakeToken }, body: noDocumentConsentForm,
  });
  assert.equal(noDocumentConsent.status, 403);

  const consentedRegistration = await fetch(`${apiUrl}/api/patients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Consented AI Demo Patient',
      preferredLanguage: 'en',
      consent: { caseTaking: true, documentProcessing: true, aiAssistance: true },
    }),
  });
  assert.equal(consentedRegistration.status, 201);
  const consentedIntake = await consentedRegistration.json();
  const aiFollowUp = await fetch(`${apiUrl}/api/patients/intake/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-intake-token': consentedIntake.intakeToken },
    body: JSON.stringify({ field: 'chiefComplaint', answer: 'pain', language: 'en' }),
  });
  assert.equal(aiFollowUp.status, 200);
  assert.ok((await aiFollowUp.json()).followUpQuestion);
  const aiEmergency = await fetch(`${apiUrl}/api/patients/intake/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-intake-token': consentedIntake.intakeToken },
    body: JSON.stringify({ field: 'associatedSymptoms', answer: "I can't breathe", language: 'en' }),
  });
  assert.equal(aiEmergency.status, 200);
  assert.equal((await aiEmergency.json()).urgent, true);

  const documentForm = new FormData();
  documentForm.append('category', 'lab_report');
  documentForm.append('document', new Blob([syntheticPng], { type: 'image/png' }), 'synthetic-lab.png');
  const uploadedDocumentResponse = await fetch(`${apiUrl}/api/patients/intake/documents`, {
    method: 'POST', headers: { 'x-intake-token': consentedIntake.intakeToken }, body: documentForm,
  });
  assert.equal(uploadedDocumentResponse.status, 201);
  const uploadedDocument = (await uploadedDocumentResponse.json()).document;
  assert.equal(uploadedDocument.category, 'lab_report');
  assert.ok(['unavailable', 'extracted'].includes(uploadedDocument.ocrStatus));
  assert.equal(Object.hasOwn(uploadedDocument, 'storageName'), false);
  const completeConsentedIntake = await fetch(`${apiUrl}/api/patients/intake/case-history`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-intake-token': consentedIntake.intakeToken },
    body: JSON.stringify({ chiefComplaint: 'Synthetic test concern', complete: true }),
  });
  assert.equal(completeConsentedIntake.status, 200);

  const saveCase = await fetch(`${apiUrl}/api/patients/intake/case-history`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-intake-token': registered.intakeToken },
    body: JSON.stringify({ chiefComplaint: 'Headache for two days', severity: 5 }),
  });
  assert.equal(saveCase.status, 200);
  assert.equal((await saveCase.json()).status, 'in_progress');

  const patientList = await fetch(`${apiUrl}/api/patients/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: administratorCookie },
    body: JSON.stringify({ q: 'Integration', page: 1, limit: 20 }),
  });
  assert.equal(patientList.status, 200);
  const listedPatients = await patientList.json();
  assert.equal(listedPatients.pagination.total, 1);
  assert.equal(listedPatients.patients[0].clinicalReview.status, 'pending');
  const patientRecord = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}`, { headers: { cookie: administratorCookie } });
  assert.equal(patientRecord.status, 200);
  const record = (await patientRecord.json()).patient;
  assert.equal(record.caseHistory.chiefComplaint, 'Headache for two days');
  assert.equal(record.abhaId, 'demo-abha-id');

  const createStaff = await fetch(`${apiUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: administratorCookie },
    body: JSON.stringify({ name: 'Integration Receptionist', email: 'reception@medikiosk.test', password: 'integration-staff-password', role: 'receptionist', department: 'OPD' }),
  });
  assert.equal(createStaff.status, 201);

  const staffLogin = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'reception@medikiosk.test', password: 'integration-staff-password' }),
  });
  assert.equal(staffLogin.status, 200);
  receptionistCookie = staffLogin.headers.get('set-cookie').split(';')[0];
  const forbidden = await fetch(`${apiUrl}/api/users`, { headers: { cookie: receptionistCookie } });
  assert.equal(forbidden.status, 403);
  const receptionistRecord = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}`, { headers: { cookie: receptionistCookie } });
  assert.equal(receptionistRecord.status, 200);
  const receptionistView = (await receptionistRecord.json()).patient;
  assert.equal(Object.hasOwn(receptionistView, 'caseHistory'), false);
  assert.equal(Object.hasOwn(receptionistView, 'abhaId'), false);
  const receptionistAyurvedaUpdate = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}/ayurveda`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', cookie: receptionistCookie }, body: JSON.stringify({}),
  });
  assert.equal(receptionistAyurvedaUpdate.status, 403);
  const receptionistDocumentAccess = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}/documents/${uploadedDocument._id}`, { headers: { cookie: receptionistCookie } });
  assert.equal(receptionistDocumentAccess.status, 403);

  const completeCase = await fetch(`${apiUrl}/api/patients/intake/case-history`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-intake-token': registered.intakeToken }, body: JSON.stringify({ complete: true }),
  });
  assert.equal(completeCase.status, 200);
  assert.equal((await completeCase.json()).status, 'completed');
  const reusedIntakeToken = await fetch(`${apiUrl}/api/patients/intake/case-history`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-intake-token': registered.intakeToken }, body: JSON.stringify({ onset: 'yesterday' }),
  });
  assert.equal(reusedIntakeToken.status, 401);

  const createDoctor = await fetch(`${apiUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: administratorCookie },
    body: JSON.stringify({ name: 'Integration Doctor', email: 'doctor@medikiosk.test', password: 'integration-doctor-password', role: 'doctor', department: 'OPD' }),
  });
  assert.equal(createDoctor.status, 201);
  const doctorLogin = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@medikiosk.test', password: 'integration-doctor-password' }),
  });
  assert.equal(doctorLogin.status, 200);
  const doctorCookie = doctorLogin.headers.get('set-cookie').split(';')[0];
  const originalDocumentResponse = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}/documents/${uploadedDocument._id}/file`, { headers: { cookie: doctorCookie } });
  assert.equal(originalDocumentResponse.status, 200);
  assert.deepEqual(Buffer.from(await originalDocumentResponse.arrayBuffer()), syntheticPng);
  const reviewDocument = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}/documents/${uploadedDocument._id}/review`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ reviewedText: 'Synthetic lab report: glucose 106 mg/dL', reviewNotes: 'Transcribed for integration test.', reviewStatus: 'reviewed' }),
  });
  assert.equal(reviewDocument.status, 200);
  const generatedSummary = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}/summary/generate`, { method: 'POST', headers: { cookie: doctorCookie } });
  assert.equal(generatedSummary.status, 200);
  const generatedSummaryData = (await generatedSummary.json()).clinicalSummary;
  assert.match(generatedSummaryData.text, /Synthetic lab report: glucose 106 mg\/dL/);
  const approvedSummary = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}/summary`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ text: generatedSummaryData.text, status: 'approved' }),
  });
  assert.equal(approvedSummary.status, 200);
  assert.equal((await approvedSummary.json()).clinicalSummary.status, 'approved');
  const receptionistDocumentPatient = await fetch(`${apiUrl}/api/patients/${consentedIntake.patient.patientId}`, { headers: { cookie: receptionistCookie } });
  assert.equal(receptionistDocumentPatient.status, 200);
  const receptionistDocumentRecord = (await receptionistDocumentPatient.json()).patient;
  assert.equal(Object.hasOwn(receptionistDocumentRecord, 'documents'), false);
  assert.equal(Object.hasOwn(receptionistDocumentRecord, 'clinicalSummary'), false);
  const clinicalReview = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}/clinical-review`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ status: 'approved', doctorNotes: 'Reviewed with the patient.', verifiedHistory: { chiefComplaint: 'Headache, confirmed with patient' } }),
  });
  assert.equal(clinicalReview.status, 200);
  const ayurveda = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}/ayurveda`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({
      prakriti: 'vata_pitta', vikriti: 'vata', sara: 'Documented by clinician', samhanana: '', pramana: '',
      satmya: '', sattva: '', aharaShakti: '', vyayamaShakti: '', vaya: 'madhya', agni: 'vishama',
      koshtha: 'madhyama', nidana: 'Assessment notes for test only',
    }),
  });
  assert.equal(ayurveda.status, 200);
  const reviewedRecordResponse = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}` , { headers: { cookie: doctorCookie } });
  const reviewedRecord = (await reviewedRecordResponse.json()).patient;
  assert.equal(reviewedRecord.caseHistory.chiefComplaint, 'Headache for two days');
  assert.equal(reviewedRecord.clinicalReview.verifiedHistory.chiefComplaint, 'Headache, confirmed with patient');
  assert.equal(reviewedRecord.clinicalReview.status, 'approved');
  assert.equal(reviewedRecord.ayurvedaAssessment.prakriti, 'vata_pitta');
  const reviseReview = await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}/clinical-review`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ status: 'approved', doctorNotes: 'Second review version.', verifiedHistory: { chiefComplaint: 'Updated verified concern' } }),
  });
  assert.equal(reviseReview.status, 200);
  const revisionRecord = (await (await fetch(`${apiUrl}/api/patients/${registered.patient.patientId}`, { headers: { cookie: doctorCookie } })).json()).patient;
  assert.equal(revisionRecord.clinicalReview.history.length, 1);
  assert.equal(revisionRecord.clinicalReview.history[0].doctorNotes, 'Reviewed with the patient.');

  const receptionist = await User.findOne({ email: 'reception@medikiosk.test' });
  const deactivate = await fetch(`${apiUrl}/api/users/${receptionist.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: administratorCookie },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactivate.status, 200);
  const expiredStaffSession = await fetch(`${apiUrl}/api/auth/me`, { headers: { cookie: receptionistCookie } });
  assert.equal(expiredStaffSession.status, 401);

  const changePassword = await fetch(`${apiUrl}/api/auth/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: administratorCookie },
    body: JSON.stringify({ currentPassword: 'integration-admin-password', newPassword: 'integration-admin-new-password' }),
  });
  assert.equal(changePassword.status, 200);
  const oldAdminSession = await fetch(`${apiUrl}/api/auth/me`, { headers: { cookie: administratorCookie } });
  assert.equal(oldAdminSession.status, 401);
  administratorCookie = changePassword.headers.get('set-cookie').split(';')[0];
  const newAdminSession = await fetch(`${apiUrl}/api/auth/me`, { headers: { cookie: administratorCookie } });
  assert.equal(newAdminSession.status, 200);

  const logout = await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: administratorCookie } });
  assert.equal(logout.status, 204);
});
