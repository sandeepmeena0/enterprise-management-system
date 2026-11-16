const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Shared infrastructure
const connectDB = require('./src/shared/config/database');
const { errorHandler, notFound } = require('./src/shared/middleware/errorHandler');
const { authenticateUser } = require('./src/shared/middleware/authMiddleware');
const { initSocketServer } = require('./src/shared/socket/socketManager');

// Load environment variables
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Connect to MongoDB
connectDB();

// Midnight & daily shift auto-close worker (cleans past unclosed shifts from MongoDB Atlas)
const { autoClosePastDayShifts } = require('./src/modules/hr/controllers/attendanceController');
mongoose.connection.once('open', () => {
  autoClosePastDayShifts();
  setInterval(autoClosePastDayShifts, 30 * 60 * 1000);
});

const app = express();

// Enable reverse proxy trust for secure client IP extraction behind Render / Load Balancers
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://enterprise-management-system-two.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Server-to-server, mobile or curl
  return allowedOrigins.includes(origin);
};

// Strict, Secure CORS & Preflight Handler
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  const reqHeaders = req.headers['access-control-request-headers'];
  if (reqHeaders) {
    res.setHeader('Access-Control-Allow-Headers', reqHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token, x-user-id, x-idempotency-key, x-request-id, x-client-source');
  }
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Request origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-auth-token', 'x-user-id', 'x-idempotency-key', 'x-request-id', 'x-client-source']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route (With graceful 2s connection buffer to avoid 503 on cold start)
app.get('/api/health', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    const start = Date.now();
    while (mongoose.connection.readyState !== 1 && Date.now() - start < 2000) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  const isDbReady = mongoose.connection.readyState === 1;
  res.status(isDbReady ? 200 : 503).json({
    status: isDbReady ? 'online' : 'connecting',
    database: isDbReady ? 'connected' : 'connecting',
    system: 'Enterprise Management System (EMS) API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── Public Authentication Routes (Login strictly against MongoDB Atlas) ────
app.use('/api/auth', require('./src/modules/auth/routes/authRoutes'));

// Authenticate user & tenant scoping middleware
app.use('/api', authenticateUser);

// Database Seed / Reset Endpoint (Strictly Master Admin only in development; permanently disabled in production)
app.post('/api/seed', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Production Security Policy: Endpoint is permanently disabled in production regardless of environment variables
  if (isProd) {
    return res.status(403).json({
      success: false,
      code: 'RESET_DISABLED_IN_PRODUCTION',
      message: 'Database reset endpoint is permanently disabled in production environment.'
    });
  }

  const u = req.user;
  const isMasterAdmin = u && Boolean(
    u.employeeCode === 'ADM-001' ||
    u.isSuperAdmin ||
    u.email === 'admin@inforag.com' ||
    u.email === 'avinash@inforag.com'
  );

  if (!isMasterAdmin) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Access denied: Database reset is restricted strictly to Master Administrator.'
    });
  }

  try {
    const { seedDatabase } = require('./src/seeders/seed');
    const { clearUserAuthCache } = require('./src/shared/cache/userAuthCache');
    await seedDatabase();
    clearUserAuthCache();
    res.json({ success: true, message: 'Database successfully seeded with actual enterprise data!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Mount Module Routes ────────────────────────────────────────────────────
// HR Module
app.use('/api/employees', require('./src/modules/hr/routes/employeeRoutes'));
app.use('/api/leaves', require('./src/modules/hr/routes/leaveRoutes'));
app.use('/api/attendance', require('./src/modules/hr/routes/attendanceRoutes'));
app.use('/api/holidays', require('./src/modules/hr/routes/holidayRoutes'));
app.use('/api/appreciations', require('./src/modules/hr/routes/appreciationRoutes'));

// Work Module (Projects, Tasks, Timesheets)
app.use('/api/projects', require('./src/modules/work/routes/projectRoutes'));
app.use('/api/tasks', require('./src/modules/work/routes/taskRoutes'));
app.use('/api/work-sessions', require('./src/modules/work/routes/workSessionRoutes'));
app.use('/api/timesheet', require('./src/modules/work/routes/timesheetRoutes'));
app.use('/api/timesheets', require('./src/modules/work/routes/timesheetRoutes'));
app.use('/api/timer', require('./src/modules/work/routes/timesheetRoutes'));
app.use('/api/timelogs', require('./src/modules/work/routes/timesheetRoutes'));
app.use('/api/timelog', require('./src/modules/work/routes/timesheetRoutes'));

// CRM Module (Leads, Notices, Tickets, Events, Conversations)
app.use('/api/leads', require('./src/modules/crm/routes/leadRoutes'));
app.use('/api/conversations', require('./src/modules/crm/routes/conversationRoutes'));
app.use('/api/notices', require('./src/modules/notices/routes/noticeRoutes'));
app.use('/api/tickets', require('./src/modules/tickets/routes/ticketRoutes'));
app.use('/api/events', require('./src/modules/events/routes/eventRoutes'));

// Finance Module (Expenses)
app.use('/api/expenses', require('./src/modules/finance/routes/expenseRoutes'));

// Company Settings & Resignations Module
app.use('/api/company-settings', require('./src/modules/settings/routes/companySettingsRoutes'));
app.use('/api/resignations', require('./src/modules/hr/routes/resignationRoutes'));

// 404 & Error Handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Wrap Express with HTTP Server for Socket.IO Integration
const server = http.createServer(app);
const io = initSocketServer(server, allowedOrigins);
app.set('io', io);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Enterprise Management System (EMS) Backend Server running on port ${PORT}`);
    console.log(`📡 API Endpoints ready at http://localhost:${PORT}/api/`);
    console.log(`⚡ Socket.IO Real-time Engine mounted and ready`);
  });
}

module.exports = { app, server };
