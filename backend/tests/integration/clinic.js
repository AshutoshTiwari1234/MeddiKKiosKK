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

function futureDate(daysAhead = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return formatLocalDate(date);
}

test('clinic sessions manage doctor shifts and cabin allocation without overlaps', async () => {
  const date = futureDate(1);
  const doctorId = String(staff.doctor._id);
  const doctor2Id = String(staff.doctor2._id);

  const receptionistCreate = await call('receptionist', 'POST', '/sessions', { doctorId, date, shift: 'morning', cabin: 'Cabin 1' });
  assert.equal(receptionistCreate.status, 403);

  const morning = await call('administrator', 'POST', '/sessions', { doctorId, date, shift: 'morning', cabin: 'Cabin 1' });
  assert.equal(morning.status, 201);
  assert.equal(morning.body.session.startTime, '09:00');
  assert.equal(morning.body.session.endTime, '13:00');
  assert.equal(morning.body.session.department, 'General Medicine');
  assert.equal(morning.body.session.doctor.name, 'Dr. Meera Rao');

  // Same doctor, overlapping time in another cabin.
  const doctorClash = await call('administrator', 'POST', '/sessions', { doctorId, date, shift: 'custom', startTime: '12:00', endTime: '14:00', cabin: 'Cabin 2' });
  assert.equal(doctorClash.status, 409);
  assert.match(doctorClash.body.error.message, /already has a session/);

  // Different doctor, same cabin and overlapping time (cabin name differs only in case/spacing).
  const cabinClash = await call('administrator', 'POST', '/sessions', { doctorId: doctor2Id, date, shift: 'custom', startTime: '10:00', endTime: '11:00', cabin: '  cabin   1 ' });
  assert.equal(cabinClash.status, 409);
  assert.match(cabinClash.body.error.message, /Cabin 1 is already allocated/);

  // Back-to-back sessions in the same cabin are fine.
  const afternoon = await call('doctor2', 'POST', '/sessions', { date, shift: 'custom', startTime: '13:00', endTime: '16:00', cabin: 'Cabin 1', slotMinutes: 20 });
  assert.equal(afternoon.status, 201);
  assert.equal(afternoon.body.session.department, 'Cardiology');

  const doctorForOther = await call('doctor2', 'POST', '/sessions', { doctorId, date, shift: 'evening', cabin: 'Cabin 4' });
  assert.equal(doctorForOther.status, 403);

  const invalidCustom = await call('administrator', 'POST', '/sessions', { doctorId, date, shift: 'custom', cabin: 'Cabin 5' });
  assert.equal(invalidCustom.status, 400);
  const backwards = await call('administrator', 'POST', '/sessions', { doctorId, date, shift: 'custom', startTime: '18:00', endTime: '17:00', cabin: 'Cabin 5' });
  assert.equal(backwards.status, 400);
  const past = await call('administrator', 'POST', '/sessions', { doctorId, date: '2020-01-01', shift: 'morning', cabin: 'Cabin 5' });
  assert.equal(past.status, 400);
  const receptionistAsDoctor = await call('administrator', 'POST', '/sessions', { doctorId: String(staff.receptionist._id), date, shift: 'morning', cabin: 'Cabin 6' });
  assert.equal(receptionistAsDoctor.status, 400);

  const list = await call('receptionist', 'GET', `/sessions?date=${date}`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.sessions.map((session) => session.startTime), ['09:00', '13:00']);
  const byDoctor = await call('receptionist', 'GET', `/sessions?from=${date}&to=${date}&doctorId=${doctor2Id}`);
  assert.equal(byDoctor.body.sessions.length, 1);

  const cabins = await call('receptionist', 'GET', `/sessions/cabins?date=${date}`);
  assert.equal(cabins.status, 200);
  assert.equal(cabins.body.cabins.length, 1);
  assert.equal(cabins.body.cabins[0].cabin, 'Cabin 1');
  assert.equal(cabins.body.cabins[0].sessions.length, 2);

  // Moving the morning session into a free cabin; another doctor cannot edit it.
  const sessionId = morning.body.session._id;
  const otherDoctorEdit = await call('doctor2', 'PATCH', `/sessions/${sessionId}`, { cabin: 'Cabin 9' });
  assert.equal(otherDoctorEdit.status, 403);
  const moved = await call('doctor', 'PATCH', `/sessions/${sessionId}`, { cabin: 'Cabin 3', shift: 'custom', endTime: '12:30' });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.session.cabin, 'Cabin 3');
  assert.equal(moved.body.session.startTime, '09:00');
  assert.equal(moved.body.session.endTime, '12:30');
  const movedIntoClash = await call('administrator', 'PATCH', `/sessions/${sessionId}`, { cabin: 'Cabin 1', endTime: '13:30' });
  assert.equal(movedIntoClash.status, 409);

  // Status lifecycle.
  const complete = await call('doctor', 'PATCH', `/sessions/${sessionId}/status`, { status: 'completed' });
  assert.equal(complete.status, 409);
  const start = await call('doctor', 'PATCH', `/sessions/${sessionId}/status`, { status: 'active' });
  assert.equal(start.status, 200);
  assert.ok(start.body.session.startedAt);
  const cancel = await call('administrator', 'PATCH', `/sessions/${afternoon.body.session._id}/status`, { status: 'cancelled', reason: 'Doctor on leave' });
  assert.equal(cancel.status, 200);
  const editCancelled = await call('administrator', 'PATCH', `/sessions/${afternoon.body.session._id}`, { notes: 'x' });
  assert.equal(editCancelled.status, 409);

  // A cancelled session frees its cabin and is hidden from the default list.
  const reuseCabin = await call('administrator', 'POST', '/sessions', { doctorId: doctor2Id, date, shift: 'custom', startTime: '13:00', endTime: '15:00', cabin: 'Cabin 1' });
  assert.equal(reuseCabin.status, 201);
  const withCancelled = await call('receptionist', 'GET', `/sessions?date=${date}&includeCancelled=true`);
  assert.equal(withCancelled.body.sessions.length, 3);

  const missing = await call('receptionist', 'GET', '/sessions/507f1f77bcf86cd799439011');
  assert.equal(missing.status, 404);
});

test('follow-up appointments prevent double bookings', async () => {
  const FollowUpAppointment = require('../../models/FollowUpAppointment');
  await FollowUpAppointment.init();
  const date = futureDate(3);
  const doctorId = String(staff.doctor._id);
  const doctor2Id = String(staff.doctor2._id);
  const [alice, bala, chitra] = await Patient.create([
    { fullName: 'Alice Follow-up', consent: { caseTaking: true } },
    { fullName: 'Bala Follow-up', consent: { caseTaking: true } },
    { fullName: 'Chitra Follow-up', consent: { caseTaking: true } },
  ]);

  // No session yet: booking is refused.
  const noSession = await call('doctor', 'POST', '/appointments', { patientId: alice.patientId, date, startTime: '10:00' });
  assert.equal(noSession.status, 409);
  assert.match(noSession.body.error.message, /no OPD session/);

  const session = await call('doctor', 'POST', '/sessions', { date, shift: 'custom', startTime: '10:00', endTime: '11:00', cabin: 'Cabin 7', slotMinutes: 15, maxPatients: 3 });
  assert.equal(session.status, 201);
  await call('doctor2', 'POST', '/sessions', { date, shift: 'custom', startTime: '10:00', endTime: '12:00', cabin: 'Cabin 8' });

  const receptionistBooking = await call('receptionist', 'POST', '/appointments', { patientId: alice.patientId, doctorId, date, startTime: '10:00' });
  assert.equal(receptionistBooking.status, 403);

  const booked = await call('doctor', 'POST', '/appointments', { patientId: alice.patientId, date, startTime: '10:00', reason: 'Review BP after medication' });
  assert.equal(booked.status, 201);
  assert.equal(booked.body.appointment.startTime, '10:00');
  assert.equal(booked.body.appointment.endTime, '10:15');
  assert.equal(booked.body.appointment.status, 'booked');
  assert.equal(booked.body.appointment.doctor.name, 'Dr. Meera Rao');
  assert.equal(booked.body.appointment.session.cabin, 'Cabin 7');

  // Same doctor, same slot, different patient.
  const doctorDouble = await call('administrator', 'POST', '/appointments', { patientId: bala.patientId, doctorId, date, startTime: '10:00' });
  assert.equal(doctorDouble.status, 409);
  assert.match(doctorDouble.body.error.message, /already booked/);

  // Same patient, second slot in the same session.
  const patientSameSession = await call('doctor', 'POST', '/appointments', { patientId: alice.patientId, date, startTime: '10:30' });
  assert.equal(patientSameSession.status, 409);
  assert.match(patientSameSession.body.error.message, /already has a follow-up booked in this clinic session/);

  // Same patient, same time with another doctor.
  const patientElsewhere = await call('doctor2', 'POST', '/appointments', { patientId: alice.patientId, date, startTime: '10:00' });
  assert.equal(patientElsewhere.status, 409);
  assert.match(patientElsewhere.body.error.message, /another appointment at that time/);

  // Off-grid, out-of-session and unknown-patient requests.
  const offGrid = await call('doctor', 'POST', '/appointments', { patientId: bala.patientId, date, startTime: '10:05' });
  assert.equal(offGrid.status, 400);
  const outside = await call('doctor', 'POST', '/appointments', { patientId: bala.patientId, date, startTime: '11:00' });
  assert.equal(outside.status, 409);
  const unknownPatient = await call('doctor', 'POST', '/appointments', { patientId: 'MK-FFFFFFFFFF', date, startTime: '10:15' });
  assert.equal(unknownPatient.status, 404);

  // Two requests racing for the same free slot: exactly one wins.
  const race = await Promise.all([
    call('doctor', 'POST', '/appointments', { patientId: bala.patientId, date, startTime: '10:15' }),
    call('administrator', 'POST', '/appointments', { patientId: chitra.patientId, doctorId, date, startTime: '10:15' }),
  ]);
  assert.deepEqual(race.map((result) => result.status).sort(), [201, 409]);
  const loserPatient = race[0].status === 409 ? bala : chitra;

  // Availability reflects bookings.
  const availability = await call('receptionist', 'GET', `/appointments/availability?doctorId=${doctorId}&date=${date}`);
  assert.equal(availability.status, 200);
  const slots = availability.body.sessions[0].slots;
  assert.deepEqual(slots.map((slot) => slot.startTime), ['10:00', '10:15', '10:30', '10:45']);
  assert.deepEqual(slots.map((slot) => slot.available), [false, false, true, true]);
  assert.equal(availability.body.sessions[0].booked, 2);

  // Capacity: the session allows three bookings.
  const third = await call('doctor', 'POST', '/appointments', { patientId: loserPatient.patientId, date, startTime: '10:30' });
  assert.equal(third.status, 201);
  const extraPatient = await Patient.create({ fullName: 'Overflow Patient', consent: { caseTaking: true } });
  const full = await call('doctor', 'POST', '/appointments', { patientId: extraPatient.patientId, date, startTime: '10:45' });
  assert.equal(full.status, 409);
  assert.match(full.body.error.message, /fully booked/);

  // A session with bookings cannot be cancelled or shrunk past them.
  const cancelSession = await call('doctor', 'PATCH', `/sessions/${session.body.session._id}/status`, { status: 'cancelled' });
  assert.equal(cancelSession.status, 409);
  const shrink = await call('doctor', 'PATCH', `/sessions/${session.body.session._id}`, { endTime: '10:30' });
  assert.equal(shrink.status, 409);

  // Reschedule into a taken slot fails; into a free slot with another doctor works.
  const appointmentId = booked.body.appointment._id;
  const rescheduleClash = await call('doctor', 'PATCH', `/appointments/${appointmentId}/reschedule`, { date, startTime: '10:30' });
  assert.equal(rescheduleClash.status, 409);
  const rescheduled = await call('doctor', 'PATCH', `/appointments/${appointmentId}/reschedule`, { date, startTime: '11:00', doctorId: doctor2Id });
  assert.equal(rescheduled.status, 200);
  assert.equal(rescheduled.body.appointment.doctor.name, 'Dr. Arjun Das');
  assert.equal(rescheduled.body.appointment.rescheduledFrom.length, 1);

  // The freed 10:00 slot can now be booked.
  const freed = await call('doctor', 'POST', '/appointments', { patientId: extraPatient.patientId, date, startTime: '10:00' });
  assert.equal(freed.status, 201);

  // Status changes: future appointments can be cancelled but not completed.
  const completeEarly = await call('doctor', 'PATCH', `/appointments/${freed.body.appointment._id}/status`, { status: 'completed' });
  assert.equal(completeEarly.status, 409);
  const cancelled = await call('doctor', 'PATCH', `/appointments/${freed.body.appointment._id}/status`, { status: 'cancelled', reason: 'Patient called to cancel' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.appointment.status, 'cancelled');
  const cancelAgain = await call('doctor', 'PATCH', `/appointments/${freed.body.appointment._id}/status`, { status: 'cancelled' });
  assert.equal(cancelAgain.status, 409);
  const rebookAfterCancel = await call('doctor', 'POST', '/appointments', { patientId: extraPatient.patientId, date, startTime: '10:00' });
  assert.equal(rebookAfterCancel.status, 201);

  // Listing by patient and by day.
  const alicesAppointments = await call('receptionist', 'GET', `/appointments?patientId=${alice.patientId}`);
  assert.equal(alicesAppointments.status, 200);
  assert.equal(alicesAppointments.body.appointments.length, 1);
  assert.equal(alicesAppointments.body.appointments[0].startTime, '11:00');
  const dayList = await call('receptionist', 'GET', `/appointments?date=${date}&doctorId=${doctorId}&status=booked`);
  assert.deepEqual(dayList.body.appointments.map((appointment) => appointment.startTime), ['10:00', '10:15', '10:30']);
});
