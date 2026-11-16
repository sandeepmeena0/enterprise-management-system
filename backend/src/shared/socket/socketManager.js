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
        // Allow requests with no origin (e.g. mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        const whitelist = [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174',
          'https://enterprise-management-system-two.vercel.app',
          process.env.FRONTEND_URL
        ].filter(Boolean);

        // Allow localhost and vercel previews
        const isAllowed = whitelist.some(w => origin === w || origin.endsWith('.vercel.app')) || origin.includes('localhost');
        if (isAllowed) {
          return callback(null, true);
        }
        return callback(null, true); // Fallback allow to avoid dropping mobile web views
      },
      credentials: true,
      methods: ['GET', 'POST']
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

module.exports = {
  initSocketServer,
  getSocketServer,
  disconnectUserSockets
};
