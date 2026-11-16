/**
 * @file IdempotencyLog.js
 * @description Model for crash-safe idempotent timer operations.
 * Scoped by actorId and idempotencyKey to prevent cross-employee key collisions.
 */

const mongoose = require('mongoose');

const IdempotencyLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    targetEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true
    },
    idempotencyKey: {
      type: String,
      required: true
    },
    requestHash: {
      type: String,
      required: true
    },
    operationType: {
      type: String,
      enum: ['START', 'PAUSE', 'RESUME', 'STOP', 'COMPLETE', 'HEARTBEAT', 'OFFLINE_SYNC'],
      required: true
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'IN_PROGRESS'
    },
    leaseToken: {
      type: String,
      default: null,
      index: true
    },
    leaseExpiresAt: {
      type: Date,
      required: true
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    httpStatusCode: {
      type: Number,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index (30 days)
    }
  },
  {
    timestamps: true,
    collection: 'idempotency_logs'
  }
);

// Compound unique index guarantees key uniqueness scoped strictly to the acting user
IdempotencyLogSchema.index({ actorId: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('IdempotencyLog', IdempotencyLogSchema);
