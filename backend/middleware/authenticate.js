const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, verifySession } = require('../utils/auth');

async function authenticate(request, _response, next) {
  try {
    const token = request.cookies?.[COOKIE_NAME];
    if (!token) return next(new AppError('Please sign in to continue.', 401));

    const payload = verifySession(token);
    const user = await User.findById(payload.sub).select('name email role department active +sessionVersion');
    if (!user || !user.active) return next(new AppError('Your session is no longer active. Please sign in again.', 401));
    if ((payload.sv || 0) !== user.sessionVersion) return next(new AppError('Your session has expired. Please sign in again.', 401));

    request.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please sign in again.', 401));
    }
    next(error);
  }
}

function requireRole(...roles) {
  return (request, _response, next) => {
    const normalizedRole = request.user?.role === 'admin' ? 'administrator' : request.user?.role;
    if (!request.user || !roles.includes(normalizedRole)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
