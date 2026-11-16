/**
 * @file workSessionRoutes.js
 * @description Routes for unified server-authoritative Task Timer & Work Sessions.
 */

const express = require('express');
const router = express.Router();
const timerController = require('../controllers/timerController');

// All routes are mounted behind /api/work-sessions and protected by authenticateUser middleware
router.post('/start', timerController.startTimer);
router.post('/pause', timerController.pauseTimer);
router.post('/resume', timerController.resumeTimer);
router.post('/stop', timerController.stopTimer);
router.post('/complete', timerController.completeTask);
router.get('/active', timerController.getActiveTimer);
router.get('/', timerController.getWorkSessions);

module.exports = router;
