/**
 * @file userAuthCache.js
 * @description In-memory synchronous authentication & permission cache for EMS.
 * Caches server-derived trusted employee identity, tokenVersion, and permissionVersion.
 * Invalidate synchronously whenever security data (status, tokenVersion, permissions) changes.
 */

const authCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds max TTL safeguard

/**
 * Retrieve cached auth data for a user
 * @param {string} userId - Mongo ObjectId string or canonical ID
 * @returns {object|null} Cached auth data or null if expired/missing
 */
function getUserAuthCache(userId) {
  if (!userId) return null;
  const key = String(userId);
  const entry = authCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    authCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache trusted user auth data
 * @param {string} userId
 * @param {object} data
 */
function setUserAuthCache(userId, data) {
  if (!userId || !data) return;
  const key = String(userId);
  authCache.set(key, {
    data: { ...data },
    cachedAt: Date.now()
  });
}

/**
 * Invalidate a user's cached auth record immediately
 * @param {string} userId
 */
function invalidateUserAuthCache(userId) {
  if (!userId) return;
  authCache.delete(String(userId));
}

/**
 * Clear the entire auth cache (e.g. on server reset or batch updates)
 */
function clearUserAuthCache() {
  authCache.clear();
}

module.exports = {
  getUserAuthCache,
  setUserAuthCache,
  invalidateUserAuthCache,
  clearUserAuthCache
};
