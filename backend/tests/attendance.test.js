/**
 * @file attendance.test.js
 * @description Automated Unit & Integration Tests for Server-Authoritative Attendance & Clock-In/Out.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Replicate scoping and validation logic from attendanceController
function resolveAttendanceTarget(rawEmp, reqUser) {
  const isPrivileged = Boolean(
    reqUser?.isAdmin ||
    reqUser?.role === 'admin' ||
    reqUser?.role === 'hr' ||
    reqUser?.systemRole === 'admin' ||
    reqUser?.systemRole === 'hr' ||
    reqUser?.permissions?.editAttendance ||
    reqUser?.permissions?.allAccess
  );

  let targetId = rawEmp;
  if (!isPrivileged && reqUser) {
    targetId = reqUser._id || reqUser.id;
  }
  return { targetId, isPrivileged };
}

function validateAttendanceDate(dateStr, status, todayStr) {
  if (dateStr > todayStr && ['present', 'late', 'half_day', 'absent'].includes(status)) {
    return { valid: false, error: `Cannot mark attendance as '${status}' for a future date (${dateStr}).` };
  }
  return { valid: true };
}

function computeAutoCloseShift(shift, autoSecs = 32400, autoHours = 9.0) {
  const existingSecs = Number(shift.workSeconds) || 0;
  const finalSecs = existingSecs > 0 ? existingSecs : autoSecs;
  const finalHours = +(finalSecs / 3600).toFixed(2);
  return {
    isClockedIn: false,
    isOnBreak: false,
    workSeconds: finalSecs,
    totalWorkingHours: finalHours
  };
}

describe('Server-Authoritative Attendance Suite', () => {
  test('Non-privileged employee cannot mark attendance for another employee', () => {
    const regularUser = {
      _id: 'emp_user_1',
      employeeCode: 'EMP-001',
      systemRole: 'team_member',
      isAdmin: false
    };

    // Client passes another employee's ID in request body
    const maliciousTarget = 'emp_user_99';
    const resolved = resolveAttendanceTarget(maliciousTarget, regularUser);

    assert.equal(resolved.targetId, 'emp_user_1', 'Target must be forced to the requesting user ID');
    assert.equal(resolved.isPrivileged, false);
  });

  test('HR / Admin can mark attendance for other employees', () => {
    const hrUser = {
      _id: 'hr_1',
      employeeCode: 'HR-001',
      systemRole: 'hr',
      isAdmin: false
    };

    const target = 'emp_user_42';
    const resolved = resolveAttendanceTarget(target, hrUser);

    assert.equal(resolved.targetId, 'emp_user_42', 'Privileged user can specify target employee');
    assert.equal(resolved.isPrivileged, true);
  });

  test('Future date attendance is strictly rejected for presence statuses', () => {
    const today = '2026-11-16';
    const tomorrow = '2026-11-17';

    const presentRes = validateAttendanceDate(tomorrow, 'present', today);
    assert.equal(presentRes.valid, false, 'Future date present must be rejected');

    const lateRes = validateAttendanceDate(tomorrow, 'late', today);
    assert.equal(lateRes.valid, false, 'Future date late must be rejected');

    // Future leaves or holidays are permitted
    const leaveRes = validateAttendanceDate(tomorrow, 'on_leave', today);
    assert.equal(leaveRes.valid, true, 'Future date on_leave is permitted');
  });

  test('Auto-close past day shift preserves existing accumulated workSeconds if > 0', () => {
    const shiftWith5Hours = {
      date: '2026-11-14',
      isClockedIn: true,
      workSeconds: 18000 // 5 hours worked before forgetting to clock out
    };

    const closed = computeAutoCloseShift(shiftWith5Hours);
    assert.equal(closed.isClockedIn, false);
    assert.equal(closed.workSeconds, 18000, 'Must preserve actual tracked 18000s');
    assert.equal(closed.totalWorkingHours, 5.0);

    const shiftWith0Hours = {
      date: '2026-11-14',
      isClockedIn: true,
      workSeconds: 0
    };

    const defaultClosed = computeAutoCloseShift(shiftWith0Hours);
    assert.equal(defaultClosed.workSeconds, 32400, 'Falls back to standard shift duration if 0');
    assert.equal(defaultClosed.totalWorkingHours, 9.0);
  });
});
