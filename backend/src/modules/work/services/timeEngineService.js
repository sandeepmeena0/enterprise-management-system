/**
 * @file timeEngineService.js
 * @description Centralized, server-authoritative Task Timer Engine.
 * Enforces atomic state transitions within MongoDB transactions, Optimistic Concurrency Control (OCC),
 * strict tenant isolation, delegated admin/manager authority, and append-only audit logging.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// Models
const ActiveTaskTimer = require('../models/ActiveTaskTimer');
const WorkSession = require('../models/WorkSession');
const TimeTrackingAuditLog = require('../models/TimeTrackingAuditLog');
const DurableOutboxEvent = require('../models/DurableOutboxEvent');
const SequenceCounter = require('../models/SequenceCounter');
const IdempotencyLog = require('../models/IdempotencyLog');
const Task = require('../models/Task');
const Employee = require('../../hr/models/Employee');

// Custom Concurrency Error
class ConcurrencyVersionMismatchError extends Error {
  constructor(message) {
    super(message || 'Concurrency version mismatch: active timer was updated concurrently.');
    this.name = 'ConcurrencyVersionMismatchError';
  }
}

/**
 * Returns current date string in Asia/Kolkata (IST = UTC+05:30)
 * @param {Date} d
 * @returns {string} 'YYYY-MM-DD'
 */
function getISTDateString(d = new Date()) {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffsetMs);
  return istTime.toISOString().split('T')[0];
}

/**
 * Validates and resolves the acting user and target employee subject.
 * Enforces strict department scoping and role hierarchy.
 */
async function resolveActorAndSubject(actor, requestedTargetId) {
  if (!actor || !actor._id) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const actorId = new mongoose.Types.ObjectId(actor._id);
  const isSuperAdmin = Boolean(actor.isSuperAdmin || actor.employeeCode === 'ADM-001' || actor.email === 'admin@inforag.com');
  const isAdmin = Boolean(isSuperAdmin || actor.isAdmin || actor.isDelegatedAdmin || actor.systemRole === 'admin');
  const isHR = !isAdmin && Boolean(actor.systemRole === 'hr' || actor.department === 'Human Resources');
  const isManager = !isAdmin && !isHR && Boolean(
    actor.systemRole === 'manager' ||
    (actor.role && actor.role.toLowerCase().includes('manager')) ||
    (actor.permissions && actor.permissions.manageDepartmentTasks)
  );

  let actorType = 'EMPLOYEE';
  if (isAdmin) actorType = 'ADMIN';
  else if (isHR) actorType = 'HR_MANAGER';
  else if (isManager) actorType = 'MANAGER';

  let targetId = actorId;

  // Non-privileged users CAN NEVER target another employee
  if (actorType === 'EMPLOYEE') {
    targetId = actorId;
  } else if (requestedTargetId && String(requestedTargetId) !== String(actorId)) {
    if (!mongoose.Types.ObjectId.isValid(requestedTargetId)) {
      const err = new Error('Invalid target employee ID format.');
      err.statusCode = 400;
      throw err;
    }
    targetId = new mongoose.Types.ObjectId(requestedTargetId);
  }

  // Load target employee record
  const targetEmployee = await Employee.findById(targetId);
  if (!targetEmployee) {
    const err = new Error('Target employee record not found.');
    err.statusCode = 404;
    throw err;
  }
  if (targetEmployee.status !== 'active') {
    const err = new Error('Target employee account is deactivated.');
    err.statusCode = 403;
    throw err;
  }

  // Scope Enforcement: Manager can strictly operate within their department
  if (actorType === 'MANAGER' && String(targetId) !== String(actorId)) {
    if (String(targetEmployee.department).trim().toLowerCase() !== String(actor.department).trim().toLowerCase()) {
      const err = new Error(`Access denied: Managers can only manage employees within their department (${actor.department}).`);
      err.statusCode = 403;
      throw err;
    }
  }

  // Scope Enforcement: HR Manager without allAccess requires manageTasks permission
  if (actorType === 'HR_MANAGER' && String(targetId) !== String(actorId)) {
    const hasHrTaskPerm = actor.permissions?.allAccess || actor.permissions?.manageAllTasks || actor.permissions?.manageTasks;
    if (!hasHrTaskPerm && targetEmployee.department !== 'Human Resources') {
      const err = new Error('Access denied: HR Manager missing delegated task management permissions for other departments.');
      err.statusCode = 403;
      throw err;
    }
  }

  return {
    actorId,
    actorType,
    targetEmployeeId: targetEmployee._id,
    targetEmployeeCode: targetEmployee.employeeCode,
    targetEmployeeName: targetEmployee.name,
    targetEmployeeDepartment: targetEmployee.department
  };
}

/**
 * Validates task single-ownership and active eligibility.
 */
function validateTaskOwnership(task, targetEmployeeId) {
  if (!task) {
    const err = new Error('Task not found.');
    err.statusCode = 404;
    throw err;
  }

  // Strict Single-Ownership Enforcement: Task must be assigned to target employee
  const isOwner = (
    (task.assignedTo && String(task.assignedTo) === String(targetEmployeeId)) ||
    (task.assignedToId && String(task.assignedToId) === String(targetEmployeeId)) ||
    (Array.isArray(task.assignedToIds) && task.assignedToIds.includes(String(targetEmployeeId)))
  );

  if (!isOwner) {
    const err = new Error('Task is not assigned to the target employee.');
    err.statusCode = 403;
    throw err;
  }

  if (task.status === 'completed') {
    const err = new Error('Cannot run timer on a completed task. Reopen task before tracking time.');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Transaction execution wrapper with Bounded Exponential Backoff OCC Retry
 */
async function withOCCRetry(operationFn, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await operationFn(session);
      });
      return result;
    } catch (err) {
      lastErr = err;
      const isTransient = err.hasErrorLabel && (
        err.hasErrorLabel('TransientTransactionError') ||
        err.hasErrorLabel('UnknownTransactionCommitResult')
      );
      const isWriteConflict = err.code === 112 || (err.message && err.message.includes('WriteConflict'));
      const isVersionMismatch = err instanceof ConcurrencyVersionMismatchError;

      if ((isTransient || isWriteConflict || isVersionMismatch) && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 50);
        const backoffMs = (attempt * 60) + jitter;
        await new Promise(res => setTimeout(res, backoffMs));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
  throw lastErr;
}

/**
 * Generates an atomically incremented sequence number for an employee's outbox events
 */
async function getNextSequenceNumber(employeeId, session) {
  const counterId = `seq_emp_${employeeId}`;
  const counter = await SequenceCounter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { lastSeq: 1 } },
    { upsert: true, new: true, session }
  );
  return counter.lastSeq;
}

/**
 * Canonical request payload hash calculation.
 * Incorporates operationType, taskId, and targetEmployeeId.
 */
function computeRequestHash({ operationType, taskId, targetEmployeeId }) {
  const normalizedPayload = {
    operationType: operationType ? String(operationType).toUpperCase() : null,
    taskId: taskId ? String(taskId) : null,
    targetEmployeeId: targetEmployeeId ? String(targetEmployeeId) : null
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
}

/**
 * Evaluates or acquires an atomic idempotency lease scoped to actorId and idempotencyKey.
 * Uses atomic document insertion and Compare-And-Swap (CAS) conditional lease reclamation.
 * Guarantees exclusive lease ownership via unique leaseToken.
 */
async function acquireIdempotencyLease({ actorId, targetEmployeeId, idempotencyKey, operationType, requestPayload }) {
  if (!idempotencyKey || !actorId) return null;

  const taskId = requestPayload?.taskId ? String(requestPayload.taskId) : null;
  const resolvedTargetEmpId = targetEmployeeId ? String(targetEmployeeId) : (requestPayload?.targetEmployeeId ? String(requestPayload.targetEmployeeId) : null);
  const requestHash = computeRequestHash({ operationType, taskId, targetEmployeeId: resolvedTargetEmpId });

  const now = new Date();
  const leaseExpiry = new Date(now.getTime() + 15000); // 15-second lease window
  const ttlExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30-day retention
  const leaseToken = crypto.randomUUID();

  // Step 1: Query existing record
  let existing = await IdempotencyLog.findOne({ actorId, idempotencyKey });

  // Step 2: If no existing record, attempt race-safe insertion guarded by compound unique index
  if (!existing) {
    try {
      await IdempotencyLog.create({
        actorId,
        targetEmployeeId: resolvedTargetEmpId || null,
        idempotencyKey,
        requestHash,
        operationType,
        status: 'IN_PROGRESS',
        leaseToken,
        leaseExpiresAt: leaseExpiry,
        expiresAt: ttlExpiry
      });
      return { isCached: false, idempotencyKey, leaseToken };
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent insertion won the race; re-fetch the winner's record
        existing = await IdempotencyLog.findOne({ actorId, idempotencyKey });
      } else {
        throw err;
      }
    }
  }

  // Step 3: Handle existing record
  if (existing) {
    // 3A: Record is COMPLETED -> return cached response or reject payload mismatch with 422
    if (existing.status === 'COMPLETED') {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        const err = new Error('Idempotency key has already been used with a different request payload.');
        err.statusCode = 422;
        err.code = 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
        throw err;
      }
      return { isCached: true, statusCode: existing.httpStatusCode || 200, payload: existing.responsePayload };
    }

    // 3B: Record is IN_PROGRESS and lease is still valid -> reject concurrent requests
    if (existing.status === 'IN_PROGRESS' && existing.leaseExpiresAt > now) {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        const err = new Error('Conflicting concurrent request with different payload for this idempotency key.');
        err.statusCode = 409;
        err.code = 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
        throw err;
      }
      const err = new Error('Concurrent request in progress for this idempotency key. Please retry shortly.');
      err.statusCode = 409;
      err.code = 'IDEMPOTENCY_CONCURRENT_REQUEST';
      throw err;
    }

    // 3C: Record is expired IN_PROGRESS or FAILED -> perform atomic conditional CAS reclamation
    const reclaimed = await IdempotencyLog.findOneAndUpdate(
      {
        actorId,
        idempotencyKey,
        $or: [
          { status: 'FAILED' },
          { status: 'IN_PROGRESS', leaseExpiresAt: { $lte: now } }
        ]
      },
      {
        $set: {
          targetEmployeeId: resolvedTargetEmpId || null,
          requestHash,
          operationType,
          status: 'IN_PROGRESS',
          leaseToken,
          leaseExpiresAt: leaseExpiry,
          expiresAt: ttlExpiry
        }
      },
      { new: true }
    );

    if (reclaimed) {
      return { isCached: false, idempotencyKey, leaseToken };
    }

    // If reclamation failed (another concurrent request reclaimed or completed it), evaluate fresh state
    const fresh = await IdempotencyLog.findOne({ actorId, idempotencyKey });
    if (fresh) {
      if (fresh.status === 'COMPLETED') {
        if (fresh.requestHash && fresh.requestHash !== requestHash) {
          const err = new Error('Idempotency key has already been used with a different request payload.');
          err.statusCode = 422;
          err.code = 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
          throw err;
        }
        return { isCached: true, statusCode: fresh.httpStatusCode || 200, payload: fresh.responsePayload };
      }
      if (fresh.requestHash && fresh.requestHash !== requestHash) {
        const err = new Error('Conflicting concurrent request with different payload for this idempotency key.');
        err.statusCode = 409;
        err.code = 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
        throw err;
      }
    }

    const err = new Error('Concurrent request in progress for this idempotency key. Please retry shortly.');
    err.statusCode = 409;
    err.code = 'IDEMPOTENCY_CONCURRENT_REQUEST';
    throw err;
  }

  return { isCached: false, idempotencyKey, leaseToken };
}

/**
 * Finalizes an idempotency record upon successful commit (inside MongoDB transaction for atomicity).
 * Verifies that the completing worker still holds the valid leaseToken.
 */
async function completeIdempotencyRecord({ actorId, idempotencyKey, leaseToken, statusCode = 200, responsePayload, session }) {
  if (!idempotencyKey || !actorId) return;
  const filter = {
    actorId,
    idempotencyKey
  };
  if (leaseToken) {
    filter.leaseToken = leaseToken;
  }
  const updateQuery = {
    $set: {
      status: 'COMPLETED',
      httpStatusCode: statusCode,
      responsePayload
    }
  };
  const opts = session ? { session } : {};
  const res = await IdempotencyLog.updateOne(filter, updateQuery, opts);
  if (leaseToken && res.matchedCount === 0) {
    const err = new Error(`Stale lease owner token for key ${idempotencyKey}. Operation was superseded.`);
    err.statusCode = 409;
    err.code = 'STALE_LEASE_OWNER';
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE TIMER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enforces the Attendance State Invariant:
 * An employee MUST be actively clocked in for their shift today and MUST NOT be on break.
 * Rejects with 400 if clocked out or on break.
 */
async function verifyAttendanceActive(empId, businessDate, session) {
  const Attendance = require('../../hr/models/Attendance');
  const Employee = require('../../hr/models/Employee');

  let empCode = null;
  if (mongoose.Types.ObjectId.isValid(empId)) {
    const empDoc = await Employee.findById(empId).select('employeeCode').lean();
    if (empDoc) empCode = empDoc.employeeCode;
  }

  const orClauses = [{ employee: empId }, { employeeId: String(empId) }];
  if (empCode) {
    orClauses.push({ employeeCode: empCode });
  }

  const query = Attendance.findOne({
    date: businessDate,
    $or: orClauses
  });
  if (session) query.session(session);
  const attendanceRecord = await query;

  if (!attendanceRecord || !attendanceRecord.isClockedIn || attendanceRecord.clockOutTime) {
    const err = new Error('Cannot start task timer while clocked out. Please clock in for your shift first.');
    err.statusCode = 400;
    throw err;
  }

  if (attendanceRecord.isOnBreak) {
    const err = new Error('Cannot start or resume task timer while on break. Please resume work first.');
    err.statusCode = 400;
    throw err;
  }

  return attendanceRecord;
}

/**
 * START TIMER (or ATOMIC TASK SWITCH)
 */
async function startTimer({ actor, targetEmployeeId, taskId, reason, requestId, idempotencyKey, leaseToken, source = 'EMPLOYEE_PORTAL', clientIp, userAgent }) {
  const { actorId, actorType, targetEmployeeId: empId, targetEmployeeName } = await resolveActorAndSubject(actor, targetEmployeeId);

  const task = await Task.findById(taskId);
  validateTaskOwnership(task, empId);

  return withOCCRetry(async (session) => {
    const serverNow = new Date();
    const businessDate = getISTDateString(serverNow);

    // Enforce Attendance State Invariant: Must be clocked in today and not on break
    await verifyAttendanceActive(empId, businessDate, session);

    // 1. Load or initialize authoritative ActiveTaskTimer
    let activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).session(session);
    if (!activeTimer) {
      const [created] = await ActiveTaskTimer.create([{
        employeeId: empId,
        status: 'IDLE',
        version: 0
      }], { session });
      activeTimer = created;
    }

    const currentVersion = activeTimer.version;
    const previousState = {
      timerStatus: activeTimer.status,
      activeTaskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      version: currentVersion
    };

    // ── SAME-TASK NO-OP RESOLUTION ───────────────────────────────────────────
    if (activeTimer.status === 'RUNNING' && String(activeTimer.taskId) === String(taskId)) {
      // Refresh heartbeat only; do not close or recreate session
      await ActiveTaskTimer.updateOne(
        { _id: activeTimer._id, version: currentVersion },
        { $set: { lastHeartbeatAt: serverNow } },
        { session }
      );

      const noOpPayload = {
        success: true,
        message: 'Task timer is already running.',
        state: {
          status: 'RUNNING',
          taskId: activeTimer.taskId,
          activeSessionId: activeTimer.activeSessionId,
          startedAt: activeTimer.startedAt,
          serverTime: serverNow
        },
        noOp: true
      };

      if (idempotencyKey) {
        await completeIdempotencyRecord({
          actorId,
          idempotencyKey,
          leaseToken,
          statusCode: 200,
          responsePayload: noOpPayload,
          session
        });
      }

      return noOpPayload;
    }

    let closedSession = null;
    let oldTaskId = null;

    // ── TASK SWITCH OR RUNNING SESSION CLOSE ─────────────────────────────────
    if (activeTimer.status === 'RUNNING' && activeTimer.activeSessionId) {
      oldTaskId = activeTimer.taskId;
      closedSession = await WorkSession.findOne({
        _id: activeTimer.activeSessionId,
        status: 'RUNNING'
      }).session(session);

      if (closedSession) {
        const durationMs = serverNow.getTime() - closedSession.startTimestamp.getTime();
        const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

        closedSession.actualEndTimestamp = serverNow;
        closedSession.durationMs = durationMs;
        closedSession.durationSeconds = durationSeconds;
        closedSession.status = 'CLOSED';
        closedSession.terminatedByActorId = actorId;
        closedSession.terminatedByActorType = actorType;
        await closedSession.save({ session });

        // Synchronously project legacy task metrics for old task
        if (oldTaskId) {
          await Task.updateOne(
            { _id: oldTaskId },
            {
              $inc: { accumulatedSeconds: durationSeconds, todayWorkSeconds: durationSeconds },
              $set: { timerRunning: false, status: 'incomplete' }
            },
            { session }
          );
        }
      }
    }

    // ── CREATE NEW WORK SESSION FOR NEW TASK ────────────────────────────────
    const [newSession] = await WorkSession.create([{
      employeeId: empId,
      taskId: task._id,
      businessDate,
      startTimestamp: serverNow,
      actualEndTimestamp: null,
      durationMs: 0,
      durationSeconds: 0,
      status: 'RUNNING',
      verificationStatus: 'VERIFIED',
      initiatedByActorId: actorId,
      initiatedByActorType: actorType
    }], { session });

    // ── ATOMICALLY UPDATE ACTIVETASKTIMER WITH OCC ───────────────────────────
    const actionType = (activeTimer.status === 'RUNNING' && oldTaskId) ? 'TASK_SWITCH' : 'START';

    const updateResult = await ActiveTaskTimer.updateOne(
      { _id: activeTimer._id, version: currentVersion },
      {
        $set: {
          taskId: task._id,
          activeSessionId: newSession._id,
          status: 'RUNNING',
          startedAt: serverNow,
          lastHeartbeatAt: serverNow,
          lastActionContext: {
            performedBy: actorId,
            performerRole: actorType,
            actionType,
            reason: reason || null,
            requestId: requestId || null,
            timestamp: serverNow
          }
        },
        $inc: { version: 1 }
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      throw new ConcurrencyVersionMismatchError();
    }

    // ── SYNCHRONOUSLY UPDATE TARGET TASK PROJECTION ──────────────────────────
    await Task.updateOne(
      { _id: task._id },
      {
        $set: {
          timerRunning: true,
          status: 'in_progress',
          startedAt: serverNow.getTime()
        }
      },
      { session }
    );

    // ── APPEND AUDIT LOG ────────────────────────────────────────────────────
    await TimeTrackingAuditLog.create([{
      actorId,
      actorType,
      targetEmployeeId: empId,
      taskId: task._id,
      actionType,
      previousState,
      newState: {
        timerStatus: 'RUNNING',
        activeTaskId: task._id,
        activeSessionId: newSession._id,
        version: currentVersion + 1
      },
      reason: reason || null,
      source,
      requestId: requestId || null,
      clientIp: clientIp || null,
      userAgent: userAgent || null,
      timestamp: serverNow
    }], { session });

    // ── DURABLE OUTBOX EVENT ────────────────────────────────────────────────
    const seq = await getNextSequenceNumber(empId, session);
    await DurableOutboxEvent.create([{
      employeeId: empId,
      seq,
      eventType: actionType === 'TASK_SWITCH' ? 'TASK_SWITCHED' : 'TIMER_STARTED',
      payload: {
        taskId: task._id,
        taskTitle: task.title,
        startedAt: serverNow,
        activeSessionId: newSession._id,
        performedBy: actorId,
        actorType
      },
      status: 'PENDING',
      createdAt: serverNow
    }], { session });

    const successResult = {
      success: true,
      message: actionType === 'TASK_SWITCH' ? 'Switched active task timer successfully.' : 'Task timer started successfully.',
      state: {
        status: 'RUNNING',
        taskId: task._id,
        taskTitle: task.title,
        activeSessionId: newSession._id,
        startedAt: serverNow,
        serverTime: serverNow,
        version: currentVersion + 1
      }
    };

    if (idempotencyKey) {
      await completeIdempotencyRecord({
        actorId,
        idempotencyKey,
        leaseToken,
        statusCode: 200,
        responsePayload: successResult,
        session
      });
    }

    return successResult;
  });
}

/**
 * PAUSE TIMER
 */
async function pauseTimer({ actor, targetEmployeeId, taskId, reason, requestId, idempotencyKey, leaseToken, source = 'EMPLOYEE_PORTAL', clientIp, userAgent }) {
  const { actorId, actorType, targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  return withOCCRetry(async (session) => {
    const serverNow = new Date();
    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).session(session);

    if (!activeTimer || activeTimer.status !== 'RUNNING') {
      const noOpRes = {
        success: true,
        message: 'Timer is not currently running.',
        state: activeTimer || { status: 'IDLE' },
        noOp: true
      };
      if (idempotencyKey) {
        await completeIdempotencyRecord({
          actorId,
          idempotencyKey,
          leaseToken,
          statusCode: 200,
          responsePayload: noOpRes,
          session
        });
      }
      return noOpRes;
    }

    if (taskId && String(activeTimer.taskId) !== String(taskId)) {
      const err = new Error('Specified task is not the currently running task.');
      err.statusCode = 400;
      throw err;
    }

    const currentVersion = activeTimer.version;
    const previousState = {
      timerStatus: activeTimer.status,
      activeTaskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      version: currentVersion
    };

    // 1. Close open WorkSession
    let durationSeconds = 0;
    if (activeTimer.activeSessionId) {
      const runningSession = await WorkSession.findOne({
        _id: activeTimer.activeSessionId,
        status: 'RUNNING'
      }).session(session);

      if (runningSession) {
        const durationMs = serverNow.getTime() - runningSession.startTimestamp.getTime();
        durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

        runningSession.actualEndTimestamp = serverNow;
        runningSession.durationMs = durationMs;
        runningSession.durationSeconds = durationSeconds;
        runningSession.status = 'CLOSED';
        runningSession.terminatedByActorId = actorId;
        runningSession.terminatedByActorType = actorType;
        await runningSession.save({ session });
      }
    }

    // 2. Mutate ActiveTaskTimer to PAUSED
    const updateResult = await ActiveTaskTimer.updateOne(
      { _id: activeTimer._id, version: currentVersion },
      {
        $set: {
          status: 'PAUSED',
          activeSessionId: null,
          lastActionContext: {
            performedBy: actorId,
            performerRole: actorType,
            actionType: 'PAUSE',
            reason: reason || null,
            requestId: requestId || null,
            timestamp: serverNow
          }
        },
        $inc: { version: 1 }
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      throw new ConcurrencyVersionMismatchError();
    }

    // 3. Project Task status: on_hold, timerRunning: false
    if (activeTimer.taskId) {
      await Task.updateOne(
        { _id: activeTimer.taskId },
        {
          $inc: { accumulatedSeconds: durationSeconds, todayWorkSeconds: durationSeconds },
          $set: { timerRunning: false, status: 'on_hold' }
        },
        { session }
      );
    }

    // 4. Append Audit Log
    await TimeTrackingAuditLog.create([{
      actorId,
      actorType,
      targetEmployeeId: empId,
      taskId: activeTimer.taskId,
      actionType: 'PAUSE',
      previousState,
      newState: {
        timerStatus: 'PAUSED',
        activeTaskId: activeTimer.taskId,
        activeSessionId: null,
        version: currentVersion + 1
      },
      reason: reason || null,
      source,
      requestId: requestId || null,
      clientIp: clientIp || null,
      userAgent: userAgent || null,
      timestamp: serverNow
    }], { session });

    // 5. Durable Outbox Event
    const seq = await getNextSequenceNumber(empId, session);
    await DurableOutboxEvent.create([{
      employeeId: empId,
      seq,
      eventType: 'TIMER_PAUSED',
      payload: {
        taskId: activeTimer.taskId,
        pausedAt: serverNow,
        performedBy: actorId,
        actorType
      },
      status: 'PENDING',
      createdAt: serverNow
    }], { session });

    const pauseResult = {
      success: true,
      message: 'Task timer paused successfully.',
      state: {
        status: 'PAUSED',
        taskId: activeTimer.taskId,
        activeSessionId: null,
        pausedAt: serverNow,
        serverTime: serverNow,
        version: currentVersion + 1
      }
    };

    if (idempotencyKey) {
      await completeIdempotencyRecord({
        actorId,
        idempotencyKey,
        leaseToken,
        statusCode: 200,
        responsePayload: pauseResult,
        session
      });
    }

    return pauseResult;
  });
}

/**
 * RESUME TIMER
 */
async function resumeTimer({ actor, targetEmployeeId, taskId, reason, requestId, idempotencyKey, leaseToken, source = 'EMPLOYEE_PORTAL', clientIp, userAgent }) {
  const { actorId, actorType, targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  return withOCCRetry(async (session) => {
    const serverNow = new Date();
    const businessDate = getISTDateString(serverNow);

    // Enforce Attendance State Invariant: Must be clocked in today and not on break
    await verifyAttendanceActive(empId, businessDate, session);

    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).session(session);

    if (!activeTimer) {
      const err = new Error('No active timer state found to resume.');
      err.statusCode = 404;
      throw err;
    }

    // Determine target task
    const resumeTaskId = taskId || activeTimer.taskId;
    if (!resumeTaskId) {
      const err = new Error('No task specified to resume.');
      err.statusCode = 400;
      throw err;
    }

    const task = await Task.findById(resumeTaskId);
    validateTaskOwnership(task, empId);

    // If already running on this task, no-op
    if (activeTimer.status === 'RUNNING' && String(activeTimer.taskId) === String(resumeTaskId)) {
      const noOpRes = {
        success: true,
        message: 'Task timer is already running.',
        state: activeTimer,
        noOp: true
      };
      if (idempotencyKey) {
        await completeIdempotencyRecord({
          actorId,
          idempotencyKey,
          leaseToken,
          statusCode: 200,
          responsePayload: noOpRes,
          session
        });
      }
      return noOpRes;
    }

    // If running on another task, delegate to startTimer which performs atomic switch
    if (activeTimer.status === 'RUNNING') {
      return startTimer({ actor, targetEmployeeId: empId, taskId: resumeTaskId, reason, requestId, idempotencyKey, source, clientIp, userAgent });
    }

    const currentVersion = activeTimer.version;
    const previousState = {
      timerStatus: activeTimer.status,
      activeTaskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      version: currentVersion
    };

    // Create new WorkSession interval
    const [newSession] = await WorkSession.create([{
      employeeId: empId,
      taskId: task._id,
      businessDate,
      startTimestamp: serverNow,
      actualEndTimestamp: null,
      durationMs: 0,
      durationSeconds: 0,
      status: 'RUNNING',
      verificationStatus: 'VERIFIED',
      initiatedByActorId: actorId,
      initiatedByActorType: actorType
    }], { session });

    // Update ActiveTaskTimer to RUNNING
    const updateResult = await ActiveTaskTimer.updateOne(
      { _id: activeTimer._id, version: currentVersion },
      {
        $set: {
          taskId: task._id,
          activeSessionId: newSession._id,
          status: 'RUNNING',
          startedAt: serverNow,
          lastHeartbeatAt: serverNow,
          lastActionContext: {
            performedBy: actorId,
            performerRole: actorType,
            actionType: 'RESUME',
            reason: reason || null,
            requestId: requestId || null,
            timestamp: serverNow
          }
        },
        $inc: { version: 1 }
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      throw new ConcurrencyVersionMismatchError();
    }

    // Project Task to in_progress
    await Task.updateOne(
      { _id: task._id },
      {
        $set: {
          timerRunning: true,
          status: 'in_progress',
          startedAt: serverNow.getTime()
        }
      },
      { session }
    );

    // Append Audit Log
    await TimeTrackingAuditLog.create([{
      actorId,
      actorType,
      targetEmployeeId: empId,
      taskId: task._id,
      actionType: 'RESUME',
      previousState,
      newState: {
        timerStatus: 'RUNNING',
        activeTaskId: task._id,
        activeSessionId: newSession._id,
        version: currentVersion + 1
      },
      reason: reason || null,
      source,
      requestId: requestId || null,
      clientIp: clientIp || null,
      userAgent: userAgent || null,
      timestamp: serverNow
    }], { session });

    // Durable Outbox Event
    const seq = await getNextSequenceNumber(empId, session);
    await DurableOutboxEvent.create([{
      employeeId: empId,
      seq,
      eventType: 'TIMER_RESUMED',
      payload: {
        taskId: task._id,
        resumedAt: serverNow,
        activeSessionId: newSession._id,
        performedBy: actorId,
        actorType
      },
      status: 'PENDING',
      createdAt: serverNow
    }], { session });

    const resumeResult = {
      success: true,
      message: 'Task timer resumed successfully.',
      state: {
        status: 'RUNNING',
        taskId: task._id,
        activeSessionId: newSession._id,
        startedAt: serverNow,
        serverTime: serverNow,
        version: currentVersion + 1
      }
    };

    if (idempotencyKey) {
      await completeIdempotencyRecord({
        actorId,
        idempotencyKey,
        leaseToken,
        statusCode: 200,
        responsePayload: resumeResult,
        session
      });
    }

    return resumeResult;
  });
}

/**
 * STOP TIMER
 * Strict Business Rule: STOP closes the running timer and leaves the task incomplete.
 * NEVER marks the task as completed!
 */
async function stopTimer({ actor, targetEmployeeId, taskId, reason, requestId, idempotencyKey, leaseToken, source = 'EMPLOYEE_PORTAL', clientIp, userAgent }) {
  const { actorId, actorType, targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  return withOCCRetry(async (session) => {
    const serverNow = new Date();
    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).session(session);

    if (!activeTimer || activeTimer.status === 'IDLE') {
      const idleRes = {
        success: true,
        message: 'Timer is already idle.',
        state: activeTimer || { status: 'IDLE' },
        noOp: true
      };
      if (idempotencyKey) {
        await completeIdempotencyRecord({
          actorId,
          idempotencyKey,
          leaseToken,
          statusCode: 200,
          responsePayload: idleRes,
          session
        });
      }
      return idleRes;
    }

    const currentVersion = activeTimer.version;
    const previousState = {
      timerStatus: activeTimer.status,
      activeTaskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      version: currentVersion
    };

    const targetTaskId = taskId || activeTimer.taskId;

    // 1. Close running session if currently open
    let durationSeconds = 0;
    if (activeTimer.status === 'RUNNING' && activeTimer.activeSessionId) {
      const runningSession = await WorkSession.findOne({
        _id: activeTimer.activeSessionId,
        status: 'RUNNING'
      }).session(session);

      if (runningSession) {
        const durationMs = serverNow.getTime() - runningSession.startTimestamp.getTime();
        durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

        runningSession.actualEndTimestamp = serverNow;
        runningSession.durationMs = durationMs;
        runningSession.durationSeconds = durationSeconds;
        runningSession.status = 'CLOSED';
        runningSession.terminatedByActorId = actorId;
        runningSession.terminatedByActorType = actorType;
        await runningSession.save({ session });
      }
    }

    // 2. Set ActiveTaskTimer to IDLE
    const updateResult = await ActiveTaskTimer.updateOne(
      { _id: activeTimer._id, version: currentVersion },
      {
        $set: {
          status: 'IDLE',
          taskId: null,
          activeSessionId: null,
          startedAt: null,
          lastActionContext: {
            performedBy: actorId,
            performerRole: actorType,
            actionType: 'STOP',
            reason: reason || null,
            requestId: requestId || null,
            timestamp: serverNow
          }
        },
        $inc: { version: 1 }
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      throw new ConcurrencyVersionMismatchError();
    }

    // 3. Project Task status: incomplete, timerRunning: false (DO NOT MARK COMPLETED)
    if (targetTaskId) {
      await Task.updateOne(
        { _id: targetTaskId },
        {
          $inc: { accumulatedSeconds: durationSeconds, todayWorkSeconds: durationSeconds },
          $set: { timerRunning: false, status: 'incomplete' }
        },
        { session }
      );
    }

    // 4. Append Audit Log
    await TimeTrackingAuditLog.create([{
      actorId,
      actorType,
      targetEmployeeId: empId,
      taskId: targetTaskId,
      actionType: 'STOP',
      previousState,
      newState: {
        timerStatus: 'IDLE',
        activeTaskId: null,
        activeSessionId: null,
        version: currentVersion + 1
      },
      reason: reason || null,
      source,
      requestId: requestId || null,
      clientIp: clientIp || null,
      userAgent: userAgent || null,
      timestamp: serverNow
    }], { session });

    // 5. Durable Outbox Event
    const seq = await getNextSequenceNumber(empId, session);
    await DurableOutboxEvent.create([{
      employeeId: empId,
      seq,
      eventType: 'TIMER_STOPPED',
      payload: {
        taskId: targetTaskId,
        stoppedAt: serverNow,
        performedBy: actorId,
        actorType
      },
      status: 'PENDING',
      createdAt: serverNow
    }], { session });

    const stopResult = {
      success: true,
      message: 'Task timer stopped successfully. Task left incomplete.',
      state: {
        status: 'IDLE',
        taskId: null,
        activeSessionId: null,
        stoppedAt: serverNow,
        serverTime: serverNow,
        version: currentVersion + 1
      }
    };

    if (idempotencyKey) {
      await completeIdempotencyRecord({
        actorId,
        idempotencyKey,
        leaseToken,
        statusCode: 200,
        responsePayload: stopResult,
        session
      });
    }

    return stopResult;
  });
}

/**
 * COMPLETE TASK
 * Strict Business Rule: COMPLETE closes running session, resets timer to IDLE,
 * and marks task status = 'completed', progress = 100, completedAt = ServerNow.
 */
async function completeTask({ actor, targetEmployeeId, taskId, reason, requestId, idempotencyKey, leaseToken, source = 'EMPLOYEE_PORTAL', clientIp, userAgent }) {
  const { actorId, actorType, targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  const task = await Task.findById(taskId);
  validateTaskOwnership(task, empId);

  return withOCCRetry(async (session) => {
    const serverNow = new Date();
    const businessDate = getISTDateString(serverNow);

    // Enforce Attendance State Invariant: Must be clocked in today and not on break
    await verifyAttendanceActive(empId, businessDate, session);

    const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).session(session);

    let durationSeconds = 0;
    const currentVersion = activeTimer ? activeTimer.version : 0;
    const previousState = activeTimer ? {
      timerStatus: activeTimer.status,
      activeTaskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      version: currentVersion
    } : { timerStatus: 'IDLE', activeTaskId: null, activeSessionId: null, version: 0 };

    // 1. If currently timing THIS task, close the running session
    if (activeTimer && activeTimer.status === 'RUNNING' && String(activeTimer.taskId) === String(task._id)) {
      if (activeTimer.activeSessionId) {
        const runningSession = await WorkSession.findOne({
          _id: activeTimer.activeSessionId,
          status: 'RUNNING'
        }).session(session);

        if (runningSession) {
          const durationMs = serverNow.getTime() - runningSession.startTimestamp.getTime();
          durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

          runningSession.actualEndTimestamp = serverNow;
          runningSession.durationMs = durationMs;
          runningSession.durationSeconds = durationSeconds;
          runningSession.status = 'CLOSED';
          runningSession.terminatedByActorId = actorId;
          runningSession.terminatedByActorType = actorType;
          await runningSession.save({ session });
        }
      }

      // Reset timer to IDLE
      const updateResult = await ActiveTaskTimer.updateOne(
        { _id: activeTimer._id, version: currentVersion },
        {
          $set: {
            status: 'IDLE',
            taskId: null,
            activeSessionId: null,
            startedAt: null,
            lastActionContext: {
              performedBy: actorId,
              performerRole: actorType,
              actionType: 'COMPLETE',
              reason: reason || null,
              requestId: requestId || null,
              timestamp: serverNow
            }
          },
          $inc: { version: 1 }
        },
        { session }
      );

      if (updateResult.matchedCount === 0) {
        throw new ConcurrencyVersionMismatchError();
      }
    } else if (activeTimer && activeTimer.status === 'PAUSED' && String(activeTimer.taskId) === String(task._id)) {
      // Clear paused timer referencing this task
      await ActiveTaskTimer.updateOne(
        { _id: activeTimer._id, version: currentVersion },
        {
          $set: {
            status: 'IDLE',
            taskId: null,
            activeSessionId: null,
            startedAt: null
          },
          $inc: { version: 1 }
        },
        { session }
      );
    }

    // 2. Mark Task COMPLETED
    await Task.updateOne(
      { _id: task._id },
      {
        $inc: { accumulatedSeconds: durationSeconds, todayWorkSeconds: durationSeconds },
        $set: {
          status: 'completed',
          progress: 100,
          timerRunning: false,
          completedAt: serverNow,
          completedOn: businessDate
        }
      },
      { session }
    );

    // 3. Append Audit Log
    await TimeTrackingAuditLog.create([{
      actorId,
      actorType,
      targetEmployeeId: empId,
      taskId: task._id,
      actionType: 'COMPLETE',
      previousState,
      newState: {
        timerStatus: 'IDLE',
        activeTaskId: null,
        activeSessionId: null,
        version: currentVersion + 1
      },
      reason: reason || null,
      source,
      requestId: requestId || null,
      clientIp: clientIp || null,
      userAgent: userAgent || null,
      timestamp: serverNow
    }], { session });

    // 4. Durable Outbox Event
    const seq = await getNextSequenceNumber(empId, session);
    await DurableOutboxEvent.create([{
      employeeId: empId,
      seq,
      eventType: 'TASK_COMPLETED',
      payload: {
        taskId: task._id,
        completedAt: serverNow,
        performedBy: actorId,
        actorType
      },
      status: 'PENDING',
      createdAt: serverNow
    }], { session });

    const completeResult = {
      success: true,
      message: 'Task marked as completed successfully.',
      task: {
        _id: task._id,
        status: 'completed',
        progress: 100,
        completedAt: serverNow,
        completedOn: businessDate
      }
    };

    if (idempotencyKey) {
      await completeIdempotencyRecord({
        actorId,
        idempotencyKey,
        leaseToken,
        statusCode: 200,
        responsePayload: completeResult,
        session
      });
    }

    return completeResult;
  });
}

/**
 * GET ACTIVE TIMER (Authoritative Query)
 */
async function getActiveTimer({ actor, targetEmployeeId }) {
  const { targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  const activeTimer = await ActiveTaskTimer.findOne({ employeeId: empId }).populate('taskId', 'taskCode title status priority projectName');
  if (!activeTimer) {
    return {
      success: true,
      data: {
        status: 'IDLE',
        employeeId: empId,
        taskId: null,
        activeSessionId: null,
        startedAt: null,
        serverTime: new Date(),
        liveElapsedSeconds: 0
      }
    };
  }

  let liveElapsedSeconds = 0;
  let activeSession = null;

  if (activeTimer.status === 'RUNNING' && activeTimer.activeSessionId) {
    activeSession = await WorkSession.findById(activeTimer.activeSessionId);
    if (activeSession && activeSession.startTimestamp) {
      const now = new Date();
      liveElapsedSeconds = Math.max(0, Math.floor((now.getTime() - activeSession.startTimestamp.getTime()) / 1000));
    }
  }

  return {
    success: true,
    data: {
      status: activeTimer.status,
      employeeId: activeTimer.employeeId,
      taskId: activeTimer.taskId,
      activeSessionId: activeTimer.activeSessionId,
      startedAt: activeTimer.startedAt,
      lastHeartbeatAt: activeTimer.lastHeartbeatAt,
      serverTime: new Date(),
      liveElapsedSeconds,
      activeSession
    }
  };
}

/**
 * GET WORK SESSIONS (Interval Ledger Query)
 */
async function getWorkSessions({ actor, targetEmployeeId, taskId, businessDate, startDate, endDate, page = 1, limit = 50 }) {
  const { targetEmployeeId: empId } = await resolveActorAndSubject(actor, targetEmployeeId);

  const query = { employeeId: empId };
  if (taskId) query.taskId = taskId;
  if (businessDate) query.businessDate = businessDate;
  if (startDate && endDate) {
    query.startTimestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10)));

  const [sessions, total] = await Promise.all([
    WorkSession.find(query)
      .populate('taskId', 'taskCode title project projectName')
      .sort({ startTimestamp: -1 })
      .skip(skip)
      .limit(parsedLimit),
    WorkSession.countDocuments(query)
  ]);

  return {
    success: true,
    data: sessions,
    pagination: {
      page: parseInt(page, 10),
      limit: parsedLimit,
      total,
      pages: Math.ceil(total / parsedLimit)
    }
  };
}

module.exports = {
  getISTDateString,
  resolveActorAndSubject,
  validateTaskOwnership,
  verifyAttendanceActive,
  computeRequestHash,
  acquireIdempotencyLease,
  completeIdempotencyRecord,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  completeTask,
  getActiveTimer,
  getWorkSessions
};
