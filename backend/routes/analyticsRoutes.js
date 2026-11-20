const express = require('express');
const { getOpdAnalytics } = require('../controllers/analyticsController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'));
router.get('/opd', getOpdAnalytics);

module.exports = router;
