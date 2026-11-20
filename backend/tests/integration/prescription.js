const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const mongoose = require('mongoose');

const app = require('../../server');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const { COOKIE_NAME, signSession } = require('../../utils/auth');

const database = 'medikiosk_rx_test_' + randomUUID().replaceAll('-', '');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
process.env.JWT_SECRET = randomBytes(48).toString('hex');

let server;
let apiUrl;
let doctorCookie;
let receptionistCookie;

async function request(route, { method = 'GET', body, cookie = doctorCookie, expected = 200 } = {}) {
  const response = await fetch(apiUrl + route, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}

const save = (route, body, expected = 200) => request(route, { method: 'PUT', body, expected });

before(async () => {
  await mongoose.connect(mongoUri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  const [doctor, receptionist] = await User.create([
    { name: 'Test Doctor', email: 'rx-doctor@medikiosk.test', role: 'doctor', passwordHash: 'unused-test-hash' },
    { name: 'Test Receptionist', email: 'rx-reception@medikiosk.test', role: 'receptionist', passwordHash: 'unused-test-hash' },
  ]);
  doctorCookie = COOKIE_NAME + '=' + signSession(doctor._id);
  receptionistCookie = COOKIE_NAME + '=' + signSession(receptionist._id);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  apiUrl = 'http://127.0.0.1:' + server.address().port + '/api';
});

after(async () => {
  try {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
});

test('prescription updates retain treatment-plan fields, accurate versions, and interaction warnings', async () => {
  const patient = await Patient.create({ fullName: 'Prescription Compatibility Fixture' });
  const route = '/patients/' + patient.patientId + '/prescription';
  const initial = {
    medications: [{ name: 'Aspirin', form: 'Tablet' }, { name: 'Warfarin', form: 'Capsule' }],
    instructions: 'Existing API instructions',
    investigations: ['Initial investigation'],
    ayushAdvice: { pathya: 'Original Pathya', apathya: 'Original Apathya' },
    generalAdvice: 'Original advice',
    followUpDate: '2027-01-20',
  };

  await request(route, { method: 'PUT', body: initial, cookie: receptionistCookie, expected: 403 });
  await save(route, { medications: [] }, 400);
  await save(route, { medications: [{ name: '' }], generalAdvice: 'Fixture' }, 400);
  await save(route, { ...initial, followUpDate: '2027-02-30' }, 400);
  await save(route, { ...initial, ayushAdvice: { unrelated: 'Fixture' } }, 400);

  const created = await save(route, initial);
  assert.equal(created.prescription.version, 1);
  assert.equal(created.prescription.medications[1].form, 'Capsule');
  assert.equal(created.prescription.followUpDate, '2027-01-20T00:00:00.000Z');
  assert.equal(created.warnings[0].severity, 'critical');

  const edited = await save(route, {
    medications: [{ name: 'Synthetic medicine', form: 'Syrup' }],
    ayushAdvice: { pathya: 'Updated Pathya' },
    followUpDate: null,
  });
  assert.equal(edited.prescription.version, 2);
  assert.equal(edited.prescription.instructions, initial.instructions);
  assert.equal(edited.prescription.followUpDate, null);
  assert.deepEqual(edited.warnings, []);
  assert.deepEqual(edited.prescription.ayushAdvice, { pathya: 'Updated Pathya', apathya: 'Original Apathya' });

  const saved = (await request(route)).prescription;
  assert.equal(saved.medications[0].form, 'Syrup');
  assert.deepEqual(saved.investigations, initial.investigations);
  assert.equal(saved.generalAdvice, initial.generalAdvice);

  const recordRoute = '/patients/' + patient.patientId;
  assert.equal((await request(recordRoute)).patient.prescription.medications[0].form, 'Syrup');
  const receptionistView = await request(recordRoute, { cookie: receptionistCookie });
  assert.equal(receptionistView.patient.patientId, patient.patientId);
  assert.equal(Object.hasOwn(receptionistView.patient, 'prescription'), false);

  const history = await request(route + '/history');
  assert.equal(history.currentVersion, 2);
  assert.equal(history.history.length, 1);
  const previous = history.history[0];
  assert.equal(previous.version, 1);
  assert.equal(previous.medications[1].form, 'Capsule');
  assert.equal(previous.followUpDate, '2027-01-20T00:00:00.000Z');
  assert.equal(previous.warnings[0].severity, 'critical');
  assert.deepEqual(previous.ayushAdvice, initial.ayushAdvice);
  assert.deepEqual(previous.investigations, initial.investigations);
  assert.equal(previous.generalAdvice, initial.generalAdvice);
});

test('unversioned treatment plans are readable and become version one in history', async () => {
  const existing = await Patient.create({ fullName: 'Legacy Treatment Plan Fixture' });
  const route = '/patients/' + existing.patientId + '/prescription';
  const legacyPlan = {
    medications: [],
    investigations: ['Legacy investigation'],
    ayushAdvice: { pathya: 'Legacy Pathya', apathya: 'Legacy Apathya' },
    generalAdvice: 'Legacy advice',
    followUpDate: new Date('2027-01-21T00:00:00.000Z'),
    prescribedAt: new Date('2026-11-19T10:00:00.000Z'),
  };
  await Patient.collection.updateOne({ _id: existing._id }, { $set: { prescription: legacyPlan } });
  assert.deepEqual((await request(route)).prescription.ayushAdvice, legacyPlan.ayushAdvice);

  const updated = await save(route, { medications: [], generalAdvice: 'Updated advice' });
  assert.equal(updated.prescription.version, 2);
  assert.deepEqual(updated.prescription.medications, []);
  assert.deepEqual(updated.prescription.investigations, legacyPlan.investigations);
  assert.equal(updated.prescription.followUpDate, legacyPlan.followUpDate.toISOString());
  const { history } = await request(route + '/history');
  assert.equal(history.length, 1);
  assert.equal(history[0].version, 1);
  assert.equal(history[0].generalAdvice, legacyPlan.generalAdvice);
  assert.equal(history[0].prescribedBy, null);
  assert.deepEqual(history[0].ayushAdvice, legacyPlan.ayushAdvice);
});

test('competing saves cannot create duplicate revision numbers', { timeout: 10000 }, async (t) => {
  const patient = await Patient.create({ fullName: 'Prescription Race Fixture' });
  const route = '/patients/' + patient.patientId + '/prescription';
  await save(route, { medications: [{ name: 'First saved revision' }] });

  // Release both requests together after each loads the same prior version.
  const saveDocument = Patient.prototype.save;
  let arrivals = 0;
  let release;
  const simultaneous = new Promise((resolve) => { release = resolve; });
  t.mock.method(Patient.prototype, 'save', async function (...args) {
    if (String(this._id) === String(patient._id) && this.prescription.version === 2) {
      arrivals += 1;
      if (arrivals === 2) release();
      await simultaneous;
    }
    return saveDocument.apply(this, args);
  });

  const results = await Promise.all(['Competing revision A', 'Competing revision B'].map((name) => fetch(apiUrl + route, {
    method: 'PUT',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ medications: [{ name }] }),
  })));
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
  for (const response of results) await response.json();
  const { currentVersion, history } = await request(route + '/history');
  assert.equal(currentVersion, 2);
  assert.deepEqual(history.map(({ version }) => version), [1]);
});
