const mongoose = require('mongoose');

const APPOINTMENT_STATUSES = ['booked', 'completed', 'cancelled', 'no_show'];

const followUpAppointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicSession', required: true, index: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  durationMinutes: { type: Number, required: true, min: 5, max: 120 },
  reason: { type: String, trim: true, maxlength: 300, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: 'booked', index: true },
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancellationReason: { type: String, trim: true, maxlength: 300, default: '' },
  rescheduledFrom: [{ startAt: Date, endAt: Date, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, changedAt: Date, _id: false }],
}, { timestamps: true, versionKey: false });

// Database-level guards against double booking when two requests race:
// a doctor's slot can hold one booked appointment, and a patient can hold
// one booked follow-up per clinic session.
followUpAppointmentSchema.index(
  { doctor: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' }, name: 'unique_booked_doctor_slot' },
);
followUpAppointmentSchema.index(
  { patient: 1, session: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' }, name: 'unique_booked_patient_session' },
);
followUpAppointmentSchema.index({ doctor: 1, startAt: 1, endAt: 1 });
followUpAppointmentSchema.index({ patient: 1, startAt: 1 });

module.exports = mongoose.model('FollowUpAppointment', followUpAppointmentSchema);
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES;
