const { z } = require('zod');
const { TIME_PATTERN } = require('../utils/clinicTime');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid staff account.');
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for the session date.');
const time = z.string().regex(TIME_PATTERN, 'Use 24-hour HH:MM times, for example 09:30.');
const shift = z.enum(['morning', 'afternoon', 'evening', 'custom']);

const sessionFields = {
  doctorId: objectId,
  department: z.string().trim().min(1).max(100).optional(),
  date: localDate,
  shift,
  startTime: time.optional(),
  endTime: time.optional(),
  cabin: z.string().trim().min(1, 'Choose a cabin for this session.').max(50),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  maxPatients: z.number().int().min(1).max(500).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
};

const createSessionSchema = z.object({
  ...sessionFields,
  doctorId: objectId.optional(),
}).strict().refine((value) => value.shift !== 'custom' || (value.startTime && value.endTime), {
  message: 'Custom shifts need a start time and an end time.',
});

const updateSessionSchema = z.object({
  department: sessionFields.department,
  date: localDate.optional(),
  shift: shift.optional(),
  startTime: sessionFields.startTime,
  endTime: sessionFields.endTime,
  cabin: sessionFields.cabin.optional(),
  slotMinutes: sessionFields.slotMinutes,
  maxPatients: sessionFields.maxPatients,
  notes: sessionFields.notes,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'Send at least one field to update.' });

const sessionStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled']),
  reason: z.string().trim().max(300).optional(),
}).strict();

module.exports = { createSessionSchema, sessionStatusSchema, updateSessionSchema };
