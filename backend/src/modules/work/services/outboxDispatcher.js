/**
 * @file outboxDispatcher.js
 * @description Reliable Transactional Outbox Dispatcher for EMS Task Timer & Attendance Events.
 * Reads monotonically sequenced, committed DurableOutboxEvent records from MongoDB
 * and dispatches them in strict sequence order across authenticated Socket.IO rooms.
 */

const DurableOutboxEvent = require('../models/DurableOutboxEvent');
const socketManager = require('../../../shared/socket/socketManager');

/**
 * Dispatch pending outbox events for a specific employee or all employees
 * @param {string|import('mongoose').Types.ObjectId|null} employeeId
 * @returns {Promise<{ dispatchedCount: number, error?: string }>}
 */
async function dispatchPendingOutboxEvents(employeeId = null) {
  try {
    const query = { status: 'PENDING' };
    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Monotonically ordered by sequence number to preserve strict operational ordering
    const pendingEvents = await DurableOutboxEvent.find(query)
      .sort({ seq: 1 })
      .limit(50);

    if (!pendingEvents || pendingEvents.length === 0) {
      return { dispatchedCount: 0 };
    }

    const io = socketManager.getSocketServer();
    let dispatchedCount = 0;

    for (const event of pendingEvents) {
      try {
        const empIdStr = event.employeeId ? event.employeeId.toString() : '';
        const targetRoom = `user:${empIdStr}`;

        if (io && empIdStr) {
          // 1. Monotonic outbox envelope event
          io.to(targetRoom).emit('timer:event', {
            eventId: event._id,
            seq: event.seq,
            eventType: event.eventType,
            payload: event.payload,
            createdAt: event.createdAt
          });

          // 2. High-level semantic events mapped from eventType
          switch (event.eventType) {
            case 'TIMER_STARTED':
              io.to(targetRoom).emit('task:timer_started', event.payload);
              break;
            case 'TIMER_PAUSED':
              io.to(targetRoom).emit('task:timer_paused', event.payload);
              break;
            case 'TIMER_RESUMED':
              io.to(targetRoom).emit('task:timer_resumed', event.payload);
              break;
            case 'TIMER_STOPPED':
              io.to(targetRoom).emit('task:timer_stopped', event.payload);
              break;
            case 'TASK_COMPLETED':
              io.to(targetRoom).emit('task:timer_completed', event.payload);
              break;
            case 'TASK_SWITCHED':
              io.to(targetRoom).emit('task:timer_switched', event.payload);
              break;
            case 'BREAK_PAUSE':
            case 'CLOCK_OUT_PAUSE':
              io.to(targetRoom).emit('task:timer_paused', event.payload);
              break;
            default:
              break;
          }
        }

        // Mark as published
        event.status = 'PUBLISHED';
        event.publishedAt = new Date();
        await event.save();
        dispatchedCount++;
      } catch (itemErr) {
        event.retryCount = (event.retryCount || 0) + 1;
        event.lastError = itemErr.message || 'Dispatch failure';
        if (event.retryCount >= 5) {
          event.status = 'FAILED';
        }
        await event.save();
      }
    }

    return { dispatchedCount };
  } catch (err) {
    console.error('[outboxDispatcher] Error during dispatchPendingOutboxEvents:', err.message);
    return { dispatchedCount: 0, error: err.message };
  }
}

module.exports = {
  dispatchPendingOutboxEvents
};
