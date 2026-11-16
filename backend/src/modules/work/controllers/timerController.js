/**
 * @file timerController.js
 * @description Express controller for server-authoritative Work Sessions & Task Timer.
 * Interacts with timeEngineService, manages Idempotency leases, and handles HTTP responses.
 */

const timeEngineService = require('../services/timeEngineService');

// Helper to extract common request metadata
function extractMetadata(req) {
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;
  const requestId = req.headers['x-request-id'] || idempotencyKey || null;
  const clientIp = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const source = req.headers['x-client-source'] || (req.user?.isAdmin ? 'ADMIN_PORTAL' : 'EMPLOYEE_PORTAL');

  return {
    idempotencyKey,
    requestId,
    clientIp,
    userAgent,
    source
  };
}

/**
 * POST /api/work-sessions/start
 * Starts timer or executes atomic task switch.
 */
exports.startTimer = async (req, res, next) => {
  try {
    const { taskId, targetEmployeeId, reason } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required.' });
    }

    const { idempotencyKey, requestId, clientIp, userAgent, source } = extractMetadata(req);

    // Check / acquire idempotency lease (scoped to actorId and idempotencyKey)
    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: req.user._id,
      targetEmployeeId,
      idempotencyKey,
      operationType: 'START',
      requestPayload: { taskId, targetEmployeeId }
    });

    if (lease && lease.isCached) {
      return res.status(lease.statusCode).json(lease.payload);
    }

    // Atomic transaction execution (idempotency completion committed inside transaction)
    const result = await timeEngineService.startTimer({
      actor: req.user,
      targetEmployeeId,
      taskId,
      reason,
      requestId,
      idempotencyKey,
      leaseToken: lease?.leaseToken || null,
      source,
      clientIp,
      userAgent
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      code: err.code || err.name,
      message: err.message
    });
  }
};

/**
 * POST /api/work-sessions/pause
 * Pauses active task timer.
 */
exports.pauseTimer = async (req, res, next) => {
  try {
    const { taskId, targetEmployeeId, reason } = req.body;
    const { idempotencyKey, requestId, clientIp, userAgent, source } = extractMetadata(req);

    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: req.user._id,
      targetEmployeeId,
      idempotencyKey,
      operationType: 'PAUSE',
      requestPayload: { taskId, targetEmployeeId }
    });

    if (lease && lease.isCached) {
      return res.status(lease.statusCode).json(lease.payload);
    }

    const result = await timeEngineService.pauseTimer({
      actor: req.user,
      targetEmployeeId,
      taskId,
      reason,
      requestId,
      idempotencyKey,
      leaseToken: lease?.leaseToken || null,
      source,
      clientIp,
      userAgent
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      code: err.code || err.name,
      message: err.message
    });
  }
};

/**
 * POST /api/work-sessions/resume
 * Resumes paused task timer.
 */
exports.resumeTimer = async (req, res, next) => {
  try {
    const { taskId, targetEmployeeId, reason } = req.body;
    const { idempotencyKey, requestId, clientIp, userAgent, source } = extractMetadata(req);

    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: req.user._id,
      targetEmployeeId,
      idempotencyKey,
      operationType: 'RESUME',
      requestPayload: { taskId, targetEmployeeId }
    });

    if (lease && lease.isCached) {
      return res.status(lease.statusCode).json(lease.payload);
    }

    const result = await timeEngineService.resumeTimer({
      actor: req.user,
      targetEmployeeId,
      taskId,
      reason,
      requestId,
      idempotencyKey,
      leaseToken: lease?.leaseToken || null,
      source,
      clientIp,
      userAgent
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      code: err.code || err.name,
      message: err.message
    });
  }
};

/**
 * POST /api/work-sessions/stop
 * Stops timer, leaves task incomplete. NEVER marks completed.
 */
exports.stopTimer = async (req, res, next) => {
  try {
    const { taskId, targetEmployeeId, reason } = req.body;
    const { idempotencyKey, requestId, clientIp, userAgent, source } = extractMetadata(req);

    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: req.user._id,
      targetEmployeeId,
      idempotencyKey,
      operationType: 'STOP',
      requestPayload: { taskId, targetEmployeeId }
    });

    if (lease && lease.isCached) {
      return res.status(lease.statusCode).json(lease.payload);
    }

    const result = await timeEngineService.stopTimer({
      actor: req.user,
      targetEmployeeId,
      taskId,
      reason,
      requestId,
      idempotencyKey,
      leaseToken: lease?.leaseToken || null,
      source,
      clientIp,
      userAgent
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      code: err.code || err.name,
      message: err.message
    });
  }
};

/**
 * POST /api/work-sessions/complete
 * Closes timer and marks task completed.
 */
exports.completeTask = async (req, res, next) => {
  try {
    const { taskId, targetEmployeeId, reason } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required.' });
    }

    const { idempotencyKey, requestId, clientIp, userAgent, source } = extractMetadata(req);

    const lease = await timeEngineService.acquireIdempotencyLease({
      actorId: req.user._id,
      targetEmployeeId,
      idempotencyKey,
      operationType: 'COMPLETE',
      requestPayload: { taskId, targetEmployeeId }
    });

    if (lease && lease.isCached) {
      return res.status(lease.statusCode).json(lease.payload);
    }

    const result = await timeEngineService.completeTask({
      actor: req.user,
      targetEmployeeId,
      taskId,
      reason,
      requestId,
      idempotencyKey,
      leaseToken: lease?.leaseToken || null,
      source,
      clientIp,
      userAgent
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      code: err.code || err.name,
      message: err.message
    });
  }
};

/**
 * GET /api/work-sessions/active
 * Gets authoritative active timer state and elapsed seconds.
 */
exports.getActiveTimer = async (req, res, next) => {
  try {
    const targetEmployeeId = req.query.targetEmployeeId || req.query.employeeId || null;
    const result = await timeEngineService.getActiveTimer({
      actor: req.user,
      targetEmployeeId
    });
    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: err.name,
      message: err.message
    });
  }
};

/**
 * GET /api/work-sessions
 * Gets interval ledger sessions with pagination and filters.
 */
exports.getWorkSessions = async (req, res, next) => {
  try {
    const { targetEmployeeId, employeeId, taskId, businessDate, startDate, endDate, page, limit } = req.query;
    const resolvedTarget = targetEmployeeId || employeeId || null;

    const result = await timeEngineService.getWorkSessions({
      actor: req.user,
      targetEmployeeId: resolvedTarget,
      taskId,
      businessDate,
      startDate,
      endDate,
      page,
      limit
    });
    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: err.name,
      message: err.message
    });
  }
};
