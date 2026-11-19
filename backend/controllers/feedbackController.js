const { randomBytes } = require('node:crypto');
const Feedback = require('../models/Feedback');
const AppError = require('../utils/AppError');

async function submitFeedback(request, response) {
  const retryKey = request.get('Idempotency-Key');
  if (retryKey !== undefined && !/^[0-9a-f]{32}$/.test(retryKey)) {
    throw new AppError('Idempotency-Key must contain 32 lowercase hexadecimal characters.', 400);
  }

  // MongoDB's unique _id makes the first insert for a retry key win.
  const feedbackId = retryKey ?? randomBytes(16).toString('hex');
  let status = 201;
  try {
    await Feedback.create({ _id: feedbackId, rating: request.validatedBody.rating });
  } catch (error) {
    if (error.code !== 11000 || error.keyValue?._id !== feedbackId) throw error;
    status = 200;
  }
  response.status(status).json({ message: 'Feedback received.' });
}

async function getFeedbackAverage(_request, response) {
  const [summary] = await Feedback.aggregate([
    { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    { $project: { _id: 0, averageRating: 1, count: 1 } },
  ]);
  response.json(summary ?? { averageRating: null, count: 0 });
}

module.exports = { submitFeedback, getFeedbackAverage };
