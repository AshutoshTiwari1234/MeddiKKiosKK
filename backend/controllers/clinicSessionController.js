const mongoose = require('mongoose');
const ClinicSession = require('../models/ClinicSession');
const FollowUpAppointment = require('../models/FollowUpAppointment');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { SHIFT_PRESETS, atMinutes, minutesToTime, timeToMinutes } = require('../utils/clinicTime');
const { formatLocalDate, parseLocalDate, resolveDayRange, startOfDay } = require('../utils/dateRange');

const DOCTOR_FIELDS = 'name email department role';
const STATUS_TRANSITIONS = {
  scheduled: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function normalizedRole(user) {
  return user.role === 'admin' ? 'administrator' : user.role;
}

function serializeSession(session) {
  const value = session.toObject ? session.toObject() : session;
  const doctor = value.doctor && typeof value.doctor === 'object' && value.doctor.name
    ? { _id: value.doctor._id, name: value.doctor.name, department: value.doctor.department || '' }
    : value.doctor;
  return {
    _id: value._id,
    doctor,
    department: value.department,
    date: formatLocalDate(new Date(value.date)),
    shift: value.shift,
    startTime: minutesToTime(value.startMinute),
    endTime: minutesToTime(value.endMinute),
    durationMinutes: value.endMinute - value.startMinute,
    cabin: value.cabin,
    slotMinutes: value.slotMinutes,
    maxPatients: value.maxPatients,
    status: value.status,
    notes: value.notes,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    cancelledAt: value.cancelledAt,
    cancellationReason: value.cancellationReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function resolveTimes(shift, startTime, endTime) {
  const preset = SHIFT_PRESETS[shift] || {};
  const startMinute = timeToMinutes(startTime || preset.startTime);
  const endMinute = timeToMinutes(endTime || preset.endTime);
  if (startMinute === null || endMinute === null) throw new AppError('Custom shifts need a start time and an end time.', 400);
  if (endMinute <= startMinute) throw new AppError('The session must end after it starts.', 400);
  if (endMinute - startMinute < 15) throw new AppError('A session must be at least 15 minutes long.', 400);
  return { startMinute, endMinute };
}

async function findDoctor(doctorId) {
  if (!mongoose.isValidObjectId(doctorId)) throw new AppError('Choose a valid doctor.', 400);
  const doctor = await User.findById(doctorId).select(`${DOCTOR_FIELDS} active approvalStatus`);
  if (!doctor || doctor.role !== 'doctor' || !doctor.active || doctor.approvalStatus === 'pending') {
    throw new AppError('Sessions can only be assigned to an active doctor account.', 400);
  }
  return doctor;
}

async function assertNoConflicts({ date, doctor, cabinKey, startMinute, endMinute, excludeId }) {
  const filter = {
    date,
    status: { $ne: 'cancelled' },
    startMinute: { $lt: endMinute },
    endMinute: { $gt: startMinute },
    $or: [{ doctor }, { cabinKey }],
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const conflict = await ClinicSession.findOne(filter).populate('doctor', 'name').lean();
  if (!conflict) return;
  const window = `${minutesToTime(conflict.startMinute)}–${minutesToTime(conflict.endMinute)}`;
  if (String(conflict.doctor._id) === String(doctor)) {
    throw new AppError(`${conflict.doctor.name} already has a session from ${window} on this date (${conflict.cabin}).`, 409);
  }
  throw new AppError(`${conflict.cabin} is already allocated to ${conflict.doctor.name} from ${window} on this date.`, 409);
}

function assertNotPast(date) {
  if (date < startOfDay()) throw new AppError('Sessions cannot be scheduled on a past date.', 400);
}

async function loadSession(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw new AppError('Clinic session not found.', 404);
  const session = await ClinicSession.findById(sessionId);
  if (!session) throw new AppError('Clinic session not found.', 404);
  return session;
}

function assertCanManage(user, session) {
  const role = normalizedRole(user);
  if (role === 'administrator') return;
  if (role === 'doctor' && String(session.doctor) === String(user._id)) return;
  throw new AppError('Only an administrator or the assigned doctor can change this session.', 403);
}

async function listSessions(request, response) {
  const { date, doctorId, department, cabin, status, includeCancelled } = request.query;
  const range = resolveDayRange(date ? { from: date, to: date } : request.query, { maxDays: 92 });
  const filter = { date: { $gte: range.start, $lt: range.end } };

  if (doctorId !== undefined) {
    if (!mongoose.isValidObjectId(doctorId)) throw new AppError('Choose a valid doctor.', 400);
    filter.doctor = doctorId;
  }
  if (typeof department === 'string' && department) filter.department = department.slice(0, 100);
  if (typeof cabin === 'string' && cabin) filter.cabinKey = ClinicSession.normalizeCabin(cabin.slice(0, 50));
  if (status !== undefined) {
    if (!ClinicSession.SESSION_STATUSES.includes(status)) throw new AppError('Unknown session status.', 400);
    filter.status = status;
  } else if (includeCancelled !== 'true') {
    filter.status = { $ne: 'cancelled' };
  }

  const sessions = await ClinicSession.find(filter).sort({ date: 1, startMinute: 1, cabinKey: 1 })
    .populate('doctor', DOCTOR_FIELDS).limit(500).lean();
  await recordAudit(request, { action: 'clinic_session.list', resourceType: 'clinic_session' });
  response.json({ range: { from: range.from, to: range.to }, sessions: sessions.map(serializeSession) });
}

async function getCabinAllocation(request, response) {
  const day = request.query.date ? parseLocalDate(request.query.date, 'date') : startOfDay();
  const sessions = await ClinicSession.find({ date: day, status: { $ne: 'cancelled' } })
    .sort({ cabinKey: 1, startMinute: 1 }).populate('doctor', DOCTOR_FIELDS).lean();

  const cabins = new Map();
  for (const session of sessions) {
    if (!cabins.has(session.cabinKey)) cabins.set(session.cabinKey, { cabin: session.cabin, sessions: [] });
    cabins.get(session.cabinKey).sessions.push(serializeSession(session));
  }
  const nowMinute = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = day.getTime() === startOfDay().getTime();
  const allocation = [...cabins.values()].map((entry) => ({
    ...entry,
    occupiedNow: isToday ? entry.sessions.find((session) => {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      return session.status !== 'completed' && start <= nowMinute && nowMinute < end;
    }) || null : null,
  }));

  await recordAudit(request, { action: 'clinic_session.cabins', resourceType: 'clinic_session' });
  response.json({ date: formatLocalDate(day), cabins: allocation });
}

async function getSession(request, response) {
  const session = await loadSession(request.params.sessionId);
  await session.populate('doctor', DOCTOR_FIELDS);
  await recordAudit(request, { action: 'clinic_session.view', resourceType: 'clinic_session', resourceId: session._id });
  response.json({ session: serializeSession(session) });
}

async function createSession(request, response) {
  const input = request.validatedBody;
  const role = normalizedRole(request.user);
  let doctorId = input.doctorId;
  if (role === 'doctor') {
    if (doctorId && doctorId !== String(request.user._id)) throw new AppError('Doctors can only schedule their own sessions.', 403);
    doctorId = String(request.user._id);
  }
  if (!doctorId) throw new AppError('Choose the doctor for this session.', 400);

  const doctor = await findDoctor(doctorId);
  const date = parseLocalDate(input.date, 'date');
  assertNotPast(date);
  const { startMinute, endMinute } = resolveTimes(input.shift, input.startTime, input.endTime);
  const cabinKey = ClinicSession.normalizeCabin(input.cabin);
  await assertNoConflicts({ date, doctor: doctor._id, cabinKey, startMinute, endMinute });

  const session = await ClinicSession.create({
    doctor: doctor._id,
    department: input.department || doctor.department || 'General Medicine',
    date,
    shift: input.shift,
    startMinute,
    endMinute,
    cabin: input.cabin.replace(/\s+/g, ' '),
    cabinKey,
    slotMinutes: input.slotMinutes,
    maxPatients: input.maxPatients ?? null,
    notes: input.notes || '',
    createdBy: request.user._id,
  });
  await session.populate('doctor', DOCTOR_FIELDS);
  await recordAudit(request, { action: 'clinic_session.create', resourceType: 'clinic_session', resourceId: session._id });
  response.status(201).json({ session: serializeSession(session) });
}

async function updateSession(request, response) {
  const session = await loadSession(request.params.sessionId);
  assertCanManage(request.user, session);
  if (['completed', 'cancelled'].includes(session.status)) throw new AppError(`A ${session.status} session can no longer be edited.`, 409);

  const input = request.validatedBody;
  const date = input.date ? parseLocalDate(input.date, 'date') : session.date;
  if (input.date) assertNotPast(date);
  const shift = input.shift || session.shift;
  // A new preset shift brings its own times unless explicit times are sent.
  const usePreset = input.shift && input.shift !== 'custom';
  const { startMinute, endMinute } = resolveTimes(
    shift,
    input.startTime || (usePreset ? SHIFT_PRESETS[shift].startTime : minutesToTime(session.startMinute)),
    input.endTime || (usePreset ? SHIFT_PRESETS[shift].endTime : minutesToTime(session.endMinute)),
  );
  const cabin = input.cabin ? input.cabin.replace(/\s+/g, ' ') : session.cabin;
  const cabinKey = ClinicSession.normalizeCabin(cabin);

  await assertNoConflicts({ date, doctor: session.doctor, cabinKey, startMinute, endMinute, excludeId: session._id });

  // Booked follow-ups must still fit inside the session after it moves.
  const newStart = atMinutes(date, startMinute);
  const newEnd = atMinutes(date, endMinute);
  const stranded = await FollowUpAppointment.countDocuments({
    session: session._id,
    status: 'booked',
    $or: [{ startAt: { $lt: newStart } }, { endAt: { $gt: newEnd } }],
  });
  if (stranded) {
    throw new AppError(`${stranded} booked follow-up appointment${stranded === 1 ? '' : 's'} would fall outside the new session time. Reschedule ${stranded === 1 ? 'it' : 'them'} first.`, 409);
  }

  Object.assign(session, {
    date,
    shift,
    startMinute,
    endMinute,
    cabin,
    cabinKey,
    updatedBy: request.user._id,
  });
  for (const field of ['department', 'slotMinutes', 'maxPatients', 'notes']) {
    if (Object.hasOwn(input, field)) session[field] = input[field];
  }
  await session.save();
  await session.populate('doctor', DOCTOR_FIELDS);
  await recordAudit(request, { action: 'clinic_session.update', resourceType: 'clinic_session', resourceId: session._id });
  response.json({ session: serializeSession(session) });
}

async function updateSessionStatus(request, response) {
  const session = await loadSession(request.params.sessionId);
  assertCanManage(request.user, session);
  const { status, reason = '' } = request.validatedBody;
  if (session.status === status) throw new AppError(`This session is already ${status}.`, 409);
  if (!STATUS_TRANSITIONS[session.status].includes(status)) {
    throw new AppError(`A ${session.status} session cannot be marked ${status}.`, 409);
  }

  const now = new Date();
  if (status === 'active') session.startedAt = now;
  if (status === 'completed') session.completedAt = now;
  if (status === 'cancelled') {
    const booked = await FollowUpAppointment.countDocuments({ session: session._id, status: 'booked' });
    if (booked) {
      throw new AppError(`This session has ${booked} booked follow-up appointment${booked === 1 ? '' : 's'}. Reschedule or cancel ${booked === 1 ? 'it' : 'them'} before cancelling the session.`, 409);
    }
    session.cancelledAt = now;
    session.cancelledBy = request.user._id;
    session.cancellationReason = reason;
  }
  session.status = status;
  session.updatedBy = request.user._id;
  await session.save();
  await session.populate('doctor', DOCTOR_FIELDS);
  await recordAudit(request, { action: `clinic_session.${status}`, resourceType: 'clinic_session', resourceId: session._id });
  response.json({ session: serializeSession(session) });
}

module.exports = {
  createSession,
  getCabinAllocation,
  getSession,
  listSessions,
  serializeSession,
  updateSession,
  updateSessionStatus,
};
