/**
 * @file timerOfflineQueue.js
 * @description Persistent offline action queue for task timer operations.
 * Enqueues timer actions when offline or during transient network interruptions,
 * and flushes them sequentially in FIFO order when connectivity is restored.
 * Strictly scoped per authenticated user with per-user execution locking,
 * cross-account identity protection, stable idempotency keys, and failure blocking.
 */

/**
 * Helper to resolve the currently active user ID from explicit argument or local auth session
 * @param {string|null} explicitUserId
 * @returns {string}
 */
export function getActiveUserId(explicitUserId = null) {
  if (explicitUserId) return String(explicitUserId);
  try {
    if (typeof localStorage === 'undefined') return 'anon';
    const s = localStorage.getItem('ems_auth_session');
    if (!s) return 'anon';
    const parsed = JSON.parse(s);
    const user = parsed?.user || parsed;
    return String(user?._id || user?.id || user?.employeeCode || 'anon');
  } catch (_) {
    return 'anon';
  }
}

/**
 * Generates user-scoped localStorage key
 * @param {string|null} userId
 * @returns {string}
 */
export function getOfflineQueueKey(userId = null) {
  const uid = getActiveUserId(userId);
  return `ems_timer_offline_queue_${uid}`;
}

/**
 * Retrieve queued timer actions from localStorage scoped to user
 * @param {string|null} userId
 * @returns {Array<{ id: string, type: string, payload: object, idempotencyKey: string, timestamp: number }>}
 */
export function getOfflineTimerQueue(userId = null) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const key = getOfflineQueueKey(userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Save queued timer actions to localStorage scoped to user
 * @param {Array} queue
 * @param {string|null} userId
 */
export function saveOfflineTimerQueue(queue, userId = null) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getOfflineQueueKey(userId);
    if (!queue || queue.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(queue));
    }
  } catch (_) {}
}

/**
 * Enqueue a timer action with stable idempotency key
 * @param {'START'|'PAUSE'|'RESUME'|'STOP'|'COMPLETE'} type
 * @param {object} payload
 * @param {string|null} userId
 */
export function enqueueTimerAction(type, payload = {}, userId = null) {
  const queue = getOfflineTimerQueue(userId);
  const stableIdempotencyKey = payload.idempotencyKey || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const entry = {
    id: `timer_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload: {
      ...payload,
      idempotencyKey: stableIdempotencyKey
    },
    idempotencyKey: stableIdempotencyKey,
    timestamp: Date.now()
  };
  queue.push(entry);
  saveOfflineTimerQueue(queue, userId);
  return entry;
}

// Per-user execution lock Set: In-memory protection against re-entrant calls within the same JavaScript context.
const activeUserFlushes = new Set();

/**
 * Unique identifier for the current browser tab / execution context.
 */
export const TAB_INSTANCE_ID = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

const LEASE_DURATION_MS = 15000; // 15s auto-expiry for storage lease fallback

/**
 * Fallback cross-tab lock using localStorage lease with heartbeat expiration.
 * Used when Web Locks API (navigator.locks) is unavailable or throws.
 * @param {string} userId
 * @param {string} tabId
 * @returns {boolean} true if lease acquired; false if another tab holds an active lease
 */
export function acquireCrossTabStorageLease(userId, tabId = TAB_INSTANCE_ID) {
  try {
    if (typeof localStorage === 'undefined') return true;
    const leaseKey = `ems_flush_lease_${userId}`;
    const now = Date.now();
    const existing = localStorage.getItem(leaseKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.tabId !== tabId && Number(parsed.expiresAt) > now) {
          return false; // Another tab holds an active lease
        }
      } catch (_) {}
    }
    localStorage.setItem(leaseKey, JSON.stringify({ tabId, expiresAt: now + LEASE_DURATION_MS }));
    return true;
  } catch (_) {
    return true;
  }
}

/**
 * Release fallback cross-tab storage lease
 * @param {string} userId
 * @param {string} tabId
 */
export function releaseCrossTabStorageLease(userId, tabId = TAB_INSTANCE_ID) {
  try {
    if (typeof localStorage === 'undefined') return;
    const leaseKey = `ems_flush_lease_${userId}`;
    const existing = localStorage.getItem(leaseKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.tabId === tabId) {
          localStorage.removeItem(leaseKey);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Cross-tab execution lock wrapper using Web Locks API with fallback to Storage Lease.
 * Guarantees that only ONE tab per user flushes the queue at any given time.
 * @param {string} userId
 * @param {() => Promise<number>} actionFn
 * @returns {Promise<number>}
 */
export async function executeWithCrossTabLock(userId, actionFn) {
  // 1. Module-level check (same-tab protection)
  if (activeUserFlushes.has(userId)) {
    return 0;
  }

  // 2. Web Locks API (modern standard across Chrome, Edge, Safari, Firefox)
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    const lockName = `ems_timer_flush_lock_${userId}`;
    try {
      return await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Another tab or worker currently holds the lock for this user
          return 0;
        }
        activeUserFlushes.add(userId);
        try {
          return await actionFn();
        } finally {
          activeUserFlushes.delete(userId);
        }
      });
    } catch (lockErr) {
      console.warn('[TimerOfflineQueue] Web Locks API request failed, falling back to storage lease:', lockErr);
    }
  }

  // 3. Fallback: Storage Lease with automatic TTL expiration
  const acquired = acquireCrossTabStorageLease(userId);
  if (!acquired) {
    return 0; // Another tab holds the lease
  }

  activeUserFlushes.add(userId);
  try {
    return await actionFn();
  } finally {
    activeUserFlushes.delete(userId);
    releaseCrossTabStorageLease(userId);
  }
}

/**
 * Checks whether a given user queue is currently in the process of flushing
 * @param {string|null} userId
 * @returns {boolean}
 */
export function isUserFlushing(userId = null) {
  const uid = getActiveUserId(userId);
  return activeUserFlushes.has(uid);
}

/**
 * Returns all currently flushing user IDs
 * @returns {string[]}
 */
export function getActiveFlushingUsers() {
  return Array.from(activeUserFlushes);
}

/**
 * Flush all queued actions to the backend sequentially in strict FIFO order
 * @param {object} workServiceInstance
 * @param {string|null} userId
 * @returns {Promise<number>} number of successfully flushed actions
 */
export async function flushTimerQueue(workServiceInstance, userId = null) {
  const targetUserId = getActiveUserId(userId);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 0;
  }

  return executeWithCrossTabLock(targetUserId, async () => {
    const queue = getOfflineTimerQueue(targetUserId);
    if (!queue || queue.length === 0) return 0;

    let flushedCount = 0;
    let stoppedDueToFailure = false;
    const remaining = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      // Failure blocking: once an action fails, all subsequent actions must remain queued
      if (stoppedDueToFailure) {
        remaining.push(item);
        continue;
      }

      // Cross-account safety: verify that current active session has not switched to another user
      const currentActiveSessionUid = getActiveUserId();
      if (currentActiveSessionUid !== targetUserId) {
        console.warn(`[TimerOfflineQueue] Session switched from ${targetUserId} to ${currentActiveSessionUid} mid-flush. Aborting to prevent cross-account credential usage.`);
        stoppedDueToFailure = true;
        remaining.push(item);
        continue;
      }

      try {
        const payloadWithKey = {
          ...item.payload,
          idempotencyKey: item.idempotencyKey || item.payload?.idempotencyKey
        };

        if (item.type === 'START') {
          await workServiceInstance.startWorkSession(payloadWithKey, { skipQueue: true });
        } else if (item.type === 'PAUSE') {
          await workServiceInstance.pauseWorkSession(payloadWithKey, { skipQueue: true });
        } else if (item.type === 'RESUME') {
          await workServiceInstance.resumeWorkSession(payloadWithKey, { skipQueue: true });
        } else if (item.type === 'STOP') {
          await workServiceInstance.stopWorkSession(payloadWithKey, { skipQueue: true });
        } else if (item.type === 'COMPLETE') {
          await workServiceInstance.completeWorkSession(payloadWithKey, { skipQueue: true });
        }
        flushedCount++;
      } catch (err) {
        console.warn(`[TimerOfflineQueue] Action ${item.type} failed:`, err.message);
        // Preserve failed action and all dependent subsequent actions in strict FIFO order
        stoppedDueToFailure = true;
        remaining.push(item);
      }
    }

    saveOfflineTimerQueue(remaining, targetUserId);
    return flushedCount;
  });
}

/**
 * Setup online event listener to automatically flush when network restores
 * @param {object} workServiceInstance
 * @param {string|null} userId
 */
export function initTimerOfflineSync(workServiceInstance, userId = null) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    flushTimerQueue(workServiceInstance, userId).catch(() => {});
  };

  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
