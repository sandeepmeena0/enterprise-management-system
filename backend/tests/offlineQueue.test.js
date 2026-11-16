/**
 * @file offlineQueue.test.js
 * @description Automated Unit & Integration Tests for Offline Timer Queue Service:
 * User-scoping, cross-tab Web Locks & lease fallback concurrency, mid-flush account switch detection,
 * stable idempotency, and failure blocking.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Mock localStorage engine for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('Offline Timer Queue & Cross-Tab Concurrency Suite', () => {
  let timerOfflineQueue;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = new MockLocalStorage();
    global.localStorage = mockStorage;
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // Dynamically import production ES Module
    const queueModulePath = path.resolve(__dirname, '../../src/modules/work/services/timerOfflineQueue.js');
    timerOfflineQueue = await import(`file://${queueModulePath}?t=${Date.now()}`);
  });

  afterEach(() => {
    mockStorage.clear();
    if (global.navigator) {
      delete global.navigator.locks;
    }
  });

  test('User scoping isolates queued timer actions between different employees', () => {
    const { enqueueTimerAction, getOfflineTimerQueue, getOfflineQueueKey } = timerOfflineQueue;
    const userA = 'emp_user_A';
    const userB = 'emp_user_B';

    const keyA = getOfflineQueueKey(userA);
    const keyB = getOfflineQueueKey(userB);

    assert.equal(keyA, 'ems_timer_offline_queue_emp_user_A');
    assert.equal(keyB, 'ems_timer_offline_queue_emp_user_B');
    assert.notEqual(keyA, keyB, 'Queue keys must be strictly isolated per user');

    // User A enqueues START
    enqueueTimerAction('START', { taskId: 'task_A' }, userA);

    // User B enqueues PAUSE
    enqueueTimerAction('PAUSE', { taskId: 'task_B' }, userB);

    const queueA = getOfflineTimerQueue(userA);
    const queueB = getOfflineTimerQueue(userB);

    assert.equal(queueA.length, 1);
    assert.equal(queueA[0].payload.taskId, 'task_A');
    assert.equal(queueA[0].type, 'START');

    assert.equal(queueB.length, 1);
    assert.equal(queueB[0].payload.taskId, 'task_B');
    assert.equal(queueB[0].type, 'PAUSE');
  });

  test('FIFO queue preserves stable idempotency keys across retries', () => {
    const { enqueueTimerAction, getOfflineTimerQueue } = timerOfflineQueue;
    const user = 'emp_user_1';

    enqueueTimerAction('START', { taskId: 'task_001' }, user);
    const queueBefore = getOfflineTimerQueue(user);
    assert.equal(queueBefore.length, 1);

    const originalKey = queueBefore[0].idempotencyKey;
    assert.ok(originalKey && originalKey.startsWith('offline_'));

    // Re-read queue (simulating app relaunch)
    const queueAfter = getOfflineTimerQueue(user);
    assert.equal(queueAfter[0].idempotencyKey, originalKey, 'Idempotency key must remain identical across retrievals');
    assert.equal(queueAfter[0].payload.idempotencyKey, originalKey);
  });

  test('flushTimerQueue executes queued actions in strict FIFO order and empties queue on success', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue } = timerOfflineQueue;
    const user = 'user_worker';

    // Simulate active auth session
    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));

    enqueueTimerAction('START', { taskId: 'task_10' }, user);
    enqueueTimerAction('PAUSE', { taskId: 'task_10' }, user);
    enqueueTimerAction('COMPLETE', { taskId: 'task_10' }, user);

    const executed = [];
    const mockWorkService = {
      startWorkSession: async (p) => { executed.push({ type: 'START', taskId: p.taskId }); },
      pauseWorkSession: async (p) => { executed.push({ type: 'PAUSE', taskId: p.taskId }); },
      completeWorkSession: async (p) => { executed.push({ type: 'COMPLETE', taskId: p.taskId }); }
    };

    const count = await flushTimerQueue(mockWorkService, user);
    assert.equal(count, 3, 'All 3 actions must be flushed');
    assert.equal(executed.length, 3);
    assert.equal(executed[0].type, 'START');
    assert.equal(executed[1].type, 'PAUSE');
    assert.equal(executed[2].type, 'COMPLETE');

    const remaining = getOfflineTimerQueue(user);
    assert.equal(remaining.length, 0, 'Queue must be empty after full successful flush');
  });

  test('Failure blocking preserves failed action and all dependent subsequent actions in order', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue } = timerOfflineQueue;
    const user = 'user_fail_test';

    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));

    enqueueTimerAction('START', { taskId: 'task_1' }, user);
    enqueueTimerAction('PAUSE', { taskId: 'task_1' }, user);
    enqueueTimerAction('COMPLETE', { taskId: 'task_1' }, user);

    const executed = [];
    const mockWorkService = {
      startWorkSession: async (p) => { executed.push('START'); },
      pauseWorkSession: async (p) => { throw new Error('Network timeout (503 Service Unavailable)'); },
      completeWorkSession: async (p) => { executed.push('COMPLETE'); }
    };

    const count = await flushTimerQueue(mockWorkService, user);
    assert.equal(count, 1, 'Only first action (START) should succeed');
    assert.deepEqual(executed, ['START']);

    const remaining = getOfflineTimerQueue(user);
    assert.equal(remaining.length, 2, 'Failed action and subsequent actions must remain queued');
    assert.equal(remaining[0].type, 'PAUSE', 'Failed PAUSE must be at front of queue for retry');
    assert.equal(remaining[1].type, 'COMPLETE', 'Dependent COMPLETE must remain in sequence');
  });

  test('Cross-Tab Storage Lease fallback locks same user between tabs and allows different users in parallel', () => {
    const { acquireCrossTabStorageLease, releaseCrossTabStorageLease } = timerOfflineQueue;
    const userA = 'user_tab_A';
    const userB = 'user_tab_B';

    const tab1 = 'tab_instance_1';
    const tab2 = 'tab_instance_2';

    // Tab 1 acquires lease for User A
    const acq1 = acquireCrossTabStorageLease(userA, tab1);
    assert.equal(acq1, true, 'Tab 1 acquires lease');

    // Tab 2 attempts to acquire lease for User A while Tab 1 holds it
    const acq2 = acquireCrossTabStorageLease(userA, tab2);
    assert.equal(acq2, false, 'Tab 2 must be blocked from acquiring lease for same user');

    // Tab 2 acquires lease for User B (independent user)
    const acqB = acquireCrossTabStorageLease(userB, tab2);
    assert.equal(acqB, true, 'Tab 2 can acquire lease for different user concurrently');

    // Tab 1 releases lease for User A
    releaseCrossTabStorageLease(userA, tab1);

    // Tab 2 can now acquire lease for User A
    const acqRetry = acquireCrossTabStorageLease(userA, tab2);
    assert.equal(acqRetry, true, 'Tab 2 can acquire lease after Tab 1 releases it');

    releaseCrossTabStorageLease(userA, tab2);
    releaseCrossTabStorageLease(userB, tab2);
  });

  test('Cross-Tab Web Locks API integration: simultaneous flushes from separate tabs are serialized', async () => {
    const { enqueueTimerAction, flushTimerQueue } = timerOfflineQueue;
    const user = 'user_weblock_test';

    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));
    enqueueTimerAction('START', { taskId: 'task_lock_1' }, user);

    // Mock Web Locks API on global.navigator
    const activeLocks = new Set();
    global.navigator = global.navigator || {};
    global.navigator.locks = {
      request: async (lockName, options, callback) => {
        if (options && options.ifAvailable) {
          if (activeLocks.has(lockName)) {
            return await callback(null); // Lock held by another tab!
          }
          activeLocks.add(lockName);
          try {
            return await callback({ name: lockName });
          } finally {
            activeLocks.delete(lockName);
          }
        }
        activeLocks.add(lockName);
        try {
          return await callback({ name: lockName });
        } finally {
          activeLocks.delete(lockName);
        }
      }
    };

    let simultaneousExecuted = 0;
    const mockWorkService = {
      startWorkSession: async () => {
        simultaneousExecuted++;
        await new Promise(r => setTimeout(r, 30));
      }
    };

    // Simulate Tab 1 and Tab 2 attempting to flush simultaneously
    const [c1, c2] = await Promise.all([
      flushTimerQueue(mockWorkService, user),
      flushTimerQueue(mockWorkService, user)
    ]);

    assert.equal(simultaneousExecuted, 1, 'Only one tab should execute the flush');
    assert.equal(c1 + c2, 1, 'Combined flushed count should be 1, second tab returned 0');
  });

  test('Cross-account security: mid-flush account switch halts execution immediately', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue } = timerOfflineQueue;
    const userA = 'user_victim';
    const userB = 'user_attacker';

    // Start with User A logged in
    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: userA } }));

    enqueueTimerAction('START', { taskId: 'task_userA_1' }, userA);
    enqueueTimerAction('PAUSE', { taskId: 'task_userA_1' }, userA);

    const executed = [];
    const mockWorkService = {
      startWorkSession: async (p) => {
        executed.push({ op: 'START', taskId: p.taskId });
        // Simulating session hijacking or user logout + login of user B during the flight of first request!
        global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: userB } }));
      },
      pauseWorkSession: async (p) => {
        executed.push({ op: 'PAUSE', taskId: p.taskId });
      }
    };

    const count = await flushTimerQueue(mockWorkService, userA);
    assert.equal(count, 1, 'Only first action ran before session switch was caught');
    assert.equal(executed.length, 1);

    // Remaining in queue for userA must preserve second action intact
    const remainingA = getOfflineTimerQueue(userA);
    assert.equal(remainingA.length, 1);
    assert.equal(remainingA[0].type, 'PAUSE');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE A.4 DATA-LOSS PREVENTION & LEASE SAFETY TESTS (Section 5 & 6)
  // ═══════════════════════════════════════════════════════════════════════════
  test('New action enqueued during active flush is completely preserved without data loss', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue } = timerOfflineQueue;
    const user = 'user_concur_enqueue';

    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));

    // Pre-populate queue with Action 1 and Action 2
    enqueueTimerAction('START', { taskId: 'task_orig_1' }, user);
    enqueueTimerAction('PAUSE', { taskId: 'task_orig_1' }, user);

    const executed = [];
    const mockWorkService = {
      startWorkSession: async (p) => {
        executed.push('START');
        // CRITICAL RACE CONDITION SIMULATION:
        // User clicks "RESUME" while the first network call is in flight!
        enqueueTimerAction('RESUME', { taskId: 'task_new_3' }, user);
      },
      pauseWorkSession: async (p) => {
        executed.push('PAUSE');
        // Another action added while second action is in flight!
        enqueueTimerAction('COMPLETE', { taskId: 'task_new_3' }, user);
      },
      resumeWorkSession: async (p) => {
        executed.push('RESUME');
      },
      completeWorkSession: async (p) => {
        executed.push('COMPLETE');
      }
    };

    // First flush executes and processes the live queue item-by-item
    const flushedCount = await flushTimerQueue(mockWorkService, user);
    assert.equal(flushedCount, 4, 'All actions including those enqueued mid-flush must be executed');
    assert.deepEqual(executed, ['START', 'PAUSE', 'RESUME', 'COMPLETE']);

    const finalQueue = getOfflineTimerQueue(user);
    assert.equal(finalQueue.length, 0, 'Queue must be empty after all confirmed actions finish');
  });

  test('Same action retried after ambiguous network failure preserves idempotencyKey and queue position', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue } = timerOfflineQueue;
    const user = 'user_ambiguous_retry';

    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));
    enqueueTimerAction('START', { taskId: 'task_retry_1' }, user);

    const initialQueue = getOfflineTimerQueue(user);
    const initialKey = initialQueue[0].idempotencyKey;

    let attempt = 0;
    const mockWorkService = {
      startWorkSession: async (p) => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Ambiguous gateway timeout (504 Gateway Timeout)');
        }
        assert.equal(p.idempotencyKey, initialKey, 'Retry must pass the exact same idempotency key');
      }
    };

    // First flush fails
    const count1 = await flushTimerQueue(mockWorkService, user);
    assert.equal(count1, 0, 'First flush must report 0 successful actions');

    const queueAfterFailure = getOfflineTimerQueue(user);
    assert.equal(queueAfterFailure.length, 1, 'Failed action must not be deleted from storage');
    assert.equal(queueAfterFailure[0].idempotencyKey, initialKey);

    // Second flush succeeds
    const count2 = await flushTimerQueue(mockWorkService, user);
    assert.equal(count2, 1, 'Second flush must succeed');
    assert.equal(getOfflineTimerQueue(user).length, 0);
  });

  test('Lease expiration detection halts flush immediately if another tab overtook lock', async () => {
    const { enqueueTimerAction, flushTimerQueue, getOfflineTimerQueue, TAB_INSTANCE_ID } = timerOfflineQueue;
    const user = 'user_lease_expire';

    // Temporarily disable Web Locks to exercise storage lease fallback specifically
    const origLocks = global.navigator?.locks;
    Object.defineProperty(global.navigator, 'locks', { value: undefined, configurable: true });

    try {
      global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));
      enqueueTimerAction('START', { taskId: 'task_exp_1' }, user);
      enqueueTimerAction('PAUSE', { taskId: 'task_exp_1' }, user);

      const executed = [];
      const mockWorkService = {
        startWorkSession: async () => {
          executed.push('START');
          // Simulate lease expiration + Tab 2 taking over the lease while Tab 1 was waiting!
          const leaseKey = `ems_flush_lease_${user}`;
          global.localStorage.setItem(leaseKey, JSON.stringify({
            tabId: 'rival_tab_instance_999',
            expiresAt: Date.now() + 15000
          }));
        },
        pauseWorkSession: async () => {
          executed.push('PAUSE');
        }
      };

      const count = await flushTimerQueue(mockWorkService, user);
      assert.equal(count, 1, 'Tab 1 must halt immediately after losing lease before executing second action');
      assert.deepEqual(executed, ['START']);

      // Second action remains in queue for the rival tab to execute
      const remaining = getOfflineTimerQueue(user);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].type, 'PAUSE');
    } finally {
      Object.defineProperty(global.navigator, 'locks', { value: origLocks, configurable: true });
    }
  });

  test('acquireCrossTabStorageLease fails safely (returns false) if localStorage throws an error', () => {
    const { acquireCrossTabStorageLease } = timerOfflineQueue;
    const user = 'user_storage_error';

    // Break localStorage.setItem to simulate QuotaExceededError or SecurityError
    const origSetItem = global.localStorage.setItem;
    global.localStorage.setItem = () => {
      throw new Error('QuotaExceededError: DOM Exception 22');
    };

    try {
      const result = acquireCrossTabStorageLease(user);
      assert.equal(result, false, 'Must return false when storage access fails');
    } finally {
      global.localStorage.setItem = origSetItem;
    }
  });
});
