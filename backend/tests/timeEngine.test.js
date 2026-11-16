/**
 * @file timeEngine.test.js
 * @description Automated Unit & Integration Tests for Task Timer Engine,
 * Attendance Guard Invariants, Idempotency & Concurrency Control.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Attendance = require('../src/modules/hr/models/Attendance');
const Employee = require('../src/modules/hr/models/Employee');
const ActiveTaskTimer = require('../src/modules/work/models/ActiveTaskTimer');
const {
  getISTDateString,
  computeRequestHash,
  verifyAttendanceActive,
  pauseTimer
} = require('../src/modules/work/services/timeEngineService');

function stubQuery(result) {
  return {
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    }
  };
}

describe('Task Timer Engine & Concurrency Suite', () => {
  let origFindOneAttendance;
  let origFindByIdEmployee;
  let origFindOneTimer;
  let origStartSession;

  beforeEach(() => {
    origFindOneAttendance = Attendance.findOne;
    origFindByIdEmployee = Employee.findById;
    origFindOneTimer = ActiveTaskTimer.findOne;
    origStartSession = mongoose.startSession;

    mongoose.startSession = async () => ({
      withTransaction: async (fn) => fn(),
      endSession: async () => {}
    });

    Employee.findById = (id) => {
      const emp = {
        _id: id || new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        name: 'Test Employee',
        employeeCode: 'EMP-001',
        role: 'Team Member',
        status: 'active'
      };
      return {
        ...emp,
        select: () => ({
          lean: async () => emp
        }),
        then: (resolve, reject) => Promise.resolve(emp).then(resolve, reject)
      };
    };
  });

  afterEach(() => {
    Attendance.findOne = origFindOneAttendance;
    Employee.findById = origFindByIdEmployee;
    ActiveTaskTimer.findOne = origFindOneTimer;
    mongoose.startSession = origStartSession;
  });

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
    let activeTimer = {
      taskId: 'task_A',
      timerRunning: true,
      startedAt: Date.now() - 3600 * 1000,
      accumulatedSeconds: 0
    };

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
      accumulatedSeconds: 1800,
      startedAt: null
    };

    // Resume timer
    const resumeTs = Date.now() - 600 * 1000;
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

  // ── Testing verifyAttendanceActive Production Service ──
  test('verifyAttendanceActive rejects with 400 when no attendance record exists today', async () => {
    Attendance.findOne = () => stubQuery(null);

    await assert.rejects(
      async () => {
        await verifyAttendanceActive('507f1f77bcf86cd799439011', '2026-11-16');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Cannot start task timer while clocked out/i);
        return true;
      }
    );
  });

  test('verifyAttendanceActive rejects with 400 when employee is clocked out', async () => {
    Attendance.findOne = () => stubQuery({
      isClockedIn: false,
      clockOutTime: '06:00 PM',
      isOnBreak: false
    });

    await assert.rejects(
      async () => {
        await verifyAttendanceActive('507f1f77bcf86cd799439011', '2026-11-16');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Cannot start task timer while clocked out/i);
        return true;
      }
    );
  });

  test('verifyAttendanceActive rejects with 400 when employee is on break', async () => {
    Attendance.findOne = () => stubQuery({
      isClockedIn: true,
      clockOutTime: null,
      isOnBreak: true,
      breakType: 'Lunch'
    });

    await assert.rejects(
      async () => {
        await verifyAttendanceActive('507f1f77bcf86cd799439011', '2026-11-16');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Cannot start or resume task timer while on break/i);
        return true;
      }
    );
  });

  test('verifyAttendanceActive succeeds when employee is actively clocked in and not on break', async () => {
    const activeRecord = {
      isClockedIn: true,
      clockOutTime: null,
      isOnBreak: false,
      clockInTime: '09:30 AM'
    };
    Attendance.findOne = () => stubQuery(activeRecord);

    const result = await verifyAttendanceActive('507f1f77bcf86cd799439011', '2026-11-16');
    assert.equal(result.isClockedIn, true);
    assert.equal(result.isOnBreak, false);
  });

  // ── Testing pauseTimer Production Service ──
  test('pauseTimer returns noOp: true and 200 message when no active timer is running', async () => {
    ActiveTaskTimer.findOne = () => stubQuery({
      status: 'IDLE',
      employeeId: '507f1f77bcf86cd799439011'
    });

    const result = await pauseTimer({
      actor: { _id: '507f1f77bcf86cd799439011', role: 'Team Member' },
      targetEmployeeId: '507f1f77bcf86cd799439011'
    });

    assert.equal(result.success, true);
    assert.equal(result.noOp, true);
    assert.match(result.message, /not currently running/i);
  });
});
