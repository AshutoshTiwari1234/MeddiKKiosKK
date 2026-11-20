const express = require('express');
const { createSession, getCabinAllocation, getSession, listSessions, updateSession, updateSessionStatus } = require('../controllers/clinicSessionController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');
const { createSessionSchema, sessionStatusSchema, updateSessionSchema } = require('../schemas/clinicSessionSchemas');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'));
router.get('/', listSessions);
router.get('/cabins', getCabinAllocation);
router.get('/:sessionId', getSession);
router.post('/', requireRole('administrator', 'doctor'), validate(createSessionSchema), createSession);
router.patch('/:sessionId', requireRole('administrator', 'doctor'), validate(updateSessionSchema), updateSession);
router.patch('/:sessionId/status', requireRole('administrator', 'doctor'), validate(sessionStatusSchema), updateSessionStatus);

module.exports = router;
