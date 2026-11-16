/**
 * @file attendance.test.js
 * @description Automated Integration Tests for Attendance API Authorization,
 * Server-Authoritative Timestamps, Overtime Governance & Audit Trail Derivation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  checkIsPrivileged,
  bulkMarkAttendance,
  deleteAttendanceRecord,
  getOvertimeRequests,
  requestOvertime,
  updateOvertimeStatus,
  createAuditLog
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

describe('Attendance API Authorization & Scoping Suite', () => {
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
      body: { records: [{ employee: 'emp_1' }] } // missing date
    };
    const resMissing = createMockRes();
    await bulkMarkAttendance(reqMissingFields, resMissing);
    assert.equal(resMissing.statusCode, 400);
  });

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
});
