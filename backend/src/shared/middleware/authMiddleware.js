/**
 * @file authMiddleware.js
 * @description Cryptographic JWT Authentication and User Scoping Middleware for EMS/CRM Backend.
 * Strictly verifies signed JSON Web Tokens (Bearer auth), checks server-side tokenVersion and account status,
 * and completely eliminates reliance on client-supplied identity/role headers.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Employee = require('../../modules/hr/models/Employee');
const { getUserAuthCache, setUserAuthCache } = require('../cache/userAuthCache');

/**
 * Universal Authentication Middleware
 * Validates cryptographically signed JWT, enforces tokenVersion and active status,
 * and attaches server-verified user identity to req.user.
 */
exports.authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';

    // Check if client passed the old predictable token format or no Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const rawHeader = authHeader.trim() || req.headers['x-auth-token'] || '';
      if (rawHeader.startsWith('ems_token_') || rawHeader.includes('ems_token_') || req.headers['x-user-id']) {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_UPGRADE_REQUIRED',
          message: 'Security upgrade: Your session format is outdated. Please sign in with your credentials.'
        });
      }
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. No Bearer token provided.'
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token || token.startsWith('ems_token_')) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_UPGRADE_REQUIRED',
        message: 'Security upgrade: Your session format is outdated. Please sign in with your credentials.'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT_SECRET missing.'
      });
    }

    // Cryptographic signature & expiry verification
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Session expired. Please sign in again.'
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Invalid session token signature.'
      });
    }

    const userId = decoded.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Malformed token payload.'
      });
    }

    // Check trusted server-side in-memory cache first
    let userAuth = getUserAuthCache(userId);

    if (!userAuth) {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connecting, standby.'
        });
      }

      const employee = await Employee.findById(userId);
      if (!employee) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Employee record not found.'
        });
      }

      let isDelegatedAdmin = !!employee.isDelegatedAdmin;
      if (isDelegatedAdmin && employee.delegationExpiresAt) {
        const expTime = new Date(employee.delegationExpiresAt).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) {
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

      userAuth = {
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
        isDelegatedAdmin,
        status: employee.status || 'active',
        tokenVersion: typeof employee.tokenVersion === 'number' ? employee.tokenVersion : 0,
        permissionVersion: typeof employee.permissionVersion === 'number' ? employee.permissionVersion : 0,
        permissions: employee.permissions || {}
      };

      setUserAuthCache(userId, userAuth);
    }

    // Enforce active status
    if (userAuth.status !== 'active') {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is deactivated. Please contact your Administrator.'
      });
    }

    // Enforce tokenVersion consistency (revocation verification)
    const tokenVersionInToken = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    if (tokenVersionInToken !== userAuth.tokenVersion) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_REVOKED',
        message: 'Session has been invalidated. Please sign in again.'
      });
    }

    // Attach strictly server-verified identity to request
    req.user = userAuth;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Require specific permission or role to access an endpoint
 */
exports.requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
    }
    if (req.user.isAdmin || req.user.systemRole === 'admin') {
      return next();
    }

    const perms = req.user.permissions || {};
    if (perms[permissionKey] || perms.allAccess) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      message: `Access denied: missing '${permissionKey}' authority.`
    });
  };
};
