const express = require('express');
const router = express.Router();
const { login, getMe, logout, logoutAll } = require('../controllers/authController');
const { authenticateUser } = require('../../../shared/middleware/authMiddleware');

router.post('/login', login);
router.get('/me', authenticateUser, getMe);
router.post('/logout', authenticateUser, logout);
router.post('/logout-all', authenticateUser, logoutAll);

module.exports = router;
