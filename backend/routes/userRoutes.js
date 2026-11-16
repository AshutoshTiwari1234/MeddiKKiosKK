const express = require('express');
const { createUser, listUsers, rejectAccountRequest, updateUserStatus } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');
const validate = require('../middleware/validate');
const { createUserSchema, userStatusSchema } = require('../schemas/authSchemas');

const router = express.Router();
router.use(requireDatabase, authenticate, requireRole('administrator'));
router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.delete('/:userId', rejectAccountRequest);
router.patch('/:userId/status', validate(userStatusSchema), updateUserStatus);

module.exports = router;
