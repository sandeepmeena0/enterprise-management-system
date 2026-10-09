/**
 * @file taskController.js
 * @description Controller for Tasks in EMS Work Module.
 */

const Task = require('../models/Task');
const Timesheet = require('../models/Timesheet');

// @desc    Get all tasks with filters
// @route   GET /api/tasks
exports.getTasks = async (req, res, next) => {
  try {
    const { projectId, status, priority, assignedTo, search, hideCompleted } = req.query;
    let query = {};

    if (projectId && projectId !== 'all') {
      query.projectId = projectId;
    }
    if (status && status !== 'all') {
      query.status = status;
    } else if (hideCompleted === 'true' || hideCompleted === true) {
      query.status = { $ne: 'completed' };
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (assignedTo && assignedTo !== 'all') {
      query.$or = [{ assignedTo: assignedTo }, { assignedToId: assignedTo }];
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { taskCode: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
        { assignedToName: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
exports.getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
exports.createTask = async (req, res, next) => {
  try {
    const count = await Task.countDocuments();
    const taskData = {
      ...req.body,
      taskCode: req.body.taskCode || `TSK-${count + 1}`
    };
    const task = await Task.create(taskData);
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'completed') {
      update.completedOn = new Date().toISOString().split('T')[0];
      update.timerRunning = false;
    }

    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({
      success: true,
      message: `Task status updated to ${status}`,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
