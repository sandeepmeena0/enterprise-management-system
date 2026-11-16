/**
 * @file ActiveTaskTimer.js
 * @description Mongoose model representing the single authoritative operational timer state per employee.
 * One employee can have strictly at most ONE operational timer state (IDLE, RUNNING, or PAUSED).
 */

const mongoose = require('mongoose');

const ActiveTaskTimerSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
      unique: true // Strictly one operational timer state per employee
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    activeSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkSession',
      default: null
    },
    status: {
      type: String,
      enum: ['IDLE', 'RUNNING', 'PAUSED'],
      default: 'IDLE',
      required: true
    },
    startedAt: {
      type: Date,
      default: null
    },
    lastHeartbeatAt: {
      type: Date,
      default: null
    },
    // Ephemeral snapshot of the most recent operational trigger
    lastActionContext: {
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
      },
      performerRole: {
        type: String,
        enum: ['EMPLOYEE', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'SYSTEM', null],
        default: null
      },
      actionType: {
        type: String,
        enum: [
          'START',
          'PAUSE',
          'RESUME',
          'STOP',
          'COMPLETE',
          'TASK_SWITCH',
          'BREAK_PAUSE',
          'CLOCK_OUT_PAUSE',
          'MIDNIGHT_ROLLOVER',
          'ADMIN_FORCE_PAUSE',
          'ADMIN_FORCE_STOP',
          'ADMIN_FORCE_CLOCK_OUT',
          'ADMIN_REASSIGN',
          'SYSTEM_TIMEOUT',
          null
        ],
        default: null
      },
      reason: {
        type: String,
        default: null
      },
      requestId: {
        type: String,
        default: null
      },
      timestamp: {
        type: Date,
        default: null
      }
    },
    version: {
      type: Number,
      default: 0,
      required: true // Optimistic Concurrency Control (OCC)
    }
  },
  {
    timestamps: true,
    collection: 'active_task_timers'
  }
);

ActiveTaskTimerSchema.index({ status: 1, lastHeartbeatAt: 1 });

module.exports = mongoose.model('ActiveTaskTimer', ActiveTaskTimerSchema);
