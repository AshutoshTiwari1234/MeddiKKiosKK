const AppError = require('../utils/AppError');

function validate(schema) {
  return async (request, _response, next) => {
    try {
      request.validatedBody = await schema.parseAsync(request.body);
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        return next(new AppError(error.issues.map((issue) => issue.message).join(' '), 400));
      }
      next(error);
    }
  };
}

module.exports = validate;
