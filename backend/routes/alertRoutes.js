const express = require('express');
const { z } = require('zod');
const { listEmergencyAlerts, updateEmergencyAlert } = require('../controllers/emergencyAlertController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'));
router.get('/', listEmergencyAlerts);
router.patch('/:alertId', validate(z.object({ status: z.enum(['acknowledged', 'resolved']) }).strict()), updateEmergencyAlert);

module.exports = router;
