const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const mongoose = require('mongoose');

const app = require('../../server');
const ClinicSession = require('../../models/ClinicSession');
const User = require('../../models/User');
const { COOKIE_NAME, signSession } = require('../../utils/auth');
const { formatLocalDate, startOfDay } = require('../../utils/dateRange');

const database = 'medikiosk_directory_test_' + randomUUID().replaceAll('-', '');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
process.env.JWT_SECRET = randomBytes(48).toString('hex');

const date = '2030-06-15';
const localDate = new Date(2030, 5, 15);
let server;
let baseUrl;
let staff;
let morning;

const cookieFor = (user) => COOKIE_NAME + '=' + signSession(user._id);

async function getDirectory(user, query = '', expected = 200) {
  const response = await fetch(baseUrl + '/departments/directory' + query, {
    headers: user ? { Cookie: cookieFor(user) } : {},
  });
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}

before(async () => {
  await mongoose.connect(mongoUri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  const users = [
    ['admin', 'Asha Admin', 'administrator', 'Administration'],
    ['receptionist', 'Ravi Reception', 'receptionist', 'Reception'],
    ['override', 'Aditi Doctor', 'doctor', 'General Medicine'],
    ['available', 'Maya Doctor', 'doctor', 'Pediatrics'],
    ['completed', 'Zoya Doctor', 'doctor', 'Cardiology'],
    ['unscheduled', 'Dev Doctor', 'doctor', 'Orthopedics'],
    ['blank', 'Neel Doctor', 'doctor', ''],
    ['inactive', 'Inactive Doctor', 'doctor', 'Inactive roster', { active: false }],
    ['pending', 'Pending Doctor', 'doctor', 'Pending roster', { approvalStatus: 'pending' }],
  ];
  const created = await User.insertMany(users.map(([key, name, role, department, overrides]) => ({
    name, email: key + '@directory.test', passwordHash: 'unused-test-hash',
    role, department, active: true, approvalStatus: 'approved', ...overrides,
  })));
  staff = Object.fromEntries(users.map(([key], index) => [key, created[index]]));
  const fixtures = [
    ['override', 'Cardiology', 'scheduled', 9 * 60 + 15, 'Cabin East'],
    ['override', 'Cardiology', 'completed', 11 * 60, 'Cabin West'],
    ['available', 'Pediatrics', 'active', 10 * 60, 'Cabin 2'],
    ['completed', 'Cardiology', 'completed', 9 * 60, 'Cabin 1'],
    ['unscheduled', 'Cancelled allocation', 'cancelled', 9 * 60, 'Cabin Old'],
    ['blank', 'Dermatology', 'scheduled', 14 * 60, 'Cabin 6'],
    ['inactive', 'Inactive allocation', 'scheduled', 8 * 60, 'Cabin Inactive'],
    ['pending', 'Pending allocation', 'active', 8 * 60, 'Cabin Pending'],
    ['receptionist', 'Non-doctor allocation', 'scheduled', 8 * 60, 'Cabin Other'],
    ['override', 'Previous day', 'scheduled', 16 * 60, 'Cabin Previous', new Date(2030, 5, 14)],
    ['override', 'Next day', 'scheduled', 8 * 60, 'Cabin Next', new Date(2030, 5, 16)],
  ];
  [morning] = await ClinicSession.insertMany(fixtures.map(([key, department, status, startMinute, cabin, sessionDate]) => ({
    doctor: staff[key]._id,
    department,
    status,
    date: sessionDate ?? localDate,
    shift: 'custom',
    startMinute,
    endMinute: startMinute + 60,
    cabin,
    cabinKey: ClinicSession.normalizeCabin(cabin),
    notes: 'Internal scheduling fixture',
    createdBy: staff.admin._id,
  })));

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/api';
});

after(async () => {
  try {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) {
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
  }
});

test('directory groups eligible doctors by roster and actual session departments', async () => {
  const response = await getDirectory(staff.receptionist, '?date=' + date);
  assert.equal(response.date, date);
  assert.deepEqual(response.departments.map(({ department }) => department), [
    'Cardiology', 'Dermatology', 'General Medicine', 'Orthopedics', 'Pediatrics',
  ]);
  const directory = new Map(response.departments.map(({ department, doctors }) => [department, doctors]));
  const emptyRoster = (doctor) => ({ doctorId: String(doctor._id), name: doctor.name, available: false, sessions: [] });
  assert.deepEqual(directory.get('General Medicine'), [emptyRoster(staff.override)]);
  assert.deepEqual(directory.get('Orthopedics'), [emptyRoster(staff.unscheduled)]);

  const [override, completed] = directory.get('Cardiology');
  assert.equal(override.doctorId, String(staff.override._id));
  assert.equal(override.available, true);
  assert.equal(override.sessions.length, 2);
  assert.deepEqual(override.sessions[0], {
    _id: String(morning._id), shift: 'custom', startTime: '09:15', endTime: '10:15',
    cabin: 'Cabin East', status: 'scheduled',
  });
  assert.equal(override.sessions[1].status, 'completed');
  assert.equal(completed.available, false);
  assert.equal(completed.sessions[0].status, 'completed');
  assert.equal(directory.get('Pediatrics')[0].available, true);
  assert.equal(directory.get('Pediatrics')[0].sessions[0].status, 'active');
  assert.equal(directory.get('Dermatology')[0].doctorId, String(staff.blank._id));

  const clinicList = await fetch(baseUrl + '/sessions?date=' + date, { headers: { Cookie: cookieFor(staff.admin) } });
  assert.equal(clinicList.status, 200);
  const sameSession = (await clinicList.json()).sessions.find((session) => session._id === String(morning._id));
  for (const key of ['startTime', 'endTime', 'cabin', 'status']) {
    assert.equal(override.sessions[0][key], sameSession[key]);
  }
});

test('directory defaults to today, respects local day boundaries, and rejects invalid dates', async () => {
  const today = formatLocalDate(startOfDay());
  assert.deepEqual(await getDirectory(staff.override), await getDirectory(staff.override, '?date=' + today));
  const next = await getDirectory(staff.admin, '?date=2030-06-16');
  assert.equal(next.date, '2030-06-16');
  const sessions = next.departments.flatMap(({ doctors }) => doctors.flatMap(({ sessions: entries }) => entries));
  assert.deepEqual(sessions.map(({ cabin }) => cabin), ['Cabin Next']);

  for (const query of ['?date=', '?date=2030-02-30', '?date=15-06-2030', '?date=2030-06-15&date=2030-06-16']) {
    const invalid = await getDirectory(staff.admin, query, 400);
    assert.equal(typeof invalid.error.message, 'string');
  }
});

test('directory requires an active staff session and accepts only reads', async () => {
  await getDirectory(null, '', 401);
  await getDirectory(staff.inactive, '', 401);

  const write = await fetch(baseUrl + '/departments/directory', {
    method: 'POST', headers: { Cookie: cookieFor(staff.admin) },
  });
  assert.equal(write.status, 404);
});
