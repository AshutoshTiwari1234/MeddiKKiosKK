const bcrypt = require('bcrypt');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, cookieOptions, signSession } = require('../utils/auth');
const { recordAudit } = require('../services/auditService');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('medikiosk-invalid-account-check', 12);
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

async function requestAccount(request, response) {
  const { name, email, password, role, department } = request.validatedBody;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ name, email, passwordHash, role, department, active: false, approvalStatus: 'pending' });
    await recordAudit(request, { action: 'auth.account_request', resourceType: 'user', resourceId: user._id });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  response.status(202).json({ message: 'If a new request was accepted, it is pending administrator approval and cannot sign in yet. Ask your hospital administrator to check Staff accounts.' });
}

async function login(request, response) {
  const { email, password } = request.validatedBody;
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockUntil +sessionVersion');
  const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);
  const isLocked = user?.lockUntil && user.lockUntil > new Date();
  const isStaffAccount = user && ROLES.includes(user.role);
  const isApproved = user?.approvalStatus !== 'pending';

  if (!user || !passwordMatches || !user.active || !isApproved || isLocked || !isStaffAccount) {
    if (user && isStaffAccount && isApproved && !isLocked) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= MAX_FAILED_ATTEMPTS) user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      await user.save();
    }
    await recordAudit(request, { actorId: user?._id || null, action: 'auth.login', resourceType: 'user', outcome: 'denied' });
    throw new AppError('Email or password is incorrect, or this account is unavailable.', 401);
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
  response.cookie(COOKIE_NAME, signSession(user._id, user.sessionVersion || 0), cookieOptions());
  await recordAudit(request, { actorId: user._id, action: 'auth.login', resourceType: 'user', resourceId: user._id });
  response.json({ user: user.toJSON() });
}

async function logout(request, response) {
  const actorId = request.cookies?.[COOKIE_NAME] ? request.user?._id : null;
  if (actorId) await recordAudit(request, { actorId, action: 'auth.logout', resourceType: 'user', resourceId: actorId });
  response.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  response.status(204).end();
}

function currentUser(request, response) {
  response.json({ user: request.user.toJSON() });
}

async function changePassword(request, response) {
  const { currentPassword, newPassword } = request.validatedBody;
  const user = await User.findById(request.user._id).select('+passwordHash +sessionVersion');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect.', 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  response.cookie(COOKIE_NAME, signSession(user._id, user.sessionVersion), cookieOptions());
  await recordAudit(request, { action: 'auth.password_change', resourceType: 'user', resourceId: user._id });
  response.json({ message: 'Password updated successfully.' });
}

module.exports = { changePassword, currentUser, login, logout, requestAccount };
