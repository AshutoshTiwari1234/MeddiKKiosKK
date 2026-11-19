const mongoose = require('mongoose');

const SESSION_SHIFTS = ['morning', 'afternoon', 'evening', 'custom'];
const SESSION_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'];

const clinicSessionSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  department: { type: String, required: true, trim: true, maxlength: 100 },
  // Local calendar day at 00:00.
  date: { type: Date, required: true },
  shift: { type: String, enum: SESSION_SHIFTS, required: true },
  // Minutes since local midnight, so overlap checks are simple comparisons.
  startMinute: { type: Number, required: true, min: 0, max: 1439 },
  endMinute: { type: Number, required: true, min: 1, max: 1440 },
  cabin: { type: String, required: true, trim: true, maxlength: 50 },
  // Normalized cabin name used for conflict checks ("Cabin 3" == "cabin  3").
  cabinKey: { type: String, required: true, maxlength: 50 },
  slotMinutes: { type: Number, min: 5, max: 120, default: 15 },
  maxPatients: { type: Number, min: 1, max: 500, default: null },
  status: { type: String, enum: SESSION_STATUSES, default: 'scheduled', index: true },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancellationReason: { type: String, trim: true, maxlength: 300, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, versionKey: false });

clinicSessionSchema.index({ date: 1, doctor: 1, startMinute: 1 });
clinicSessionSchema.index({ date: 1, cabinKey: 1, startMinute: 1 });

clinicSessionSchema.statics.normalizeCabin = (cabin) => cabin.trim().replace(/\s+/g, ' ').toLowerCase();

module.exports = mongoose.model('ClinicSession', clinicSessionSchema);
module.exports.SESSION_SHIFTS = SESSION_SHIFTS;
module.exports.SESSION_STATUSES = SESSION_STATUSES;
