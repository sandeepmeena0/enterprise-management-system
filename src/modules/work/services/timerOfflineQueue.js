/**
 * @file timerOfflineQueue.js
 * @description Persistent offline action queue for task timer operations.
 * Enqueues timer actions when offline or during transient network interruptions,
 * and flushes them sequentially in FIFO order when connectivity is restored.
 */

const OFFLINE_QUEUE_KEY = 'ems_timer_offline_queue';

/**
 * Retrieve queued timer actions from localStorage
 * @returns {Array<{ id: string, type: string, payload: object, timestamp: number }>}
 */
export function getOfflineTimerQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Save queued timer actions to localStorage
 * @param {Array} queue
 */
export function saveOfflineTimerQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (_) {}
}

/**
 * Enqueue a timer action
 * @param {'START'|'PAUSE'|'RESUME'|'STOP'|'COMPLETE'} type
 * @param {object} payload
 */
export function enqueueTimerAction(type, payload = {}) {
  const queue = getOfflineTimerQueue();
  const entry = {
    id: `timer_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: Date.now()
  };
  queue.push(entry);
  saveOfflineTimerQueue(queue);
  return entry;
}

/**
 * Flush all queued actions to the backend sequentially
 * @param {object} workServiceInstance
 * @returns {Promise<number>} number of flushed actions
 */
export async function flushTimerQueue(workServiceInstance) {
  if (!navigator.onLine) return 0;
  const queue = getOfflineTimerQueue();
  if (!queue || queue.length === 0) return 0;

  let flushedCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      if (item.type === 'START') {
        await workServiceInstance.startWorkSession(item.payload, { skipQueue: true });
      } else if (item.type === 'PAUSE') {
        await workServiceInstance.pauseWorkSession(item.payload, { skipQueue: true });
      } else if (item.type === 'RESUME') {
        await workServiceInstance.resumeWorkSession(item.payload, { skipQueue: true });
      } else if (item.type === 'STOP') {
        await workServiceInstance.stopWorkSession(item.payload, { skipQueue: true });
      } else if (item.type === 'COMPLETE') {
        await workServiceInstance.completeWorkSession(item.payload, { skipQueue: true });
      }
      flushedCount++;
    } catch (err) {
      console.warn(`[TimerOfflineQueue] Failed to flush action ${item.type}:`, err.message);
      remaining.push(item);
    }
  }

  saveOfflineTimerQueue(remaining);
  return flushedCount;
}

/**
 * Setup online event listener to automatically flush when network restores
 * @param {object} workServiceInstance
 */
export function initTimerOfflineSync(workServiceInstance) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    flushTimerQueue(workServiceInstance).catch(() => {});
  };

  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
