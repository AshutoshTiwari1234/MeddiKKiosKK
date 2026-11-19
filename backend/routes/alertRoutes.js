const express = require('express');
const { z } = require('zod');
const {
  acknowledgeEmergencyAlert,
  escalateEmergencyAlert,
  getEmergencyAlert,
  listEmergencyAlerts,
  resolveEmergencyAlert,
  updateEmergencyAlert,
} = require('../controllers/emergencyAlertController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'));

const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'escalated', 'resolved']),
  note: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(2000).optional(),
  level: z.enum(['rapid_response', 'senior_doctor', 'icu', 'general_medical']).optional(),
  severity: z.enum(['critical', 'high', 'moderate']).optional(),
  resolutionNotes: z.string().trim().max(3000).optional(),
  notes: z.string().trim().max(3000).optional(),
}).strict();

const acknowledgeSchema = z.object({
  note: z.string().trim().max(1000).optional(),
}).strict();

const escalateSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  level: z.enum(['rapid_response', 'senior_doctor', 'icu', 'general_medical']).default('senior_doctor'),
  severity: z.enum(['critical', 'high', 'moderate']).default('critical'),
}).strict();

const resolveSchema = z.object({
  resolutionNotes: z.string().trim().max(3000).optional(),
  notes: z.string().trim().max(3000).optional(),
}).strict();

router.get('/', listEmergencyAlerts);
router.get('/:alertId', getEmergencyAlert);
router.post('/:alertId/acknowledge', validate(acknowledgeSchema), acknowledgeEmergencyAlert);
router.post('/:alertId/escalate', validate(escalateSchema), escalateEmergencyAlert);
router.post('/:alertId/resolve', validate(resolveSchema), resolveEmergencyAlert);
router.patch('/:alertId', validate(updateAlertSchema), updateEmergencyAlert);

module.exports = router;
