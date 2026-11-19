const mongoose = require('mongoose');
const ClinicSession = require('../models/ClinicSession');
const FollowUpAppointment = require('../models/FollowUpAppointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { atMinutes, minutesToTime, timeToMinutes } = require('../utils/clinicTime');
const { formatLocalDate, parseLocalDate, resolveDayRange } = require('../utils/dateRange');

const BOOKABLE_SESSION_STATUSES = ['scheduled', 'active'];
const DOCTOR_FIELDS = 'name department';

function serializeAppointment(appointment) {
  const value = appointment.toObject ? appointment.toObject() : appointment;
  const start = new Date(value.startAt);
  const end = new Date(value.endAt);
  const minuteOf = (date) => date.getHours() * 60 + date.getMinutes();
  return {
    _id: value._id,
    patientId: value.patientId,
    patient: value.patient && value.patient.fullName ? { patientId: value.patient.patientId, fullName: value.patient.fullName } : undefined,
    doctor: value.doctor && value.doctor.name ? { _id: value.doctor._id, name: value.doctor.name, department: value.doctor.department || '' } : value.doctor,
    session: value.session && value.session.cabin ? { _id: value.session._id, cabin: value.session.cabin, department: value.session.department } : value.session,
    date: formatLocalDate(start),
    startTime: minutesToTime(minuteOf(start)),
    endTime: minutesToTime(minuteOf(end)),
    startAt: value.startAt,
    endAt: value.endAt,
    durationMinutes: value.durationMinutes,
    reason: value.reason,
    notes: value.notes,
    status: value.status,
    completedAt: value.completedAt,
    cancelledAt: value.cancelledAt,
    cancellationReason: value.cancellationReason,
    rescheduledFrom: value.rescheduledFrom,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function populateAppointment(appointment) {
  await appointment.populate([
    { path: 'doctor', select: DOCTOR_FIELDS },
    { path: 'patient', select: 'patientId fullName' },
    { path: 'session', select: 'cabin department' },
  ]);
  return appointment;
}

async function findDoctor(doctorId) {
  if (!mongoose.isValidObjectId(doctorId)) throw new AppError('Choose a valid doctor.', 400);
  const doctor = await User.findById(doctorId).select(`${DOCTOR_FIELDS} role active approvalStatus`);
  if (!doctor || doctor.role !== 'doctor' || !doctor.active || doctor.approvalStatus === 'pending') {
    throw new AppError('Follow-ups can only be booked with an active doctor account.', 400);
  }
  return doctor;
}

function resolveDoctorId(request, requestedId) {
  const role = request.user.role === 'admin' ? 'administrator' : request.user.role;
  if (requestedId) return requestedId;
  if (role === 'doctor') return String(request.user._id);
  throw new AppError('Choose the doctor for this follow-up.', 400);
}

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000;
}

function duplicateMessage(error) {
  const index = JSON.stringify(error.keyPattern || error.message || '');
  return index.includes('session')
    ? 'This patient already has a follow-up booked in this clinic session.'
    : 'This slot was just booked by someone else. Choose another time.';
}

// Finds the doctor's clinic session that covers the requested slot and
// checks every double-booking rule. Returns the session and exact times.
async function resolveSlot({ doctor, patient, date, startTime, excludeId }) {
  const day = parseLocalDate(date, 'date');
  const startMinute = timeToMinutes(startTime);
  const sessions = await ClinicSession.find({
    doctor: doctor._id,
    date: day,
    status: { $in: BOOKABLE_SESSION_STATUSES },
    startMinute: { $lte: startMinute },
    endMinute: { $gt: startMinute },
  }).lean();
  const session = sessions[0];
  if (!session) {
    throw new AppError(`${doctor.name} has no OPD session covering ${startTime} on ${date}. Check the doctor's schedule.`, 409);
  }
  const offset = startMinute - session.startMinute;
  if (offset % session.slotMinutes !== 0) {
    throw new AppError(`Choose a start time on the ${session.slotMinutes}-minute slot grid that begins at ${minutesToTime(session.startMinute)}.`, 400);
  }
  const endMinute = startMinute + session.slotMinutes;
  if (endMinute > session.endMinute) throw new AppError('This slot runs past the end of the OPD session.', 409);

  const startAt = atMinutes(day, startMinute);
  const endAt = atMinutes(day, endMinute);
  if (startAt <= new Date()) throw new AppError('Follow-up appointments must be booked for a future time.', 400);

  const exclude = excludeId ? { _id: { $ne: excludeId } } : {};
  const doctorClash = await FollowUpAppointment.exists({ ...exclude, doctor: doctor._id, status: 'booked', startAt: { $lt: endAt }, endAt: { $gt: startAt } });
  if (doctorClash) throw new AppError(`${doctor.name} is already booked at ${startTime} on ${date}.`, 409);

  const patientClash = await FollowUpAppointment.findOne({ ...exclude, patient: patient._id, status: 'booked', $or: [{ session: session._id }, { startAt: { $lt: endAt }, endAt: { $gt: startAt } }] }).lean();
  if (patientClash) {
    throw new AppError(String(patientClash.session) === String(session._id)
      ? 'This patient already has a follow-up booked in this clinic session.'
      : 'This patient already has another appointment at that time.', 409);
  }

  if (session.maxPatients) {
    const booked = await FollowUpAppointment.countDocuments({ ...exclude, session: session._id, status: 'booked' });
    if (booked >= session.maxPatients) throw new AppError('This OPD session is fully booked.', 409);
  }

  return { session, startAt, endAt, durationMinutes: session.slotMinutes };
}

async function loadAppointment(appointmentId) {
  if (!mongoose.isValidObjectId(appointmentId)) throw new AppError('Follow-up appointment not found.', 404);
  const appointment = await FollowUpAppointment.findById(appointmentId);
  if (!appointment) throw new AppError('Follow-up appointment not found.', 404);
  return appointment;
}

async function bookAppointment(request, response) {
  const input = request.validatedBody;
  const patient = await Patient.findOne({ patientId: input.patientId }).select('patientId fullName');
  if (!patient) throw new AppError('Patient record not found.', 404);
  const doctor = await findDoctor(resolveDoctorId(request, input.doctorId));
  const slot = await resolveSlot({ doctor, patient, date: input.date, startTime: input.startTime });

  let appointment;
  try {
    appointment = await FollowUpAppointment.create({
      patient: patient._id,
      patientId: patient.patientId,
      doctor: doctor._id,
      session: slot.session._id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      durationMinutes: slot.durationMinutes,
      reason: input.reason || '',
      notes: input.notes || '',
      bookedBy: request.user._id,
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(duplicateMessage(error), 409);
    throw error;
  }
  await populateAppointment(appointment);
  await recordAudit(request, { action: 'appointment.follow_up.book', resourceType: 'patient', resourceId: patient.patientId });
  response.status(201).json({ appointment: serializeAppointment(appointment) });
}

async function listAppointments(request, response) {
  const { date, doctorId, patientId, status } = request.query;
  const filter = {};
  // A patient's history is not limited to a date range unless one is given.
  if (date || request.query.from || request.query.to || !patientId) {
    const range = resolveDayRange(date ? { from: date, to: date } : request.query, { maxDays: 366 });
    filter.startAt = { $gte: range.start, $lt: range.end };
  }
  if (doctorId !== undefined) {
    if (!mongoose.isValidObjectId(doctorId)) throw new AppError('Choose a valid doctor.', 400);
    filter.doctor = doctorId;
  }
  if (patientId !== undefined) {
    if (typeof patientId !== 'string' || patientId.length > 32) throw new AppError('Choose a valid patient.', 400);
    filter.patientId = patientId;
  }
  if (status !== undefined) {
    if (!FollowUpAppointment.APPOINTMENT_STATUSES.includes(status)) throw new AppError('Unknown appointment status.', 400);
    filter.status = status;
  }

  const appointments = await FollowUpAppointment.find(filter).sort({ startAt: 1 }).limit(500)
    .populate('doctor', DOCTOR_FIELDS).populate('patient', 'patientId fullName').populate('session', 'cabin department').lean();
  await recordAudit(request, { action: 'appointment.follow_up.list', resourceType: 'appointment', resourceId: patientId || '' });
  response.json({ appointments: appointments.map(serializeAppointment) });
}

async function getAvailability(request, response) {
  const { doctorId, date } = request.query;
  if (!doctorId || !date) throw new AppError('Send doctorId and date to see available slots.', 400);
  const doctor = await findDoctor(doctorId);
  const day = parseLocalDate(date, 'date');
  const sessions = await ClinicSession.find({ doctor: doctor._id, date: day, status: { $in: BOOKABLE_SESSION_STATUSES } }).sort({ startMinute: 1 }).lean();
  const booked = await FollowUpAppointment.find({ session: { $in: sessions.map((session) => session._id) }, status: 'booked' }).select('session startAt endAt').lean();
  const now = new Date();

  const result = sessions.map((session) => {
    const sessionBookings = booked.filter((appointment) => String(appointment.session) === String(session._id));
    const full = Boolean(session.maxPatients && sessionBookings.length >= session.maxPatients);
    const slots = [];
    for (let minute = session.startMinute; minute + session.slotMinutes <= session.endMinute; minute += session.slotMinutes) {
      const startAt = atMinutes(day, minute);
      const endAt = atMinutes(day, minute + session.slotMinutes);
      const taken = sessionBookings.some((appointment) => appointment.startAt < endAt && appointment.endAt > startAt);
      slots.push({
        startTime: minutesToTime(minute),
        endTime: minutesToTime(minute + session.slotMinutes),
        available: !taken && !full && startAt > now,
        reason: taken ? 'booked' : startAt <= now ? 'past' : full ? 'session_full' : null,
      });
    }
    return {
      sessionId: session._id,
      cabin: session.cabin,
      department: session.department,
      startTime: minutesToTime(session.startMinute),
      endTime: minutesToTime(session.endMinute),
      slotMinutes: session.slotMinutes,
      maxPatients: session.maxPatients,
      booked: sessionBookings.length,
      slots,
    };
  });

  response.json({ doctor: { _id: doctor._id, name: doctor.name, department: doctor.department }, date: formatLocalDate(day), sessions: result });
}

async function getAppointment(request, response) {
  const appointment = await loadAppointment(request.params.appointmentId);
  await populateAppointment(appointment);
  await recordAudit(request, { action: 'appointment.follow_up.view', resourceType: 'patient', resourceId: appointment.patientId });
  response.json({ appointment: serializeAppointment(appointment) });
}

async function rescheduleAppointment(request, response) {
  const appointment = await loadAppointment(request.params.appointmentId);
  if (appointment.status !== 'booked') throw new AppError(`A ${appointment.status.replace('_', '-')} appointment cannot be rescheduled.`, 409);
  const input = request.validatedBody;
  const doctor = await findDoctor(input.doctorId || String(appointment.doctor));
  const patient = { _id: appointment.patient };
  const slot = await resolveSlot({ doctor, patient, date: input.date, startTime: input.startTime, excludeId: appointment._id });

  appointment.rescheduledFrom.push({ startAt: appointment.startAt, endAt: appointment.endAt, changedBy: request.user._id, changedAt: new Date() });
  Object.assign(appointment, {
    doctor: doctor._id,
    session: slot.session._id,
    startAt: slot.startAt,
    endAt: slot.endAt,
    durationMinutes: slot.durationMinutes,
  });
  try {
    await appointment.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(duplicateMessage(error), 409);
    throw error;
  }
  await populateAppointment(appointment);
  await recordAudit(request, { action: 'appointment.follow_up.reschedule', resourceType: 'patient', resourceId: appointment.patientId });
  response.json({ appointment: serializeAppointment(appointment) });
}

async function updateAppointmentStatus(request, response) {
  const appointment = await loadAppointment(request.params.appointmentId);
  const { status, reason = '' } = request.validatedBody;
  if (appointment.status !== 'booked') throw new AppError(`This appointment is already ${appointment.status.replace('_', '-')}.`, 409);
  if (status !== 'cancelled' && appointment.startAt > new Date()) {
    throw new AppError('An appointment can only be marked completed or no-show once its time has started.', 409);
  }

  const now = new Date();
  appointment.status = status;
  if (status === 'completed') appointment.completedAt = now;
  if (status === 'cancelled') {
    appointment.cancelledAt = now;
    appointment.cancelledBy = request.user._id;
    appointment.cancellationReason = reason;
  }
  await appointment.save();
  await populateAppointment(appointment);
  await recordAudit(request, { action: `appointment.follow_up.${status}`, resourceType: 'patient', resourceId: appointment.patientId });
  response.json({ appointment: serializeAppointment(appointment) });
}

module.exports = {
  bookAppointment,
  getAppointment,
  getAvailability,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
};
