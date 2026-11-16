const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { changePassword, currentUser, login, logout, requestAccount } = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');
const { accountRequestSchema, changePasswordSchema, loginSchema } = require('../schemas/authSchemas');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const accountRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

router.use(requireDatabase);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/account-requests', accountRequestLimiter, validate(accountRequestSchema), requestAccount);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, currentUser);
router.post('/password', authenticate, validate(changePasswordSchema), changePassword);

module.exports = router;
