/**
 * @file SequenceCounter.js
 * @description Atomic sequence generator for per-employee monotonic outbox event sequencing.
 */

const mongoose = require('mongoose');

const SequenceCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // 'seq_emp_<employeeId>'
      required: true
    },
    lastSeq: {
      type: Number,
      default: 0
    }
  },
  {
    collection: 'sequence_counters'
  }
);

module.exports = mongoose.model('SequenceCounter', SequenceCounterSchema);
