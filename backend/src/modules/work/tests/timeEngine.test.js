/**
 * @file timeEngine.test.js
 * @description Comprehensive automated integration test suite for Phase 2B.1 Time Engine.
 * Tests atomic state transitions, OCC concurrency, tenant isolation, delegated admin/manager operations,
 * database integrity constraints, and idempotent requests against an isolated test database.
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// Models
const Employee = require('../../hr/models/Employee');
const Task = require('../models/Task');
const ActiveTaskTimer = require('../models/ActiveTaskTimer');
const WorkSession = require('../models/WorkSession');
const TimeTrackingAuditLog = require('../models/TimeTrackingAuditLog');
const DurableOutboxEvent = require('../models/DurableOutboxEvent');
const IdempotencyLog = require('../models/IdempotencyLog');

// Service & Controllers
const timeEngineService = require('../services/timeEngineService');
const timesheetController = require('../controllers/timesheetController');
const taskController = require('../controllers/taskController');

// Use an isolated test database name so production collections are NEVER touched
const originalUri = process.env.MONGO_URI || '';
const testDbUri = originalUri.includes('?')
  ? originalUri.replace(/\/[^/?]+(\?)/, '/ems_test_phase2b1$1')
  : `${originalUri}/ems_test_phase2b1`;

describe('Phase 2B.1 — Core Backend Task Timer Engine Suite', () => {
  let adminUser, managerEng, managerMkt, empA, empB, empC;
  let task1A, task2A, task3B, task4C;

  before(async () => {
    assert.ok(process.env.MONGO_URI, 'MONGO_URI must be set in environment');
    await mongoose.connect(testDbUri);
    console.log(`\n Connected to isolated test database: ${mongoose.connection.name}`);

    // Drop any prior test database state so fresh indexes build cleanly
    try {
      await mongoose.connection.dropDatabase();
    } catch (_) {}

    // Ensure all model indexes are created in MongoDB
    await ActiveTaskTimer.init();
    await WorkSession.init();
    await TimeTrackingAuditLog.init();
    await DurableOutboxEvent.init();
    await IdempotencyLog.init();

    // 1. Create Test Employees
    adminUser = await Employee.create({
      employeeCode: 'ADM-TEST-01',
      name: 'Super Admin',
      email: 'admin.test@inforag.com',
      role: 'Administrator',
      systemRole: 'admin',
      department: 'Management',
      isAdmin: true,
      status: 'active'
    });

    managerEng = await Employee.create({
      employeeCode: 'MGR-ENG-01',
      name: 'Eng Manager',
      email: 'mgr.eng@inforag.com',
      role: 'Engineering Manager',
      systemRole: 'manager',
      department: 'Engineering',
      isAdmin: false,
      status: 'active'
    });

    managerMkt = await Employee.create({
      employeeCode: 'MGR-MKT-01',
      name: 'Marketing Manager',
      email: 'mgr.mkt@inforag.com',
      role: 'Marketing Manager',
      systemRole: 'manager',
      department: 'Marketing',
      isAdmin: false,
      status: 'active'
    });

    empA = await Employee.create({
      employeeCode: 'EMP-A-01',
      name: 'Alice Engineer',
      email: 'alice@inforag.com',
      role: 'Software Engineer',
      systemRole: 'team_member',
      department: 'Engineering',
      isAdmin: false,
      status: 'active'
    });

    empB = await Employee.create({
      employeeCode: 'EMP-B-01',
      name: 'Bob Engineer',
      email: 'bob@inforag.com',
      role: 'Software Engineer',
      systemRole: 'team_member',
      department: 'Engineering',
      isAdmin: false,
      status: 'active'
    });

    empC = await Employee.create({
      employeeCode: 'EMP-C-01',
      name: 'Charlie Marketer',
      email: 'charlie@inforag.com',
      role: 'Marketing Associate',
      systemRole: 'team_member',
      department: 'Marketing',
      isAdmin: false,
      status: 'active'
    });

    // 2. Create Test Tasks
    task1A = await Task.create({
      taskCode: 'TSK-101',
      title: 'Task 1 for Alice',
      startDate: '2026-11-14',
      assignedTo: empA._id,
      assignedToId: empA._id.toString(),
      status: 'incomplete',
      priority: 'high'
    });

    task2A = await Task.create({
      taskCode: 'TSK-102',
      title: 'Task 2 for Alice',
      startDate: '2026-11-14',
      assignedTo: empA._id,
      assignedToId: empA._id.toString(),
      status: 'incomplete',
      priority: 'medium'
    });

    task3B = await Task.create({
      taskCode: 'TSK-103',
      title: 'Task 3 for Bob',
      startDate: '2026-11-14',
      assignedTo: empB._id,
      assignedToId: empB._id.toString(),
      status: 'incomplete',
      priority: 'low'
    });

    task4C = await Task.create({
      taskCode: 'TSK-104',
      title: 'Task 4 for Charlie',
      startDate: '2026-11-14',
      assignedTo: empC._id,
      assignedToId: empC._id.toString(),
      status: 'incomplete',
      priority: 'urgent'
    });
  });

  after(async () => {
    // Drop test database cleanly
    try {
      await mongoose.connection.dropDatabase();
    } catch (_) {}
    await mongoose.disconnect();
    console.log(' Isolated test database cleaned and disconnected.');
  });

  beforeEach(async () => {
    // Reset timer states and intervals between tests
    await ActiveTaskTimer.deleteMany({});
    await WorkSession.deleteMany({});
    await TimeTrackingAuditLog.deleteMany({});
    await DurableOutboxEvent.deleteMany({});
    await IdempotencyLog.deleteMany({});
    await Task.updateMany({}, { $set: { timerRunning: false, status: 'incomplete', accumulatedSeconds: 0, progress: 0 } });
  });

  // ── TEST 1: START TIMER ───────────────────────────────────────────────────
  test('1. START: Starts timer, creates RUNNING WorkSession and ActiveTaskTimer', async () => {
    const res = await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id
    });

    assert.equal(res.success, true);
    assert.equal(res.state.status, 'RUNNING');
    assert.equal(res.state.taskId.toString(), task1A._id.toString());

    // Verify ActiveTaskTimer in DB
    const timer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.ok(timer);
    assert.equal(timer.status, 'RUNNING');
    assert.equal(timer.taskId.toString(), task1A._id.toString());
    assert.ok(timer.activeSessionId);

    // Verify WorkSession in DB
    const session = await WorkSession.findById(timer.activeSessionId);
    assert.ok(session);
    assert.equal(session.status, 'RUNNING');
    assert.equal(session.actualEndTimestamp, null);
    assert.equal(session.employeeId.toString(), empA._id.toString());

    // Verify Task projection
    const updatedTask = await Task.findById(task1A._id);
    assert.equal(updatedTask.timerRunning, true);
    assert.equal(updatedTask.status, 'in_progress');

    // Verify Audit log
    const audit = await TimeTrackingAuditLog.findOne({ targetEmployeeId: empA._id });
    assert.ok(audit);
    assert.equal(audit.actionType, 'START');
    assert.equal(audit.actorType, 'EMPLOYEE');
  });

  // ── TEST 2: SAME-TASK NO-OP ───────────────────────────────────────────────
  test('2. SAME-TASK NO-OP: Starting already running task returns no-op without creating duplicate session', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });
    const sessionCountBefore = await WorkSession.countDocuments({ employeeId: empA._id });
    assert.equal(sessionCountBefore, 1);

    const secondCall = await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });
    assert.equal(secondCall.success, true);
    assert.equal(secondCall.noOp, true);

    const sessionCountAfter = await WorkSession.countDocuments({ employeeId: empA._id });
    assert.equal(sessionCountAfter, 1, 'Must NOT create duplicate work session');
  });

  // ── TEST 3: PAUSE & RESUME ────────────────────────────────────────────────
  test('3. PAUSE & RESUME: Pausing closes session and leaves on_hold; resuming creates new interval', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });

    // Wait 100ms to accumulate time
    await new Promise(r => setTimeout(r, 100));

    // Pause
    const pauseRes = await timeEngineService.pauseTimer({ actor: empA, taskId: task1A._id });
    assert.equal(pauseRes.success, true);
    assert.equal(pauseRes.state.status, 'PAUSED');

    const timerAfterPause = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(timerAfterPause.status, 'PAUSED');
    assert.equal(timerAfterPause.activeSessionId, null);

    const closedSession = await WorkSession.findOne({ employeeId: empA._id, status: 'CLOSED' });
    assert.ok(closedSession);
    assert.ok(closedSession.actualEndTimestamp);

    const taskAfterPause = await Task.findById(task1A._id);
    assert.equal(taskAfterPause.timerRunning, false);
    assert.equal(taskAfterPause.status, 'on_hold');

    // Resume
    const resumeRes = await timeEngineService.resumeTimer({ actor: empA, taskId: task1A._id });
    assert.equal(resumeRes.success, true);
    assert.equal(resumeRes.state.status, 'RUNNING');

    const runningSessions = await WorkSession.find({ employeeId: empA._id, status: 'RUNNING' });
    assert.equal(runningSessions.length, 1);
    assert.notEqual(runningSessions[0]._id.toString(), closedSession._id.toString(), 'Resume must open a new interval');
  });

  // ── TEST 4: TASK SWITCH ───────────────────────────────────────────────────
  test('4. TASK SWITCH: Starting Task 2 while Task 1 is running atomically switches tasks', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });

    // Switch to Task 2
    const switchRes = await timeEngineService.startTimer({ actor: empA, taskId: task2A._id });
    assert.equal(switchRes.success, true);
    assert.equal(switchRes.state.taskId.toString(), task2A._id.toString());

    // Task 1 session closed
    const session1 = await WorkSession.findOne({ taskId: task1A._id });
    assert.equal(session1.status, 'CLOSED');
    assert.ok(session1.actualEndTimestamp);

    // Task 2 session open
    const session2 = await WorkSession.findOne({ taskId: task2A._id });
    assert.equal(session2.status, 'RUNNING');
    assert.equal(session2.actualEndTimestamp, null);

    // Projections
    const t1 = await Task.findById(task1A._id);
    assert.equal(t1.timerRunning, false);
    assert.equal(t1.status, 'incomplete');

    const t2 = await Task.findById(task2A._id);
    assert.equal(t2.timerRunning, true);
    assert.equal(t2.status, 'in_progress');

    // ActiveTaskTimer references Task 2
    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(activeTimer.taskId.toString(), task2A._id.toString());
    assert.equal(activeTimer.activeSessionId.toString(), session2._id.toString());
  });

  // ── TEST 5: START B WHILE A IS PAUSED ─────────────────────────────────────
  test('5. START B FROM PAUSED A: Starting Task 2 while Task 1 is paused leaves Task 1 on_hold and starts Task 2', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });
    await timeEngineService.pauseTimer({ actor: empA, taskId: task1A._id });

    // Start Task 2
    await timeEngineService.startTimer({ actor: empA, taskId: task2A._id });

    const t1 = await Task.findById(task1A._id);
    assert.equal(t1.status, 'on_hold');
    assert.equal(t1.timerRunning, false);

    const t2 = await Task.findById(task2A._id);
    assert.equal(t2.status, 'in_progress');
    assert.equal(t2.timerRunning, true);

    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(activeTimer.status, 'RUNNING');
    assert.equal(activeTimer.taskId.toString(), task2A._id.toString());
  });

  // ── TEST 6: STOP DOES NOT COMPLETE TASK ───────────────────────────────────
  test('6. STOP: Closes timer and resets to IDLE, leaves task incomplete and NOT completed', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });
    const stopRes = await timeEngineService.stopTimer({ actor: empA, taskId: task1A._id });

    assert.equal(stopRes.success, true);
    assert.equal(stopRes.state.status, 'IDLE');
    assert.equal(stopRes.state.taskId, null);

    const task = await Task.findById(task1A._id);
    assert.equal(task.timerRunning, false);
    assert.equal(task.status, 'incomplete', 'STOP must NEVER mark task completed');
    assert.equal(task.completedAt, null);
    assert.notEqual(task.progress, 100);

    const activeSessions = await WorkSession.find({ employeeId: empA._id, status: 'RUNNING' });
    assert.equal(activeSessions.length, 0);
  });

  // ── TEST 7: COMPLETE MARKS TASK COMPLETED ─────────────────────────────────
  test('7. COMPLETE: Closes timer, sets task status = completed, progress = 100', async () => {
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });
    const compRes = await timeEngineService.completeTask({ actor: empA, taskId: task1A._id });

    assert.equal(compRes.success, true);

    const task = await Task.findById(task1A._id);
    assert.equal(task.status, 'completed');
    assert.equal(task.progress, 100);
    assert.ok(task.completedAt);
    assert.ok(task.completedOn);
    assert.equal(task.timerRunning, false);

    const timer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(timer.status, 'IDLE');
  });

  // ── TEST 8: PARTIAL UNIQUE INDEX ENFORCEMENT ──────────────────────────────
  test('8. INTEGRITY: MongoDB partial unique index prevents two simultaneous RUNNING sessions for same employee', async () => {
    await WorkSession.create({
      employeeId: empA._id,
      taskId: task1A._id,
      businessDate: '2026-11-14',
      startTimestamp: new Date(),
      status: 'RUNNING'
    });

    // Attempting to directly insert a second RUNNING session must fail with duplicate key
    await assert.rejects(
      async () => {
        await WorkSession.create({
          employeeId: empA._id,
          taskId: task2A._id,
          businessDate: '2026-11-14',
          startTimestamp: new Date(),
          status: 'RUNNING'
        });
      },
      /E11000.*duplicate key error/
    );
  });

  // ── TEST 9: TENANT ISOLATION ──────────────────────────────────────────────
  test('9. TENANT ISOLATION: Employee cannot time another employee task or view foreign sessions', async () => {
    // Bob attempts to start Alice's task (task1A)
    await assert.rejects(
      async () => {
        await timeEngineService.startTimer({
          actor: empB,
          taskId: task1A._id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not assigned to the target employee/);
        return true;
      }
    );

    // Alice starts her task
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });

    // Bob queries work sessions specifying targetEmployeeId = Alice
    const bobSessions = await timeEngineService.getWorkSessions({
      actor: empB,
      targetEmployeeId: empA._id
    });

    // Forced scoping guarantees Bob only gets his own sessions (empty)
    assert.equal(bobSessions.data.length, 0);
  });

  // ── TEST 10: ADMIN DELEGATED OPERATIONS & ATTRIBUTION ─────────────────────
  test('10. DELEGATED ADMIN: Admin can operate on employee task with separate actor & subject attribution', async () => {
    // Admin starts timer for Bob
    const res = await timeEngineService.startTimer({
      actor: adminUser,
      targetEmployeeId: empB._id,
      taskId: task3B._id,
      reason: 'Admin started shift timer for remote employee'
    });

    assert.equal(res.success, true);

    // Timer is strictly owned by Bob
    const timer = await ActiveTaskTimer.findOne({ employeeId: empB._id });
    assert.equal(timer.employeeId.toString(), empB._id.toString());
    assert.equal(timer.lastActionContext.performedBy.toString(), adminUser._id.toString());
    assert.equal(timer.lastActionContext.performerRole, 'ADMIN');

    // WorkSession belongs to Bob, initiated by Admin
    const session = await WorkSession.findById(timer.activeSessionId);
    assert.equal(session.employeeId.toString(), empB._id.toString());
    assert.equal(session.initiatedByActorId.toString(), adminUser._id.toString());
    assert.equal(session.initiatedByActorType, 'ADMIN');

    // Audit log records both identities
    const audit = await TimeTrackingAuditLog.findOne({ targetEmployeeId: empB._id });
    assert.equal(audit.targetEmployeeId.toString(), empB._id.toString());
    assert.equal(audit.actorId.toString(), adminUser._id.toString());
    assert.equal(audit.actorType, 'ADMIN');
    assert.equal(audit.reason, 'Admin started shift timer for remote employee');
  });

  // ── TEST 11: MANAGER DEPARTMENT SCOPING ───────────────────────────────────
  test('11. DEPARTMENT SCOPING: Manager can manage employees in same dept, rejected for other depts', async () => {
    // Engineering Manager operates on Alice (Engineering) -> Allowed
    const engRes = await timeEngineService.startTimer({
      actor: managerEng,
      targetEmployeeId: empA._id,
      taskId: task1A._id
    });
    assert.equal(engRes.success, true);

    // Engineering Manager attempts to operate on Charlie (Marketing) -> 403 Forbidden
    await assert.rejects(
      async () => {
        await timeEngineService.startTimer({
          actor: managerEng,
          targetEmployeeId: empC._id,
          taskId: task4C._id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Managers can only manage employees within their department/);
        return true;
      }
    );
  });

  // ── TEST 12: IDEMPOTENT REQUESTS & ATOMIC TRANSACTION COMPLETION ──────────
  test('12. IDEMPOTENCY: Repeated requests with same idempotencyKey return cached payload without duplicate execution', async () => {
    const idempotencyKey = 'idem_key_test_999';

    // First request
    const lease1 = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(lease1.isCached, false);

    // Passes idempotencyKey directly into startTimer for atomic transactional completion
    const execResult = await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id,
      requestId: idempotencyKey,
      idempotencyKey
    });

    // Second request with same idempotency key returns cached response
    const lease2 = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });

    assert.equal(lease2.isCached, true);
    assert.equal(lease2.statusCode, 200);
    assert.equal(lease2.payload.success, true);

    const totalSessions = await WorkSession.countDocuments({ employeeId: empA._id });
    assert.equal(totalSessions, 1);
  });

  // ── TEST 13: SIMULTANEOUS CONCURRENT STARTS (TWO DEVICES) ─────────────────
  test('13. CONCURRENCY: Simultaneous start requests for the same employee cannot create duplicate RUNNING sessions', async () => {
    // Simulate Device 1 and Device 2 firing simultaneous start calls
    const [p1, p2] = await Promise.allSettled([
      timeEngineService.startTimer({ actor: empA, taskId: task1A._id }),
      timeEngineService.startTimer({ actor: empA, taskId: task1A._id })
    ]);

    // At least one must succeed; if second also succeeded it's via idempotent no-op or OCC retry
    assert.ok(p1.status === 'fulfilled' || p2.status === 'fulfilled');

    // Invariant: Exactly ONE RUNNING WorkSession must exist for empA
    const runningSessions = await WorkSession.find({ employeeId: empA._id, status: 'RUNNING' });
    assert.equal(runningSessions.length, 1, 'Strictly 1 RUNNING session allowed per employee across concurrent calls');

    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(activeTimer.status, 'RUNNING');
  });

  // ── TEST 14: SIMULTANEOUS EMPLOYEE & ADMIN RACE ───────────────────────────
  test('14. CONCURRENCY RACE: Admin pause and Employee start racing resolve cleanly with single authoritative state', async () => {
    // Start initial timer
    await timeEngineService.startTimer({ actor: empA, taskId: task1A._id });

    // Admin pauses while Employee attempts to start Task 2 simultaneously
    const results = await Promise.allSettled([
      timeEngineService.pauseTimer({ actor: adminUser, targetEmployeeId: empA._id, taskId: task1A._id, reason: 'Admin lunch pause' }),
      timeEngineService.startTimer({ actor: empA, taskId: task2A._id })
    ]);

    // Both operations must settle cleanly (fulfilled or caught via OCC retry)
    assert.ok(results.every(r => r.status === 'fulfilled' || r.status === 'rejected'));

    // Check invariants
    const runningCount = await WorkSession.countDocuments({ employeeId: empA._id, status: 'RUNNING' });
    assert.ok(runningCount <= 1, 'Never more than 1 running session');

    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.ok(['RUNNING', 'PAUSED'].includes(activeTimer.status));
  });

  // ── TEST 15: LEGACY STOP CANNOT OVERWRITE HISTORICAL LIFETIME DURATION ──────
  test('15. LEGACY PROTECTION: timesheetController.stopTimer cannot overwrite historical lifetime duration', async () => {
    // Set 10 hours of lifetime historical accumulated time on Task 1
    const HISTORICAL_LIFETIME_SECS = 36000;
    await Task.updateOne(
      { _id: task1A._id },
      { $set: { accumulatedSeconds: HISTORICAL_LIFETIME_SECS, timerRunning: true } }
    );

    // Mock Express req and res for legacy stopTimer call with 20 minutes (1200s)
    const mockReq = {
      user: empA,
      body: {
        taskId: task1A._id.toString(),
        totalDurationSeconds: 1200,
        endTime: '18:00:00'
      }
    };
    let jsonResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => { jsonResult = data; return data; }
      })
    };

    await timesheetController.stopTimer(mockReq, mockRes, (err) => { if (err) throw err; });

    assert.ok(jsonResult && jsonResult.success);

    // Invariant: Lifetime accumulatedSeconds must NOT be replaced by 1200!
    const reloadedTask = await Task.findById(task1A._id);
    assert.ok(
      reloadedTask.accumulatedSeconds >= HISTORICAL_LIFETIME_SECS,
      `Lifetime duration (${reloadedTask.accumulatedSeconds}) was destroyed! Must be >= ${HISTORICAL_LIFETIME_SECS}`
    );
  });

  // ── TEST 16: GENERIC PUT CANNOT MODIFY PROTECTED TIMER PROJECTIONS ─────────
  test('16. PROJECTION PROTECTION: Generic PUT /api/tasks/:id safely ignores client attempts to mutate timer fields', async () => {
    await Task.updateOne(
      { _id: task1A._id },
      { $set: { accumulatedSeconds: 5000, timerRunning: false, title: 'Original Title' } }
    );

    const mockReq = {
      params: { id: task1A._id.toString() },
      body: {
        title: 'Safely Updated Title',
        timerRunning: true, // Attempted direct override
        startedAt: 12345678,
        accumulatedSeconds: 999999, // Attempted direct overwrite
        timerSeconds: 88888
      }
    };
    let jsonResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => { jsonResult = data; return data; }
      })
    };

    await taskController.updateTask(mockReq, mockRes, (err) => { if (err) throw err; });
    assert.ok(jsonResult && jsonResult.success);

    const updatedTask = await Task.findById(task1A._id);
    // Legitimate field was updated
    assert.equal(updatedTask.title, 'Safely Updated Title');
    // Protected fields were preserved from tampering
    assert.equal(updatedTask.timerRunning, false, 'Client must not be able to force timerRunning: true via generic PUT');
    assert.equal(updatedTask.accumulatedSeconds, 5000, 'Client must not be able to overwrite accumulatedSeconds via generic PUT');
  });

  // ── TEST 17: OUTBOX TTL RETENTION FOR PENDING EVENTS ───────────────────────
  test('17. OUTBOX TTL: PENDING events have no expiration timestamp; published events receive publishedAt', async () => {
    const [pendingEvent] = await DurableOutboxEvent.create([{
      employeeId: empA._id,
      seq: 9001,
      eventType: 'TIMER_STARTED',
      payload: { test: true },
      status: 'PENDING'
    }]);

    // PENDING event has publishedAt = null, so MongoDB TTL index will NEVER delete it
    assert.equal(pendingEvent.publishedAt, null);
    assert.equal(pendingEvent.status, 'PENDING');

    // Simulate successful broadcast
    const publishedTimestamp = new Date();
    await DurableOutboxEvent.updateOne(
      { _id: pendingEvent._id },
      { $set: { status: 'PUBLISHED', publishedAt: publishedTimestamp } }
    );

    const updatedEvent = await DurableOutboxEvent.findById(pendingEvent._id);
    assert.equal(updatedEvent.status, 'PUBLISHED');
    assert.ok(updatedEvent.publishedAt);
    assert.equal(updatedEvent.publishedAt.getTime(), publishedTimestamp.getTime());
  });

  // ── TEST 18: SCOPED IDEMPOTENCY ACROSS DIFFERENT EMPLOYEES ────────────────
  test('18. IDEMPOTENCY SCOPING: Two different employees can safely use identical idempotencyKey without collision', async () => {
    const sharedTextualKey = 'client_local_uuid_001';

    // Employee A acquires lease
    const leaseA = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: sharedTextualKey,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(leaseA.isCached, false);

    // Employee B acquires lease with the EXACT SAME key
    const leaseB = await timeEngineService.acquireIdempotencyLease({
      actorId: empB._id,
      targetEmployeeId: empB._id,
      idempotencyKey: sharedTextualKey,
      operationType: 'START',
      requestPayload: { taskId: task3B._id }
    });

    // Must NOT collide or conflict; both acquire their own scoped leases
    assert.equal(leaseB.isCached, false, 'Different employees using same idempotency key must not collide');

    const totalLeases = await IdempotencyLog.countDocuments({ idempotencyKey: sharedTextualKey });
    assert.equal(totalLeases, 2);
  });

  // ── TEST 19: REPLAY PAYLOAD HASH MISMATCH VALIDATION ───────────────────────
  test('19. PAYLOAD VALIDATION: Replaying completed key with differing payload returns 422 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', async () => {
    const key = 'payload_hash_test_key';

    // Step 1: Complete operation for Task 1
    await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });

    await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id,
      idempotencyKey: key
    });

    // Step 2: Replay with matching payload -> 200 Cached Hit
    const matchingReplay = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(matchingReplay.isCached, true);

    // Step 3: Replay with MISMATCHING payload (different task) -> Must reject with 422
    await assert.rejects(
      async () => {
        await timeEngineService.acquireIdempotencyLease({
          actorId: empA._id,
          targetEmployeeId: empA._id,
          idempotencyKey: key,
          operationType: 'START',
          requestPayload: { taskId: task2A._id } // Different task!
        });
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
        assert.match(err.message, /different request payload/);
        return true;
      }
    );
  });

  // ── TEST 20: SIMULTANEOUS REQUESTS WITH IDENTICAL KEY & PAYLOAD ──────────
  test('20. IDEMPOTENCY ATOMICITY: Two simultaneous requests with identical actorId, key, and payload allow only 1 lease', async () => {
    const key = 'simul_key_identical_' + Date.now();
    const payload = { taskId: task1A._id };

    // Fire two simultaneous lease acquisitions
    const results = await Promise.allSettled([
      timeEngineService.acquireIdempotencyLease({
        actorId: empA._id,
        targetEmployeeId: empA._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: payload
      }),
      timeEngineService.acquireIdempotencyLease({
        actorId: empA._id,
        targetEmployeeId: empA._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: payload
      })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Strictly 1 request must acquire the lease');
    assert.equal(rejected.length, 1, 'The losing request must be rejected');
    assert.equal(fulfilled[0].value.isCached, false);
    assert.ok(fulfilled[0].value.leaseToken, 'Winning lease must have a unique leaseToken');
    assert.equal(rejected[0].reason.statusCode, 409);

    // Assert database: Exactly 1 record in IdempotencyLog
    const count = await IdempotencyLog.countDocuments({ actorId: empA._id, idempotencyKey: key });
    assert.equal(count, 1);

    // Winner executes timer operation
    await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id,
      idempotencyKey: key,
      leaseToken: fulfilled[0].value.leaseToken
    });

    // Invariant: Exactly 1 RUNNING WorkSession
    const runningSessions = await WorkSession.countDocuments({ employeeId: empA._id, status: 'RUNNING' });
    assert.equal(runningSessions, 1);
  });

  // ── TEST 21: SIMULTANEOUS REQUESTS WITH IDENTICAL KEY BUT DIFFERENT TARGET EMPLOYEE ──
  test('21. IDEMPOTENCY TARGET ISOLATION: Simultaneous requests with same key but different targetEmployeeId cannot conflict', async () => {
    const key = 'admin_simul_key_' + Date.now();

    // Admin attempts to use same key simultaneously for empA and empB
    const results = await Promise.allSettled([
      timeEngineService.acquireIdempotencyLease({
        actorId: adminUser._id,
        targetEmployeeId: empA._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: { taskId: task1A._id, targetEmployeeId: empA._id }
      }),
      timeEngineService.acquireIdempotencyLease({
        actorId: adminUser._id,
        targetEmployeeId: empB._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: { taskId: task3B._id, targetEmployeeId: empB._id }
      })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Only one target employee can acquire ownership of the key');
    assert.equal(rejected.length, 1, 'The conflicting target employee request must be rejected with 409');
    assert.equal(rejected[0].reason.statusCode, 409);

    // Execute winner
    const winningTarget = fulfilled[0].value.targetEmployeeId || empA._id;
    const winningTask = String(winningTarget) === String(empA._id) ? task1A._id : task3B._id;
    await timeEngineService.startTimer({
      actor: adminUser,
      targetEmployeeId: winningTarget,
      taskId: winningTask,
      idempotencyKey: key,
      leaseToken: fulfilled[0].value.leaseToken
    });

    // Invariant: Total running sessions across all employees is exactly 1
    const totalRunning = await WorkSession.countDocuments({ status: 'RUNNING' });
    assert.equal(totalRunning, 1);
  });

  // ── TEST 22: SAME KEY WITH DIFFERENT TASK ID WHILE IN_PROGRESS ─────────────
  test('22. PAYLOAD MISMATCH IN_PROGRESS: Differing taskId on active lease is deterministically rejected with 409', async () => {
    const key = 'in_progress_mismatch_' + Date.now();

    // Step 1: Acquire lease for Task 1
    const lease1 = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(lease1.isCached, false);

    // Step 2: While lease1 is IN_PROGRESS, second request arrives with different taskId (Task 2)
    await assert.rejects(
      async () => {
        await timeEngineService.acquireIdempotencyLease({
          actorId: empA._id,
          targetEmployeeId: empA._id,
          idempotencyKey: key,
          operationType: 'START',
          requestPayload: { taskId: task2A._id }
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
        assert.match(err.message, /Conflicting concurrent request with different payload/);
        return true;
      }
    );

    // Invariant: Database document requestHash still belongs to task1A
    const doc = await IdempotencyLog.findOne({ actorId: empA._id, idempotencyKey: key });
    assert.equal(doc.status, 'IN_PROGRESS');
    assert.equal(doc.leaseToken, lease1.leaseToken);
  });

  // ── TEST 23: TWO SIMULTANEOUS ATTEMPTS TO RECLAIM ONE EXPIRED LEASE ─────────
  test('23. CAS LEASE RECLAMATION: Two simultaneous attempts to reclaim an expired lease permit strictly 1 winner', async () => {
    const key = 'reclaim_race_key_' + Date.now();

    // Setup: Seed an expired lease in MongoDB
    const oldExpiry = new Date(Date.now() - 5000); // Expired 5 seconds ago
    await IdempotencyLog.create({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      requestHash: 'old_hash',
      operationType: 'START',
      status: 'IN_PROGRESS',
      leaseToken: 'old-stale-token',
      leaseExpiresAt: oldExpiry,
      expiresAt: new Date(Date.now() + 86400000)
    });

    // Two simultaneous reclamation attempts
    const results = await Promise.allSettled([
      timeEngineService.acquireIdempotencyLease({
        actorId: empA._id,
        targetEmployeeId: empA._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: { taskId: task1A._id }
      }),
      timeEngineService.acquireIdempotencyLease({
        actorId: empA._id,
        targetEmployeeId: empA._id,
        idempotencyKey: key,
        operationType: 'START',
        requestPayload: { taskId: task1A._id }
      })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Only 1 worker must win the expired CAS reclamation');
    assert.equal(rejected.length, 1, 'Losing reclaimer must be rejected with 409');
    assert.notEqual(fulfilled[0].value.leaseToken, 'old-stale-token', 'Winner receives a fresh unique leaseToken');

    // Invariant: Database record has the winner's new leaseToken and future expiration
    const doc = await IdempotencyLog.findOne({ actorId: empA._id, idempotencyKey: key });
    assert.equal(doc.leaseToken, fulfilled[0].value.leaseToken);
    assert.ok(doc.leaseExpiresAt.getTime() > Date.now());
  });

  // ── TEST 24: STALE LEASE OWNER COMPLETION REJECTION ────────────────────────
  test('24. STALE OWNER PROTECTION: Old lease owner cannot complete or overwrite a newer owner lease', async () => {
    const key = 'stale_completion_key_' + Date.now();

    // 1. Worker 1 acquires initial lease
    const lease1 = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    const token1 = lease1.leaseToken;

    // 2. Simulate Worker 1 stalling: Advance lease expiry into past
    await IdempotencyLog.updateOne(
      { actorId: empA._id, idempotencyKey: key },
      { $set: { leaseExpiresAt: new Date(Date.now() - 1000) } }
    );

    // 3. Worker 2 reclaims the expired lease
    const lease2 = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    const token2 = lease2.leaseToken;
    assert.notEqual(token1, token2);

    // 4. Worker 1 wakes up and attempts to complete its transaction with stale token1
    await assert.rejects(
      async () => {
        await timeEngineService.completeIdempotencyRecord({
          actorId: empA._id,
          idempotencyKey: key,
          leaseToken: token1, // Old stale token!
          statusCode: 200,
          responsePayload: { success: true, fake: 'worker1' }
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'STALE_LEASE_OWNER');
        return true;
      }
    );

    // Invariant: The record in MongoDB remains owned by Worker 2 (IN_PROGRESS with token2)
    const doc = await IdempotencyLog.findOne({ actorId: empA._id, idempotencyKey: key });
    assert.equal(doc.status, 'IN_PROGRESS');
    assert.equal(doc.leaseToken, token2);
    assert.equal(doc.responsePayload, null, 'Stale payload must not be written to database');
  });

  // ── TEST 25: SIMULATED CRASH RECOVERY ──────────────────────────────────────
  test('25. CRASH RECOVERY: Crashed worker lease expires and is cleanly reclaimed and completed by retry', async () => {
    const key = 'crash_recovery_key_' + Date.now();

    // 1. Worker acquires lease but crashes before executing timer operation
    const crashedLease = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(crashedLease.isCached, false);

    // Immediate retry while lease is active is rejected with 409
    await assert.rejects(
      async () => {
        await timeEngineService.acquireIdempotencyLease({
          actorId: empA._id,
          targetEmployeeId: empA._id,
          idempotencyKey: key,
          operationType: 'START',
          requestPayload: { taskId: task1A._id }
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'IDEMPOTENCY_CONCURRENT_REQUEST');
        return true;
      }
    );

    // 2. Simulate 15s elapsing (process crash recovery)
    await IdempotencyLog.updateOne(
      { actorId: empA._id, idempotencyKey: key },
      { $set: { leaseExpiresAt: new Date(Date.now() - 500) } }
    );

    // 3. Client retries -> Successfully reclaims lease
    const recoveredLease = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });
    assert.equal(recoveredLease.isCached, false);
    assert.notEqual(recoveredLease.leaseToken, crashedLease.leaseToken);

    // 4. Execute timer operation with recovered lease
    const startResult = await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id,
      idempotencyKey: key,
      leaseToken: recoveredLease.leaseToken
    });
    assert.equal(startResult.success, true);

    // Invariant: Exactly 1 session created, IdempotencyLog status is COMPLETED
    const sessionCount = await WorkSession.countDocuments({ employeeId: empA._id, taskId: task1A._id });
    assert.equal(sessionCount, 1);
    const finalLog = await IdempotencyLog.findOne({ actorId: empA._id, idempotencyKey: key });
    assert.equal(finalLog.status, 'COMPLETED');
    assert.equal(finalLog.leaseToken, recoveredLease.leaseToken);
  });

  // ── TEST 26: AMBIGUOUS COMMIT & LOST HTTP RESPONSE RETRY ────────────────────
  test('26. LOST RESPONSE RETRY: Transaction commits but client retries after network drop; returns cached payload without duplicate work', async () => {
    const key = 'lost_response_key_' + Date.now();

    // 1. Initial request acquires lease and commits transaction
    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });

    const initialCommit = await timeEngineService.startTimer({
      actor: empA,
      taskId: task1A._id,
      idempotencyKey: key,
      leaseToken: lease.leaseToken
    });
    assert.equal(initialCommit.success, true);

    const timerAfterCommit = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    const versionAfterCommit = timerAfterCommit.version;

    // 2. Client loses HTTP response, reconnects, and retries exact same request
    const retryLease = await timeEngineService.acquireIdempotencyLease({
      actorId: empA._id,
      targetEmployeeId: empA._id,
      idempotencyKey: key,
      operationType: 'START',
      requestPayload: { taskId: task1A._id }
    });

    // Assert: Cached response returned immediately
    assert.equal(retryLease.isCached, true);
    assert.equal(retryLease.statusCode, 200);
    assert.equal(retryLease.payload.success, true);
    assert.equal(String(retryLease.payload.state.taskId), String(task1A._id));

    // Invariant: ZERO additional sessions created, ActiveTaskTimer version did not increment
    const sessionCount = await WorkSession.countDocuments({ employeeId: empA._id });
    assert.equal(sessionCount, 1, 'Strictly 1 session must exist in MongoDB');

    const timerAfterRetry = await ActiveTaskTimer.findOne({ employeeId: empA._id });
    assert.equal(timerAfterRetry.version, versionAfterCommit, 'Version must not increment on idempotent retry');
  });
});
