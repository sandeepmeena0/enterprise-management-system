/**
 * @file TimeTrackingAuditLog.js
 * @description Append-only historical audit trail for all timer and temporal mutations.
 * Committed atomically with the business state transition inside the MongoDB transaction.
 */

const mongoose = require('mongoose');

const TimeTrackingAuditLogSchema = new mongoose.Schema(
  {
    // Actor Information (Who executed the command)
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null // Null allowed strictly for SYSTEM_DAEMON actions
    },
    actorType: {
      type: String,
      enum: ['EMPLOYEE', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'SYSTEM'],
      required: true
    },
    // Subject Information (Whose timer/records were modified)
    targetEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Target employee ID is required']
    },
    // Associated Task
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
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
        'SYSTEM_TIMEOUT'
      ],
      required: true,
      index: true
    },
    previousState: {
      timerStatus: { type: String, default: 'IDLE' },
      activeTaskId: { type: mongoose.Schema.Types.ObjectId, default: null },
      activeSessionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      version: { type: Number, default: 0 }
    },
    newState: {
      timerStatus: { type: String, required: true },
      activeTaskId: { type: mongoose.Schema.Types.ObjectId, default: null },
      activeSessionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      version: { type: Number, required: true }
    },
    reason: {
      type: String,
      default: null // Mandatory for all administrative/delegated actions
    },
    source: {
      type: String,
      enum: ['EMPLOYEE_PORTAL', 'ADMIN_PORTAL', 'SYSTEM_DAEMON', 'OFFLINE_RECONCILIATION'],
      required: true
    },
    requestId: {
      type: String, // Idempotency key or request UUID
      default: null,
      index: true
    },
    clientIp: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false, // Immutable append-only
    collection: 'time_tracking_audit_logs'
  }
);

TimeTrackingAuditLogSchema.index({ targetEmployeeId: 1, timestamp: -1 });
TimeTrackingAuditLogSchema.index({ actorId: 1, timestamp: -1 });
TimeTrackingAuditLogSchema.index({ taskId: 1, timestamp: -1 });

module.exports = mongoose.model('TimeTrackingAuditLog', TimeTrackingAuditLogSchema);
