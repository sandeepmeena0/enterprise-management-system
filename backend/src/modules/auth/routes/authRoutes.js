const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  logout,
  logoutAll,
  changePassword,
  adminResetPassword,
  forgotPassword
} = require('../controllers/authController');
const { authenticateUser } = require('../../../shared/middleware/authMiddleware');

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Authenticated session & credential management routes
router.get('/me', authenticateUser, getMe);
router.post('/change-password', authenticateUser, changePassword);
router.put('/change-password', authenticateUser, changePassword);
router.post('/admin-reset-password', authenticateUser, adminResetPassword);
router.post('/logout', authenticateUser, logout);
router.post('/logout-all', authenticateUser, logoutAll);

module.exports = router;
