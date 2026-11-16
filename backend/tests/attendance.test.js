/**
 * @file attendance.test.js
 * @description Automated Integration Tests for Attendance API Authorization,
 * Server-Authoritative Timestamps, State Transitions, Failure Recovery & Audit Trails.
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
  forceClockOut
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

describe('Attendance API Authorization & Scoping Suite', () => {
  // Stubs storage
  let origFindOneAttendance;
  let origFindOneAndUpdateAttendance;
  let origFindByIdAndDeleteAttendance;
  let origFindByIdAttendance;
  let origCreateAudit;
  let origFindOneEmployee;
  let origFindByIdEmployee;
  let origFindOneCompanySettings;
  let origPauseTimer;

  beforeEach(() => {
    origFindOneAttendance = Attendance.findOne;
    origFindOneAndUpdateAttendance = Attendance.findOneAndUpdate;
    origFindByIdAndDeleteAttendance = Attendance.findByIdAndDelete;
    origFindByIdAttendance = Attendance.findById;
    origCreateAudit = AttendanceAudit.create;
    origFindOneEmployee = Employee.findOne;
    origFindByIdEmployee = Employee.findById;
    origFindOneCompanySettings = CompanySettings.findOne;
    origPauseTimer = timeEngineService.pauseTimer;

    // Default safe stubs for un-connected MongoDB environment
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
    AttendanceAudit.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId() });
  });

  afterEach(() => {
    Attendance.findOne = origFindOneAttendance;
    Attendance.findOneAndUpdate = origFindOneAndUpdateAttendance;
    Attendance.findByIdAndDelete = origFindByIdAndDeleteAttendance;
    Attendance.findById = origFindByIdAttendance;
    AttendanceAudit.create = origCreateAudit;
    Employee.findOne = origFindOneEmployee;
    Employee.findById = origFindByIdEmployee;
    CompanySettings.findOne = origFindOneCompanySettings;
    timeEngineService.pauseTimer = origPauseTimer;
  });

  // ── 1. checkIsPrivileged ──
  test('checkIsPrivileged correctly distinguishes administrative authority', () => {
    assert.equal(checkIsPrivileged({ isAdmin: true }), true, 'Super/Admin is privileged');
    assert.equal(checkIsPrivileged({ role: 'admin' }), true, 'Admin role is privileged');
    assert.equal(checkIsPrivileged({ role: 'hr' }), true, 'HR role is privileged');
    assert.equal(checkIsPrivileged({ systemRole: 'hr' }), true, 'System HR is privileged');
    assert.equal(checkIsPrivileged({ permissions: { allAccess: true } }), true, 'allAccess permission is privileged');
    assert.equal(checkIsPrivileged({ permissions: { editAttendance: true } }, 'editAttendance'), true, 'editAttendance permission is privileged');

    // Non-privileged cases
    assert.equal(checkIsPrivileged({ role: 'Team Member', systemRole: 'team_member', isAdmin: false }), false, 'Team Member is not privileged');
    assert.equal(checkIsPrivileged({ role: 'Developer', permissions: {} }), false, 'Developer without permissions is not privileged');
    assert.equal(checkIsPrivileged(null), false, 'Null user is not privileged');
  });

  // ── 2. bulkMarkAttendance ──
  test('bulkMarkAttendance rejects non-privileged employee with 403 Forbidden', async () => {
    const regularUser = {
      _id: 'emp_001',
      employeeCode: 'EMP-001',
      role: 'Team Member',
      systemRole: 'team_member',
      isAdmin: false
    };

    const req = {
      user: regularUser,
      body: {
        records: [
          { employee: 'emp_002', date: '2026-11-16', status: 'present' }
        ]
      }
    };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 403, 'Must return 403 Forbidden');
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /administrative attendance permission required/i);
  });

  test('bulkMarkAttendance rejects privileged user if records array is empty or missing required fields', async () => {
    const adminUser = {
      _id: 'adm_001',
      employeeCode: 'ADM-001',
      role: 'admin',
      isAdmin: true
    };

    const reqEmpty = { user: adminUser, body: { records: [] } };
    const resEmpty = createMockRes();
    await bulkMarkAttendance(reqEmpty, resEmpty);
    assert.equal(resEmpty.statusCode, 400);

    const reqMissingFields = {
      user: adminUser,
      body: { records: [{ employee: 'emp_1' }] } // missing date and status
    };
    const resMissing = createMockRes();
    await bulkMarkAttendance(reqMissingFields, resMissing);
    assert.equal(resMissing.statusCode, 400);
  });

  test('bulkMarkAttendance strips protected internal fields and only sets allowlisted attributes', async () => {
    const adminUser = {
      _id: 'adm_001',
      name: 'Admin User',
      role: 'admin',
      isAdmin: true
    };

    let bulkOpsCaptured = null;
    Attendance.bulkWrite = async (ops) => {
      bulkOpsCaptured = ops;
      return { modifiedCount: 1, upsertedCount: 0 };
    };

    const req = {
      user: adminUser,
      body: {
        records: [
          {
            employee: '507f1f77bcf86cd799439011',
            date: '2026-11-16',
            status: 'present',
            workSeconds: 28800,
            notes: 'Approved bulk update',
            // Injected unauthorized / internal fields that MUST be stripped:
            _id: 'malicious_id_injection',
            isAdminOverride: true,
            actor: 'spoofed_admin',
            actorId: 'spoofed_id',
            password: 'leaked_password',
            tokenVersion: 999
          }
        ]
      }
    };
    const res = createMockRes();

    await bulkMarkAttendance(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(bulkOpsCaptured && bulkOpsCaptured.length === 1);

    const setFields = bulkOpsCaptured[0].updateOne.update.$set;
    assert.equal(setFields.status, 'present');
    assert.equal(setFields.workSeconds, 28800);
    assert.equal(setFields.notes, 'Approved bulk update');

    // Verify protected internal fields were stripped
    assert.equal(setFields._id, undefined, 'Must strip _id from bulk $set');
    assert.equal(setFields.isAdminOverride, undefined, 'Must strip isAdminOverride');
    assert.equal(setFields.actor, undefined, 'Must strip actor');
    assert.equal(setFields.actorId, undefined, 'Must strip actorId');
    assert.equal(setFields.password, undefined, 'Must strip password');
    assert.equal(setFields.tokenVersion, undefined, 'Must strip tokenVersion');
  });

  // ── 3. deleteAttendanceRecord ──
  test('deleteAttendanceRecord rejects non-privileged employee with 403 Forbidden', async () => {
    const regularUser = {
      _id: 'emp_001',
      employeeCode: 'EMP-001',
      role: 'Team Member',
      systemRole: 'team_member',
      isAdmin: false
    };

    const req = { user: regularUser, params: { id: 'att_record_123' }, body: {} };
    const res = createMockRes();

    await deleteAttendanceRecord(req, res);
    assert.equal(res.statusCode, 403, 'Must reject deletion by ordinary employee with 403');
    assert.equal(res.body.success, false);
  });

  test('deleteAttendanceRecord requires an audit reason', async () => {
    const adminUser = {
      _id: 'adm_001',
      name: 'Admin User',
      role: 'admin',
      isAdmin: true
    };

    const req = {
      user: adminUser,
      params: { id: '507f1f77bcf86cd799439011' },
      body: { reason: '   ' } // empty reason
    };
    const res = createMockRes();

    await deleteAttendanceRecord(req, res);
    assert.equal(res.statusCode, 400, 'Must require audit reason for attendance deletion');
    assert.match(res.body.message, /audit reason.*required/i);
  });

  test('deleteAttendanceRecord halts and does not delete if audit logging fails', async () => {
    const adminUser = {
      _id: 'adm_001',
      name: 'Admin User',
      role: 'admin',
      isAdmin: true
    };

    const validId = '507f1f77bcf86cd799439011';
    Attendance.findById = async () => ({
      _id: validId,
      employee: 'emp_001',
      employeeCode: 'EMP-001',
      employeeName: 'Test Employee',
      date: '2026-11-16',
      totalWorkingHours: 8
    });

    let deleteCalled = false;
    Attendance.findByIdAndDelete = async () => {
      deleteCalled = true;
      return true;
    };

    // Simulate audit store throwing an error
    AttendanceAudit.create = async () => {
      throw new Error('Audit collection write locked');
    };

    const req = {
      user: adminUser,
      params: { id: validId },
      body: { reason: 'Duplicate entry cleanup' }
    };
    const res = createMockRes();

    await deleteAttendanceRecord(req, res);
    assert.equal(res.statusCode, 500, 'Must fail with 500 when audit creation throws');
    assert.equal(deleteCalled, false, 'Must NOT delete attendance record if audit log creation failed');
  });

  // ── 4. Overtime Governance ──
  test('updateOvertimeStatus rejects non-privileged employee with 403 Forbidden', async () => {
    const regularUser = {
      _id: 'emp_001',
      employeeCode: 'EMP-001',
      role: 'Team Member',
      systemRole: 'team_member',
      isAdmin: false
    };

    const req = {
      user: regularUser,
      params: { id: 'att_rec_1' },
      body: { status: 'approved' }
    };
    const res = createMockRes();

    await updateOvertimeStatus(req, res);
    assert.equal(res.statusCode, 403, 'Non-privileged user cannot update overtime status');
  });

  test('updateOvertimeStatus prevents employee from approving their own overtime', async () => {
    const hrUser = {
      _id: '507f1f77bcf86cd799439011',
      employeeCode: 'EMP-001',
      role: 'hr',
      isAdmin: false
    };

    Attendance.findById = async () => ({
      _id: 'att_rec_1',
      employee: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      employeeCode: 'EMP-001',
      overtimeStatus: 'pending'
    });

    const req = {
      user: hrUser,
      params: { id: 'att_rec_1' },
      body: { status: 'approved' }
    };
    const res = createMockRes();

    await updateOvertimeStatus(req, res);
    assert.equal(res.statusCode, 403, 'Approver cannot approve their own overtime');
    assert.match(res.body.message, /cannot approve or reject your own overtime/i);
  });

  test('updateOvertimeStatus validates status allowed values (approved, rejected)', async () => {
    const adminUser = {
      _id: 'adm_001',
      role: 'admin',
      isAdmin: true
    };

    const req = {
      user: adminUser,
      params: { id: 'att_rec_1' },
      body: { status: 'arbitrary_status' }
    };
    const res = createMockRes();

    await updateOvertimeStatus(req, res);
    assert.equal(res.statusCode, 400, 'Must reject invalid overtime status');
    assert.match(res.body.message, /Allowed values: approved, rejected/i);
  });

  // ── 5. createAuditLog ──
  test('createAuditLog forbids non-privileged employee from writing audit logs against other employees', async () => {
    const regularUser = {
      _id: 'emp_001',
      employeeCode: 'EMP-001',
      name: 'John Doe',
      role: 'Team Member',
      isAdmin: false
    };

    const req = {
      user: regularUser,
      body: {
        employeeId: 'emp_victim_999',
        action: 'Malicious Fake Clock Out',
        isAdminOverride: true
      }
    };
    const res = createMockRes();

    await createAuditLog(req, res);
    assert.equal(res.statusCode, 403, 'Must forbid ordinary employee from creating audit records for other employees');
    assert.equal(res.body.success, false);
  });

  // ── 6. markAttendance Validations & State Transitions ──
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
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        action: 'break_start'
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
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
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        action: 'break_end'
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /no active break found to end/i);
  });

  test('markAttendance: ordinary employee cannot inject activeTask directly', async () => {
    const today = getTodayStr();
    Attendance.findOne = async () => null;

    let capturedUpdate = null;
    Attendance.findOneAndUpdate = async (q, update) => {
      capturedUpdate = update;
      return { ...update, _id: new mongoose.Types.ObjectId() };
    };

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'Team Member' },
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        activeTask: { taskId: 'bad_task', title: 'Malicious Injected Task' }
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(capturedUpdate.activeTask, undefined, 'Ordinary employee activeTask must be ignored');
  });

  test('markAttendance: ordinary employee cannot mark attendance for another employee', async () => {
    const today = getTodayStr();
    Attendance.findOne = async () => null;

    let capturedQuery = null;
    Attendance.findOneAndUpdate = async (q, update) => {
      capturedQuery = q;
      return { ...update, _id: new mongoose.Types.ObjectId() };
    };

    const requestingUserId = '507f1f77bcf86cd799439011';
    const req = {
      user: { _id: requestingUserId, employeeCode: 'EMP-MY-CODE', role: 'Team Member' },
      body: {
        employee: 'victim_employee_999',
        date: today,
        status: 'present'
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 200);
    // Ensure targetEmpId was locked to requesting user
    assert.equal(String(capturedQuery.$or[0].employee), requestingUserId);
    assert.equal(capturedQuery.$or[1].employeeCode, 'EMP-MY-CODE');
  });

  test('markAttendance: admin adjustment requires audit reason', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    const req = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        isManualAdjustment: true,
        workSeconds: 36000
        // missing auditNote / notes
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Audit reason.*required/i);
  });

  test('markAttendance: invalid administrative timestamps return 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    // 1. clockOutTimestamp <= clockInTimestamp
    const req1 = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test adjustment',
        clockInTimestamp: 1700000000000,
        clockOutTimestamp: 1699999999000
      }
    };
    const res1 = createMockRes();
    await markAttendance(req1, res1);
    assert.equal(res1.statusCode, 400);
    assert.match(res1.body.message, /clockOutTimestamp must be strictly greater than clockInTimestamp/i);

    // 2. Future timestamp
    const req2 = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Test adjustment',
        clockInTimestamp: Date.now() + 5000000
      }
    };
    const res2 = createMockRes();
    await markAttendance(req2, res2);
    assert.equal(res2.statusCode, 400);
    assert.match(res2.body.message, /clockInTimestamp cannot be in the future/i);
  });

  test('markAttendance: invalid or overlapping punch sessions return 400', async () => {
    const today = getTodayStr();
    const adminUser = { _id: 'adm_1', role: 'admin', isAdmin: true };

    // Punch session where outTimestamp <= inTimestamp
    const reqInvalid = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Fixing punches',
        punchSessions: [
          { inTimestamp: 1700000000000, outTimestamp: 1699999900000 }
        ]
      }
    };
    const resInvalid = createMockRes();
    await markAttendance(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 400);
    assert.match(resInvalid.body.message, /outTimestamp must be greater than inTimestamp/i);

    // Overlapping punch sessions
    const reqOverlap = {
      user: adminUser,
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        auditNote: 'Fixing punches',
        punchSessions: [
          { inTimestamp: 1700000000000, outTimestamp: 1700010000000 },
          { inTimestamp: 1700005000000, outTimestamp: 1700015000000 } // starts before session 1 ends
        ]
      }
    };
    const resOverlap = createMockRes();
    await markAttendance(reqOverlap, resOverlap);
    assert.equal(resOverlap.statusCode, 400);
    assert.match(resOverlap.body.message, /overlaps with previous session/i);
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

    // Simulate timer pause failure
    timeEngineService.pauseTimer = async () => {
      throw new Error('Database write collision (OCC retry limit)');
    };

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', employeeCode: 'EMP-001', role: 'Team Member' },
      body: {
        employee: 'EMP-001',
        date: today,
        status: 'present',
        action: 'clock_out'
      }
    };
    const res = createMockRes();

    await markAttendance(req, res);
    assert.equal(res.statusCode, 500, 'Must return 500 when timer pause fails');
    assert.match(res.body.message, /Failed to pause active task timer during clock-out/i);
    assert.equal(updateCalled, false, 'Attendance record must NOT be updated if timer pause threw an error');
  });

  // ── 7. forceClockOut ──
  test('forceClockOut: non-privileged user rejected with 403', async () => {
    const regularUser = { _id: 'emp_001', role: 'Team Member', isAdmin: false };
    const req = { user: regularUser, body: { employeeId: 'emp_002' } };
    const res = createMockRes();

    await forceClockOut(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Administrator or HR access required/i);
  });

  test('forceClockOut: aborts with 500 if timer pause throws an error', async () => {
    const adminUser = { _id: 'adm_1', name: 'Admin', role: 'admin', isAdmin: true };
    const targetId = new mongoose.Types.ObjectId();

    Employee.findById = async () => ({
      _id: targetId,
      name: 'Target Employee',
      employeeCode: 'EMP-TGT',
      role: 'Team Member'
    });

    // Simulate timer pause failure
    timeEngineService.pauseTimer = async () => {
      throw new Error('Active timer transaction failed');
    };

    const req = {
      user: adminUser,
      body: { employeeId: targetId.toString(), auditNote: 'Admin emergency out' }
    };
    const res = createMockRes();

    await forceClockOut(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Failed to pause active task timer during force clock-out/i);
  });
});
