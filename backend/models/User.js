const mongoose = require('mongoose');

const ROLES = ['administrator', 'admin', 'doctor', 'receptionist'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  department: { type: String, trim: true, maxlength: 100, default: '' },
  approvalStatus: { type: String, enum: ['pending', 'approved'], default: 'approved', index: true },
  active: { type: Boolean, default: true, index: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, default: null, select: false },
  sessionVersion: { type: Number, default: 0, select: false },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', {
  transform(_document, value) {
    if (value.role === 'admin') value.role = 'administrator';
    delete value.passwordHash;
    delete value.failedLoginAttempts;
    delete value.lockUntil;
    delete value.sessionVersion;
    return value;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
