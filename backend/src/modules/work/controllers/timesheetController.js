/**
 * @file timesheetController.js
 * @description Controller for Timesheet and Time Tracking in EMS Work Module.
 */

const Timesheet = require('../models/Timesheet');
const Task = require('../models/Task');

// @desc    Get timesheet entries with filters
// @route   GET /api/timesheet
exports.getTimesheets = async (req, res, next) => {
  try {
    const { employeeId, projectId, taskId, date, status, search } = req.query;
    let query = {};

    if (employeeId && employeeId !== 'all') {
      query.$or = [{ employee: employeeId }, { employeeId: employeeId }];
    }
    if (projectId && projectId !== 'all') {
      query.$or = [{ project: projectId }, { projectId: projectId }];
    }
    if (taskId && taskId !== 'all') {
      query.$or = [{ task: taskId }, { taskId: taskId }];
    }
    if (date) {
      query.date = date;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { taskTitle: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
        { employeeName: { $regex: search, $options: 'i' } },
        { memo: { $regex: search, $options: 'i' } }
      ];
    }

    const timesheets = await Timesheet.find(query).sort({ date: -1, createdAt: -1 });
    res.status(200).json({
      success: true,
      count: timesheets.length,
      data: timesheets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log manual time entry
// @route   POST /api/timesheet
exports.createTimesheet = async (req, res, next) => {
  try {
    const timesheet = await Timesheet.create(req.body);

    // If linked to a task, increment task logged hours
    if (req.body.taskId) {
      const durationHours = (req.body.totalDurationSeconds || 0) / 3600;
      await Task.findByIdAndUpdate(req.body.taskId, {
        $inc: { hoursLogged: durationHours }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Time logged successfully',
      data: timesheet
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stop running timer and save duration
// @route   POST /api/timesheet/stop
exports.stopTimer = async (req, res, next) => {
  try {
    const { taskId, totalDurationSeconds, endTime, memo } = req.body;
    
    // Update task
    const task = await Task.findById(taskId);
    if (task) {
      task.timerRunning = false;
      const hoursAdded = totalDurationSeconds / 3600;
      task.hoursLogged = Number(((task.hoursLogged || 0) + hoursAdded).toFixed(2));
      const hrs = Math.floor(totalDurationSeconds / 3600);
      const mins = Math.floor((totalDurationSeconds % 3600) / 60);
      task.hoursLoggedText = `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
      await task.save();
    }

    // Format duration text
    const hrs = String(Math.floor(totalDurationSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalDurationSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalDurationSeconds % 60).padStart(2, '0');
    const durationText = `${hrs}:${mins}:${secs}`;

    const newLog = await Timesheet.create({
      task: task?._id || null,
      taskId: task?._id?.toString() || taskId,
      taskCode: task?.taskCode || '',
      taskTitle: task?.title || 'Tracked Session',
      project: task?.project || null,
      projectId: task?.projectId || '',
      projectName: task?.projectName || 'General Work',
      employee: task?.assignedTo || null,
      employeeId: task?.assignedToId || '',
      employeeName: task?.assignedToName || 'Current User',
      employeeAvatar: task?.assignedToAvatar || '',
      employeeRole: task?.assignedToRole || '',
      date: new Date().toISOString().split('T')[0],
      startTime: req.body.startTime || new Date(Date.now() - totalDurationSeconds * 1000).toTimeString().split(' ')[0],
      endTime: endTime || new Date().toTimeString().split(' ')[0],
      totalDurationSeconds,
      totalDurationText: durationText,
      memo: memo || 'Live work session completed',
      status: 'stopped'
    });

    res.status(200).json({
      success: true,
      message: 'Timer stopped and duration logged to timesheet!',
      data: newLog
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete timesheet entry
// @route   DELETE /api/timesheet/:id
exports.deleteTimesheet = async (req, res, next) => {
  try {
    const timesheet = await Timesheet.findByIdAndDelete(req.params.id);
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet entry not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Timesheet entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
