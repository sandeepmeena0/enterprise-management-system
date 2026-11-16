/**
 * @file transactionHelper.test.js
 * @description Unit tests for MongoDB Transaction Capability Detection & Execution Wrapper.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  isTransactionSupported,
  setTransactionSupportOverride,
  clearTransactionSupportCache,
  executeTransaction
} = require('../src/shared/utils/transactionHelper');

describe('MongoDB Transaction Capability & Safety Suite', () => {
  beforeEach(() => {
    clearTransactionSupportCache();
  });

  afterEach(() => {
    clearTransactionSupportCache();
  });

  test('isTransactionSupported returns false when mongoose is disconnected', () => {
    // When mongoose is not connected (readyState !== 1)
    const origReadyState = mongoose.connection.readyState;
    try {
      mongoose.connection.readyState = 0;
      assert.equal(isTransactionSupported(), false);
    } finally {
      mongoose.connection.readyState = origReadyState;
    }
  });

  test('isTransactionSupported detects Standalone topology and returns false', () => {
    const origReadyState = mongoose.connection.readyState;
    const origClient = mongoose.connection.client;

    try {
      mongoose.connection.readyState = 1;
      mongoose.connection.client = {
        topology: {
          description: {
            type: 'Single'
          }
        }
      };

      assert.equal(isTransactionSupported(), false, 'Single / Standalone topology must NOT be reported as supporting transactions');
    } finally {
      mongoose.connection.readyState = origReadyState;
      mongoose.connection.client = origClient;
    }
  });

  test('isTransactionSupported detects ReplicaSetWithPrimary and returns true', () => {
    const origReadyState = mongoose.connection.readyState;
    const origClient = mongoose.connection.client;

    try {
      mongoose.connection.readyState = 1;
      mongoose.connection.client = {
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary'
          }
        }
      };

      assert.equal(isTransactionSupported(), true, 'ReplicaSetWithPrimary topology supports transactions');
    } finally {
      mongoose.connection.readyState = origReadyState;
      mongoose.connection.client = origClient;
    }
  });

  test('executeTransaction executes fallbackFn when transactions are unsupported', async () => {
    setTransactionSupportOverride(false);

    let fallbackCalled = false;
    let operationCalled = false;

    const res = await executeTransaction(
      async () => {
        operationCalled = true;
      },
      {
        fallbackFn: async () => {
          fallbackCalled = true;
          return { fallbackData: 42 };
        }
      }
    );

    assert.equal(fallbackCalled, true);
    assert.equal(operationCalled, false);
    assert.equal(res.inTransaction, false);
    assert.equal(res.result.fallbackData, 42);
  });

  test('executeTransaction throws error when requireTransaction: true on unsupported topology', async () => {
    setTransactionSupportOverride(false);

    await assert.rejects(
      async () => {
        await executeTransaction(async () => {}, { requireTransaction: true });
      },
      {
        code: 'TRANSACTIONS_UNSUPPORTED',
        message: /Transactions are not supported by the current MongoDB deployment topology/i
      }
    );
  });

  test('executeTransaction aborts transaction and closes session if operationFn throws', async () => {
    setTransactionSupportOverride(true);

    const origStartSession = mongoose.startSession;
    let transactionAborted = false;
    let sessionEnded = false;

    mongoose.startSession = async () => ({
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {
        transactionAborted = true;
      },
      endSession: async () => {
        sessionEnded = true;
      },
      inTransaction: () => true
    });

    try {
      await assert.rejects(
        async () => {
          await executeTransaction(async () => {
            throw new Error('Database write collision inside transaction');
          });
        },
        /Database write collision inside transaction/
      );

      assert.equal(transactionAborted, true, 'Transaction must be aborted on failure');
      assert.equal(sessionEnded, true, 'Session must always be ended');
    } finally {
      mongoose.startSession = origStartSession;
    }
  });
});
