const { z } = require('zod');
const { TIME_PATTERN } = require('../utils/clinicTime');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid doctor.');
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for the appointment date.');
const time = z.string().regex(TIME_PATTERN, 'Use 24-hour HH:MM times, for example 10:30.');

const bookAppointmentSchema = z.object({
  patientId: z.string().trim().min(1, 'Choose the patient for this follow-up.').max(32),
  doctorId: objectId.optional(),
  date: localDate,
  startTime: time,
  reason: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const rescheduleAppointmentSchema = z.object({
  date: localDate,
  startTime: time,
  doctorId: objectId.optional(),
}).strict();

const appointmentStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled', 'no_show']),
  reason: z.string().trim().max(300).optional(),
}).strict();

module.exports = { appointmentStatusSchema, bookAppointmentSchema, rescheduleAppointmentSchema };
