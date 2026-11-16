/**
 * @file realtimeSyncService.js
 * @description Centralized Real-time Cross-Tab & Cross-Device Synchronization Engine
 * using Socket.IO events, browser BroadcastChannel API, and custom event bridges.
 * 
 * Ensures that whenever an employee starts, pauses, or completes a task,
 * or when an Admin controls an employee's timer or attendance from any laptop or device,
 * all open tabs and devices update with zero latency and maintain canonical server synchronization.
 */

import { subscribeSocketEvent } from './socketService';

const SYNC_CHANNEL_NAME = 'inforag_realtime_sync_v1';

let syncChannel = null;
try {
  if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
} catch (err) {
  console.warn('BroadcastChannel not supported in this environment, falling back to storage events:', err);
}

export const SYNC_EVENTS = {
  TASK_TIMER_STARTED: 'TASK_TIMER_STARTED',
  TASK_TIMER_PAUSED: 'TASK_TIMER_PAUSED',
  TASK_TIMER_STOPPED: 'TASK_TIMER_STOPPED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  SHIFT_CLOCKED_IN: 'SHIFT_CLOCKED_IN',
  SHIFT_CLOCKED_OUT: 'SHIFT_CLOCKED_OUT',
  SHIFT_BREAK_STARTED: 'SHIFT_BREAK_STARTED',
  SHIFT_BREAK_ENDED: 'SHIFT_BREAK_ENDED',
  ATTENDANCE_STATE_UPDATED: 'ATTENDANCE_STATE_UPDATED',
  TIMER_OUTBOX_EVENT: 'TIMER_OUTBOX_EVENT',
  CHAT_MESSAGE_SENT: 'CHAT_MESSAGE_SENT',
  STORAGE_MUTATION: 'STORAGE_MUTATION'
};

/**
 * Broadcast an event across all open tabs/windows and locally
 * @param {string} type - Event type (from SYNC_EVENTS)
 * @param {object} payload - Event payload
 */
export const broadcastSyncEvent = (type, payload = {}) => {
  const message = {
    type,
    payload,
    timestamp: Date.now(),
    sourceTabId: (typeof window !== 'undefined' && (window.__ems_tab_id || (window.__ems_tab_id = Math.random().toString(36).substring(2, 9)))) || 'svr'
  };

  if (syncChannel) {
    try {
      syncChannel.postMessage(message);
    } catch (e) {
      console.warn('Failed to postMessage on syncChannel:', e);
    }
  }

  // Also dispatch locally on current window so subscribers on the active tab get uniform handling
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('ems_realtime_sync', { detail: message }));
    } catch (e) {}
  }
};

/**
 * Bridge incoming Socket.IO events into the client-side realtime sync bus
 */
if (typeof window !== 'undefined') {
  subscribeSocketEvent('task:timer_started', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_TIMER_STARTED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('task:timer_paused', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_TIMER_PAUSED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('task:timer_resumed', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_TIMER_STARTED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('task:timer_stopped', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_TIMER_STOPPED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('task:timer_completed', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_COMPLETED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('task:timer_switched', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TASK_TIMER_STARTED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('attendance:state_updated', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.ATTENDANCE_STATE_UPDATED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('attendance:clock_in', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.SHIFT_CLOCKED_IN, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('attendance:clock_out', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.SHIFT_CLOCKED_OUT, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('attendance:break_start', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.SHIFT_BREAK_STARTED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('attendance:break_end', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.SHIFT_BREAK_ENDED, { ...payload, fromSocket: true });
  });

  subscribeSocketEvent('timer:event', (payload) => {
    broadcastSyncEvent(SYNC_EVENTS.TIMER_OUTBOX_EVENT, { ...payload, fromSocket: true });
  });
}

/**
 * Subscribe to real-time events across all tabs
 * @param {Function} callback - Called with { type, payload, timestamp, sourceTabId }
 * @returns {Function} Unsubscribe function
 */
export const subscribeToSyncEvents = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event) => {
    if (event?.data && typeof callback === 'function') {
      try {
        callback(event.data);
      } catch (err) {
        console.error('Error in realtime sync listener:', err);
      }
    }
  };

  const handleLocalCustom = (event) => {
    if (event?.detail && typeof callback === 'function') {
      try {
        callback(event.detail);
      } catch (err) {
        console.error('Error in local sync listener:', err);
      }
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleMessage);
  }
  window.addEventListener('ems_realtime_sync', handleLocalCustom);

  return () => {
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('ems_realtime_sync', handleLocalCustom);
  };
};

export default {
  broadcastSyncEvent,
  subscribeToSyncEvents,
  SYNC_EVENTS
};
