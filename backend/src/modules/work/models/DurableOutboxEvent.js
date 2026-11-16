/**
 * @file DurableOutboxEvent.js
 * @description Transactional outbox event model for durable, sequenced cross-instance Socket.IO dispatch.
 * Inserted atomically inside the same MongoDB transaction as state transitions.
 */

const mongoose = require('mongoose');

const DurableOutboxEventSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    seq: {
      type: Number,
      required: true
    },
    eventType: {
      type: String,
      enum: [
        'TIMER_STARTED',
        'TIMER_PAUSED',
        'TIMER_RESUMED',
        'TIMER_STOPPED',
        'TASK_COMPLETED',
        'TASK_SWITCHED',
        'BREAK_PAUSE',
        'CLOCK_OUT_PAUSE',
        'MIDNIGHT_ROLLOVER',
        'HEARTBEAT_TICK'
      ],
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    leaseOwner: {
      type: String,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0
    },
    nextRetryAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: null
    },
    publishedAt: {
      type: Date,
      default: null // Set strictly upon successful publication
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false,
    collection: 'durable_outbox_events'
  }
);

// Strict unique constraint guarantees monotonic sequence without gaps or duplicates per employee
DurableOutboxEventSchema.index({ employeeId: 1, seq: 1 }, { unique: true });

// Compound index for atomic lease polling and worker acquisition
DurableOutboxEventSchema.index({ status: 1, leaseExpiresAt: 1 });
DurableOutboxEventSchema.index({ employeeId: 1, status: 1, seq: 1 });

// TTL index: Retention applies ONLY after successful publication!
// MongoDB TTL index ignores documents where publishedAt is null (PENDING or retrying events NEVER expire)
DurableOutboxEventSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 14 * 86400 });

module.exports = mongoose.model('DurableOutboxEvent', DurableOutboxEventSchema);
