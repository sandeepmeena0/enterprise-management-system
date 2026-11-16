/**
 * @file authController.js
 * @description Centralized Database Authentication Controller for EMS.
 * Validates credentials strictly against MongoDB Atlas records, generates cryptographically
 * signed JWTs, and enforces server-side tokenVersion session tracking.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Employee = require('../../hr/models/Employee');
const Ticket = require('../../tickets/models/Ticket');
const asyncHandler = require('../../../shared/middleware/asyncHandler');
const { setUserAuthCache, invalidateUserAuthCache } = require('../../../shared/cache/userAuthCache');
const { verifyPassword, hashPassword } = require('../../../shared/utils/passwordUtils');
const { disconnectUserSockets } = require('../../../shared/socket/socketManager');

// Rate limiting maps for forgot-password abuse prevention: Dual-Bucket (IP-level + Identifier-level)
const forgotPasswordIpLimits = new Map();
const forgotPasswordIdentifierLimits = new Map();
const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_IP = 15;
const MAX_REQUESTS_PER_IDENTIFIER = 5;

// Rate limiting maps for login brute-force prevention: Dual-Bucket (IP-level + Identifier-level)
const loginIpLimits = new Map();
const loginIdentifierLimits = new Map();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS_PER_IP = 25;
const MAX_LOGIN_ATTEMPTS_PER_IDENTIFIER = 10;

// Helper to extract client IP safely
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

// Helper to sign JWT
const signToken = (employee) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    {
      userId: employee._id.toString(),
      tokenVersion: typeof employee.tokenVersion === 'number' ? employee.tokenVersion : 0
    },
    jwtSecret,
    { expiresIn }
  );
};

// @desc    Universal Login endpoint (supports Email or Employee Code with Password)
// @route   POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const input = (req.body.identifier || req.body.email || req.body.employeeCode || req.body.username || '').trim();
  const password = (req.body.password || '').trim();

  if (!input) {
    return res.status(400).json({ success: false, message: 'Employee ID or Email is required.' });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  const clientIp = getClientIp(req);
  const now = Date.now();

  // 1. IP-level Rate Limit Check
  const ipKey = `login_ip:${clientIp}`;
  const ipLimitEntry = loginIpLimits.get(ipKey);
  if (ipLimitEntry && now < ipLimitEntry.resetTime) {
    if (ipLimitEntry.count >= MAX_LOGIN_ATTEMPTS_PER_IP) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts from this network. Please try again in 15 minutes.'
      });
    }
  }

  // 2. Identifier-level Rate Limit Check
  const cleanId = input.toLowerCase();
  const idKey = `login_id:${cleanId}`;
  const idLimitEntry = loginIdentifierLimits.get(idKey);
  if (idLimitEntry && now < idLimitEntry.resetTime) {
    if (idLimitEntry.count >= MAX_LOGIN_ATTEMPTS_PER_IDENTIFIER) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts for this account. Please try again in 15 minutes or request a password reset.'
      });
    }
  }

  const recordFailedAttempt = () => {
    // Record IP failure
    if (ipLimitEntry && now < ipLimitEntry.resetTime) {
      ipLimitEntry.count += 1;
    } else {
      loginIpLimits.set(ipKey, { count: 1, resetTime: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    }

    // Record Identifier failure
    if (idLimitEntry && now < idLimitEntry.resetTime) {
      idLimitEntry.count += 1;
    } else {
      loginIdentifierLimits.set(idKey, { count: 1, resetTime: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    }
  };

  // Find employee in MongoDB Atlas (explicitly include password for verification)
  const employee = await Employee.findOne({
    $or: [
      { email: cleanId },
      { employeeCode: input.toUpperCase() }
    ]
  }).select('+password');

  // Generic credential error (Never reveal whether account exists)
  const GENERIC_AUTH_ERROR = 'Invalid credentials. Please verify your email/ID and password.';

  if (!employee) {
    recordFailedAttempt();
    return res.status(401).json({
      success: false,
      message: GENERIC_AUTH_ERROR
    });
  }

  // Check account active status
  if (employee.status && employee.status !== 'active') {
    return res.status(401).json({
      success: false,
      message: 'This account has been deactivated. Please contact your Administrator.'
    });
  }

  // Ensure employee has a stored password configured
  if (!employee.password || typeof employee.password !== 'string' || !employee.password.trim()) {
    recordFailedAttempt();
    return res.status(401).json({
      success: false,
      message: GENERIC_AUTH_ERROR
    });
  }

  // Cryptographic bcrypt verification with backward-compatible legacy auto-migration (NO DEFAULT FALLBACK)
  const { matches, needsMigration } = await verifyPassword(password, employee.password);

  if (!matches) {
    recordFailedAttempt();
    return res.status(401).json({
      success: false,
      message: GENERIC_AUTH_ERROR
    });
  }

  // Successful authentication: clear identifier rate limit
  loginIdentifierLimits.delete(idKey);

  // Transparent backward-compatible migration:
  // If employee authenticated with legacy plaintext password, hash with bcrypt and save to MongoDB
  if (needsMigration) {
    try {
      const secureHash = await hashPassword(password);
      await Employee.findByIdAndUpdate(employee._id, {
        $set: {
          password: secureHash,
          passwordMigratedAt: new Date().toISOString()
        }
      });
    } catch (migErr) {
      console.warn('Password on-the-fly migration notice:', migErr.message);
    }
  }

  let isDelegatedAdmin = !!employee.isDelegatedAdmin;
  if (isDelegatedAdmin && employee.delegationExpiresAt) {
    const exp = new Date(employee.delegationExpiresAt).getTime();
    if (!isNaN(exp) && exp < Date.now()) {
      isDelegatedAdmin = false;
    }
  }

  const isPrimary = Boolean(
    employee.employeeCode === 'ADM-001' ||
    employee.isSuperAdmin ||
    employee.isPrimaryAdmin ||
    employee.email === 'admin@inforag.com' ||
    employee.email === 'avinash@inforag.com'
  );
  const isSystemAdmin = Boolean(isPrimary || isDelegatedAdmin || (employee.isAdmin && employee.systemRole === 'admin'));
  const isSystemHR = !isSystemAdmin && Boolean(
    employee.department === 'Human Resources' ||
    employee.role?.toLowerCase().includes('hr') ||
    employee.systemRole === 'hr'
  );

  const tokenVersion = typeof employee.tokenVersion === 'number' ? employee.tokenVersion : 0;
  const permissionVersion = typeof employee.permissionVersion === 'number' ? employee.permissionVersion : 0;

  const userObj = {
    _id: employee._id.toString(),
    id: employee._id.toString(),
    employeeCode: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    avatar: employee.avatar || '',
    role: employee.role,
    department: employee.department,
    systemRole: isSystemAdmin ? 'admin' : (isSystemHR ? 'hr' : (employee.systemRole && employee.systemRole !== 'admin' ? employee.systemRole : 'team_member')),
    isAdmin: isSystemAdmin,
    isSuperAdmin: isPrimary,
    isDelegatedAdmin: isDelegatedAdmin,
    delegationExpiresAt: employee.delegationExpiresAt || null,
    status: employee.status || 'active',
    joiningDate: employee.joiningDate,
    leaveBalance: employee.leaveBalance,
    tokenVersion,
    permissionVersion,
    permissions: employee.permissions || {}
  };

  // Generate cryptographically signed JWT
  const token = signToken(employee);

  // Cache trusted auth data
  setUserAuthCache(employee._id.toString(), userObj);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: userObj
  });
});

// @desc    Get authenticated user session profile
// @route   GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  // If request reached here with valid req.user from authMiddleware, return profile
  if (req.user) {
    return res.json({
      success: true,
      data: req.user
    });
  }

  return res.status(401).json({
    success: false,
    code: 'AUTH_REQUIRED',
    message: 'Authentication required'
  });
});

// @desc    Standard logout
// @route   POST /api/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  if (req.user?.id) {
    invalidateUserAuthCache(req.user.id);
    try {
      disconnectUserSockets(req.user.id);
    } catch (_) {}
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Global logout / session revocation across all devices
// @route   POST /api/auth/logout-all
exports.logoutAll = asyncHandler(async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const updated = await Employee.findByIdAndUpdate(
    req.user.id,
    { $inc: { tokenVersion: 1 } },
    { new: true }
  );

  invalidateUserAuthCache(req.user.id);

  // Disconnect open sockets for this user if socket manager is available
  try {
    const { disconnectUserSockets } = require('../../../shared/socket/socketManager');
    if (typeof disconnectUserSockets === 'function') {
      disconnectUserSockets(req.user.id);
    }
  } catch (_) {}

  res.status(200).json({
    success: true,
    message: 'All active sessions on all devices have been invalidated',
    tokenVersion: updated?.tokenVersion || 0
  });
});

// @desc    Self-service authenticated password change
// @route   POST /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { currentPassword, newPassword } = req.body;
  const cleanCurrent = (currentPassword || '').trim();
  const cleanNew = (newPassword || '').trim();

  if (!cleanCurrent) {
    return res.status(400).json({ success: false, message: 'Please enter your current password.' });
  }
  if (!cleanNew || cleanNew.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }
  if (cleanNew === '••••••••') {
    return res.status(400).json({ success: false, message: 'Invalid password format.' });
  }

  // Load employee record selecting password explicitly
  const employee = await Employee.findById(req.user.id).select('+password +passwordHistory');
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee record not found.' });
  }

  const { matches } = await verifyPassword(cleanCurrent, employee.password);

  if (!matches) {
    return res.status(400).json({
      success: false,
      message: 'Incorrect current password. Please enter your valid existing password.'
    });
  }

  // Cryptographically hash new password with bcrypt (10 rounds)
  const secureHash = await hashPassword(cleanNew);

  const historyEntry = {
    changedAt: new Date().toISOString(),
    changedBy: `${employee.name || 'User'} (Self-Service)`
  };
  const prevHistory = Array.isArray(employee.passwordHistory) ? employee.passwordHistory : [];
  const passwordHistory = [historyEntry, ...prevHistory].slice(0, 10);

  // Update employee: hash password, update history, and increment tokenVersion to revoke old sessions
  await Employee.findByIdAndUpdate(employee._id, {
    $set: {
      password: secureHash,
      passwordHistory,
      passwordUpdatedAt: new Date().toISOString()
    },
    $inc: { tokenVersion: 1 }
  });

  // Invalidate cache immediately
  const empIdStr = employee._id.toString();
  invalidateUserAuthCache(empIdStr);
  if (employee.employeeCode) invalidateUserAuthCache(employee.employeeCode);
  if (employee.email) invalidateUserAuthCache(employee.email.toLowerCase());

  // Disconnect active sockets
  try {
    disconnectUserSockets(empIdStr);
  } catch (_) {}

  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Your sessions have been updated. Please sign in with your new password.'
  });
});

// @desc    Admin-authorized password reset for another employee
// @route   POST /api/auth/admin-reset-password
exports.adminResetPassword = asyncHandler(async (req, res) => {
  const u = req.user;
  if (!u) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const canReset = u.isAdmin || u.systemRole === 'admin' || u.isSuperAdmin || u.permissions?.allAccess || u.permissions?.manageEmployees;
  if (!canReset) {
    return res.status(403).json({ success: false, message: 'Access denied: Only Administrators can reset employee passwords.' });
  }

  const { employeeId, newPassword } = req.body;
  const cleanPass = (newPassword || '').trim();
  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Target employee ID is required.' });
  }
  if (!cleanPass || cleanPass.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }
  if (cleanPass === '••••••••') {
    return res.status(400).json({ success: false, message: 'Invalid password format.' });
  }

  const query = mongoose.Types.ObjectId.isValid(employeeId)
    ? { _id: employeeId }
    : { $or: [{ employeeCode: String(employeeId).trim().toUpperCase() }, { email: String(employeeId).trim().toLowerCase() }] };

  const target = await Employee.findOne(query).select('+password +passwordHistory');
  if (!target) {
    return res.status(404).json({ success: false, message: 'Target employee not found.' });
  }

  // Protect Super Admin from being reset by non-master admins
  const isTargetSuper = target.employeeCode === 'ADM-001' || target.isSuperAdmin || target.email === 'admin@inforag.com' || target.email === 'avinash@inforag.com';
  const isCallerSuper = u.employeeCode === 'ADM-001' || u.isSuperAdmin || u.email === 'admin@inforag.com' || u.email === 'avinash@inforag.com';
  if (isTargetSuper && !isCallerSuper) {
    return res.status(403).json({ success: false, message: 'Security Policy: Master Administrator account cannot be reset by other administrators.' });
  }

  const secureHash = await hashPassword(cleanPass);
  const historyEntry = {
    changedAt: new Date().toISOString(),
    changedBy: `Administrator (${u.name || u.email || 'Admin'})`
  };
  const prevHistory = Array.isArray(target.passwordHistory) ? target.passwordHistory : [];
  const passwordHistory = [historyEntry, ...prevHistory].slice(0, 10);

  await Employee.findByIdAndUpdate(target._id, {
    $set: {
      password: secureHash,
      passwordHistory,
      passwordUpdatedAt: new Date().toISOString()
    },
    $inc: { tokenVersion: 1 }
  });

  const targetIdStr = target._id.toString();
  invalidateUserAuthCache(targetIdStr);
  if (target.employeeCode) invalidateUserAuthCache(target.employeeCode);
  if (target.email) invalidateUserAuthCache(target.email.toLowerCase());

  try {
    disconnectUserSockets(targetIdStr);
  } catch (_) {}

  res.status(200).json({
    success: true,
    message: `Password has been reset successfully for ${target.name} (${target.employeeCode}).`
  });
});

// @desc    Public password reset request (creates Admin review ticket without exposing credentials)
// @route   POST /api/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || req.body.email || req.body.employeeCode || '').trim();
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = (typeof forwarded === 'string' && forwarded.trim())
    ? forwarded.split(',')[0].trim()
    : (req.ip || req.socket?.remoteAddress || 'unknown');

  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Please provide your registered Email or Employee ID.' });
  }

  const now = Date.now();

  // 1. IP-level Rate Limit Check (Prevents identifier cycling attacks from a single IP)
  const ipKey = `ip:${clientIp}`;
  const ipLimitEntry = forgotPasswordIpLimits.get(ipKey);
  if (ipLimitEntry && now < ipLimitEntry.resetTime) {
    if (ipLimitEntry.count >= MAX_REQUESTS_PER_IP) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset requests from this network. Please try again in 15 minutes.'
      });
    }
    ipLimitEntry.count += 1;
  } else {
    forgotPasswordIpLimits.set(ipKey, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
  }

  // 2. Identifier-level Rate Limit Check (Prevents targeted DoS on a specific account)
  const cleanId = identifier.toLowerCase();
  const idKey = `id:${cleanId}`;
  const idLimitEntry = forgotPasswordIdentifierLimits.get(idKey);
  if (idLimitEntry && now < idLimitEntry.resetTime) {
    if (idLimitEntry.count >= MAX_REQUESTS_PER_IDENTIFIER) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset requests for this account. Please try again in 15 minutes.'
      });
    }
    idLimitEntry.count += 1;
  } else {
    forgotPasswordIdentifierLimits.set(idKey, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
  }

  // Standardized generic response text (Never reveal account existence)
  const genericResponse = {
    success: true,
    message: 'If an active account matches that identifier, a password reset request has been submitted to the Administrator.'
  };

  try {
    const employee = await Employee.findOne({
      $or: [
        { email: cleanId },
        { employeeCode: identifier.toUpperCase() }
      ]
    });

    if (employee && employee.status === 'active') {
      const count = await Ticket.countDocuments();
      const ticketCode = `TKT-${1000 + count + 1}`;

      await Ticket.create({
        ticketCode,
        subject: `🔐 Password Reset Request: ${employee.name} (${employee.employeeCode})`,
        description: `Employee ${employee.name} (${employee.employeeCode}, ${employee.role}, ${employee.department}) has requested a password reset. Please open the Employee Directory and set a new secure password.`,
        category: 'Account Access',
        priority: 'urgent',
        status: 'open',
        department: 'Human Resources',
        requestedById: employee._id.toString(),
        requestedByName: employee.name,
        requestedByEmail: employee.email,
        requestedByRole: employee.role,
        requestedOn: new Date().toISOString().split('T')[0],
        createdBy: employee._id.toString(),
        createdByName: employee.name,
        createdByRole: employee.role
      });
    }
  } catch (err) {
    console.warn('[ForgotPassword] Ticket creation notice:', err.message);
  }

  // Always return the generic message
  res.status(200).json(genericResponse);
});
