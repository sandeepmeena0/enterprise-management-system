/**
 * @file WorkSession.js
 * @description Mongoose model representing discrete, immutable temporal intervals [startTimestamp, actualEndTimestamp).
 * Uses exact millisecond storage (durationMs) to prevent boundary truncation.
 */

const mongoose = require('mongoose');

const WorkSessionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required']
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
      index: true
    },
    businessDate: {
      type: String, // 'YYYY-MM-DD' strictly evaluated in Asia/Kolkata
      required: [true, 'Business date is required'],
      index: true
    },
    startTimestamp: {
      type: Date,
      required: [true, 'Start timestamp is required'],
      index: true // Inclusive boundary: [startTimestamp, ...)
    },
    actualEndTimestamp: {
      type: Date,
      default: null // Exclusive boundary: [..., actualEndTimestamp)
    },
    inferredEndTimestamp: {
      type: Date,
      default: null // Inferred boundary on 16h timeout daemon
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['RUNNING', 'CLOSED', 'DISCARDED'],
      default: 'RUNNING',
      required: true,
      index: true
    },
    verificationStatus: {
      type: String,
      enum: [
        'VERIFIED',             // Real-time online session verified by server
        'PROVISIONAL_OFFLINE', // Submitted via offline queue, requires admin confirmation
        'PROVISIONAL_TIMEOUT', // 16h timeout closed by daemon, requires review
        'ADMIN_CONFIRMED',     // Approved by Admin/HR
        'REJECTED'             // Discarded by Admin/HR
      ],
      default: 'VERIFIED',
      required: true,
      index: true
    },
    splitReason: {
      type: String,
      enum: ['NONE', 'MIDNIGHT_ROLLOVER', 'SHIFT_INTERSECTION'],
      default: 'NONE'
    },
    parentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkSession',
      default: null
    },
    initiatedByActorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    },
    initiatedByActorType: {
      type: String,
      enum: ['EMPLOYEE', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'SYSTEM'],
      default: 'EMPLOYEE',
      required: true
    },
    terminatedByActorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    },
    terminatedByActorType: {
      type: String,
      enum: ['EMPLOYEE', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'SYSTEM', null],
      default: null
    },
    attendanceDiscrepancy: {
      type: String,
      enum: ['NONE', 'UNLINKED_TO_CLOCK_IN', 'SHIFT_MISMATCH'],
      default: 'NONE'
    },
    reconciliationAuditId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'work_sessions'
  }
);

// Database Integrity Constraint: AT MOST ONE RUNNING WorkSession per employee
WorkSessionSchema.index(
  { employeeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'RUNNING' } }
);

// Analytical and telemetry indexes
WorkSessionSchema.index({ employeeId: 1, businessDate: 1 });
WorkSessionSchema.index({ taskId: 1, businessDate: 1 });
WorkSessionSchema.index({ employeeId: 1, taskId: 1, businessDate: 1 });
WorkSessionSchema.index({ startTimestamp: 1, actualEndTimestamp: 1 });

module.exports = mongoose.model('WorkSession', WorkSessionSchema);
