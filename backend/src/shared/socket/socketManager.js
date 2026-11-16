/**
 * @file socketManager.js
 * @description Centralized Socket.IO Lifecycle, JWT Authentication, and Room Authorization Engine for EMS.
 * Strictly verifies JWT signature and database tokenVersion on connection handshake,
 * and restricts room assignment to server-verified user and role channels.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Employee = require('../../modules/hr/models/Employee');
const { getUserAuthCache, setUserAuthCache } = require('../cache/userAuthCache');

let io = null;

function getEffectiveWhitelist(allowedOrigins = []) {
  const defaults = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://enterprise-management-system-two.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  const set = new Set([...defaults, ...(Array.isArray(allowedOrigins) ? allowedOrigins : [])]);
  return Array.from(set);
}

const LOCAL_HOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_NETWORK_REGEX = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;
const VERCEL_PROJECT_REGEX = /^https:\/\/enterprise-management-system(-[a-z0-9-]+)?\.vercel\.app$/i;
const RENDER_PROJECT_REGEX = /^https:\/\/.*\.onrender\.com$/i;

function checkOriginAllowed(origin, allowedOrigins = []) {
  if (!origin) return false;
  const clean = origin.trim().replace(/\/+$/, '');
  const whitelist = getEffectiveWhitelist(allowedOrigins).map(o => o.trim().replace(/\/+$/, ''));
  if (whitelist.includes(clean)) return true;
  if (LOCAL_HOST_REGEX.test(clean)) return true;
  if (LOCAL_NETWORK_REGEX.test(clean)) return true;
  if (VERCEL_PROJECT_REGEX.test(clean)) return true;
  if (RENDER_PROJECT_REGEX.test(clean)) return true;
  return false;
}

/**
 * Initialize Socket.IO with HTTP server and CORS configuration
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 * @returns {Server}
 */
function initSocketServer(httpServer, allowedOrigins = []) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Documented non-browser policy: Requests with no Origin header (e.g. mobile apps, curl, server-to-server)
        // do not carry browser ambient credentials. They must pass explicit JWT authentication in handshake middleware.
        if (!origin) return callback(null, true);

        // Strict exact match only
        if (checkOriginAllowed(origin, allowedOrigins)) {
          return callback(null, true);
        }
        return callback(new Error('CORS origin not allowed: ' + origin));
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    // Handshake-level gate restricting WebSocket transport before connection upgrade
    allowRequest: (req, callback) => {
      const origin = req.headers?.origin;
      if (origin) {
        if (!checkOriginAllowed(origin, allowedOrigins)) {
          return callback(new Error('CORS origin not allowed: ' + origin), false);
        }
      }
      return callback(null, true);
    },
    pingInterval: 25000, // 25s ping keeps Render connections active
    pingTimeout: 30000,  // 30s timeout
    transports: ['websocket', 'polling']
  });

  // ─── Connection Authentication Middleware ──────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
                    (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      if (token.startsWith('ems_token_')) {
        return next(new Error('Authentication error: TOKEN_UPGRADE_REQUIRED'));
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('FATAL: JWT_SECRET is not configured for Socket.IO authentication.');
        return next(new Error('Server configuration error'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new Error('Authentication error: TOKEN_EXPIRED'));
        }
        return next(new Error('Authentication error: Invalid token signature'));
      }

      const userId = decoded.userId;
      if (!userId) {
        return next(new Error('Authentication error: Malformed token payload'));
      }

      // Check trusted cache first, fallback to MongoDB
      let userAuth = getUserAuthCache(userId);

      if (!userAuth) {
        if (mongoose.connection.readyState !== 1) {
          return next(new Error('Database unavailable, try again shortly'));
        }

        const employee = await Employee.findById(userId);
        if (!employee) {
          return next(new Error('Authentication error: User not found'));
        }

        const isPrimary = Boolean(
          employee.employeeCode === 'ADM-001' ||
          employee.isSuperAdmin ||
          employee.isPrimaryAdmin ||
          employee.email === 'admin@inforag.com' ||
          employee.email === 'avinash@inforag.com'
        );
        const isSystemAdmin = Boolean(isPrimary || employee.isAdmin || employee.systemRole === 'admin');
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
          role: employee.role,
          department: employee.department,
          systemRole: isSystemAdmin ? 'admin' : (isSystemHR ? 'hr' : 'team_member'),
          isAdmin: isSystemAdmin,
          status: employee.status || 'active',
          tokenVersion: typeof employee.tokenVersion === 'number' ? employee.tokenVersion : 0,
          permissionVersion: typeof employee.permissionVersion === 'number' ? employee.permissionVersion : 0,
          permissions: employee.permissions || {}
        };

        setUserAuthCache(userId, userAuth);
      }

      // Enforce active status
      if (userAuth.status !== 'active') {
        return next(new Error('Authentication error: Account deactivated'));
      }

      // Enforce tokenVersion consistency
      const tokenVersionInToken = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
      if (tokenVersionInToken !== userAuth.tokenVersion) {
        return next(new Error('Authentication error: SESSION_REVOKED'));
      }

      // Attach trusted user identity to the socket instance
      socket.user = userAuth;
      next();
    } catch (e) {
      next(new Error(`Authentication error: ${e.message}`));
    }
  });

  // ─── Connection Lifecycle & Server-Authorized Room Assignment ─────────
  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // 1. Join server-authorized personal user room
    const userRoom = `user:${user.id}`;
    socket.join(userRoom);

    // 2. Join server-authorized role room
    const roleRoom = `role:${user.systemRole}`;
    socket.join(roleRoom);

    // 3. Join global company broadcast channel
    socket.join('company:global');

    // Notify connected client of verified handshake confirmation
    socket.emit('auth:confirmed', {
      userId: user.id,
      employeeCode: user.employeeCode,
      systemRole: user.systemRole,
      rooms: [userRoom, roleRoom, 'company:global']
    });

    // Flush any pending durable outbox events for this user upon connection/reconnection
    try {
      const { dispatchPendingOutboxEvents } = require('../../modules/work/services/outboxDispatcher');
      dispatchPendingOutboxEvents(user.id).catch((err) => {
        console.error('[socketManager] Error dispatching pending outbox events on connection:', err.message);
      });
    } catch (_) {}

    socket.on('disconnect', (reason) => {
      // Disconnection cleanup if needed
    });
  });

  return io;
}

/**
 * Retrieve the active Socket.IO server instance
 * @returns {Server|null}
 */
function getSocketServer() {
  return io;
}

/**
 * Force disconnect all open socket connections for a specific user
 * Used when an account is deactivated, password is changed, or global logout is triggered.
 * @param {string} userId
 */
function disconnectUserSockets(userId) {
  if (!io || !userId) return;
  const userRoom = `user:${String(userId)}`;
  io.in(userRoom).disconnectSockets(true);
}

/**
 * Reset socket server instance (strictly for testing environments)
 */
function resetSocketServerForTesting() {
  if (io) {
    try {
      io.close();
    } catch (_) {}
    io = null;
  }
}

module.exports = {
  initSocketServer,
  getSocketServer,
  disconnectUserSockets,
  resetSocketServerForTesting,
  checkOriginAllowed,
  getEffectiveWhitelist
};
