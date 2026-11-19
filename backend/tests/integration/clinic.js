const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

require('../../config/loadEnv');
const baseUri = new URL(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medikiosk_dev');
baseUri.pathname = `/medikiosk_clinic_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.MONGODB_URI = baseUri.toString();
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.FRONTEND_URL = 'http://localhost:5173';

const app = require('../../server');
const User = require('../../models/User');
const Patient = require('../../models/Patient');
const { formatLocalDate } = require('../../utils/dateRange');

let server;
let apiUrl;
const cookies = {};
const staff = {};

async function login(email, password) {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function call(role, method, path, body) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies[role] },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  await mongoose.connect(baseUri.toString());
  const passwordHash = await bcrypt.hash('integration-password', 4);
  const accounts = [
    ['administrator', 'clinic-admin@medikiosk.test', 'Clinic Administrator', ''],
    ['doctor', 'clinic-doctor@medikiosk.test', 'Dr. Meera Rao', 'General Medicine'],
    ['doctor2', 'clinic-doctor2@medikiosk.test', 'Dr. Arjun Das', 'Cardiology'],
    ['receptionist', 'clinic-reception@medikiosk.test', 'Front Desk', ''],
  ];
  for (const [key, email, name, department] of accounts) {
    staff[key] = await User.create({ name, email, passwordHash, role: key.replace(/\d+$/, ''), department });
  }
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  apiUrl = `http://127.0.0.1:${server.address().port}`;
  for (const [key, email] of accounts) cookies[key] = await login(email, 'integration-password');
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('vitals history keeps every reading in order', async () => {
  const patient = await Patient.create({ fullName: 'Vitals Patient', consent: { caseTaking: true } });
  const first = await call('receptionist', 'PATCH', `/patients/${patient.patientId}/vitals`, { bloodPressure: { systolic: 150, diastolic: 95 }, pulseRate: 96, spo2: 94 });
  assert.equal(first.status, 200);
  const second = await call('receptionist', 'PATCH', `/patients/${patient.patientId}/vitals`, { bloodPressure: { systolic: 132, diastolic: 84 }, pulseRate: 82, spo2: 97 });
  assert.equal(second.status, 200);

  const history = await call('doctor', 'GET', `/patients/${patient.patientId}/vitals/history`);
  assert.equal(history.status, 200);
  assert.equal(history.body.readings.length, 2);
  assert.deepEqual(history.body.readings.map((reading) => reading.bloodPressure.systolic), [150, 132]);
  assert.deepEqual(history.body.readings.map((reading) => reading.spo2), [94, 97]);

  const missing = await call('doctor', 'GET', '/patients/MK-0000000000/vitals/history');
  assert.equal(missing.status, 404);
});

test('calling a patient validates the status and records queue timestamps', async () => {
  const patient = await Patient.create({ fullName: 'Queue Patient', consent: { caseTaking: true } });
  const invalid = await call('receptionist', 'POST', `/patients/${patient.patientId}/call`, { status: 'teleported' });
  assert.equal(invalid.status, 400);

  const called = await call('receptionist', 'POST', `/patients/${patient.patientId}/call`);
  assert.equal(called.status, 200);
  assert.equal(called.body.callStatus, 'called');
  await call('doctor', 'POST', `/patients/${patient.patientId}/call`, { status: 'in_consultation' });
  await call('doctor', 'POST', `/patients/${patient.patientId}/call`, { status: 'done' });

  const stored = await Patient.findById(patient._id).lean();
  assert.ok(stored.calledAt);
  assert.ok(stored.consultationStartedAt >= stored.calledAt);
  assert.ok(stored.consultationEndedAt >= stored.consultationStartedAt);
});

test('OPD analytics reports totals, waiting time and department statistics', async () => {
  await Patient.deleteMany({});
  const now = Date.now();
  const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000);
  const base = { consent: { caseTaking: true } };
  await Patient.collection.insertMany([
    // General Medicine: waits of 20 and 40 minutes, one still waiting.
    { ...base, patientId: 'MK-A000000001', fullName: 'GM One', department: 'General Medicine', callStatus: 'done', caseStatus: 'completed', createdAt: minutesAgo(90), calledAt: minutesAgo(70), consultationStartedAt: minutesAgo(70), consultationEndedAt: minutesAgo(60) },
    { ...base, patientId: 'MK-A000000002', fullName: 'GM Two', department: 'General Medicine', callStatus: 'in_consultation', caseStatus: 'completed', createdAt: minutesAgo(60), calledAt: minutesAgo(20), consultationStartedAt: minutesAgo(20) },
    { ...base, patientId: 'MK-A000000003', fullName: 'GM Three', department: 'General Medicine', callStatus: 'waiting', caseStatus: 'in_progress', createdAt: minutesAgo(10) },
    // Cardiology: one wait of 30 minutes.
    { ...base, patientId: 'MK-A000000004', fullName: 'Card One', department: 'Cardiology', callStatus: 'called', caseStatus: 'completed', createdAt: minutesAgo(45), calledAt: minutesAgo(15) },
    // Yesterday: excluded from today's range.
    { ...base, patientId: 'MK-A000000005', fullName: 'Old Visit', department: 'Cardiology', callStatus: 'done', createdAt: new Date(now - 26 * 60 * 60 * 1000), calledAt: new Date(now - 25 * 60 * 60 * 1000) },
  ]);
  // Guard against the test running just after midnight, when "minutes ago" rows fall on yesterday.
  const today = formatLocalDate(new Date(now));
  const earliest = formatLocalDate(minutesAgo(90));

  const response = await call('receptionist', 'GET', `/analytics/opd?from=${earliest}&to=${today}`);
  assert.equal(response.status, 200);
  const { overview, departments } = response.body;
  assert.equal(overview.totalPatients, 4);
  assert.equal(overview.patientsCalled, 3);
  assert.equal(overview.averageWaitMinutes, 30);
  assert.equal(overview.maxWaitMinutes, 40);
  assert.equal(overview.averageConsultationMinutes, 10);
  assert.deepEqual(overview.byStatus, { waiting: 1, called: 1, in_consultation: 1, done: 1 });

  assert.deepEqual(departments.map((row) => row.department), ['General Medicine', 'Cardiology']);
  const general = departments[0];
  assert.equal(general.totalPatients, 3);
  assert.equal(general.sharePercent, 75);
  assert.equal(general.averageWaitMinutes, 30);
  assert.equal(departments[1].averageWaitMinutes, 30);

  const filtered = await call('doctor', 'GET', `/analytics/opd?from=${earliest}&to=${today}&department=Cardiology`);
  assert.equal(filtered.body.overview.totalPatients, 1);

  const badRange = await call('doctor', 'GET', '/analytics/opd?from=2026-02-10&to=2026-02-01');
  assert.equal(badRange.status, 400);
  const badDate = await call('doctor', 'GET', '/analytics/opd?from=2026-02-30');
  assert.equal(badDate.status, 400);

  const unauthenticated = await fetch(`${apiUrl}/api/analytics/opd`);
  assert.equal(unauthenticated.status, 401);
});
