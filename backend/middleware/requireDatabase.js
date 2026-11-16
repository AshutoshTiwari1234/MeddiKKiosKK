const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

function requireDatabase(_request, _response, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(new AppError('The database is unavailable. Configure MongoDB and try again.', 503));
  }
  next();
}

module.exports = requireDatabase;
