const express = require('express');
const router = express.Router();
const {
  getTimesheets,
  createTimesheet,
  stopTimer,
  deleteTimesheet
} = require('../controllers/timesheetController');

router.route('/')
  .get(getTimesheets)
  .post(createTimesheet);

router.route('/stop')
  .post(stopTimer);

router.route('/:id')
  .delete(deleteTimesheet);

module.exports = router;
