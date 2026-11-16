const AppError = require('../utils/AppError');
const { hashIntakeToken, isIntakeToken } = require('../utils/intakeToken');

function requireIntakeToken(request, _response, next) {
  const token = request.get('x-intake-token');
  if (!isIntakeToken(token)) {
    return next(new AppError('This check-in session is invalid. Please ask reception for help.', 401));
  }
  request.intakeCredentialHash = hashIntakeToken(token);
  next();
}

module.exports = requireIntakeToken;
