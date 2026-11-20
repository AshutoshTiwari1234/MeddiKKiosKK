const express = require('express');
const { getDepartmentDirectory } = require('../controllers/departmentDirectoryController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');

const router = express.Router();
router.get('/directory', requireDatabase, authenticate, requireRole('administrator', 'doctor', 'receptionist'), getDepartmentDirectory);

module.exports = router;
