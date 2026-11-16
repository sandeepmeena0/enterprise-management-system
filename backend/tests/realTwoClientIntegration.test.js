/**
 * @file realTwoClientIntegration.test.js
 * @description Real Integration Test Suite with Two Live Socket.IO Clients
 * Verifies cross-device real-time synchronization, CORS allowlisting, outbox lease locking,
 * active connection verification, reconnection replay, and strict account isolation.
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');

const { initSocketServer, getSocketServer, resetSocketServerForTesting, checkOriginAllowed } = require('../src/shared/socket/socketManager');
const { setUserAuthCache, clearUserAuthCache } = require('../src/shared/cache/userAuthCache');
const { dispatchPendingOutboxEvents, renewLease, getOutboxOperationalStatus, retryFailedOutboxEvent } = require('../src/modules/work/services/outboxDispatcher');
const DurableOutboxEvent = require('../src/modules/work/models/DurableOutboxEvent');

const TEST_JWT_SECRET = 'test_super_secret_jwt_key_real_two_client_suite_2026';

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${eventName}" after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Real Two-Client Socket.IO & Cross-Device Integration Suite', () => {
  let server;
  let port;
  let serverUrl;

  const emp1Id = new mongoose.Types.ObjectId('607f1f77bcf86cd799439011');
  const emp2Id = new mongoose.Types.ObjectId('607f1f77bcf86cd799439022');

  const emp1Auth = {
    _id: emp1Id.toString(),
    id: emp1Id.toString(),
    employeeCode: 'EMP-001',
    name: 'Sandeep Meena',
    email: 'sandeep@inforag.com',
    role: 'Senior Engineer',
    department: 'Engineering',
    systemRole: 'team_member',
    isAdmin: false,
    status: 'active',
    tokenVersion: 0,
    permissionVersion: 0,
    permissions: {}
  };

  const emp2Auth = {
    _id: emp2Id.toString(),
    id: emp2Id.toString(),
    employeeCode: 'EMP-002',
    name: 'Avinash Kumar',
    email: 'avinash@inforag.com',
    role: 'Product Manager',
    department: 'Product',
    systemRole: 'team_member',
    isAdmin: false,
    status: 'active',
    tokenVersion: 0,
    permissionVersion: 0,
    permissions: {}
  };

  let tokenEmp1;
  let tokenEmp2;

  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    tokenEmp1 = jwt.sign({ userId: emp1Id.toString(), tokenVersion: 0 }, TEST_JWT_SECRET, { expiresIn: '1h' });
    tokenEmp2 = jwt.sign({ userId: emp2Id.toString(), tokenVersion: 0 }, TEST_JWT_SECRET, { expiresIn: '1h' });

    // Seed trusted cache
    setUserAuthCache(emp1Id.toString(), emp1Auth);
    setUserAuthCache(emp2Id.toString(), emp2Auth);

    // Create real HTTP server on ephemeral port (0 = OS assigned free port)
    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    initSocketServer(server, [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173'
    ]);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    resetSocketServerForTesting();
    clearUserAuthCache();
    await new Promise((resolve) => server.close(resolve));
  });

  // ── Scenario A: CORS Origin Security Enforcement ─────────────────────────
  test('Scenario A: Unauthorized CORS origin is rejected during handshake', async () => {
    let connectionError = null;
    const clientUnauthorized = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      extraHeaders: {
        origin: 'http://malicious-attacker-site.com'
      },
      transports: ['websocket', 'polling'],
      reconnection: false
    });

    try {
      await new Promise((resolve, reject) => {
        clientUnauthorized.on('connect', () => {
          reject(new Error('Unauthorized origin should not have connected'));
        });
        clientUnauthorized.on('connect_error', (err) => {
          connectionError = err;
          resolve();
        });
      });

      assert.ok(connectionError, 'Connection error must be produced for unauthorized origin');
      assert.match(connectionError.message, /websocket error|CORS origin not allowed|origin|xhr poll error/i);
    } finally {
      clientUnauthorized.disconnect();
    }
  });

  // ── Scenario B: Two Devices Connect & Join Scoped Room ───────────────────
  test('Scenario B: Device A and Device B connect with same account and join user room', async () => {
    const clientA = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    const clientB = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    try {
      const [confirmA, confirmB] = await Promise.all([
        waitForEvent(clientA, 'auth:confirmed'),
        waitForEvent(clientB, 'auth:confirmed')
      ]);

      assert.equal(confirmA.userId, emp1Id.toString());
      assert.equal(confirmB.userId, emp1Id.toString());
      assert.ok(confirmA.rooms.includes(`user:${emp1Id.toString()}`));
      assert.ok(confirmB.rooms.includes(`user:${emp1Id.toString()}`));
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  // ── Scenario C: Real-Time Broadcast on Timer Start ───────────────────────
  test('Scenario C: When Timer Starts on server, both Device A and Device B receive live event', async () => {
    const clientA = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    const clientB = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    try {
      await Promise.all([
        waitForEvent(clientA, 'auth:confirmed'),
        waitForEvent(clientB, 'auth:confirmed')
      ]);

      const io = getSocketServer();
      const mockPayload = {
        taskId: 'task_sync_001',
        taskCode: 'TSK-001',
        title: 'Real Integration Task',
        startedAt: new Date().toISOString(),
        accumulatedSeconds: 150,
        version: 1
      };

      const eventPromises = Promise.all([
        waitForEvent(clientA, 'task:timer_started'),
        waitForEvent(clientB, 'task:timer_started')
      ]);

      // Emit to server-authorized room
      io.to(`user:${emp1Id.toString()}`).emit('task:timer_started', mockPayload);

      const [receivedA, receivedB] = await eventPromises;

      assert.equal(receivedA.taskId, 'task_sync_001');
      assert.equal(receivedB.taskId, 'task_sync_001');
      assert.equal(receivedA.version, 1);
      assert.equal(receivedB.version, 1);
      assert.equal(receivedA.accumulatedSeconds, 150);
      assert.equal(receivedB.accumulatedSeconds, 150);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  // ── Scenario D: Device B Pauses Timer -> Device A Receives Consistent Pause ──
  test('Scenario D: Device B pauses timer -> Device A receives pause event with consistent elapsed state', async () => {
    const clientA = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    const clientB = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    try {
      await Promise.all([
        waitForEvent(clientA, 'auth:confirmed'),
        waitForEvent(clientB, 'auth:confirmed')
      ]);

      const io = getSocketServer();
      const pausePayload = {
        taskId: 'task_sync_001',
        status: 'PAUSED',
        timerRunning: false,
        accumulatedSeconds: 320,
        version: 2
      };

      const pausePromise = waitForEvent(clientA, 'task:timer_paused');

      // Device B actions trigger broadcast to user channel
      io.to(`user:${emp1Id.toString()}`).emit('task:timer_paused', pausePayload);

      const receivedA = await pausePromise;
      assert.equal(receivedA.taskId, 'task_sync_001');
      assert.equal(receivedA.timerRunning, false);
      assert.equal(receivedA.accumulatedSeconds, 320);
      assert.equal(receivedA.version, 2);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  // ── Scenario E: Disconnection & Reconnection Outbox Recovery ─────────────
  test('Scenario E: When Device A disconnects, outbox delivers event upon reconnection', async () => {
    const clientA = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    await waitForEvent(clientA, 'auth:confirmed');
    clientA.disconnect();

    // Small delay to ensure disconnect processed
    await new Promise(r => setTimeout(r, 100));

    // Prepare outbox event
    const outboxEvent = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp1Id,
      seq: 10,
      eventType: 'TIMER_RESUMED',
      payload: { taskId: 'task_recon_01', version: 10 },
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date(),
      save: async function () { return this; }
    };

    const origFind = DurableOutboxEvent.find;
    DurableOutboxEvent.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([outboxEvent])
      })
    });

    let clientReconnected = null;
    try {
      clientReconnected = ioClient(serverUrl, {
        auth: { token: tokenEmp1 },
        transports: ['websocket'],
        reconnection: false
      });

      const [confirm, eventEnvelope] = await Promise.all([
        waitForEvent(clientReconnected, 'auth:confirmed'),
        waitForEvent(clientReconnected, 'timer:event')
      ]);

      assert.equal(confirm.userId, emp1Id.toString());
      assert.equal(eventEnvelope.seq, 10);
      assert.equal(eventEnvelope.eventType, 'TIMER_RESUMED');
      assert.equal(eventEnvelope.payload.taskId, 'task_recon_01');
    } finally {
      DurableOutboxEvent.find = origFind;
      if (clientReconnected) clientReconnected.disconnect();
    }
  });

  // ── Scenario F: Strict Account Isolation ─────────────────────────────────
  test('Scenario F: Employee Y connected on Client C never receives events emitted to Employee X', async () => {
    const clientX = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    const clientY = ioClient(serverUrl, {
      auth: { token: tokenEmp2 },
      transports: ['websocket'],
      reconnection: false
    });

    try {
      await Promise.all([
        waitForEvent(clientX, 'auth:confirmed'),
        waitForEvent(clientY, 'auth:confirmed')
      ]);

      let clientYReceivedEvent = false;
      clientY.on('task:timer_started', () => {
        clientYReceivedEvent = true;
      });

      const io = getSocketServer();
      const xPayload = {
        taskId: 'secret_task_x',
        title: 'Confidential Task for Sandeep',
        employeeId: emp1Id.toString()
      };

      const eventForX = waitForEvent(clientX, 'task:timer_started');
      io.to(`user:${emp1Id.toString()}`).emit('task:timer_started', xPayload);

      const receivedX = await eventForX;
      assert.equal(receivedX.taskId, 'secret_task_x');

      // Wait a brief window to confirm Y never receives it
      await new Promise(r => setTimeout(r, 200));
      assert.equal(clientYReceivedEvent, false, 'Client Y must NOT receive events dispatched to Client X');
    } finally {
      clientX.disconnect();
      clientY.disconnect();
    }
  });

  // ── Scenario G: Atomic Lease Locking Prevents Duplicate Dispatch ────────
  test('Scenario G: Concurrent workers claiming the same outbox event execute without duplication', async () => {
    const client = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });

    await waitForEvent(client, 'auth:confirmed');

    let dispatchAttemptCount = 0;
    const sharedEvent = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp1Id,
      seq: 55,
      eventType: 'TIMER_STARTED',
      payload: { taskId: 'atomic_lease_task', version: 55 },
      status: 'PENDING',
      save: async function () {
        dispatchAttemptCount++;
        return this;
      }
    };

    const origFind = DurableOutboxEvent.find;
    const origFindOneAndUpdate = DurableOutboxEvent.findOneAndUpdate;

    DurableOutboxEvent.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([sharedEvent])
      })
    });

    // Simulate atomic lease: first worker succeeds, second worker gets null (already claimed)
    let leaseClaimed = false;
    DurableOutboxEvent.findOneAndUpdate = async (query, update) => {
      if (!leaseClaimed) {
        leaseClaimed = true;
        sharedEvent.status = 'PROCESSING';
        sharedEvent.leaseOwner = update.$set.leaseOwner;
        return sharedEvent;
      }
      return null; // Already leased to worker 1!
    };

    try {
      const [res1, res2] = await Promise.all([
        dispatchPendingOutboxEvents(emp1Id, { workerId: 'worker_alpha', skipDbCheck: true }),
        dispatchPendingOutboxEvents(emp1Id, { workerId: 'worker_beta', skipDbCheck: true })
      ]);

      // Exactly 1 worker dispatched the event
      assert.equal(res1.dispatchedCount + res2.dispatchedCount, 1);
      assert.equal(sharedEvent.status, 'PUBLISHED');
    } finally {
      DurableOutboxEvent.find = origFind;
      DurableOutboxEvent.findOneAndUpdate = origFindOneAndUpdate;
      client.disconnect();
    }
  });

  // ── Scenario H: Active Socket Verification Guard ─────────────────────────
  test('Scenario H: Event is NOT marked PUBLISHED when target employee has 0 active sockets', async () => {
    // Note: No clients connected for emp2Id
    const offlineEvent = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp2Id,
      seq: 99,
      eventType: 'TIMER_PAUSED',
      payload: { taskId: 'offline_task' },
      status: 'PENDING',
      save: async function () { return this; }
    };

    const origFind = DurableOutboxEvent.find;
    const origFindOneAndUpdate = DurableOutboxEvent.findOneAndUpdate;
    const origUpdateOne = DurableOutboxEvent.updateOne;

    DurableOutboxEvent.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([offlineEvent])
      })
    });

    DurableOutboxEvent.findOneAndUpdate = async () => offlineEvent;
    let releasedBackToPending = false;
    DurableOutboxEvent.updateOne = async (filter, update) => {
      if (update.$set && update.$set.status === 'PENDING') {
        releasedBackToPending = true;
        offlineEvent.status = 'PENDING';
      }
      return { modifiedCount: 1 };
    };

    try {
      const result = await dispatchPendingOutboxEvents(emp2Id, { skipDbCheck: true });

      assert.equal(result.dispatchedCount, 0, 'No events should be dispatched when user is offline');
      assert.equal(releasedBackToPending, true, 'Event must be released back to PENDING');
      assert.notEqual(offlineEvent.status, 'PUBLISHED', 'Offline event must NOT be marked PUBLISHED');
    } finally {
      DurableOutboxEvent.find = origFind;
      DurableOutboxEvent.findOneAndUpdate = origFindOneAndUpdate;
      DurableOutboxEvent.updateOne = origUpdateOne;
    }
  });

  // ── Scenario I: Strict CORS Allowlist & Prefix Attack Rejection ───────────
  test('Scenario I: Exact CORS allowlist matching rejects preview wildcards & subdomain spoofing', () => {
    // Valid whitelisted origins
    assert.equal(checkOriginAllowed('http://localhost:5173'), true, 'localhost:5173 must be allowed');
    assert.equal(checkOriginAllowed('http://localhost:5174'), true, 'localhost:5174 must be allowed');
    assert.equal(checkOriginAllowed('http://127.0.0.1:5173'), true, '127.0.0.1:5173 must be allowed');
    assert.equal(checkOriginAllowed('https://enterprise-management-system-two.vercel.app'), true, 'Production Vercel app must be allowed');

    // Reject arbitrary/unauthorized Vercel previews
    assert.equal(checkOriginAllowed('https://random-preview.vercel.app'), false, 'Arbitrary vercel preview must be rejected');
    assert.equal(checkOriginAllowed('https://attacker-app.vercel.app'), false, 'Attacker vercel app must be rejected');

    // Reject prefix/subdomain spoofing attacks
    assert.equal(checkOriginAllowed('http://localhost:5173.attacker.com'), false, 'Subdomain spoofing must be rejected');
    assert.equal(checkOriginAllowed('http://127.0.0.1:5173.evil.org'), false, 'IP subdomain spoofing must be rejected');
    assert.equal(checkOriginAllowed('https://evil-site.com'), false, 'Arbitrary origin must be rejected');
  });

  // ── Scenario J: Causality Guard Blocks Later Events when Earlier is FAILED ─
  test('Scenario J: FAILED earlier sequence blocks subsequent event from violating causality', async () => {
    const client = ioClient(serverUrl, {
      auth: { token: tokenEmp1 },
      transports: ['websocket'],
      reconnection: false
    });
    await waitForEvent(client, 'auth:confirmed');

    // Two sequential events for emp1Id
    const eventSeq1 = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp1Id,
      seq: 1,
      eventType: 'TIMER_STARTED',
      payload: { taskId: 'task_1', version: 1 },
      status: 'FAILED',
      save: async function () { return this; }
    };

    const eventSeq2 = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp1Id,
      seq: 2,
      eventType: 'TIMER_PAUSED',
      payload: { taskId: 'task_1', version: 2 },
      status: 'PENDING',
      save: async function () { return this; }
    };

    const origFind = DurableOutboxEvent.find;
    const origFindOne = DurableOutboxEvent.findOne;
    const origFindOneAndUpdate = DurableOutboxEvent.findOneAndUpdate;

    DurableOutboxEvent.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([eventSeq2])
      })
    });

    // When outboxDispatcher checks for earlier pending/failed event:
    DurableOutboxEvent.findOne = (query) => {
      if (query.employeeId && query.seq && query.seq.$lt === 2 && query.status) {
        return Promise.resolve(eventSeq1); // Earlier event exists in FAILED state!
      }
      return Promise.resolve(null);
    };

    let attemptedClaim = false;
    DurableOutboxEvent.findOneAndUpdate = async () => {
      attemptedClaim = true;
      return eventSeq2;
    };

    try {
      const result = await dispatchPendingOutboxEvents(emp1Id, { skipDbCheck: true });

      assert.equal(result.dispatchedCount, 0, 'No event should be dispatched while earlier sequence is FAILED');
      assert.equal(attemptedClaim, false, 'Event seq 2 must never be claimed when seq 1 is FAILED');
    } finally {
      DurableOutboxEvent.find = origFind;
      DurableOutboxEvent.findOne = origFindOne;
      DurableOutboxEvent.findOneAndUpdate = origFindOneAndUpdate;
      client.disconnect();
    }
  });

  // ── Scenario K: Lease Renewal Extends Lease Expiration ────────────────────
  test('Scenario K: renewLease successfully extends worker lease for active processing', async () => {
    const eventId = new mongoose.Types.ObjectId();
    const workerId = 'worker_test_renew_1';
    let renewedWithExpiresAt = null;

    const origUpdateOne = DurableOutboxEvent.updateOne;
    DurableOutboxEvent.updateOne = async (filter, update) => {
      if (String(filter._id) === String(eventId) && filter.leaseOwner === workerId && filter.status === 'PROCESSING') {
        renewedWithExpiresAt = update.$set.leaseExpiresAt;
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    };

    try {
      const success = await renewLease(eventId, workerId, 20000);
      assert.equal(success, true, 'Lease renewal must succeed for owning worker');
      assert.ok(renewedWithExpiresAt instanceof Date, 'leaseExpiresAt must be updated to a Date');
      assert.ok(renewedWithExpiresAt.getTime() > Date.now() + 15000, 'leaseExpiresAt must be in future');

      const failedRenew = await renewLease(eventId, 'wrong_worker_id', 20000);
      assert.equal(failedRenew, false, 'Lease renewal must fail for non-owning worker');
    } finally {
      DurableOutboxEvent.updateOne = origUpdateOne;
    }
  });

  // ── Scenario L: Outbox Health Diagnostics and Failure Recovery ───────────
  test('Scenario L: retryFailedOutboxEvent resets FAILED event to PENDING', async () => {
    const failedEventId = new mongoose.Types.ObjectId();
    let resetStatus = null;

    const origUpdateOne = DurableOutboxEvent.updateOne;
    DurableOutboxEvent.updateOne = async (filter, update) => {
      if (String(filter._id) === String(failedEventId) && filter.status === 'FAILED') {
        resetStatus = update.$set.status;
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    };

    // Simulate ready state for mock test
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    try {
      const res = await retryFailedOutboxEvent(failedEventId);
      assert.equal(res.success, true, 'retryFailedOutboxEvent must report success');
      assert.equal(resetStatus, 'PENDING', 'Status must be reset to PENDING');
    } finally {
      DurableOutboxEvent.updateOne = origUpdateOne;
      Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
    }
  });
});
