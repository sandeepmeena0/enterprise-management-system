/**
 * @file passwordUtils.js
 * @description Cryptographic Password Hashing and Backward-Compatible Migration Utilities for EMS.
 * Employs bcryptjs (10 salt rounds) with automatic detection and on-the-fly migration for legacy plaintext records.
 * STRICT SECURITY: Never falls back to implicit default passwords like 'emp123' or 'admin123'.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
 * Generate a cryptographically secure random password
 * @param {number} length
 * @returns {string}
 */
function generateSecureRandomPassword(length = 16) {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Securely verify candidate password against stored password (bcrypt hash or legacy plaintext).
 * Identifies whether on-the-fly migration to bcrypt is required.
 * STRICT SECURITY: Rejects any attempt when storedPassword is empty or missing.
 * 
 * @param {string} candidate - Password supplied by user at login
 * @param {string} storedPassword - Password field value stored in database
 * @returns {Promise<{ matches: boolean, needsMigration: boolean }>}
 */
async function verifyPassword(candidate, storedPassword) {
  if (!candidate || typeof candidate !== 'string') {
    return { matches: false, needsMigration: false };
  }
  const cleanCandidate = candidate.trim();
  if (!cleanCandidate || cleanCandidate === '••••••••') {
    return { matches: false, needsMigration: false };
  }

  // Reject authentication if no password is stored for the employee
  if (!storedPassword || typeof storedPassword !== 'string' || !storedPassword.trim()) {
    return { matches: false, needsMigration: false };
  }

  const target = storedPassword.trim();

  if (isBcryptHash(target)) {
    const isMatch = await bcrypt.compare(cleanCandidate, target);
    return { matches: isMatch, needsMigration: false };
  }

  // Legacy plaintext verification: only when non-empty stored password exists
  const isMatch = (cleanCandidate === target);
  return { matches: isMatch, needsMigration: isMatch };
}

module.exports = {
  hashPassword,
  isBcryptHash,
  generateSecureRandomPassword,
  verifyPassword
};
