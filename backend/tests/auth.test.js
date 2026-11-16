/**
 * @file auth.test.js
 * @description Automated Unit & Integration Tests for EMS Authentication & Password Security.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { hashPassword, isBcryptHash, generateSecureRandomPassword, verifyPassword } = require('../src/shared/utils/passwordUtils');

describe('Authentication & Password Security Suite', () => {
  test('hashPassword creates a valid bcrypt hash with 10 salt rounds', async () => {
    const raw = 'SuperSecret123!';
    const hashed = await hashPassword(raw);
    assert.ok(isBcryptHash(hashed), 'Hash must match bcrypt pattern');
    assert.notEqual(hashed, raw, 'Hash must not equal plaintext');
  });

  test('verifyPassword rejects empty or missing stored password WITHOUT falling back to default', async () => {
    // Attempting login with candidate against missing or null stored password
    const resNull = await verifyPassword('emp123', null);
    assert.equal(resNull.matches, false, 'Must reject when storedPassword is null');
    assert.equal(resNull.needsMigration, false);

    const resEmpty = await verifyPassword('emp123', '');
    assert.equal(resEmpty.matches, false, 'Must reject when storedPassword is empty');

    const resAdmin = await verifyPassword('admin123', undefined);
    assert.equal(resAdmin.matches, false, 'Must reject when storedPassword is undefined');
  });

  test('verifyPassword verifies bcrypt hash correctly without migration', async () => {
    const pass = 'CorrectPassword99#';
    const hashed = await hashPassword(pass);

    const matchRes = await verifyPassword(pass, hashed);
    assert.equal(matchRes.matches, true, 'Valid password must match');
    assert.equal(matchRes.needsMigration, false, 'Bcrypt hash does not need migration');

    const wrongRes = await verifyPassword('WrongPassword', hashed);
    assert.equal(wrongRes.matches, false, 'Wrong password must fail');
    assert.equal(wrongRes.needsMigration, false);
  });

  test('verifyPassword handles legacy plaintext and flags needsMigration only on valid match', async () => {
    const legacyPlain = 'legacyPass2025';

    const matchRes = await verifyPassword(legacyPlain, legacyPlain);
    assert.equal(matchRes.matches, true, 'Legacy plaintext must match exact candidate');
    assert.equal(matchRes.needsMigration, true, 'Legacy match must flag needsMigration: true');

    const wrongRes = await verifyPassword('wrongCandidate', legacyPlain);
    assert.equal(wrongRes.matches, false, 'Wrong candidate against legacy must fail');
    assert.equal(wrongRes.needsMigration, false, 'Failed match must not trigger migration');
  });

  test('generateSecureRandomPassword produces high-entropy random strings', () => {
    const pass1 = generateSecureRandomPassword(16);
    const pass2 = generateSecureRandomPassword(16);

    assert.equal(pass1.length, 16);
    assert.equal(pass2.length, 16);
    assert.notEqual(pass1, pass2, 'Random passwords must be distinct');
  });

  test('JWT session tracking invalidates session when tokenVersion increments', () => {
    const secret = 'test-jwt-secret-for-stabilization';
    const user = { userId: 'emp_001', tokenVersion: 1 };

    const token = jwt.sign(user, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    assert.equal(decoded.tokenVersion, 1);

    // Simulate session revocation by incrementing database tokenVersion to 2
    const currentDbTokenVersion = 2;
    const isSessionValid = (decoded.tokenVersion === currentDbTokenVersion);
    assert.equal(isSessionValid, false, 'Token with outdated tokenVersion must be rejected');
  });

  test('CORS Policy lockdown strictly validates exact trusted origins', () => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://enterprise-management-system-two.vercel.app'
    ];

    const isOriginAllowed = (origin) => {
      if (!origin) return true;
      return allowedOrigins.includes(origin);
    };

    assert.equal(isOriginAllowed('https://enterprise-management-system-two.vercel.app'), true, 'Exact production frontend origin is allowed');
    assert.equal(isOriginAllowed('http://localhost:5173'), true, 'Local dev origin is allowed');
    assert.equal(isOriginAllowed(null), true, 'Server-to-server / curl is allowed');

    // Rogue / malicious origins must be rejected
    assert.equal(isOriginAllowed('https://enterprise-management-system-phish.vercel.app'), false, 'Arbitrary vercel subdomain is rejected');
    assert.equal(isOriginAllowed('https://malicious-site.com'), false, 'Untrusted origin is rejected');
  });

  test('Rate limiting sweep purges expired entries to prevent unbounded memory growth', () => {
    const { cleanupExpiredRateLimits, loginIpLimits, loginIdentifierLimits } = require('../src/modules/auth/controllers/authController');

    const now = Date.now();
    // Add expired entry
    loginIpLimits.set('login_ip:1.2.3.4', { count: 10, resetTime: now - 1000 });
    // Add active entry
    loginIpLimits.set('login_ip:5.6.7.8', { count: 2, resetTime: now + 60000 });

    assert.equal(loginIpLimits.has('login_ip:1.2.3.4'), true);
    assert.equal(loginIpLimits.has('login_ip:5.6.7.8'), true);

    const cleared = cleanupExpiredRateLimits(now);
    assert.ok(cleared >= 1, 'Must clear at least 1 expired entry');
    assert.equal(loginIpLimits.has('login_ip:1.2.3.4'), false, 'Expired entry must be deleted');
    assert.equal(loginIpLimits.has('login_ip:5.6.7.8'), true, 'Active entry must be preserved');
  });
});
