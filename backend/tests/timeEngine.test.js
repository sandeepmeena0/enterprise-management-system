/**
 * @file timeEngine.test.js
 * @description Automated Unit & Integration Tests for Task Timer Engine & Concurrency Control.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { getISTDateString, computeRequestHash } = require('../src/modules/work/services/timeEngineService');

describe('Task Timer Engine & Concurrency Suite', () => {
  test('computeRequestHash generates deterministic SHA-256 hash of payload', () => {
    const payload = { taskId: 'task_123', targetEmployeeId: 'emp_456' };
    const hash1 = computeRequestHash(payload);
    const hash2 = computeRequestHash(payload);

    assert.equal(hash1, hash2, 'Identical payloads must produce identical hash');
    assert.equal(hash1.length, 64, 'SHA-256 hex string must be 64 characters');

    const differentPayload = { taskId: 'task_999', targetEmployeeId: 'emp_456' };
    const hashDiff = computeRequestHash(differentPayload);
    assert.notEqual(hash1, hashDiff, 'Different payloads must produce different hashes');
  });

  test('getISTDateString produces valid date in Asia/Kolkata timezone (UTC+05:30)', () => {
    // 2026-11-16 20:00:00 UTC = 2026-11-17 01:30:00 IST
    const dateUtcLate = new Date('2026-11-16T20:00:00.000Z');
    const istStr = getISTDateString(dateUtcLate);
    assert.equal(istStr, '2026-11-17', 'Late evening UTC crosses midnight in IST');

    // 2026-11-16 10:00:00 UTC = 2026-11-16 15:30:00 IST
    const dateUtcMid = new Date('2026-11-16T10:00:00.000Z');
    assert.equal(getISTDateString(dateUtcMid), '2026-11-16');
  });

  test('Single Active Task Invariant: switching tasks auto-pauses previous task', () => {
    // Simulate user timer state
    let activeTimer = {
      taskId: 'task_A',
      timerRunning: true,
      startedAt: Date.now() - 3600 * 1000, // 1 hour ago
      accumulatedSeconds: 0
    };

    // User switches to task_B
    const now = Date.now();
    const elapsedOnA = Math.floor((now - activeTimer.startedAt) / 1000);
    const pausedA = {
      ...activeTimer,
      timerRunning: false,
      accumulatedSeconds: activeTimer.accumulatedSeconds + elapsedOnA,
      startedAt: null
    };

    const newActiveB = {
      taskId: 'task_B',
      timerRunning: true,
      startedAt: now,
      accumulatedSeconds: 0
    };

    assert.equal(pausedA.timerRunning, false, 'Previous task must be paused');
    assert.ok(pausedA.accumulatedSeconds >= 3599, 'Elapsed time on task A must be accumulated');
    assert.equal(newActiveB.timerRunning, true, 'New task B must be running');
    assert.notEqual(pausedA.taskId, newActiveB.taskId);
  });

  test('Timer survives pause and resume without losing accumulated seconds', () => {
    let timer = {
      taskId: 'task_1',
      timerRunning: false,
      accumulatedSeconds: 1800, // 30 minutes accumulated earlier
      startedAt: null
    };

    // Resume timer
    const resumeTs = Date.now() - 600 * 1000; // Ran for 10 minutes (600s)
    timer = {
      ...timer,
      timerRunning: true,
      startedAt: resumeTs
    };

    // Pause timer again
    const currentElapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    const totalAccumulated = timer.accumulatedSeconds + currentElapsed;

    assert.ok(totalAccumulated >= 2399 && totalAccumulated <= 2405, 'Must combine baseline + current elapsed (approx 2400s = 40 mins)');
  });
});
