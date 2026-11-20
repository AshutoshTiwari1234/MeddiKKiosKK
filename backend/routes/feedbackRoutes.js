const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { submitFeedback, getFeedbackAverage } = require('../controllers/feedbackController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');
const AppError = require('../utils/AppError');

const router = express.Router();
const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5) }).strict();
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, _response, next) => next(new AppError('Too many feedback requests. Please try again later.', 429)),
});

router.use(requireDatabase);
router.post('/', feedbackLimiter, validate(feedbackSchema), submitFeedback);
router.get('/average', authenticate, requireRole('administrator'), getFeedbackAverage);

module.exports = router;
