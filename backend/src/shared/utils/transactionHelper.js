/**
 * @file transactionHelper.js
 * @description Safe MongoDB Transaction Capability Detection & Execution Wrapper.
 * Detects whether the current MongoDB deployment topology supports multi-document transactions
 * (Replica Set / Mongos / Sharded) vs Standalone instance, and provides safe transaction
 * execution with explicit session cleanup, rollback abort, and non-silent error handling.
 */

const mongoose = require('mongoose');

let supportOverride = null;
let cachedTopologySupport = null;

/**
 * Check whether the active MongoDB connection topology supports transactions.
 * Standalone MongoDB instances do NOT support transactions and will throw code 20.
 * Replica sets (ReplicaSetWithPrimary) and Sharded clusters (Sharded, LoadBalanced) DO support transactions.
 * @returns {boolean}
 */
function isTransactionSupported() {
  if (supportOverride !== null) {
    return supportOverride;
  }

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return false;
  }

  if (cachedTopologySupport !== null) {
    return cachedTopologySupport;
  }

  try {
    const client = mongoose.connection.client;
    if (!client || !client.topology) {
      return false;
    }

    const topologyType = client.topology?.description?.type;
    if (topologyType) {
      if (['ReplicaSetWithPrimary', 'Sharded', 'LoadBalanced'].includes(topologyType)) {
        cachedTopologySupport = true;
        return true;
      }
      if (topologyType === 'Single') {
        cachedTopologySupport = false;
        return false;
      }
    }

    // Inspect server descriptions if topology type is still generic/unknown
    const servers = client.topology?.description?.servers;
    if (servers && servers instanceof Map) {
      for (const [, server] of servers) {
        if (server.type === 'Standalone') {
          cachedTopologySupport = false;
          return false;
        }
        if (['RSPrimary', 'RSSecondary', 'Mongos'].includes(server.type)) {
          cachedTopologySupport = true;
          return true;
        }
      }
    }

    // Default to false unless verified to prevent unexpected transaction failures
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Allows overriding transaction support detection (useful for unit testing standalone vs replica set scenarios)
 * @param {boolean|null} val
 */
function setTransactionSupportOverride(val) {
  supportOverride = val;
}

/**
 * Clears cached topology capability
 */
function clearTransactionSupportCache() {
  cachedTopologySupport = null;
  supportOverride = null;
}

/**
 * Executes an operation inside a MongoDB transaction if supported, or via an explicit fallback.
 *
 * Guarantees:
 * 1. Safe detection before starting writes: Never attempts startTransaction on standalone instances.
 * 2. Fail-closed: If a transaction begins and fails mid-flight, it is cleanly aborted.
 *    It is NEVER silently switched to a non-transactional fallback after partial execution.
 * 3. Session cleanup: session.endSession() is always executed in the finally block.
 *
 * @param {Function} operationFn - async (session) => result
 * @param {object} options
 * @param {Function} [options.fallbackFn] - async () => fallbackResult (executed when transactions are unsupported)
 * @param {boolean} [options.requireTransaction=false] - if true and transactions unsupported, throws error
 * @param {object} [options.transactionOptions] - Mongoose transaction options
 * @returns {Promise<{ success: boolean, result: any, inTransaction: boolean }>}
 */
async function executeTransaction(operationFn, options = {}) {
  const supported = isTransactionSupported();

  if (!supported) {
    if (options.requireTransaction) {
      const err = new Error('Transactions are not supported by the current MongoDB deployment topology.');
      err.code = 'TRANSACTIONS_UNSUPPORTED';
      throw err;
    }

    if (typeof options.fallbackFn === 'function') {
      const fallbackResult = await options.fallbackFn();
      return { success: true, result: fallbackResult, inTransaction: false };
    }

    const directResult = await operationFn(null);
    return { success: true, result: directResult, inTransaction: false };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction(options.transactionOptions);
    const result = await operationFn(session);
    await session.commitTransaction();
    return { success: true, result, inTransaction: true };
  } catch (err) {
    if (session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('[transactionHelper] Error aborting transaction:', abortErr.message);
      }
    }

    // Detect if error was standalone deployment error
    if (err.code === 20 || (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member or mongos'))) {
      cachedTopologySupport = false;
    }

    // Re-throw the original error without silent fallback
    throw err;
  } finally {
    try {
      await session.endSession();
    } catch (_) {}
  }
}

module.exports = {
  isTransactionSupported,
  setTransactionSupportOverride,
  clearTransactionSupportCache,
  executeTransaction
};
