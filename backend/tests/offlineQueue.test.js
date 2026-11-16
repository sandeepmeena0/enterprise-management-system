/**
 * @file offlineQueue.test.js
 * @description Automated Unit & Integration Tests for Offline Timer Queue Service:
 * User-scoping, concurrent multi-user execution, execution locking, mid-flush account switch detection,
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

describe('Offline Timer Queue Suite', () => {
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

  test('Execution lock prevents concurrent flush executions for the SAME user', async () => {
    const { enqueueTimerAction, flushTimerQueue, isUserFlushing } = timerOfflineQueue;
    const user = 'user_concurrent';

    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: user } }));
    enqueueTimerAction('START', { taskId: 'task_conc' }, user);

    let activeFlushes = 0;
    let maxConcurrency = 0;

    const mockWorkService = {
      startWorkSession: async () => {
        activeFlushes++;
        maxConcurrency = Math.max(maxConcurrency, activeFlushes);
        await new Promise((r) => setTimeout(r, 40));
        activeFlushes--;
      }
    };

    // Trigger two simultaneous flush executions for user_concurrent
    const [c1, c2] = await Promise.all([
      flushTimerQueue(mockWorkService, user),
      flushTimerQueue(mockWorkService, user)
    ]);

    assert.equal(maxConcurrency, 1, 'Same user cannot execute concurrent flushes');
    assert.equal(c1 + c2, 1, 'Only one flush execution should run to completion');
    assert.equal(isUserFlushing(user), false, 'Lock is released after flush finishes');
  });

  test('Independent user flushes execute in parallel without cross-blocking', async () => {
    const { enqueueTimerAction, flushTimerQueue, getActiveFlushingUsers } = timerOfflineQueue;
    const userA = 'user_alpha';
    const userB = 'user_beta';

    enqueueTimerAction('START', { taskId: 'task_alpha' }, userA);
    enqueueTimerAction('START', { taskId: 'task_beta' }, userB);

    let usersFlushed = [];

    const mockWorkServiceA = {
      startWorkSession: async () => {
        usersFlushed.push('alpha');
        await new Promise((r) => setTimeout(r, 20));
      }
    };

    const mockWorkServiceB = {
      startWorkSession: async () => {
        usersFlushed.push('beta');
        await new Promise((r) => setTimeout(r, 20));
      }
    };

    // User A session for mock flush
    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: userA } }));
    const flushA = flushTimerQueue(mockWorkServiceA, userA);

    // User B session for mock flush
    global.localStorage.setItem('ems_auth_session', JSON.stringify({ user: { _id: userB } }));
    const flushB = flushTimerQueue(mockWorkServiceB, userB);

    await Promise.all([flushA, flushB]);

    assert.ok(usersFlushed.includes('alpha'));
    assert.ok(usersFlushed.includes('beta'));
    assert.equal(getActiveFlushingUsers().length, 0, 'All user flush locks released');
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
});
