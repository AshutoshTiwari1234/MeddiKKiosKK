const bcrypt = require('bcrypt');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');

async function listUsers(_request, response) {
  const users = await User.find().select('name email role department approvalStatus active lastLoginAt createdAt').sort({ createdAt: -1 }).limit(200);
  response.json({ users });
}

async function createUser(request, response) {
  const { name, email, password, role, department } = request.validatedBody;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({ name, email, passwordHash, role, department });
    await recordAudit(request, { action: 'user.create', resourceType: 'user', resourceId: user._id });
    response.status(201).json({ user: user.toJSON() });
  } catch (error) {
    if (error.code === 11000) throw new AppError('An account with this email already exists.', 409);
    throw error;
  }
}

async function updateUserStatus(request, response) {
  const { active } = request.validatedBody;
  if (request.params.userId === request.user.id && !active) {
    throw new AppError('You cannot deactivate your own account.', 400);
  }

  const target = await User.findById(request.params.userId).select('role active approvalStatus');
  if (!target) throw new AppError('User not found.', 404);
  if (!active && target.active && ['administrator', 'admin'].includes(target.role)) {
    const activeAdministrators = await User.countDocuments({ role: { $in: ['administrator', 'admin'] }, active: true });
    if (activeAdministrators <= 1) throw new AppError('The last active administrator cannot be deactivated.', 409);
  }

  const user = await User.findByIdAndUpdate(request.params.userId, {
    active,
    ...(active ? { approvalStatus: 'approved', lockUntil: null, failedLoginAttempts: 0 } : { $inc: { sessionVersion: 1 } }),
  }, { returnDocument: 'after', runValidators: true })
    .select('name email role department approvalStatus active lastLoginAt createdAt');
  if (!user) throw new AppError('User not found.', 404);

  await recordAudit(request, { action: active ? 'user.activate' : 'user.deactivate', resourceType: 'user', resourceId: user._id });
  response.json({ user });
}

async function rejectAccountRequest(request, response) {
  const target = await User.findOneAndDelete({ _id: request.params.userId, approvalStatus: 'pending', active: false });
  if (!target) throw new AppError('Pending account request not found.', 404);
  await recordAudit(request, { action: 'user.account_request.reject', resourceType: 'user', resourceId: target._id });
  response.status(204).end();
}

module.exports = { createUser, listUsers, rejectAccountRequest, updateUserStatus };
