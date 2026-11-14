/**
 * @file passwordUtils.js
 * @description Cryptographic Password Hashing and Backward-Compatible Migration Utilities for EMS.
 * Employs bcryptjs (10 salt rounds) with automatic detection and on-the-fly migration for legacy plaintext records.
 */

const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
const BCRYPT_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainText
 * @returns {Promise<string>}
 */
async function hashPassword(plainText) {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await bcrypt.hash(plainText.trim(), BCRYPT_ROUNDS);
}

/**
 * Test whether a given string is a valid bcrypt hash
 * @param {string} str
 * @returns {boolean}
 */
function isBcryptHash(str) {
  if (!str || typeof str !== 'string') return false;
  return BCRYPT_REGEX.test(str.trim());
}

/**
 * Securely verify candidate password against stored password (bcrypt hash or legacy plaintext).
 * Identifies whether on-the-fly migration to bcrypt is required.
 * 
 * @param {string} candidate - Password supplied by user at login
 * @param {string} storedPassword - Password field value stored in database
 * @param {string} defaultFallback - Fallback default ('admin123' or 'emp123')
 * @returns {Promise<{ matches: boolean, needsMigration: boolean }>}
 */
async function verifyPassword(candidate, storedPassword, defaultFallback = 'emp123') {
  if (!candidate || typeof candidate !== 'string') {
    return { matches: false, needsMigration: false };
  }
  const cleanCandidate = candidate.trim();
  if (!cleanCandidate || cleanCandidate === '••••••••') {
    return { matches: false, needsMigration: false };
  }

  const target = (storedPassword && typeof storedPassword === 'string' && storedPassword.trim())
    ? storedPassword.trim()
    : defaultFallback;

  if (isBcryptHash(target)) {
    const isMatch = await bcrypt.compare(cleanCandidate, target);
    return { matches: isMatch, needsMigration: false };
  }

  // Legacy plaintext verification
  const isMatch = (cleanCandidate === target);
  return { matches: isMatch, needsMigration: isMatch };
}

module.exports = {
  hashPassword,
  isBcryptHash,
  verifyPassword
};
