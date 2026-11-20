const express = require('express');
const { bookAppointment, getAppointment, getAvailability, listAppointments, rescheduleAppointment, updateAppointmentStatus } = require('../controllers/appointmentController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');
const { appointmentStatusSchema, bookAppointmentSchema, rescheduleAppointmentSchema } = require('../schemas/appointmentSchemas');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'));
router.get('/', listAppointments);
router.get('/availability', getAvailability);
router.get('/:appointmentId', getAppointment);
router.post('/', requireRole('administrator', 'doctor'), validate(bookAppointmentSchema), bookAppointment);
router.patch('/:appointmentId/reschedule', requireRole('administrator', 'doctor'), validate(rescheduleAppointmentSchema), rescheduleAppointment);
router.patch('/:appointmentId/status', requireRole('administrator', 'doctor'), validate(appointmentStatusSchema), updateAppointmentStatus);

module.exports = router;
