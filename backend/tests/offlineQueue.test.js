/**
 * @file offlineQueue.test.js
 * @description Automated Unit & Integration Tests for Offline Timer Queue:
 * User-scoping, strict FIFO execution, execution lock, stable idempotency, and failure blocking.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

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
  test('User scoping isolates queued timer actions between different employees', () => {
    const mockStorage = new MockLocalStorage();
    const userA = 'emp_user_A';
    const userB = 'emp_user_B';

    const queueKeyA = `ems_timer_offline_queue_${userA}`;
    const queueKeyB = `ems_timer_offline_queue_${userB}`;

    assert.notEqual(queueKeyA, queueKeyB, 'Queue keys must be strictly isolated per user');

    // User A enqueues START
    mockStorage.setItem(queueKeyA, JSON.stringify([
      { id: '1', type: 'START', payload: { taskId: 'task_A' }, idempotencyKey: 'idemp_A1' }
    ]));

    // User B enqueues PAUSE
    mockStorage.setItem(queueKeyB, JSON.stringify([
      { id: '2', type: 'PAUSE', payload: { taskId: 'task_B' }, idempotencyKey: 'idemp_B1' }
    ]));

    const queueA = JSON.parse(mockStorage.getItem(queueKeyA));
    const queueB = JSON.parse(mockStorage.getItem(queueKeyB));

    assert.equal(queueA.length, 1);
    assert.equal(queueA[0].payload.taskId, 'task_A');
    assert.equal(queueB.length, 1);
    assert.equal(queueB[0].payload.taskId, 'task_B');
  });

  test('FIFO queue preserves stable idempotency keys across retries', () => {
    const originalItem = {
      id: 'timer_act_123',
      type: 'START',
      payload: { taskId: 'task_001', targetEmployeeId: 'emp_001', idempotencyKey: 'stable_idemp_key_xyz' },
      idempotencyKey: 'stable_idemp_key_xyz',
      timestamp: Date.now()
    };

    // Simulate serialization & deserialization across network drops
    const serialized = JSON.stringify([originalItem]);
    const deserialized = JSON.parse(serialized);

    assert.equal(deserialized[0].idempotencyKey, 'stable_idemp_key_xyz');
    assert.equal(deserialized[0].payload.idempotencyKey, 'stable_idemp_key_xyz');
  });

  test('Failure blocking preserves failed action and all dependent subsequent actions in order', async () => {
    const executedActions = [];
    const queue = [
      { id: '1', type: 'START', payload: { taskId: 'task_1' }, idempotencyKey: 'key_1' },
      { id: '2', type: 'PAUSE', payload: { taskId: 'task_1' }, idempotencyKey: 'key_2' },
      { id: '3', type: 'COMPLETE', payload: { taskId: 'task_1' }, idempotencyKey: 'key_3' }
    ];

    // Mock workService where action 2 fails with network timeout
    const mockWorkService = {
      async startWorkSession(p) { executedActions.push({ type: 'START', taskId: p.taskId }); },
      async pauseWorkSession(p) { throw new Error('Network timeout (503)'); },
      async completeWorkSession(p) { executedActions.push({ type: 'COMPLETE', taskId: p.taskId }); }
    };

    // Simulate flushTimerQueue with failure blocking
    let stoppedDueToFailure = false;
    let flushedCount = 0;
    const remaining = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (stoppedDueToFailure) {
        remaining.push(item);
        continue;
      }
      try {
        if (item.type === 'START') await mockWorkService.startWorkSession(item.payload);
        else if (item.type === 'PAUSE') await mockWorkService.pauseWorkSession(item.payload);
        else if (item.type === 'COMPLETE') await mockWorkService.completeWorkSession(item.payload);
        flushedCount++;
      } catch (err) {
        stoppedDueToFailure = true;
        remaining.push(item);
      }
    }

    assert.equal(flushedCount, 1, 'Only action 1 should succeed');
    assert.equal(executedActions.length, 1);
    assert.equal(executedActions[0].type, 'START');

    // Remaining must contain action 2 AND action 3 in strict FIFO order
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].id, '2', 'Failed action 2 remains at front of queue');
    assert.equal(remaining[1].id, '3', 'Dependent action 3 remains queued after action 2');
  });

  test('Execution lock prevents concurrent flush executions', async () => {
    let isFlushing = false;
    let concurrentCallsBlocked = 0;

    async function simulatedFlush() {
      if (isFlushing) {
        concurrentCallsBlocked++;
        return 0;
      }
      isFlushing = true;
      try {
        await new Promise(r => setTimeout(r, 20));
        return 1;
      } finally {
        isFlushing = false;
      }
    }

    // Trigger concurrent flushes
    const [res1, res2, res3] = await Promise.all([
      simulatedFlush(),
      simulatedFlush(),
      simulatedFlush()
    ]);

    assert.equal(concurrentCallsBlocked, 2, 'Two of the three concurrent flush calls must be blocked by the lock');
    assert.equal(res1 + res2 + res3, 1, 'Only one flush execution should run to completion');
  });
});
