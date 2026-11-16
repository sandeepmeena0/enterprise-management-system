/**
 * @file attendance.test.js
 * @description Automated Integration Tests for Attendance API Authorization,
 * Server-Authoritative Timestamps, Audit Integrity, Transaction Rollback & Input Validation.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Attendance = require('../src/modules/hr/models/Attendance');
const AttendanceAudit = require('../src/modules/hr/models/AttendanceAudit');
const Employee = require('../src/modules/hr/models/Employee');
const CompanySettings = require('../src/modules/settings/models/CompanySettings');
const timeEngineService = require('../src/modules/work/services/timeEngineService');

const {
  checkIsPrivileged,
  bulkMarkAttendance,
  deleteAttendanceRecord,
  getOvertimeRequests,
  requestOvertime,
  updateOvertimeStatus,
  createAuditLog,
  markAttendance,
  forceClockOut,
  validateStrictDurationSeconds,
  validateStrictTimestamp,
  validatePunchSessions,
  MAX_CLOCK_SKEW_MS,
  MAX_DAY_SECONDS
} = require('../src/modules/hr/controllers/attendanceController');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    }
  };
  return res;
}

function getTodayStr() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

describe('Attendance API Authorization, Audit Integrity & Validation Suite', () => {
  // Stubs storage
  let origFindOneAttendance;
  let origFindOneAndUpdateAttendance;
  let origFindByIdAndDeleteAttendance;
  let origFindByIdAttendance;
  let origCreateAudit;
  let origFindOneAudit;
  let origFindByIdAndDeleteAudit;
  let origFindOneEmployee;
  let origFindByIdEmployee;
  let origFindOneCompanySettings;
  let origPauseTimer;
  let origSaveAudit;

  beforeEach(() => {
    origFindOneAttendance = Attendance.findOne;
    origFindOneAndUpdateAttendance = Attendance.findOneAndUpdate;
    origFindByIdAndDeleteAttendance = Attendance.findByIdAndDelete;
    origFindByIdAttendance = Attendance.findById;
    origCreateAudit = AttendanceAudit.create;
    origFindOneAudit = AttendanceAudit.findOne;
    origFindByIdAndDeleteAudit = AttendanceAudit.findByIdAndDelete;
    origFindOneEmployee = Employee.findOne;
    origFindByIdEmployee = Employee.findById;
    origFindOneCompanySettings = CompanySettings.findOne;
    origPauseTimer = timeEngineService.pauseTimer;
    origSaveAudit = AttendanceAudit.prototype.save;

    // Default safe stubs for un-connected MongoDB environment
    Attendance.findOne = async () => null;
    Attendance.findOneAndUpdate = async (q, update) => ({ ...update, _id: new mongoose.Types.ObjectId() });
    Attendance.findById = async () => null;
    Attendance.findByIdAndDelete = async () => true;
    Attendance.find = () => ({
      lean: async () => []
    });

    Employee.findById = async () => null;
    Employee.findOne = async () => ({
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      name: 'Default Employee',
      employeeCode: 'EMP-001',
      role: 'Team Member'
    });
    CompanySettings.findOne = () => ({
      lean: async () => ({
        shiftStartTime: '10:00 AM',
        gracePeriodMinutes: 15,
        standardWorkHours: 9,
        halfDayThresholdHours: 4.5
      })
    });
    AttendanceAudit.create = async (doc) => {
      if (Array.isArray(doc)) {
        return doc.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
      }
      return { ...doc, _id: new mongoose.Types.ObjectId() };
    };
    AttendanceAudit.findOne = async () => null;
    AttendanceAudit.findByIdAndDelete = async () => true;
    AttendanceAudit.prototype.save = async function() { return this; };

    timeEngineService.pauseTimer = async () => ({ noOp: true });
  });

  afterEach(() => {
    Attendance.findOne = origFindOneAttendance;
    Attendance.findOneAndUpdate = origFindOneAndUpdateAttendance;
    Attendance.findByIdAndDelete = origFindByIdAndDeleteAttendance;
    Attendance.findById = origFindByIdAttendance;
    AttendanceAudit.create = origCreateAudit;
    AttendanceAudit.findOne = origFindOneAudit;
    AttendanceAudit.findByIdAndDelete = origFindByIdAndDeleteAudit;
    AttendanceAudit.prototype.save = origSaveAudit;
    Employee.findOne = origFindOneEmployee;
    Employee.findById = origFindByIdEmployee;
    CompanySettings.findOne = origFindOneCompanySettings;
    timeEngineService.pauseTimer = origPauseTimer;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. REUSABLE VALIDATION HELPER UNIT TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  test('validateStrictDurationSeconds strictly validates integer seconds within shift limits', () => {
    assert.equal(validateStrictDurationSeconds(undefined, 'workSeconds').valid, true);
    assert.equal(validateStrictDurationSeconds(null, 'workSeconds').valid, true);
    assert.equal(validateStrictDurationSeconds(3600, 'workSeconds').value, 3600);
    assert.equal(validateStrictDurationSeconds('1800', 'workSeconds').value, 1800);

    // Rejections
    assert.equal(validateStrictDurationSeconds('abc', 'workSeconds').valid, false);
    assert.equal(validateStrictDurationSeconds(Infinity, 'workSeconds').valid, false);
    assert.equal(validateStrictDurationSeconds(-500, 'workSeconds').valid, false);
    assert.equal(validateStrictDurationSeconds(NaN, 'workSeconds').valid, false);
    assert.equal(validateStrictDurationSeconds(90000, 'workSeconds', MAX_DAY_SECONDS).valid, false, 'Exceeds 24 hours');
  });

  test('validateStrictTimestamp rejects invalid formats, zero/negative values, and impossible future times', () => {
    assert.equal(validateStrictTimestamp(undefined, 'clockInTimestamp').valid, true);

    const now = Date.now();
    assert.equal(validateStrictTimestamp(now - 100000, 'clockInTimestamp').valid, true);
    assert.equal(validateStrictTimestamp(String(now - 100000), 'clockInTimestamp').valid, true);

    // Rejections
    assert.equal(validateStrictTimestamp('not_a_timestamp', 'clockInTimestamp').valid, false);
    assert.equal(validateStrictTimestamp(0, 'clockInTimestamp').valid, false, 'Zero epoch is rejected');
    assert.equal(validateStrictTimestamp(-1000, 'clockInTimestamp').valid, false, 'Negative timestamp is rejected');
    assert.equal(validateStrictTimestamp(now + 10 * 60 * 1000, 'clockInTimestamp').valid, false, 'Future beyond skew is rejected');
  });

  test('validatePunchSessions enforces complete intervals, valid durations, and non-overlapping order', () => {
    const baseTs = 1700000000000;

    // 1. Valid sessions
    const validRes = validatePunchSessions([
      { inTimestamp: baseTs, outTimestamp: baseTs + 3600000 },
      { inTimestamp: baseTs + 5000000, outTimestamp: baseTs + 8600000 }
    ]);
    assert.equal(validRes.valid, true);
    assert.equal(validRes.value.length, 2);

    // 2. Incomplete session (missing outTimestamp)
    const incompleteRes = validatePunchSessions([{ inTimestamp: baseTs }]);
    assert.equal(incompleteRes.valid, false);
    assert.match(incompleteRes.error, /both inTimestamp and outTimestamp are required/i);

    // 3. outTimestamp <= inTimestamp
    const invertedRes = validatePunchSessions([{ inTimestamp: baseTs, outTimestamp: baseTs - 1000 }]);
    assert.equal(invertedRes.valid, false);
    assert.match(invertedRes.error, /outTimestamp must be greater than inTimestamp/i);

    // 4. Overlapping sessions
    const overlapRes = validatePunchSessions([
      { inTimestamp: baseTs, outTimestamp: baseTs + 3600000 },
      { inTimestamp: baseTs + 1800000, outTimestamp: baseTs + 5400000 } // starts before session 1 ends
    ]);
    assert.equal(overlapRes.valid, false);
    assert.match(overlapRes.error, /overlaps with previous session/i);

    // 5. Inconsistent durationSeconds
    const durMismatch = validatePunchSessions([
      { inTimestamp: baseTs, outTimestamp: baseTs + 3600000, durationSeconds: 7200 }
    ]);
    assert.equal(durMismatch.valid, false);
    assert.match(durMismatch.error, /durationSeconds.*does not match timestamp interval/i);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MANDATORY AUDIT INTEGRITY & ROLLBACK TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  test('markAttendance: adjustment audit failure returns 500 and does NOT commit attendance modification', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', name: 'Admin', role: 'admin', isAdmin: true };

    let updateCalled = false;
    Attendance.findOneAndUpdate = async () => {
      updateCalled = true;
      return {};
    };

    // Simulate audit collection write failure
    AttendanceAudit.create = async () => {
      throw new Error('Audit collection disk full or write locked');
    };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        isManualAdjustment: true,
        auditNote: 'Adjusting shift duration',
        workSeconds: 28800
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 500, 'Must return 500 when audit creation fails');
    assert.match(res.body.message, /Failed to record mandatory audit trail/i);
    assert.equal(updateCalled, false, 'Attendance record MUST NOT be modified when audit creation fails');
  });

  test('markAttendance: rolls back audit record if attendance update throws an error', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', name: 'Admin', role: 'admin', isAdmin: true };

    let auditDeletedId = null;
    AttendanceAudit.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439099') });
    AttendanceAudit.findByIdAndDelete = async (id) => {
      auditDeletedId = id;
      return true;
    };

    // Simulate Attendance write collision
    Attendance.findOneAndUpdate = async () => {
      throw new Error('Attendance document locked by concurrent write');
    };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        isManualAdjustment: true,
        auditNote: 'Adjusting shift duration',
        workSeconds: 28800
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Audit trail rolled back/i);
    assert.ok(auditDeletedId, 'Audit record must be rolled back/deleted when attendance update throws');
  });

  test('markAttendance: idempotent retry with same idempotencyKey does not duplicate audit record', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', name: 'Admin', role: 'admin', isAdmin: true };
    const idempotencyKey = 'idemp_key_admin_adj_12345';

    let auditsCreatedCount = 0;
    AttendanceAudit.create = async (doc) => {
      auditsCreatedCount++;
      return { ...doc, _id: new mongoose.Types.ObjectId() };
    };

    // First request: no existing audit
    AttendanceAudit.findOne = async () => null;
    Attendance.findOneAndUpdate = async (q, update) => ({ ...update, _id: new mongoose.Types.ObjectId() });

    const req1 = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        isManualAdjustment: true,
        auditNote: 'Initial adjustment',
        idempotencyKey
      }
    };
    const res1 = createMockRes();
    await markAttendance(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(auditsCreatedCount, 1, 'First request creates audit');

    // Second request (retry): existing audit is found
    AttendanceAudit.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      idempotencyKey,
      action: 'Admin Shift Hour Adjustment'
    });

    const req2 = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        isManualAdjustment: true,
        auditNote: 'Initial adjustment',
        idempotencyKey
      }
    };
    const res2 = createMockRes();
    await markAttendance(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(auditsCreatedCount, 1, 'Retry with same idempotencyKey MUST NOT create a duplicate audit entry');
  });

  test('forceClockOut: audit failure returns 500 and does NOT save attendance clock-out', async () => {
    const adminUser = {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
      name: 'Admin',
      role: 'admin',
      isAdmin: true
    };
    const targetId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

    Employee.findById = async () => ({
      _id: targetId,
      name: 'Target Employee',
      employeeCode: 'EMP-TGT',
      role: 'Team Member'
    });

    let saveCalled = false;
    Attendance.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      isClockedIn: true,
      save: async () => { saveCalled = true; }
    });

    // Simulate audit failure
    AttendanceAudit.create = async () => {
      throw new Error('Audit collection unavailable');
    };
    AttendanceAudit.prototype.save = async function() {
      throw new Error('Audit save failed');
    };

    const req = {
      user: adminUser,
      body: { employeeId: targetId.toString(), auditNote: 'Admin emergency out' }
    };
    const res = createMockRes();

    await forceClockOut(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Failed to create audit log for force clock-out/i);
    assert.equal(saveCalled, false, 'Attendance record MUST NOT be saved as clocked out if audit creation failed');
  });

  test('bulkMarkAttendance: creates traceable admin_bulk_attendance audit record', async () => {
    const adminUser = { _id: 'adm_1', name: 'Admin User', role: 'admin', isAdmin: true };

    let createdAudit = null;
    AttendanceAudit.create = async (doc) => {
      createdAudit = doc;
      return { ...doc, _id: new mongoose.Types.ObjectId() };
    };
    Attendance.bulkWrite = async (ops) => ({ modifiedCount: ops.length, upsertedCount: 0 });

    const req = {
      user: adminUser,
      body: {
        records: [
          { employee: 'emp_1', date: '2026-11-16', status: 'present', workSeconds: 28800 },
          { employee: 'emp_2', date: '2026-11-16', status: 'present', workSeconds: 28800 }
        ],
        auditNote: 'End of month team sync'
      }
    };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(createdAudit, 'Bulk attendance operation must persist an audit record');
    assert.equal(createdAudit.type, 'admin_bulk_attendance');
    assert.equal(createdAudit.actor, 'admin');
    assert.equal(createdAudit.actorId, 'adm_1');
    assert.equal(createdAudit.auditNote, 'End of month team sync');
    assert.match(createdAudit.details, /updated 2 attendance records in bulk/i);
  });

  test('bulkMarkAttendance: halts with 500 if audit creation fails', async () => {
    const adminUser = { _id: 'adm_1', name: 'Admin User', role: 'admin', isAdmin: true };

    let bulkWriteCalled = false;
    Attendance.bulkWrite = async () => {
      bulkWriteCalled = true;
      return {};
    };

    // Simulate audit failure
    AttendanceAudit.create = async () => {
      throw new Error('Audit database unreachable');
    };

    const req = {
      user: adminUser,
      body: {
        records: [
          { employee: 'emp_1', date: '2026-11-16', status: 'present' }
        ],
        auditNote: 'Test bulk'
      }
    };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Failed to create audit log for bulk attendance update/i);
    assert.equal(bulkWriteCalled, false, 'bulkWrite must not proceed if audit creation fails');
  });

  test('deleteAttendanceRecord: rolls back audit record if deletion throws', async () => {
    const adminUser = { _id: 'adm_1', name: 'Admin User', role: 'admin', isAdmin: true };
    const validId = '507f1f77bcf86cd799439011';

    Attendance.findById = async () => ({
      _id: validId,
      employee: 'emp_001',
      employeeCode: 'EMP-001',
      employeeName: 'Test Employee',
      date: '2026-11-16'
    });

    let auditDeletedId = null;
    AttendanceAudit.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439088') });
    AttendanceAudit.findByIdAndDelete = async (id) => {
      auditDeletedId = id;
      return true;
    };

    // Simulate deletion throwing an error
    Attendance.findByIdAndDelete = async () => {
      throw new Error('Database connection reset during delete');
    };

    const req = {
      user: adminUser,
      params: { id: validId },
      body: { reason: 'Duplicate entry cleanup' }
    };
    const res = createMockRes();

    await deleteAttendanceRecord(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Audit record rolled back/i);
    assert.ok(auditDeletedId, 'Audit must be deleted so it does not falsely claim deletion succeeded');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. STRICT NUMERIC & TIMESTAMP VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  test('markAttendance: rejects non-numeric string workSeconds ("abc") with 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test validation',
        workSeconds: 'abc'
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /workSeconds must be a valid positive numeric value/i);
  });

  test('markAttendance: rejects breakSeconds: Infinity with 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test validation',
        breakSeconds: Infinity
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /breakSeconds must be a valid finite number/i);
  });

  test('markAttendance: rejects negative durations with 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test validation',
        workSeconds: -100
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /workSeconds must be a valid finite number between 0 and 86400/i);
  });

  test('markAttendance: rejects combined workSeconds and breakSeconds exceeding 24h limit', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test validation',
        workSeconds: 50000,
        breakSeconds: 40000 // Total = 90,000s > 86,400s
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Combined workSeconds and breakSeconds.*exceeds 24-hour limit/i);
  });

  test('markAttendance: rejects incomplete punch sessions with 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test punch sessions',
        punchSessions: [
          { inTimestamp: 1700000000000 } // Missing outTimestamp!
        ]
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Punch session 1 is incomplete: both inTimestamp and outTimestamp are required/i);
  });

  test('bulkMarkAttendance: strictly validates each record and rejects invalid numeric values with 400', async () => {
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        records: [
          { employee: 'emp_1', date: '2026-11-16', status: 'present', workSeconds: 'not_a_number' }
        ],
        auditNote: 'Bulk update'
      }
    };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /records\[0\]\.workSeconds must be a valid positive numeric value/i);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. AUTHORIZATION, OVERTIME & STATE TRANSITION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  test('checkIsPrivileged correctly distinguishes administrative authority', () => {
    assert.equal(checkIsPrivileged({ isAdmin: true }), true);
    assert.equal(checkIsPrivileged({ role: 'admin' }), true);
    assert.equal(checkIsPrivileged({ role: 'hr' }), true);
    assert.equal(checkIsPrivileged({ permissions: { allAccess: true } }), true);
    assert.equal(checkIsPrivileged({ permissions: { editAttendance: true } }, 'editAttendance'), true);

    assert.equal(checkIsPrivileged({ role: 'Team Member', isAdmin: false }), false);
    assert.equal(checkIsPrivileged(null), false);
  });

  test('bulkMarkAttendance rejects non-privileged employee with 403 Forbidden', async () => {
    const regularUser = { _id: 'emp_001', role: 'Team Member', isAdmin: false };
    const req = { user: regularUser, body: { records: [{ employee: 'emp_2', date: '2026-11-16' }] } };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 403);
  });

  test('deleteAttendanceRecord rejects non-privileged employee with 403 Forbidden', async () => {
    const regularUser = { _id: 'emp_001', role: 'Team Member', isAdmin: false };
    const req = { user: regularUser, params: { id: '507f1f77bcf86cd799439011' }, body: { reason: 'Clean' } };
    const res = createMockRes();

    await deleteAttendanceRecord(req, res);
    assert.equal(res.statusCode, 403);
  });

  test('updateOvertimeStatus prevents employee from approving their own overtime', async () => {
    const hrUser = { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'hr' };

    Attendance.findById = async () => ({
      _id: 'att_rec_1',
      employee: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      employeeCode: 'EMP-001',
      overtimeStatus: 'pending'
    });

    const req = { user: hrUser, params: { id: 'att_rec_1' }, body: { status: 'approved' } };
    const res = createMockRes();

    await updateOvertimeStatus(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /cannot approve or reject your own overtime/i);
  });

  test('markAttendance: repeated break-start while on break returns 400', async () => {
    const today = getTodayStr();
    Attendance.findOne = async () => ({
      isClockedIn: true,
      isOnBreak: true,
      breakType: 'Tea',
      breakStartTimestamp: Date.now() - 300000,
      punchSessions: []
    });

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'Team Member' },
      body: { employee: 'EMP-001', date: today, status: 'present', action: 'break_start' }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /already on an active break/i);
  });

  test('markAttendance: break-end without active break returns 400', async () => {
    const today = getTodayStr();
    Attendance.findOne = async () => ({
      isClockedIn: true,
      isOnBreak: false,
      punchSessions: []
    });

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'Team Member' },
      body: { employee: 'EMP-001', date: today, status: 'present', action: 'break_end' }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /no active break found to end/i);
  });

  test('markAttendance: failed timer pause aborts clock-out and returns 500 without updating attendance', async () => {
    const today = getTodayStr();
    Attendance.findOne = async () => ({
      isClockedIn: true,
      clockInTime: '10:00 AM',
      clockInTimestamp: Date.now() - 3600000,
      punchSessions: []
    });

    let updateCalled = false;
    Attendance.findOneAndUpdate = async () => {
      updateCalled = true;
      return {};
    };

    timeEngineService.pauseTimer = async () => {
      throw new Error('Database write collision (OCC retry limit)');
    };

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'Team Member' },
      body: { employee: 'EMP-001', date: today, status: 'present', action: 'clock_out' }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Failed to pause active task timer during clock-out/i);
    assert.equal(updateCalled, false);
  });
});
