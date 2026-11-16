const mongoose = require('mongoose');
const crypto = require('crypto');
const Attendance = require('../models/Attendance');
const AttendanceAudit = require('../models/AttendanceAudit');
const Task = require('../../work/models/Task');
const asyncHandler = require('../../../shared/middleware/asyncHandler');
const {
  isTransactionSupported,
  executeTransaction
} = require('../../../shared/utils/transactionHelper');

/**
 * Deterministically canonicalizes an object or value by sorting keys recursively.
 */
function canonicalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalizeValue);
  const sortedKeys = Object.keys(val).sort();
  const res = {};
  for (const k of sortedKeys) {
    res[k] = canonicalizeValue(val[k]);
  }
  return res;
}

/**
 * Generates a deterministic SHA-256 request fingerprint scoped to actor, operation, and payload.
 * Used for strict idempotency isolation (Section 2).
 */
function computeAuditFingerprint({ actorId, type, targetEmpId, targetEmpCode, date, action, payload }) {
  const canonical = {
    actorId: String(actorId || ''),
    type: String(type || ''),
    targetEmpId: String(targetEmpId || ''),
    targetEmpCode: String(targetEmpCode || '').toUpperCase(),
    date: String(date || ''),
    action: String(action || ''),
    payload: canonicalizeValue(payload || {})
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

// Universal helper to get local date string YYYY-MM-DD for IST business operations
const getLocalTodayStr = (d = new Date()) => {
  const dateObj = typeof d === 'number' || typeof d === 'string' ? new Date(d) : d;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(dateObj);
  } catch (_) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

// Authorization helper to check administrative attendance permissions
const checkIsPrivileged = (user, requiredPermission = 'editAttendance') => {
  if (!user) return false;
  if (user.isAdmin || user.isSuperAdmin) return true;
  if (user.role === 'admin' || user.role === 'hr') return true;
  if (user.systemRole === 'admin' || user.systemRole === 'hr') return true;
  if (user.permissions?.allAccess) return true;
  if (requiredPermission && user.permissions?.[requiredPermission]) return true;
  return false;
};

// ── Strict Numeric, Timestamp & Interval Validation Helpers ──────────────────
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes max clock skew allowance
const MAX_DAY_SECONDS = 86400; // 24 hours in a single business day
const MIN_ALLOWED_TIMESTAMP_MS = new Date('2020-01-01T00:00:00Z').getTime();

/**
 * Strictly parses and validates a duration in seconds (0 to maxAllowed).
 * Rejects non-numeric strings ("abc"), NaN, Infinity, negative numbers, and out-of-range values.
 * @param {any} val
 * @param {string} fieldName
 * @param {number} maxAllowed
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
function validateStrictDurationSeconds(val, fieldName, maxAllowed = MAX_DAY_SECONDS) {
  if (val === undefined || val === null) return { valid: true, value: undefined };
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val) || val < 0 || val > maxAllowed) {
      return { valid: false, error: `${fieldName} must be a valid finite number between 0 and ${maxAllowed}. Received: ${val}` };
    }
    return { valid: true, value: Math.round(val) };
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      return { valid: false, error: `${fieldName} must be a valid positive numeric value. Received: "${val}"` };
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || num > maxAllowed) {
      return { valid: false, error: `${fieldName} must be between 0 and ${maxAllowed}. Received: ${num}` };
    }
    return { valid: true, value: Math.round(num) };
  }
  return { valid: false, error: `${fieldName} must be a valid numeric duration. Received type: ${typeof val}` };
}

/**
 * Strictly parses and validates an epoch timestamp (ms).
 * Rejects invalid strings ("abc"), NaN, Infinity, negative values, and future timestamps beyond skew.
 * @param {any} val
 * @param {string} fieldName
 * @param {number} maxFutureAllowanceMs
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
function validateStrictTimestamp(val, fieldName, maxFutureAllowanceMs = MAX_CLOCK_SKEW_MS) {
  if (val === undefined || val === null) return { valid: true, value: undefined };
  let num;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val)) {
      return { valid: false, error: `${fieldName} must be a finite numeric timestamp. Received: ${val}` };
    }
    num = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{10,14}$/.test(trimmed)) {
      num = Number(trimmed);
    } else {
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        return { valid: false, error: `${fieldName} is not a valid timestamp format. Received: "${val}"` };
      }
      num = parsed;
    }
  } else if (val instanceof Date) {
    num = val.getTime();
    if (Number.isNaN(num)) {
      return { valid: false, error: `${fieldName} is an invalid Date object.` };
    }
  } else {
    return { valid: false, error: `${fieldName} must be a timestamp number or date string. Received type: ${typeof val}` };
  }

  if (num < MIN_ALLOWED_TIMESTAMP_MS) {
    return { valid: false, error: `${fieldName} (${num}) is before the minimum supported system epoch.` };
  }

  const maxAllowedNow = Date.now() + maxFutureAllowanceMs;
  if (num > maxAllowedNow) {
    return { valid: false, error: `${fieldName} cannot be in the future (timestamp ${num} exceeds server time + 5min allowance).` };
  }

  return { valid: true, value: num };
}

/**
 * Validates punch sessions array:
 * - Every element must be an object
 * - Both inTimestamp and outTimestamp are required
 * - outTimestamp > inTimestamp
 * - No overlapping sessions (sess[i].inTimestamp >= sess[i-1].outTimestamp)
 * @param {any} sessions
 * @returns {{ valid: boolean, value?: Array, error?: string }}
 */
function validatePunchSessions(sessions) {
  if (!sessions) return { valid: true, value: undefined };
  if (!Array.isArray(sessions)) {
    return { valid: false, error: 'punchSessions must be an array.' };
  }

  const validated = [];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s || typeof s !== 'object') {
      return { valid: false, error: `Invalid punch session at index ${i}: session must be an object.` };
    }

    if (s.inTimestamp === undefined || s.inTimestamp === null || s.outTimestamp === undefined || s.outTimestamp === null) {
      return { valid: false, error: `Punch session ${i + 1} is incomplete: both inTimestamp and outTimestamp are required.` };
    }

    const inRes = validateStrictTimestamp(s.inTimestamp, `punchSessions[${i}].inTimestamp`);
    if (!inRes.valid) return inRes;

    const outRes = validateStrictTimestamp(s.outTimestamp, `punchSessions[${i}].outTimestamp`);
    if (!outRes.valid) return outRes;

    const inTs = inRes.value;
    const outTs = outRes.value;

    if (outTs <= inTs) {
      return { valid: false, error: `Invalid punch session ${i + 1}: outTimestamp must be greater than inTimestamp.` };
    }

    const durationSec = Math.floor((outTs - inTs) / 1000);
    if (durationSec > MAX_DAY_SECONDS) {
      return { valid: false, error: `Punch session ${i + 1} duration exceeds maximum 24-hour limit.` };
    }

    if (s.durationSeconds !== undefined && s.durationSeconds !== null) {
      const durRes = validateStrictDurationSeconds(s.durationSeconds, `punchSessions[${i}].durationSeconds`);
      if (!durRes.valid) return durRes;
      if (Math.abs(durRes.value - durationSec) > 5) {
        return { valid: false, error: `Punch session ${i + 1} durationSeconds (${durRes.value}s) does not match timestamp interval (${durationSec}s).` };
      }
    }

    if (i > 0) {
      const prev = validated[i - 1];
      if (inTs < prev.outTimestamp) {
        return { valid: false, error: `Punch session ${i + 1} overlaps with previous session.` };
      }
      if (inTs <= prev.inTimestamp) {
        return { valid: false, error: `Punch session ${i + 1} starts before or at the same time as previous session.` };
      }
    }

    validated.push({
      ...s,
      inTimestamp: inTs,
      outTimestamp: outTs,
      durationSeconds: durationSec,
      durationText: `${Math.floor(durationSec / 3600)}h ${Math.floor((durationSec % 3600) / 60)}m`
    });
  }

  return { valid: true, value: validated };
}

// ⏱️ Auto-close past-day unclosed shifts (runs daily at midnight or upon request)
const autoClosePastDayShifts = async () => {
  try {
    const todayStr = getLocalTodayStr();
    // Only auto-close past day shifts if the shift was initiated more than 16 hours ago!
    // A night shift or midnight clock-in (e.g. 11:30 PM or 00:30 AM) is actively running and must NOT be closed!
    const sixteenHoursAgo = Date.now() - 16 * 60 * 60 * 1000;

    let companySettings = null;
    try {
      const CompanySettings = require('../../settings/models/CompanySettings');
      companySettings = await CompanySettings.findOne().lean();
    } catch (_) {}
    const autoOutTime = companySettings?.shiftEndTime || '07:00 PM';
    const autoHours = Number(companySettings?.standardWorkHours) || 9.0;
    const autoSecs = Math.round(autoHours * 3600);

    const unclosedPastShifts = await Attendance.find({
      date: { $lt: todayStr },
      isClockedIn: true,
      clockOutTime: null,
      $or: [
        { clockInTimestamp: { $lt: sixteenHoursAgo } },
        { clockInTimestamp: null },
        { currentSessionStartTimestamp: { $lt: sixteenHoursAgo } }
      ]
    });

    for (const shift of unclosedPastShifts) {
      const existingSecs = Number(shift.workSeconds) || 0;
      const finalSecs = existingSecs > 0 ? existingSecs : autoSecs;
      const finalHours = +(finalSecs / 3600).toFixed(2);
      await Attendance.updateOne(
        { _id: shift._id },
        {
          $set: {
            isClockedIn: false,
            isOnBreak: false,
            clockOutTime: autoOutTime,
            clockOut: autoOutTime,
            workSeconds: finalSecs,
            totalWorkingHours: finalHours,
            notes: shift.notes ? `${shift.notes} | Auto-closed past shift` : 'Auto-closed past-day shift (daily shift reset)'
          }
        }
      );
    }
  } catch (err) {
    console.warn('[attendanceController] Auto-close past day shifts error:', err.message);
  }
};

// ─── GET /api/attendance ─────────────────────────────────────────────────────
// Query: ?month=9&year=2026&employeeId=...
const getMonthlyAttendance = asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    const start = Date.now();
    while (mongoose.connection.readyState !== 1 && Date.now() - start < 2000) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database connecting, standby', data: [] });
    }
  }

  // Auto-close any unclosed shifts from previous calendar days
  await autoClosePastDayShifts();

  const { month, year, employeeId } = req.query;

  const query = {};
  if (month && year) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    query.date = new RegExp(`^${monthStr}`);
  }

  // Tenant scoping: non-admin can only see own attendance
  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.systemRole === 'admin' || req.user?.permissions?.viewAllAttendance || req.user?.permissions?.allAccess;

  if (!isPrivileged) {
    const myId = req.user?.id || req.user?._id;
    const myCode = req.user?.employeeCode;
    const matchConditions = [];
    if (myId && mongoose.Types.ObjectId.isValid(myId)) matchConditions.push({ employee: myId });
    if (myCode) matchConditions.push({ employeeCode: myCode });
    if (myId) matchConditions.push({ employeeId: String(myId) });

    if (matchConditions.length === 0 && employeeId && employeeId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(employeeId)) matchConditions.push({ employee: employeeId });
      matchConditions.push({ employeeCode: String(employeeId).toUpperCase() });
      matchConditions.push({ employeeId: String(employeeId) });
    }

    if (matchConditions.length > 0) {
      query.$or = matchConditions;
    }
  } else if (employeeId && employeeId !== 'all') {
    const matchConditions = [];
    if (mongoose.Types.ObjectId.isValid(employeeId)) matchConditions.push({ employee: employeeId });
    matchConditions.push({ employeeCode: String(employeeId).toUpperCase() });
    matchConditions.push({ employeeId: String(employeeId) });
    query.$or = matchConditions;
  }

  const records = await Attendance.find(query).sort(month && year ? { date: 1, employee: 1 } : { date: -1, employee: 1 });
  const formattedRecords = records.map(r => {
    const obj = r.toObject ? r.toObject() : { ...r };
    if (!obj.employeeId && obj.employee) {
      obj.employeeId = String(obj.employee);
    }
    return obj;
  });

  res.json({ success: true, count: formattedRecords.length, data: formattedRecords });
});

// ─── GET /api/attendance/summary ──────────────────────────────────────────────
// Returns aggregate counts for a given month/year/employee
const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { month, year, employeeId } = req.query;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const matchStage = { date: new RegExp(`^${monthStr}`) };
  const mongoose = require('mongoose');

  // Tenant scoping: non-admin can only see own attendance summary
  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.systemRole === 'admin' || req.user?.permissions?.viewAllAttendance || req.user?.permissions?.allAccess;
  if (!isPrivileged) {
    const myId = req.user?.id || req.user?._id;
    const myCode = req.user?.employeeCode;
    const matchConditions = [];
    if (myId && mongoose.Types.ObjectId.isValid(myId)) matchConditions.push({ employee: new mongoose.Types.ObjectId(myId) });
    if (myCode) matchConditions.push({ employeeCode: myCode });
    if (myId) matchConditions.push({ employeeId: String(myId) });
    if (matchConditions.length > 0) {
      matchStage.$or = matchConditions;
    }
  } else if (employeeId && employeeId !== 'all') {
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      matchStage.employee = new mongoose.Types.ObjectId(employeeId);
    } else {
      matchStage.employeeCode = String(employeeId).toUpperCase();
    }
  }

  const summary = await Attendance.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const result = {
    present: 0, late: 0, absent: 0,
    half_day: 0, holiday: 0, day_off: 0, on_leave: 0
  };
  summary.forEach(s => {
    if (result[s._id] !== undefined) result[s._id] = s.count;
  });

  res.json({ success: true, data: result });
});

// Helper: Robust AM/PM and 24-hr time parser to seconds
const parseTimeStringToSeconds = (str) => {
  if (!str) return 0;
  const m = String(str).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3] || '0', 10);
  const ampm = (m[4] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 3600 + min * 60 + sec;
};

// ─── POST /api/attendance/mark ────────────────────────────────────────────────
const markAttendance = asyncHandler(async (req, res) => {
  const rawEmp = req.body.employee || req.body.employeeId || req.body.employeeCode;
  const {
    date,
    status,
    clockInTime,
    clockOutTime,
    clockInTimestamp,
    clockOutTimestamp,
    workSeconds,
    breakSeconds,
    isOnBreak,
    breakType,
    breakHistory,
    isClockedIn,
    notes,
    markedBy,
    auditNote,
    isAdminOverride
  } = req.body;

  if (!rawEmp || !date || !status) {
    return res.status(400).json({ success: false, message: 'employee, date, and status are required' });
  }

  const todayStr = getLocalTodayStr();
  const ALLOWED_STATUSES = ['present', 'late', 'half_day', 'absent', 'on_leave', 'holiday', 'day_off'];
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid attendance status '${status}'. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}.`
    });
  }

  // Reject future date attendance for active presence statuses (present, late, half_day, absent).
  // Future dates can only be scheduled for 'on_leave' or 'holiday'.
  if (date > todayStr && ['present', 'late', 'half_day', 'absent'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot mark attendance as '${status}' for a future date (${date}). Attendance can only be recorded for today or past dates.`
    });
  }

  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');

  // Strict Tenant & Date Scoping: Ordinary employees can only record attendance for today
  if (!isPrivileged && date !== todayStr) {
    return res.status(403).json({
      success: false,
      message: `Unauthorized date (${date}). Non-administrative employees can only record attendance punches for today (${todayStr}).`
    });
  }

  // ── Administrative Validation & Audit Reason Requirement ──
  if (isPrivileged) {
    const auditReason = (auditNote || req.body.reason || notes || '').trim();
    if (!auditReason && (req.body.isManualAdjustment || clockInTime || clockOutTime || workSeconds !== undefined)) {
      return res.status(400).json({
        success: false,
        message: 'Audit reason (auditNote or notes) is required for manual administrative attendance adjustments.'
      });
    }

    if (workSeconds !== undefined) {
      const v = validateStrictDurationSeconds(workSeconds, 'workSeconds');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (breakSeconds !== undefined) {
      const v = validateStrictDurationSeconds(breakSeconds, 'breakSeconds');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (req.body.totalWorkingHours !== undefined) {
      const v = validateStrictDurationSeconds(req.body.totalWorkingHours, 'totalWorkingHours', 24);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }

    if (clockInTimestamp !== undefined) {
      const v = validateStrictTimestamp(clockInTimestamp, 'clockInTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (clockOutTimestamp !== undefined) {
      const v = validateStrictTimestamp(clockOutTimestamp, 'clockOutTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (req.body.firstClockInTimestamp !== undefined) {
      const v = validateStrictTimestamp(req.body.firstClockInTimestamp, 'firstClockInTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (req.body.lastClockOutTimestamp !== undefined) {
      const v = validateStrictTimestamp(req.body.lastClockOutTimestamp, 'lastClockOutTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (req.body.currentSessionStartTimestamp !== undefined) {
      const v = validateStrictTimestamp(req.body.currentSessionStartTimestamp, 'currentSessionStartTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (req.body.breakStartTimestamp !== undefined) {
      const v = validateStrictTimestamp(req.body.breakStartTimestamp, 'breakStartTimestamp');
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }

    if (clockInTimestamp && clockOutTimestamp && Number(clockOutTimestamp) <= Number(clockInTimestamp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrative timestamps: clockOutTimestamp must be strictly greater than clockInTimestamp.'
      });
    }

    if (req.body.firstClockInTimestamp && req.body.lastClockOutTimestamp && Number(req.body.lastClockOutTimestamp) <= Number(req.body.firstClockInTimestamp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrative timestamps: lastClockOutTimestamp must be strictly greater than firstClockInTimestamp.'
      });
    }

    if (workSeconds !== undefined && breakSeconds !== undefined) {
      if (Number(workSeconds) + Number(breakSeconds) > MAX_DAY_SECONDS) {
        return res.status(400).json({
          success: false,
          message: `Combined workSeconds and breakSeconds (${Number(workSeconds) + Number(breakSeconds)}s) exceeds 24-hour limit (${MAX_DAY_SECONDS}s).`
        });
      }
    }

    if (req.body.punchSessions !== undefined) {
      const v = validatePunchSessions(req.body.punchSessions);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
  }

  const Employee = require('../models/Employee');
  const mongoose = require('mongoose');

  let empDoc = null;
  if (mongoose.Types.ObjectId.isValid(rawEmp)) {
    empDoc = await Employee.findById(rawEmp);
  }
  if (!empDoc) {
    empDoc = await Employee.findOne({
      $or: [
        { employeeCode: String(rawEmp).toUpperCase() },
        { email: String(rawEmp).toLowerCase() },
        { name: new RegExp(`^${String(req.body.employeeName || rawEmp)}$`, 'i') }
      ]
    });
  }
  if (!empDoc && req.user) {
    empDoc = await Employee.findOne({
      $or: [
        { employeeCode: req.user.employeeCode },
        { email: req.user.email }
      ]
    });
  }

  let targetEmpId = empDoc ? empDoc._id : (mongoose.Types.ObjectId.isValid(rawEmp) ? rawEmp : new mongoose.Types.ObjectId());
  let targetEmpName = empDoc ? empDoc.name : (req.body.employeeName || 'Employee');
  let targetEmpCode = empDoc ? empDoc.employeeCode : (req.body.employeeCode || String(rawEmp));
  let targetEmpRole = empDoc ? empDoc.role : (req.body.employeeRole || 'Team Member');
  let targetEmpAvatar = empDoc ? empDoc.avatar : (req.body.employeeAvatar || '');

  // Strict Tenant Scoping: Non-privileged users can NEVER mark attendance for other employees
  if (!isPrivileged && req.user) {
    targetEmpId = req.user._id || req.user.id;
    targetEmpName = req.user.name || targetEmpName;
    targetEmpCode = req.user.employeeCode || targetEmpCode;
    targetEmpRole = req.user.role || targetEmpRole;
    targetEmpAvatar = req.user.avatar || targetEmpAvatar;
  }

  const adminActorId = req.user?.id || req.user?._id || markedBy || 'ADMIN';
  const adminActorName = req.user?.name || markedBy || 'HR Administrator';

  // Dynamically load CompanySettings for shift timing, grace period & half-day threshold
  const CompanySettings = require('../../settings/models/CompanySettings');
  let companySettings = null;
  try {
    companySettings = await CompanySettings.findOne().lean();
  } catch (err) {
    console.warn('[attendanceController] Could not fetch CompanySettings, using defaults:', err.message);
  }

  const shiftStartTime = companySettings?.shiftStartTime || '10:00 AM';
  const graceMins = companySettings?.gracePeriodMinutes !== undefined ? Number(companySettings.gracePeriodMinutes) : 15;
  const standardWorkHours = companySettings?.standardWorkHours !== undefined ? Number(companySettings.standardWorkHours) : 9;
  const halfDayThresholdHours = companySettings?.halfDayThresholdHours !== undefined ? Number(companySettings.halfDayThresholdHours) : 4.5;

  const shiftStartSecs = parseTimeStringToSeconds(shiftStartTime);
  const graceLimitSecs = shiftStartSecs + (graceMins * 60);

  const existingRecord = await Attendance.findOne({
    date,
    $or: [{ employee: targetEmpId }, { employeeCode: targetEmpCode }]
  });

  const serverNow = new Date();
  const nowTs = serverNow.getTime();
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const nowTimeStr = istFormatter.format(serverNow);

  let calculatedStatus = status;
  let isLate = false;
  let lateByMinutes = 0;
  let totalWorkingHours = 0;
  let finalWorkSecs = 0;
  let finalBreakSecs = 0;
  let finalBreakHistory = existingRecord?.breakHistory || [];
  let finalPunchSessions = existingRecord?.punchSessions || [];
  let isCurrentlyClockedIn = true;
  let isCurrentlyOnBreak = false;
  let finalBreakType = null;
  let finalBreakStartTimestamp = null;
  let finalSessionStartTimestamp = existingRecord?.currentSessionStartTimestamp || null;
  let finalClockInTime = existingRecord?.firstClockInTime || existingRecord?.clockInTime || null;
  let finalClockInTimestamp = existingRecord?.firstClockInTimestamp || existingRecord?.clockInTimestamp || null;
  let finalClockOutTime = null;
  let finalClockOutTimestamp = null;

  if (!isPrivileged) {
    // ── SERVER-AUTHORITATIVE LOGIC FOR ORDINARY EMPLOYEES ──
    if (Boolean(isOnBreak) || req.body.action === 'break_start') {
      // 1. Starting a Break
      if (!existingRecord || !existingRecord.isClockedIn || existingRecord.clockOutTime) {
        return res.status(400).json({ success: false, message: 'Cannot take a break while clocked out. Please clock in first.' });
      }
      if (existingRecord.isOnBreak) {
        return res.status(400).json({ success: false, message: 'Employee is already on an active break. Cannot start another break.' });
      }

      // Auto-pause active task timer FIRST
      try {
        const timeEngineService = require('../../work/services/timeEngineService');
        await timeEngineService.pauseTimer({
          actor: req.user,
          targetEmployeeId: targetEmpId,
          reason: `Shift Break (${breakType || 'General'}) initiated`,
          source: 'ATTENDANCE_BREAK'
        });
      } catch (timerErr) {
        console.error('[attendanceController] Critical timer pause failure during break start:', timerErr);
        return res.status(500).json({
          success: false,
          message: `Failed to pause active task timer during break: ${timerErr.message}. Break was not started to prevent desynchronization.`
        });
      }

      isCurrentlyOnBreak = true;
      finalBreakType = breakType || 'General';
      finalBreakStartTimestamp = nowTs;
      isCurrentlyClockedIn = true;
      finalWorkSecs = Number(existingRecord?.workSeconds) || 0;
      finalBreakSecs = Number(existingRecord?.breakSeconds) || 0;
      totalWorkingHours = +(finalWorkSecs / 3600).toFixed(2);
      calculatedStatus = existingRecord?.status || 'present';
    } else if (req.body.action === 'break_end' || req.body.isEndingBreak || (existingRecord?.isOnBreak && isOnBreak === false)) {
      // 2. Ending a Break / Resuming Work
      if (!existingRecord || !existingRecord.isOnBreak) {
        return res.status(400).json({ success: false, message: 'No active break found to end.' });
      }

      const bStart = Number(existingRecord.breakStartTimestamp) || nowTs;
      const addedBreakSecs = Math.max(0, Math.floor((nowTs - bStart) / 1000));
      finalBreakSecs = (Number(existingRecord.breakSeconds) || 0) + addedBreakSecs;
      const breakItem = {
        id: `break_${nowTs}`,
        type: existingRecord.breakType || 'General',
        startTime: new Date(bStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        endTime: nowTimeStr,
        durationSeconds: addedBreakSecs,
        durationText: `${Math.floor(addedBreakSecs / 60)}m`
      };
      finalBreakHistory = [breakItem, ...(existingRecord.breakHistory || [])];
      isCurrentlyOnBreak = false;
      finalBreakType = null;
      finalBreakStartTimestamp = null;
      isCurrentlyClockedIn = true;
      finalWorkSecs = Number(existingRecord.workSeconds) || 0;
      totalWorkingHours = +(finalWorkSecs / 3600).toFixed(2);
      calculatedStatus = existingRecord.status || 'present';
    } else if (clockOutTime !== undefined || isClockedIn === false || req.body.action === 'clock_out') {
      // 3. Clocking Out of Shift
      if (!existingRecord || (!existingRecord.isClockedIn && existingRecord.clockOutTime)) {
        return res.status(400).json({ success: false, message: 'Cannot clock out: employee is not currently clocked in for today.' });
      }

      // Auto-pause active task timer FIRST
      try {
        const timeEngineService = require('../../work/services/timeEngineService');
        await timeEngineService.pauseTimer({
          actor: req.user,
          targetEmployeeId: targetEmpId,
          reason: 'Shift Clock-out: automatic pause of active task timer',
          source: 'ATTENDANCE_CLOCK_OUT'
        });
      } catch (timerErr) {
        console.error('[attendanceController] Critical timer pause failure during clock-out:', timerErr);
        return res.status(500).json({
          success: false,
          message: `Failed to pause active task timer during clock-out: ${timerErr.message}. Clock-out was not committed to prevent desynchronization.`
        });
      }

      let totalBreaks = Number(existingRecord?.breakSeconds) || 0;
      let bHistory = [...(existingRecord?.breakHistory || [])];
      if (existingRecord?.isOnBreak) {
        const bStart = Number(existingRecord.breakStartTimestamp) || nowTs;
        const addedBreak = Math.max(0, Math.floor((nowTs - bStart) / 1000));
        totalBreaks += addedBreak;
        bHistory.unshift({
          id: `break_${nowTs}`,
          type: existingRecord.breakType || 'General',
          startTime: new Date(bStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          endTime: nowTimeStr,
          durationSeconds: addedBreak,
          durationText: `${Math.floor(addedBreak / 60)}m`
        });
      }

      const sessStart = Number(existingRecord?.currentSessionStartTimestamp) || Number(existingRecord?.clockInTimestamp) || nowTs;
      const grossSessionSecs = Math.max(0, Math.floor((nowTs - sessStart) / 1000));
      const closedSession = {
        id: `sess_${nowTs}`,
        sessionNumber: (existingRecord?.punchSessions?.length || 0) + 1,
        inTime: existingRecord?.clockInTime || nowTimeStr,
        outTime: nowTimeStr,
        inTimestamp: sessStart,
        outTimestamp: nowTs,
        durationSeconds: grossSessionSecs,
        durationText: `${Math.floor(grossSessionSecs / 3600)}h ${Math.floor((grossSessionSecs % 3600) / 60)}m`
      };
      finalPunchSessions = [...(existingRecord?.punchSessions || []), closedSession];
      const sumSessions = finalPunchSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
      finalWorkSecs = Math.max(0, sumSessions - totalBreaks);
      totalWorkingHours = +(finalWorkSecs / 3600).toFixed(2);
      finalBreakSecs = totalBreaks;
      finalBreakHistory = bHistory;
      isCurrentlyClockedIn = false;
      isCurrentlyOnBreak = false;
      finalClockOutTime = nowTimeStr;
      finalClockOutTimestamp = nowTs;
      finalSessionStartTimestamp = null;
      calculatedStatus = existingRecord?.status || 'present';
    } else {
      // 4. Clocking In / Resuming Shift
      if (existingRecord && existingRecord.isClockedIn && !existingRecord.clockOutTime && !existingRecord.isOnBreak) {
        return res.status(400).json({ success: false, message: 'Employee is already clocked in for today.' });
      }
      if (existingRecord && existingRecord.isOnBreak) {
        return res.status(400).json({ success: false, message: 'Employee is currently on break. Please resume from break first.' });
      }

      if (!existingRecord) {
        // First clock-in of the day
        finalClockInTime = nowTimeStr;
        finalClockInTimestamp = nowTs;
        finalSessionStartTimestamp = nowTs;
        isCurrentlyClockedIn = true;
        isCurrentlyOnBreak = false;
        finalWorkSecs = 0;
        finalBreakSecs = 0;
        totalWorkingHours = 0;
        finalPunchSessions = [];

        const inSecs = parseTimeStringToSeconds(nowTimeStr);
        if (inSecs > graceLimitSecs) {
          isLate = true;
          lateByMinutes = Math.floor((inSecs - shiftStartSecs) / 60);
          calculatedStatus = 'late';
        } else {
          isLate = false;
          lateByMinutes = 0;
          calculatedStatus = 'present';
        }
      } else {
        // Resuming after earlier clock-out (re-clock in)
        isCurrentlyClockedIn = true;
        isCurrentlyOnBreak = false;
        finalSessionStartTimestamp = nowTs;
        finalClockOutTime = null;
        finalClockOutTimestamp = null;
        finalWorkSecs = Number(existingRecord.workSeconds) || 0;
        finalBreakSecs = Number(existingRecord.breakSeconds) || 0;
        totalWorkingHours = +(finalWorkSecs / 3600).toFixed(2);
        calculatedStatus = existingRecord.status || 'present';
        isLate = existingRecord.isLate || false;
        lateByMinutes = existingRecord.lateByMinutes || 0;
      }
    }
  } else {
    // ── ADMINISTRATIVE MANUAL ADJUSTMENT / OVERRIDE ──
    finalClockInTime = clockInTime || existingRecord?.firstClockInTime || existingRecord?.clockInTime;
    finalClockInTimestamp = clockInTimestamp || existingRecord?.firstClockInTimestamp || existingRecord?.clockInTimestamp;
    finalClockOutTime = clockOutTime !== undefined ? clockOutTime : existingRecord?.clockOutTime;
    finalClockOutTimestamp = clockOutTimestamp !== undefined ? clockOutTimestamp : existingRecord?.clockOutTimestamp;
    isCurrentlyClockedIn = isClockedIn !== undefined ? Boolean(isClockedIn) : (finalClockInTime && !finalClockOutTime);
    isCurrentlyOnBreak = Boolean(isOnBreak);
    finalBreakType = breakType || existingRecord?.breakType;
    finalBreakStartTimestamp = req.body.breakStartTimestamp || existingRecord?.breakStartTimestamp;
    finalSessionStartTimestamp = req.body.currentSessionStartTimestamp || existingRecord?.currentSessionStartTimestamp;
    finalBreakSecs = breakSeconds !== undefined ? Number(breakSeconds) : (Number(existingRecord?.breakSeconds) || 0);
    finalBreakHistory = breakHistory || existingRecord?.breakHistory || [];
    finalPunchSessions = req.body.punchSessions || existingRecord?.punchSessions || [];

    if (finalClockInTime) {
      const inSecs = parseTimeStringToSeconds(finalClockInTime);
      if (inSecs > graceLimitSecs) {
        isLate = true;
        lateByMinutes = Math.floor((inSecs - shiftStartSecs) / 60);
        calculatedStatus = 'late';
      } else {
        isLate = false;
        lateByMinutes = 0;
        if (calculatedStatus === 'late' || !calculatedStatus) calculatedStatus = 'present';
      }
    }

    if (finalClockInTime && finalClockOutTime) {
      const inSecs = parseTimeStringToSeconds(finalClockInTime);
      const outSecs = parseTimeStringToSeconds(finalClockOutTime);
      let diffSecs = outSecs - inSecs;
      if (diffSecs < 0) diffSecs += 24 * 3600;
      totalWorkingHours = +(diffSecs / 3600).toFixed(2);
    }
    finalWorkSecs = workSeconds !== undefined ? Number(workSeconds) : Math.round(totalWorkingHours * 3600);
    totalWorkingHours = +(finalWorkSecs / 3600).toFixed(2);

    // If admin is closing the shift or initiating a break, ensure task timer is paused
    if (finalClockOutTime || isCurrentlyClockedIn === false || isCurrentlyOnBreak) {
      try {
        const timeEngineService = require('../../work/services/timeEngineService');
        await timeEngineService.pauseTimer({
          actor: req.user,
          targetEmployeeId: targetEmpId,
          reason: `Admin adjustment: shift ${isCurrentlyOnBreak ? 'break' : 'closed'}`,
          source: 'ADMIN_PORTAL'
        });
      } catch (timerErr) {
        console.error('[attendanceController] Timer pause failed during admin adjustment:', timerErr);
        return res.status(500).json({
          success: false,
          message: `Failed to pause active task timer during administrative adjustment: ${timerErr.message}.`
        });
      }
    }
  }

  // Evaluate half-day if employee worked fewer hours than company half-day threshold
  if (finalClockOutTime && totalWorkingHours > 0 && totalWorkingHours < halfDayThresholdHours && !['on_leave', 'holiday', 'day_off'].includes(calculatedStatus)) {
    calculatedStatus = 'half_day';
  }

  // Calculate Overtime if employee worked beyond standard work hours
  let overtimeHours = 0;
  let overtimeSeconds = 0;
  if (totalWorkingHours > standardWorkHours) {
    overtimeHours = +(totalWorkingHours - standardWorkHours).toFixed(2);
    overtimeSeconds = Math.round(overtimeHours * 3600);
  }

  // Upsert: update existing or create new
  const updateFields = {
    employee: targetEmpId,
    employeeName: targetEmpName,
    employeeCode: targetEmpCode,
    employeeRole: targetEmpRole,
    employeeAvatar: targetEmpAvatar,
    date,
    status: calculatedStatus,
    firstClockInTime: existingRecord?.firstClockInTime || finalClockInTime,
    clockInTime: existingRecord?.firstClockInTime || finalClockInTime,
    firstClockInTimestamp: existingRecord?.firstClockInTimestamp || finalClockInTimestamp,
    clockInTimestamp: existingRecord?.firstClockInTimestamp || finalClockInTimestamp,
    clockOutTime: finalClockOutTime,
    lastClockOutTime: finalClockOutTime || existingRecord?.lastClockOutTime,
    clockOutTimestamp: finalClockOutTimestamp,
    lastClockOutTimestamp: finalClockOutTimestamp || existingRecord?.lastClockOutTimestamp,
    isClockedIn: isCurrentlyClockedIn,
    isOnBreak: isCurrentlyOnBreak,
    breakType: finalBreakType,
    breakStartTimestamp: finalBreakStartTimestamp,
    currentSessionStartTimestamp: finalSessionStartTimestamp,
    workSeconds: finalWorkSecs,
    breakSeconds: finalBreakSecs,
    breakHistory: finalBreakHistory,
    punchSessions: finalPunchSessions,
    totalWorkingHours,
    isLate,
    lateByMinutes,
    overtimeHours,
    overtimeSeconds,
    hasOvertime: overtimeHours > 0,
    notes: notes || (auditNote ? `Adjusted by ${adminActorName}: ${auditNote}` : (existingRecord?.notes || '')),
    markedBy: isPrivileged ? adminActorName : (targetEmpName || 'Self'),
    lastHeartbeatAt: Date.now()
  };

  // Only administrative updates can supply activeTask override
  if (isPrivileged && 'activeTask' in req.body) {
    updateFields.activeTask = req.body.activeTask;
  }

  if (overtimeHours > 0) {
    updateFields.overtimeStatus = req.body.overtimeStatus || existingRecord?.overtimeStatus || 'approved';
    updateFields.overtimeReason = req.body.overtimeReason || existingRecord?.overtimeReason || 'Worked beyond standard shift hours';
    updateFields.overtimeApprovedBy = existingRecord?.overtimeApprovedBy || 'System (Auto)';
    updateFields.overtimeApprovedAt = existingRecord?.overtimeApprovedAt || new Date();
  }

  // Mandatory Audit Trail for Admin manual modifications
  const isMandatoryAudit = isPrivileged && (auditNote || isAdminOverride || req.body.isManualAdjustment);
  const auditIdempotencyKey = req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null;
  const auditReasonText = (auditNote || req.body.reason || notes || 'Manual administrative attendance adjustment').trim();

  // Compute deterministic request fingerprint for idempotency isolation (Section 2)
  const currentFingerprint = computeAuditFingerprint({
    actorId: adminActorId,
    type: 'admin_shift_adjustment',
    targetEmpId,
    targetEmpCode,
    date,
    action: 'Admin Shift Hour Adjustment',
    payload: {
      status: calculatedStatus,
      workSeconds: finalWorkSecs,
      breakSeconds: finalBreakSecs,
      punchSessions: finalPunchSessions,
      clockInTime: finalClockInTime,
      clockOutTime: finalClockOutTime,
      auditReason: auditReasonText
    }
  });

  let existingAudit = null;
  if (auditIdempotencyKey) {
    existingAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
    if (existingAudit) {
      // Collision check: same key with different payload/actor/action MUST return 409 Conflict
      if (existingAudit.requestFingerprint && existingAudit.requestFingerprint !== currentFingerprint) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }

      // Idempotent replay: same key + same request returns original result
      const existingRecordDoc = await Attendance.findOne({
        date,
        $or: [{ employee: targetEmpId }, { employeeCode: targetEmpCode }]
      });
      return res.status(200).json({
        success: true,
        message: 'Shift adjustment already processed (idempotent replay)',
        idempotentReplay: true,
        data: {
          attendance: existingRecordDoc || existingAudit.responseSnapshot?.attendance,
          audit: existingAudit
        }
      });
    }
  }

  const auditPayload = isMandatoryAudit ? {
    employee: targetEmpId,
    employeeId: String(targetEmpId),
    employeeName: targetEmpName || 'Employee',
    employeeCode: targetEmpCode || '',
    date,
    timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    type: 'admin_shift_adjustment',
    action: 'Admin Shift Hour Adjustment',
    durationSeconds: (totalWorkingHours || 0) * 3600,
    durationText: `${totalWorkingHours || 0}h`,
    actor: 'admin',
    actorId: String(adminActorId),
    actorName: adminActorName,
    isAdminOverride: true,
    adminId: String(adminActorId),
    adminName: adminActorName,
    auditNote: auditReasonText,
    idempotencyKey: auditIdempotencyKey,
    idempotencyScope: `${adminActorId}:admin_shift_adjustment:${targetEmpId}:${date}`,
    requestFingerprint: currentFingerprint,
    details: `Shift manually adjusted by Admin ${adminActorName} (ID: ${adminActorId}). Status: ${calculatedStatus}, In: ${finalClockInTime || '—'}, Out: ${finalClockOutTime || '—'}. Reason: "${auditReasonText}"`
  } : null;

  let record;
  let auditEntry = null;

  // Transaction capability detection & safe execution (Section 1)
  if (isTransactionSupported()) {
    try {
      await executeTransaction(async (session) => {
        if (isMandatoryAudit) {
          const created = await AttendanceAudit.create([auditPayload], { session });
          auditEntry = created[0];
        }

        record = await Attendance.findOneAndUpdate(
          {
            date,
            $or: [
              { employee: targetEmpId },
              { employeeCode: targetEmpCode }
            ]
          },
          updateFields,
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, session }
        );

        if (auditEntry && record) {
          auditEntry.responseSnapshot = {
            attendanceId: record._id,
            status: record.status,
            date: record.date
          };
        }
      });
    } catch (txErr) {
      console.error('[attendanceController] Transaction failed during administrative adjustment:', txErr);
      if (txErr.code === 11000 && auditIdempotencyKey) {
        // Concurrent duplicate request caught by unique database index
        const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
        if (dupAudit && dupAudit.requestFingerprint === currentFingerprint) {
          const existingRec = await Attendance.findOne({ date, $or: [{ employee: targetEmpId }, { employeeCode: targetEmpCode }] });
          return res.status(200).json({
            success: true,
            message: 'Shift adjustment already processed (concurrent idempotent replay)',
            idempotentReplay: true,
            data: { attendance: existingRec, audit: dupAudit }
          });
        }
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to commit administrative adjustment: ${txErr.message}. Operation aborted to preserve audit integrity.`
      });
    }
  } else {
    // Non-transactional fallback with reliable rollback compensation
    let auditCreatedHere = null;
    if (isMandatoryAudit) {
      try {
        auditCreatedHere = await AttendanceAudit.create(auditPayload);
        auditEntry = auditCreatedHere;
      } catch (auditErr) {
        console.error('[attendanceController] Mandatory audit creation failed:', auditErr);
        if (auditErr.code === 11000 && auditIdempotencyKey) {
          const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
          if (dupAudit && dupAudit.requestFingerprint === currentFingerprint) {
            const existingRec = await Attendance.findOne({ date, $or: [{ employee: targetEmpId }, { employeeCode: targetEmpCode }] });
            return res.status(200).json({
              success: true,
              message: 'Shift adjustment already processed (concurrent idempotent replay)',
              idempotentReplay: true,
              data: { attendance: existingRec, audit: dupAudit }
            });
          }
          return res.status(409).json({
            success: false,
            code: 'IDEMPOTENCY_KEY_COLLISION',
            message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
          });
        }
        return res.status(500).json({
          success: false,
          message: `Failed to record mandatory audit trail for administrative adjustment: ${auditErr.message}. Attendance was not modified.`
        });
      }
    }

    try {
      record = await Attendance.findOneAndUpdate(
        {
          date,
          $or: [
            { employee: targetEmpId },
            { employeeCode: targetEmpCode }
          ]
        },
        updateFields,
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (updateErr) {
      // Rollback audit entry if attendance update failed! Never delete an existing audit if it was a retry!
      let rollbackFailed = false;
      if (auditCreatedHere && auditCreatedHere._id) {
        try {
          await AttendanceAudit.findByIdAndDelete(auditCreatedHere._id);
        } catch (rbErr) {
          rollbackFailed = true;
          console.error('[attendanceController] CRITICAL: Audit rollback failed:', rbErr.message);
        }
      }
      console.error('[attendanceController] Attendance update failed after audit:', updateErr);
      return res.status(500).json({
        success: false,
        message: rollbackFailed
          ? `Failed to update attendance record: ${updateErr.message}. Critical: Audit rollback failed.`
          : `Failed to update attendance record: ${updateErr.message}. Audit trail rolled back.`
      });
    }
  }

  // Immediately update in-memory liveTelemetryCache so zero-flicker telemetry reflects clock-in/out across all devices instantly!
  try {
    const telemPayload = {
      employeeId: String(targetEmpId),
      employeeCode: String(targetEmpCode || ''),
      employeeName: targetEmpName,
      date,
      status: calculatedStatus,
      isLate,
      isClockedIn: Boolean(record.isClockedIn),
      clockInTime: record.firstClockInTime || record.clockInTime || null,
      firstClockInTime: record.firstClockInTime || record.clockInTime || null,
      clockInTimestamp: record.clockInTimestamp || null,
      clockOutTime: record.clockOutTime || null,
      lastClockOutTime: record.lastClockOutTime || record.clockOutTime || null,
      clockOutTimestamp: record.clockOutTimestamp || null,
      currentSessionStartTimestamp: record.currentSessionStartTimestamp || record.clockInTimestamp || null,
      workSeconds: Number(record.workSeconds) || 0,
      breakSeconds: Number(record.breakSeconds) || 0,
      isOnBreak: Boolean(record.isOnBreak),
      breakType: record.breakType || null,
      breakStartTimestamp: record.breakStartTimestamp || null,
      activeTask: record.activeTask || null,
      lastHeartbeatAt: Date.now()
    };
    if (targetEmpCode) {
      liveTelemetryCache.set(String(targetEmpCode).trim().toUpperCase(), telemPayload);
      liveTelemetryCache.set(String(targetEmpCode).trim().toLowerCase(), telemPayload);
    }
    if (targetEmpId) {
      liveTelemetryCache.set(String(targetEmpId), telemPayload);
    }
  } catch (_) {}

  // Real-time cross-device Socket.IO emission
  try {
    const { getSocketServer } = require('../../../shared/socket/socketManager');
    const io = getSocketServer();
    if (io && targetEmpId) {
      const userRoom = `user:${String(targetEmpId)}`;
      const attPayload = {
        employeeId: String(targetEmpId),
        employeeCode: String(targetEmpCode || ''),
        date,
        isClockedIn: Boolean(record.isClockedIn),
        isOnBreak: Boolean(record.isOnBreak),
        breakType: record.breakType || null,
        clockInTime: record.firstClockInTime || record.clockInTime || null,
        clockOutTime: record.clockOutTime || null,
        workSeconds: Number(record.workSeconds) || 0,
        breakSeconds: Number(record.breakSeconds) || 0,
        status: calculatedStatus || record.status
      };
      io.to(userRoom).emit('attendance:state_updated', attPayload);

      if (record.isClockedIn && !record.clockOutTime && !record.isOnBreak) {
        io.to(userRoom).emit('attendance:clock_in', attPayload);
      } else if (!record.isClockedIn && record.clockOutTime) {
        io.to(userRoom).emit('attendance:clock_out', attPayload);
      }

      if (record.isOnBreak) {
        io.to(userRoom).emit('attendance:break_start', attPayload);
      } else if (existingRecord?.isOnBreak && !record.isOnBreak) {
        io.to(userRoom).emit('attendance:break_end', attPayload);
      }
    }
  } catch (socketErr) {
    console.error('[attendanceController] Socket attendance emission notice:', socketErr.message);
  }

  const resObj = record.toObject ? record.toObject() : { ...record };
  resObj.employeeId = String(resObj.employee || targetEmpId);
  res.status(200).json({ success: true, data: resObj, audit: auditEntry });
});

// ─── GET /api/attendance/daily ───────────────────────────────────────────────
const getAttendanceByDate = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const mongoose = require('mongoose');

  const query = { date: targetDate };
  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.systemRole === 'admin' || req.user?.permissions?.viewAllAttendance || req.user?.permissions?.allAccess;
  if (!isPrivileged) {
    const myId = req.user?.id || req.user?._id;
    const myCode = req.user?.employeeCode;
    const matchConditions = [];
    if (myId && mongoose.Types.ObjectId.isValid(myId)) matchConditions.push({ employee: myId });
    if (myCode) matchConditions.push({ employeeCode: myCode });
    if (myId) matchConditions.push({ employeeId: String(myId) });
    if (matchConditions.length > 0) {
      query.$or = matchConditions;
    }
  }

  const records = await Attendance.find(query).sort({ employeeName: 1 });
  res.json({ success: true, count: records.length, date: targetDate, data: records });
});

// ─── POST /api/attendance/bulk ───────────────────────────────────────────────
const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');
  if (!isPrivileged) {
    return res.status(403).json({ success: false, message: 'Forbidden. Administrative attendance permission required for bulk modification.' });
  }

  const { records } = req.body;
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'records array is required' });
  }

  const ALLOWED_BULK_FIELDS = [
    'employeeId', 'employeeCode', 'employeeName',
    'status', 'notes',
    'firstClockInTime', 'clockInTime', 'clockOutTime',
    'firstClockInTimestamp', 'clockInTimestamp', 'clockOutTimestamp',
    'workSeconds', 'breakSeconds', 'totalWorkingHours',
    'isLate', 'lateByMinutes', 'isClockedIn', 'isOnBreak'
  ];
  const ALLOWED_STATUSES = ['present', 'late', 'half_day', 'absent', 'on_leave', 'holiday', 'day_off'];

  const auditReasonText = (req.body.auditNote || req.body.reason || `Bulk administrative attendance update for ${records.length} records`).trim();
  const auditIdempotencyKey = req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null;

  // Prevent duplicate employee/date pairs in the same bulk payload (Section 3)
  const seenEmpDates = new Set();
  const operations = [];

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];
    if (!r.employee || !r.date) {
      return res.status(400).json({ success: false, message: `Record ${idx + 1} must contain employee and date.` });
    }

    const pairKey = `${String(r.employee).trim().toUpperCase()}__${String(r.date).trim()}`;
    if (seenEmpDates.has(pairKey)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate record detected in bulk payload for employee '${r.employee}' on date '${r.date}'. Each employee-date pair must be unique within a single bulk request.`
      });
    }
    seenEmpDates.add(pairKey);

    if (r.status && !ALLOWED_STATUSES.includes(r.status)) {
      return res.status(400).json({ success: false, message: `Record ${idx + 1} has invalid status '${r.status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}.` });
    }

    if (r.workSeconds !== undefined) {
      const v = validateStrictDurationSeconds(r.workSeconds, `records[${idx}].workSeconds`);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (r.breakSeconds !== undefined) {
      const v = validateStrictDurationSeconds(r.breakSeconds, `records[${idx}].breakSeconds`);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (r.totalWorkingHours !== undefined) {
      const v = validateStrictDurationSeconds(r.totalWorkingHours, `records[${idx}].totalWorkingHours`, 24);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (r.clockInTimestamp !== undefined) {
      const v = validateStrictTimestamp(r.clockInTimestamp, `records[${idx}].clockInTimestamp`);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (r.clockOutTimestamp !== undefined) {
      const v = validateStrictTimestamp(r.clockOutTimestamp, `records[${idx}].clockOutTimestamp`);
      if (!v.valid) return res.status(400).json({ success: false, message: v.error });
    }
    if (r.clockInTimestamp && r.clockOutTimestamp && Number(r.clockOutTimestamp) <= Number(r.clockInTimestamp)) {
      return res.status(400).json({ success: false, message: `Record ${idx + 1} has invalid timestamps: clockOutTimestamp must be strictly greater than clockInTimestamp.` });
    }

    // Whitelist sanitize fields to prevent mass-assignment of protected internal fields
    const sanitizedUpdate = {};
    for (const key of ALLOWED_BULK_FIELDS) {
      if (key in r) {
        sanitizedUpdate[key] = r[key];
      }
    }
    sanitizedUpdate.markedBy = req.user?.name || 'Administrator';
    sanitizedUpdate.lastHeartbeatAt = Date.now();

    operations.push({
      updateOne: {
        filter: { employee: r.employee, date: r.date },
        update: { $set: sanitizedUpdate },
        upsert: true
      }
    });
  }

  // Deterministic fingerprint for bulk idempotency (Section 2 & 3)
  const bulkFingerprint = computeAuditFingerprint({
    actorId: req.user?._id || req.user?.id || 'ADMIN',
    type: 'admin_bulk_attendance',
    targetEmpId: 'BULK',
    targetEmpCode: 'BULK',
    date: records[0].date,
    action: 'Admin Bulk Attendance Update',
    payload: {
      recordsCount: records.length,
      records: records.map(r => ({ employee: r.employee, date: r.date, status: r.status, workSeconds: r.workSeconds })),
      auditReason: auditReasonText
    }
  });

  if (auditIdempotencyKey) {
    const existingAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
    if (existingAudit) {
      if (existingAudit.requestFingerprint && existingAudit.requestFingerprint !== bulkFingerprint) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Bulk attendance already recorded (idempotent replay)',
        idempotentReplay: true,
        data: existingAudit.responseSnapshot || {},
        audit: existingAudit
      });
    }
  }

  const auditPayload = {
    employeeId: 'BULK_UPDATE',
    employeeName: `Bulk Update (${records.length} records)`,
    employeeCode: 'BULK',
    date: records[0].date,
    timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    type: 'admin_bulk_attendance',
    action: 'Admin Bulk Attendance Update',
    durationSeconds: 0,
    durationText: `${records.length} records`,
    actor: 'admin',
    actorId: String(req.user?._id || req.user?.id || 'ADMIN'),
    actorName: req.user?.name || 'Administrator',
    isAdminOverride: true,
    adminId: String(req.user?._id || req.user?.id || 'ADMIN'),
    adminName: req.user?.name || 'Administrator',
    auditNote: auditReasonText,
    idempotencyKey: auditIdempotencyKey,
    idempotencyScope: `${req.user?._id || 'ADMIN'}:admin_bulk_attendance:${records.length}:${records[0].date}`,
    requestFingerprint: bulkFingerprint,
    details: `Administrator ${req.user?.name || 'Admin'} updated ${records.length} attendance records in bulk. Reason: "${auditReasonText}"`
  };

  let bulkAudit = null;
  let result = null;

  // Transactional vs Non-Transactional safe execution (Section 1 & Section 3)
  if (isTransactionSupported()) {
    try {
      await executeTransaction(async (session) => {
        const created = await AttendanceAudit.create([auditPayload], { session });
        bulkAudit = created[0];
        result = await Attendance.bulkWrite(operations, { session, ordered: true });
        if (bulkAudit && result) {
          bulkAudit.responseSnapshot = { modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount };
        }
      });
    } catch (txErr) {
      console.error('[attendanceController] Transaction failed in bulkMarkAttendance:', txErr);
      if (txErr.code === 11000 && auditIdempotencyKey) {
        const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
        if (dupAudit && dupAudit.requestFingerprint === bulkFingerprint) {
          return res.status(200).json({
            success: true,
            message: 'Bulk attendance already recorded (concurrent idempotent replay)',
            idempotentReplay: true,
            data: dupAudit.responseSnapshot || {},
            audit: dupAudit
          });
        }
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to execute bulk attendance update: ${txErr.message}. Entire operation rolled back.`
      });
    }
  } else {
    // Non-transactional fallback with partial outcome preservation (Section 3)
    try {
      bulkAudit = await AttendanceAudit.create(auditPayload);
    } catch (auditErr) {
      console.error('[attendanceController] Bulk attendance audit creation failed:', auditErr);
      if (auditErr.code === 11000 && auditIdempotencyKey) {
        const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
        if (dupAudit && dupAudit.requestFingerprint === bulkFingerprint) {
          return res.status(200).json({
            success: true,
            message: 'Bulk attendance already recorded (concurrent idempotent replay)',
            idempotentReplay: true,
            data: dupAudit.responseSnapshot || {},
            audit: dupAudit
          });
        }
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to create audit log for bulk attendance update: ${auditErr.message}. Bulk update aborted.`
      });
    }

    try {
      result = await Attendance.bulkWrite(operations, { ordered: true });
    } catch (bulkErr) {
      console.error('[attendanceController] bulkWrite failed:', bulkErr);
      const modifiedCount = bulkErr.result?.nModified || bulkErr.result?.modifiedCount || 0;
      const upsertedCount = bulkErr.result?.nUpserted || bulkErr.result?.upsertedCount || 0;
      const totalWritten = modifiedCount + upsertedCount;

      if (totalWritten > 0) {
        // Some records were modified: DO NOT DELETE AUDIT LOG!
        if (bulkAudit) {
          bulkAudit.action = 'Admin Bulk Attendance Update (Partial Failure)';
          bulkAudit.details += ` [PARTIAL FAILURE: ${bulkErr.message}. ${totalWritten} of ${records.length} records written before error.]`;
          try { await bulkAudit.save(); } catch (_) {}
        }
        return res.status(500).json({
          success: false,
          message: `Bulk attendance operation partially failed: ${bulkErr.message}. ${totalWritten} records were modified and audit trail was preserved.`,
          partialFailure: true,
          modifiedCount,
          upsertedCount
        });
      } else {
        // Zero records written: safe to rollback audit entry
        let rollbackFailed = false;
        if (bulkAudit && bulkAudit._id) {
          try {
            await AttendanceAudit.findByIdAndDelete(bulkAudit._id);
          } catch (rbErr) {
            rollbackFailed = true;
            console.error('[attendanceController] CRITICAL: Bulk audit rollback failed:', rbErr.message);
          }
        }
        return res.status(500).json({
          success: false,
          message: rollbackFailed
            ? `Failed to perform bulk attendance write: ${bulkErr.message}. Critical: Audit rollback failed.`
            : `Failed to perform bulk attendance write: ${bulkErr.message}. Zero records modified. Audit trail rolled back.`
        });
      }
    }
  }

  res.status(200).json({ success: true, message: 'Bulk attendance recorded', data: result, audit: bulkAudit });
});

// ─── DELETE /api/attendance/:id ───────────────────────────────────────────────
const deleteAttendanceRecord = asyncHandler(async (req, res) => {
  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');
  if (!isPrivileged) {
    return res.status(403).json({ success: false, message: 'Forbidden. Administrative attendance permission required to delete attendance records.' });
  }

  const auditReason = (req.body?.auditNote || req.body?.reason || '').trim();
  if (!auditReason) {
    return res.status(400).json({
      success: false,
      message: 'Audit reason (auditNote or reason) is required for attendance record deletion.'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid attendance record ID.' });
  }

  const record = await Attendance.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

  const auditIdempotencyKey = req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null;
  const deleteFingerprint = computeAuditFingerprint({
    actorId: req.user?._id || req.user?.id || 'ADMIN',
    type: 'admin_shift_deletion',
    targetEmpId: record.employee,
    targetEmpCode: record.employeeCode,
    date: record.date,
    action: 'Admin Attendance Record Deletion',
    payload: { recordId: req.params.id, reason: auditReason }
  });

  if (auditIdempotencyKey) {
    const existingAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
    if (existingAudit) {
      if (existingAudit.requestFingerprint && existingAudit.requestFingerprint !== deleteFingerprint) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Attendance record already deleted (idempotent replay)',
        idempotentReplay: true,
        data: {}
      });
    }
  }

  const auditPayload = {
    employee: record.employee,
    employeeId: String(record.employee || record.employeeCode || ''),
    employeeName: record.employeeName || 'Employee',
    employeeCode: record.employeeCode || '',
    date: record.date,
    timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    type: 'admin_shift_deletion',
    action: 'Admin Attendance Record Deletion',
    actor: 'admin',
    actorId: String(req.user?._id || req.user?.id || 'ADMIN'),
    actorName: req.user?.name || 'Administrator',
    isAdminOverride: true,
    adminId: String(req.user?._id || req.user?.id || 'ADMIN'),
    adminName: req.user?.name || 'Administrator',
    auditNote: auditReason,
    idempotencyKey: auditIdempotencyKey,
    idempotencyScope: `${req.user?._id || 'ADMIN'}:admin_shift_deletion:${req.params.id}`,
    requestFingerprint: deleteFingerprint,
    details: `Attendance record for ${record.employeeName} on ${record.date} was deleted by ${req.user?.name || 'Admin'}. Reason: "${auditReason}"`
  };

  // Transaction capability detection & safe deletion (Section 1 & 4)
  if (isTransactionSupported()) {
    try {
      await executeTransaction(async (session) => {
        const deletedDoc = await Attendance.findByIdAndDelete(req.params.id, { session });
        if (!deletedDoc) {
          const notFoundErr = new Error('Attendance record not found or already deleted by another request.');
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }

        await AttendanceAudit.create([auditPayload], { session });
      });
    } catch (txErr) {
      console.error('[attendanceController] Transaction failed in deleteAttendanceRecord:', txErr);
      if (txErr.statusCode === 404) {
        return res.status(404).json({ success: false, message: txErr.message });
      }
      return res.status(500).json({ success: false, message: `Failed to delete record: ${txErr.message}. Transaction aborted.` });
    }
  } else {
    // Non-transactional fallback with verified deletion and explicit rollback error handling (Section 4)
    let auditEntry = null;
    try {
      auditEntry = await AttendanceAudit.create(auditPayload);
    } catch (auditErr) {
      console.error('[attendanceController] Audit creation failed before attendance deletion:', auditErr);
      return res.status(500).json({
        success: false,
        message: `Failed to create audit log for deletion: ${auditErr.message}. Record was NOT deleted to preserve audit compliance.`
      });
    }

    let deletedDoc = null;
    try {
      deletedDoc = await Attendance.findByIdAndDelete(req.params.id);
    } catch (deleteErr) {
      let rollbackFailed = false;
      if (auditEntry && auditEntry._id) {
        try {
          await AttendanceAudit.findByIdAndDelete(auditEntry._id);
        } catch (rbErr) {
          rollbackFailed = true;
          console.error('[attendanceController] CRITICAL: Audit rollback failed after delete error:', rbErr.message);
        }
      }
      return res.status(500).json({
        success: false,
        message: rollbackFailed
          ? `Failed to delete attendance record: ${deleteErr.message}. Critical: Audit rollback failed.`
          : `Failed to delete attendance record: ${deleteErr.message}. Audit record rolled back to prevent false records.`
      });
    }

    // Verify record was actually deleted (Section 4)
    if (!deletedDoc) {
      let rollbackFailed = false;
      if (auditEntry && auditEntry._id) {
        try {
          await AttendanceAudit.findByIdAndDelete(auditEntry._id);
        } catch (rbErr) {
          rollbackFailed = true;
          console.error('[attendanceController] CRITICAL: Audit rollback failed after concurrent delete:', rbErr.message);
        }
      }
      if (rollbackFailed) {
        return res.status(500).json({
          success: false,
          message: 'Record was already deleted by another request, and audit rollback failed. Inconsistent state logged.'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Attendance record was already deleted by another request. Audit record rolled back.'
      });
    }
  }

  res.json({ success: true, message: 'Record deleted', data: {} });
});

// ═════════════════════════════════════════════════════════════════════════════
// 📋 AUDIT TRAIL & ADMIN OVERRIDE CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/attendance/audit ───────────────────────────────────────────────
const getAuditLogs = asyncHandler(async (req, res) => {
  const { employeeId, date, month, year, type, onlyOverrides } = req.query;
  const isPrivileged = checkIsPrivileged(req.user, 'viewAuditTrail');

  const query = {};

  // Strict Tenant Scoping: non-privileged users only see their own audit events
  if (!isPrivileged) {
    const myId = req.user?.id || req.user?._id;
    const myCode = req.user?.employeeCode;
    query.$or = [
      { employeeId: String(myId) },
      { employee: myId },
      ...(myCode ? [{ employeeCode: myCode }, { employeeId: myCode }] : [])
    ];
  } else if (employeeId && employeeId !== 'all') {
    query.$or = [
      { employeeId: String(employeeId) },
      { employee: employeeId },
      { employeeCode: employeeId }
    ];
  }

  if (date) query.date = date;
  if (month && year) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    query.date = new RegExp(`^${monthStr}`);
  }
  if (type && type !== 'all') query.type = type;
  if (onlyOverrides === 'true' || onlyOverrides === true) query.isAdminOverride = true;

  const logs = await AttendanceAudit.find(query).sort({ timestamp: -1 }).limit(500);
  res.json({ success: true, count: logs.length, data: logs });
});

// ─── POST /api/attendance/audit ──────────────────────────────────────────────
const createAuditLog = asyncHandler(async (req, res) => {
  const auditData = { ...(req.body || {}) };
  // Remove client-generated custom string _id so MongoDB creates a valid ObjectId
  delete auditData._id;

  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');
  const actorId = String(req.user?._id || req.user?.id || 'unknown');
  const actorName = String(req.user?.name || 'User');
  const actor = isPrivileged ? (auditData.actor === 'admin' ? 'admin' : 'employee') : 'employee';
  const isAdminOverride = isPrivileged && Boolean(auditData.isAdminOverride);

  // Derive target employee safely
  let employeeId = String(auditData.employeeId || auditData.employeeCode || '');
  if (!isPrivileged) {
    // Non-privileged users must only create audit logs for themselves
    const myId = String(req.user?._id || req.user?.id || '');
    const myCode = String(req.user?.employeeCode || '');
    if (employeeId && employeeId !== myId && employeeId !== myCode) {
      return res.status(403).json({ success: false, message: 'Forbidden. You cannot create audit logs for other employees.' });
    }
    employeeId = myCode || myId;
  } else if (!employeeId) {
    employeeId = actorId;
  }

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'employeeId is required' });
  }

  const type = auditData.type || auditData.action || 'system';
  const action = auditData.action || auditData.type || 'audit';

  // Sanitize employee field - must be valid Mongo ObjectId or omitted
  const mongoose = require('mongoose');
  let validEmployeeObjId = undefined;
  if (auditData.employee && mongoose.Types.ObjectId.isValid(auditData.employee)) {
    validEmployeeObjId = auditData.employee;
  } else if (!isPrivileged && req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
    validEmployeeObjId = req.user._id;
  }
  delete auditData.employee;

  const employeeName = (!isPrivileged && req.user?.name) ? req.user.name : (auditData.employeeName || req.user?.name || 'Employee');

  const record = new AttendanceAudit({
    ...auditData,
    employee: validEmployeeObjId,
    employeeId,
    employeeName,
    type,
    action,
    date: auditData.date || getLocalTodayStr(),
    timeFormatted: auditData.timeFormatted || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    actor,
    actorId,
    actorName,
    isAdminOverride,
    adminId: isAdminOverride ? actorId : null,
    adminName: isAdminOverride ? actorName : null,
    auditNote: auditData.auditNote || null
  });

  await record.save();
  res.status(201).json({ success: true, data: record });
});

// ─── POST /api/attendance/force-clock-out ─────────────────────────────────────
// Admin Override: Forcefully clock out an active employee with mandatory audit note
const forceClockOut = asyncHandler(async (req, res) => {
  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.systemRole === 'admin' || req.user?.permissions?.forceClockOut || req.user?.permissions?.allAccess;
  if (!isPrivileged) {
    return res.status(403).json({ success: false, message: 'Unauthorized. Administrator or HR access required.' });
  }

  const { employeeId, date, auditNote } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'employeeId is required' });
  }

  const noteText = (auditNote && auditNote.trim()) ? auditNote.trim() : 'Manual clock out by administrator';
  const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const adminId = req.user?.id || req.user?._id || 'ADMIN';
  const adminName = req.user?.name || 'Administrator';
  const Employee = require('../models/Employee');
  const mongoose = require('mongoose');

  // Safely resolve employee document
  let empDoc = null;
  if (mongoose.Types.ObjectId.isValid(employeeId)) {
    empDoc = await Employee.findById(employeeId);
  }
  if (!empDoc) {
    empDoc = await Employee.findOne({
      $or: [
        { employeeCode: String(employeeId).toUpperCase() },
        { email: String(employeeId).toLowerCase() },
        { name: new RegExp(`^${String(employeeId)}$`, 'i') }
      ]
    });
  }

  const targetEmpId = empDoc ? empDoc._id : (mongoose.Types.ObjectId.isValid(employeeId) ? employeeId : null);
  const targetEmpCode = empDoc ? empDoc.employeeCode : String(employeeId);
  const targetEmpName = empDoc ? empDoc.name : 'Employee';

  // Auto-pause active task timer FIRST to prevent desynchronization
  try {
    const timeEngineService = require('../../work/services/timeEngineService');
    if (targetEmpId) {
      await timeEngineService.pauseTimer({
        actor: req.user,
        targetEmployeeId: targetEmpId,
        reason: 'Admin forced clock-out',
        source: 'ADMIN_PORTAL'
      });
    }
  } catch (timerErr) {
    console.error('[attendanceController] Critical timer pause failure during force clock-out:', timerErr);
    return res.status(500).json({
      success: false,
      message: `Failed to pause active task timer during force clock-out: ${timerErr.message}. Force clock-out aborted to prevent desynchronization.`
    });
  }

  // Build match query for Attendance record without invalid ObjectId casting
  const matchOr = [
    { employeeId: String(targetEmpCode) },
    { employeeId: String(employeeId) },
    { employeeCode: String(targetEmpCode) }
  ];
  if (targetEmpId) {
    matchOr.unshift({ employee: targetEmpId });
  }

  let attRecord = await Attendance.findOne({
    $or: matchOr,
    date: targetDate
  });

  if (attRecord) {
    const nowTs = Date.now();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightMs = todayMidnight.getTime();

    let updatedSessions = Array.isArray(attRecord.punchSessions) ? [...attRecord.punchSessions] : [];
    const lastSessionOut = updatedSessions.length > 0
      ? Math.max(...updatedSessions.map(s => Number(s.outTimestamp || s.inTimestamp || 0)))
      : 0;

    let sessStartTs = Number(attRecord.currentSessionStartTimestamp);
    if (!sessStartTs || sessStartTs < todayMidnightMs) {
      if (lastSessionOut > 0) {
        sessStartTs = lastSessionOut;
      } else {
        sessStartTs = Number(attRecord.clockInTimestamp) || (todayMidnightMs + parseTimeStringToSeconds(attRecord.clockInTime || nowStr) * 1000);
      }
    }
    if (lastSessionOut > 0 && sessStartTs < lastSessionOut) {
      sessStartTs = lastSessionOut;
    }
    sessStartTs = Math.max(sessStartTs, todayMidnightMs);

    const grossSessionSecs = Math.max(0, Math.floor((nowTs - sessStartTs) / 1000));
    if (grossSessionSecs > 0 && sessStartTs < nowTs) {
      const sessInStr = attRecord.clockInTime || nowStr;
      const newSession = {
        id: `sess_${nowTs}`,
        sessionNumber: updatedSessions.length + 1,
        inTime: sessInStr,
        outTime: nowStr,
        inTimestamp: sessStartTs,
        outTimestamp: nowTs,
        durationSeconds: grossSessionSecs,
        durationText: `${Math.floor(grossSessionSecs / 3600)}h ${Math.floor((grossSessionSecs % 3600) / 60)}m`
      };
      updatedSessions.push(newSession);
    }

    const sessionsSum = updatedSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
    const finalWorkSecs = Math.max(Number(attRecord.workSeconds) || 0, sessionsSum);
    const finalWorkHours = +(finalWorkSecs / 3600).toFixed(2);

    attRecord.clockOutTime = nowStr;
    attRecord.clockOutTimestamp = nowTs;
    attRecord.isClockedIn = false;
    attRecord.isOnBreak = false;
    attRecord.workSeconds = finalWorkSecs;
    attRecord.totalWorkingHours = finalWorkHours;
    attRecord.punchSessions = updatedSessions;

    let companySettings = null;
    try {
      const CompanySettings = require('../../settings/models/CompanySettings');
      companySettings = await CompanySettings.findOne().lean();
    } catch (_) {}
    const standardWorkHours = Number(companySettings?.standardWorkHours) || 9;
    const halfDayThresholdHours = Number(companySettings?.halfDayThresholdHours) || 4.5;

    if (finalWorkHours >= halfDayThresholdHours && attRecord.status === 'half_day') {
      attRecord.status = attRecord.isLate ? 'late' : 'present';
    } else if (finalWorkHours > 0 && finalWorkHours < halfDayThresholdHours && !['on_leave', 'holiday', 'day_off'].includes(attRecord.status)) {
      attRecord.status = 'half_day';
    }

    if (finalWorkHours > standardWorkHours) {
      attRecord.overtimeHours = +(finalWorkHours - standardWorkHours).toFixed(2);
      attRecord.overtimeSeconds = Math.round(attRecord.overtimeHours * 3600);
      attRecord.hasOvertime = true;
      attRecord.overtimeStatus = attRecord.overtimeStatus && attRecord.overtimeStatus !== 'none' ? attRecord.overtimeStatus : 'approved';
      attRecord.overtimeReason = attRecord.overtimeReason || 'Worked beyond standard shift hours';
      attRecord.overtimeApprovedBy = 'System (Auto)';
      attRecord.overtimeApprovedAt = new Date();
    }
    attRecord.notes = `Manual Clock-Out by Admin ${adminName}: "${noteText}"`;
    attRecord.markedBy = adminName;
  }

  // Create official Audit Trail record first to ensure audit integrity
  const auditIdempotencyKey = req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null;

  // Deterministic fingerprint for force clock-out idempotency (Section 2)
  const forceFingerprint = computeAuditFingerprint({
    actorId: adminId,
    type: 'admin_force_clock_out',
    targetEmpId,
    targetEmpCode,
    date: targetDate,
    action: 'Admin Force Clock-Out',
    payload: { employeeId: String(targetEmpCode || employeeId), noteText }
  });

  if (auditIdempotencyKey) {
    const existingAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
    if (existingAudit) {
      if (existingAudit.requestFingerprint && existingAudit.requestFingerprint !== forceFingerprint) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(200).json({
        success: true,
        message: `Shift forcefully clocked out by Admin ${adminName} (idempotent replay)`,
        idempotentReplay: true,
        data: { attendance: attRecord, audit: existingAudit }
      });
    }
  }

  const auditPayload = {
    employee: targetEmpId,
    employeeId: String(targetEmpCode || employeeId),
    employeeName: targetEmpName,
    employeeCode: targetEmpCode,
    date: targetDate,
    timeFormatted: nowStr,
    type: 'admin_force_clock_out',
    action: 'Admin Force Clock-Out',
    actor: 'admin',
    actorId: String(adminId),
    actorName: adminName,
    isAdminOverride: true,
    adminId: String(adminId),
    adminName,
    auditNote: noteText,
    idempotencyKey: auditIdempotencyKey,
    idempotencyScope: `${adminId}:admin_force_clock_out:${targetEmpId}:${targetDate}`,
    requestFingerprint: forceFingerprint,
    details: `Administrator ${adminName} [ID: ${adminId}] manually forced shift clock-out. Reason: "${noteText}"`
  };

  let auditEntry = null;

  if (isTransactionSupported()) {
    try {
      await executeTransaction(async (session) => {
        const created = await AttendanceAudit.create([auditPayload], { session });
        auditEntry = created[0];

        if (attRecord) {
          await attRecord.save({ session });
        } else {
          const createdAtt = await Attendance.create([{
            employee: targetEmpId || new mongoose.Types.ObjectId(),
            employeeName: targetEmpName,
            employeeCode: targetEmpCode,
            employeeRole: empDoc ? empDoc.role : 'Team Member',
            date: targetDate,
            status: 'present',
            clockInTime: nowStr,
            workSeconds: 0,
            totalWorkingHours: 0,
            clockOutTime: nowStr,
            clockOutTimestamp: Date.now(),
            isClockedIn: false,
            isOnBreak: false,
            markedBy: adminName,
            notes: `Manual Clock-Out by Admin ${adminName}: "${noteText}"`
          }], { session });
          attRecord = Array.isArray(createdAtt) ? createdAtt[0] : createdAtt;
        }
      });
    } catch (txErr) {
      console.error('[attendanceController] Transaction failed in forceClockOut:', txErr);
      if (txErr.code === 11000 && auditIdempotencyKey) {
        const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
        if (dupAudit && dupAudit.requestFingerprint === forceFingerprint) {
          return res.status(200).json({
            success: true,
            message: `Shift forcefully clocked out by Admin ${adminName} (concurrent idempotent replay)`,
            idempotentReplay: true,
            data: { attendance: attRecord, audit: dupAudit }
          });
        }
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to force clock-out: ${txErr.message}. Transaction aborted.`
      });
    }
  } else {
    // Non-transactional fallback with verified audit creation and rollback
    let auditCreatedHere = null;
    try {
      auditCreatedHere = await AttendanceAudit.create(auditPayload);
      auditEntry = auditCreatedHere;
    } catch (auditErr) {
      console.error('[attendanceController] Mandatory audit creation failed in forceClockOut:', auditErr);
      if (auditErr.code === 11000 && auditIdempotencyKey) {
        const dupAudit = await AttendanceAudit.findOne({ idempotencyKey: auditIdempotencyKey });
        if (dupAudit && dupAudit.requestFingerprint === forceFingerprint) {
          return res.status(200).json({
            success: true,
            message: `Shift forcefully clocked out by Admin ${adminName} (concurrent idempotent replay)`,
            idempotentReplay: true,
            data: { attendance: attRecord, audit: dupAudit }
          });
        }
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'Idempotency key collision: This idempotency key was already used for a different request payload or target.'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to create audit log for force clock-out: ${auditErr.message}. Force clock-out aborted to preserve audit integrity.`
      });
    }

    try {
      if (attRecord) {
        await attRecord.save();
      } else {
        attRecord = await Attendance.create({
          employee: targetEmpId || new mongoose.Types.ObjectId(),
          employeeName: targetEmpName,
          employeeCode: targetEmpCode,
          employeeRole: empDoc ? empDoc.role : 'Team Member',
          date: targetDate,
          status: 'present',
          clockInTime: nowStr,
          workSeconds: 0,
          totalWorkingHours: 0,
          clockOutTime: nowStr,
          clockOutTimestamp: Date.now(),
          isClockedIn: false,
          isOnBreak: false,
          markedBy: adminName,
          notes: `Manual Clock-Out by Admin ${adminName}: "${noteText}"`
        });
      }
    } catch (saveErr) {
      let rollbackFailed = false;
      if (auditCreatedHere && auditCreatedHere._id) {
        try {
          await AttendanceAudit.findByIdAndDelete(auditCreatedHere._id);
        } catch (rbErr) {
          rollbackFailed = true;
          console.error('[attendanceController] CRITICAL: Audit rollback failed after attendance save error:', rbErr.message);
        }
      }
      console.error('[attendanceController] Attendance save failed in forceClockOut:', saveErr);
      return res.status(500).json({
        success: false,
        message: rollbackFailed
          ? `Failed to save attendance record during force clock-out: ${saveErr.message}. Critical: Audit rollback failed.`
          : `Failed to save attendance record during force clock-out: ${saveErr.message}. Audit trail rolled back.`
      });
    }
  }

  // Immediately update in-memory liveTelemetryCache so zero-flicker telemetry reflects forced clock-out across all devices instantly!
  try {
    const telemOutPayload = {
      employeeId: String(targetEmpId || employeeId),
      employeeCode: String(targetEmpCode || ''),
      employeeName: targetEmpName,
      date: targetDate,
      status: attRecord.status,
      isLate: attRecord.isLate,
      isClockedIn: false,
      isClockedOut: true,
      clockInTime: attRecord.firstClockInTime || attRecord.clockInTime || null,
      clockOutTime: attRecord.clockOutTime,
      lastClockOutTime: attRecord.clockOutTime,
      clockInTimestamp: attRecord.clockInTimestamp || null,
      clockOutTimestamp: attRecord.clockOutTimestamp || Date.now(),
      workSeconds: Number(attRecord.workSeconds) || 0,
      breakSeconds: Number(attRecord.breakSeconds) || 0,
      isOnBreak: false,
      activeTask: null,
      lastHeartbeatAt: Date.now()
    };
    if (targetEmpCode) {
      liveTelemetryCache.set(String(targetEmpCode).trim().toUpperCase(), telemOutPayload);
      liveTelemetryCache.set(String(targetEmpCode).trim().toLowerCase(), telemOutPayload);
    }
    if (targetEmpId) {
      liveTelemetryCache.set(String(targetEmpId), telemOutPayload);
    }
  } catch (_) {}

  // Real-time cross-device Socket.IO emission for force clock out
  try {
    const { getSocketServer } = require('../../../shared/socket/socketManager');
    const io = getSocketServer();
    const resolvedTargetId = String(targetEmpId || employeeId);
    if (io && resolvedTargetId) {
      const userRoom = `user:${resolvedTargetId}`;
      const attOutPayload = {
        employeeId: resolvedTargetId,
        employeeCode: String(targetEmpCode || ''),
        date: targetDate,
        isClockedIn: false,
        isOnBreak: false,
        clockInTime: attRecord.firstClockInTime || attRecord.clockInTime || null,
        clockOutTime: attRecord.clockOutTime,
        workSeconds: Number(attRecord.workSeconds) || 0,
        breakSeconds: Number(attRecord.breakSeconds) || 0,
        status: attRecord.status
      };
      io.to(userRoom).emit('attendance:state_updated', attOutPayload);
      io.to(userRoom).emit('attendance:clock_out', attOutPayload);
    }
  } catch (socketErr) {
    console.error('[attendanceController] Socket forceClockOut emission notice:', socketErr.message);
  }

  res.status(200).json({
    success: true,
    message: `Shift forcefully clocked out by Admin ${adminName}`,
    data: { attendance: attRecord, audit: auditEntry }
  });
});

// ─── GET /api/attendance/overtime ─────────────────────────────────────────────
const getOvertimeRequests = asyncHandler(async (req, res) => {
  const isPrivileged = checkIsPrivileged(req.user, 'viewAllAttendance');
  const baseQuery = {
    $or: [
      { overtimeStatus: { $in: ['pending', 'approved', 'rejected'] } },
      { overtimeSeconds: { $gt: 0 } },
      { overtimeHours: { $gt: 0 } },
      { hasOvertime: true }
    ]
  };

  const query = { ...baseQuery };
  if (!isPrivileged) {
    const myId = req.user?.id || req.user?._id;
    const myCode = req.user?.employeeCode;
    const userMatch = [];
    if (myId && mongoose.Types.ObjectId.isValid(myId)) userMatch.push({ employee: myId });
    if (myCode) userMatch.push({ employeeCode: myCode });
    if (myId) userMatch.push({ employeeId: String(myId) });

    query.$and = [
      baseQuery,
      { $or: userMatch }
    ];
    delete query.$or;
  }

  const records = await Attendance.find(query).sort({ date: -1, updatedAt: -1 });
  res.json({ success: true, count: records.length, data: records });
});

// ─── POST /api/attendance/overtime ────────────────────────────────────────────
const requestOvertime = asyncHandler(async (req, res) => {
  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');
  let { employeeId, employeeCode, employeeName, date, overtimeHours, overtimeSeconds, overtimeReason, overtimeTasks, requestedToId, requestedToName, isSelfApproved } = req.body;
  const targetDate = date || getLocalTodayStr();

  // If not privileged, strictly scope to requesting user and reject client-forced self approval
  if (!isPrivileged) {
    employeeId = String(req.user?._id || req.user?.id);
    employeeCode = req.user?.employeeCode || '';
    employeeName = req.user?.name || 'Employee';
    isSelfApproved = false;
  } else {
    isSelfApproved = Boolean(isSelfApproved);
  }

  const status = isSelfApproved ? 'approved' : 'pending';
  const approverName = isSelfApproved ? (req.user?.name || 'Admin') : '';
  const approvedAt = isSelfApproved ? new Date() : null;

  const mongoose = require('mongoose');
  let attRecord = await Attendance.findOne({
    date: targetDate,
    $or: [
      { employeeCode: employeeCode ? String(employeeCode).toUpperCase() : undefined },
      { employeeId: String(employeeId) },
      mongoose.Types.ObjectId.isValid(employeeId) ? { employee: employeeId } : null
    ].filter(Boolean)
  });

  if (attRecord) {
    attRecord.overtimeHours = Number(overtimeHours) || +(Number(overtimeSeconds) / 3600).toFixed(2);
    attRecord.overtimeSeconds = Number(overtimeSeconds) || 0;
    attRecord.overtimeStatus = status;
    attRecord.overtimeReason = overtimeReason || '';
    attRecord.overtimeTasks = overtimeTasks || [];
    attRecord.overtimeRequestedTo = requestedToName || '';
    attRecord.overtimeApprovedBy = approverName;
    attRecord.overtimeApprovedAt = approvedAt;
    await attRecord.save();
  }

  // Create audit log
  try {
    const auditEntry = new AttendanceAudit({
      employee: attRecord?.employee || (mongoose.Types.ObjectId.isValid(employeeId) ? employeeId : undefined),
      employeeId: String(attRecord?.employee || employeeId),
      employeeName: employeeName || 'Employee',
      employeeCode: employeeCode || '',
      type: 'overtime_request',
      action: isSelfApproved ? 'overtime_self_approved' : 'overtime_requested',
      date: targetDate,
      timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actor: isPrivileged ? 'admin' : 'employee',
      actorId: String(req.user?._id || req.user?.id || 'unknown'),
      actorName: req.user?.name || employeeName || 'User',
      isAdminOverride: isSelfApproved,
      auditNote: `${isSelfApproved ? 'Self-approved' : 'Submitted'} overtime of ${overtimeHours || 0}h: ${overtimeReason || ''}`
    });
    await auditEntry.save();
  } catch (_) {}

  res.json({ success: true, message: `Overtime request ${status}`, data: attRecord });
});

// ─── PUT /api/attendance/overtime/:id/status ──────────────────────────────────
const updateOvertimeStatus = asyncHandler(async (req, res) => {
  const isPrivileged = checkIsPrivileged(req.user, 'editAttendance');
  if (!isPrivileged) {
    return res.status(403).json({ success: false, message: 'Forbidden. Administrative authorization required to decide overtime requests.' });
  }

  const { id } = req.params;
  const { status, approverName, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid overtime status. Allowed values: approved, rejected.' });
  }

  const attRecord = await Attendance.findById(id);
  if (!attRecord) {
    return res.status(404).json({ success: false, message: 'Attendance record not found' });
  }

  // Prevent approving own overtime
  const currentUserId = String(req.user?._id || req.user?.id || '');
  const currentUserCode = String(req.user?.employeeCode || '').toUpperCase();
  const recordEmpId = String(attRecord.employee || attRecord.employeeId || '');
  const recordEmpCode = String(attRecord.employeeCode || '').toUpperCase();

  if (currentUserId === recordEmpId || (currentUserCode && currentUserCode === recordEmpCode)) {
    return res.status(403).json({ success: false, message: 'Forbidden. You cannot approve or reject your own overtime request.' });
  }

  const finalApproverName = req.user?.name || approverName || 'Admin';
  attRecord.overtimeStatus = status;
  attRecord.overtimeApprovedBy = finalApproverName;
  attRecord.overtimeApprovedAt = new Date();
  if (rejectionReason) {
    attRecord.notes = attRecord.notes ? `${attRecord.notes} | Overtime rejected: ${rejectionReason}` : `Overtime rejected: ${rejectionReason}`;
  }
  await attRecord.save();

  // Create audit log
  try {
    const auditEntry = new AttendanceAudit({
      employee: attRecord.employee,
      employeeId: String(attRecord.employee || attRecord.employeeCode || ''),
      employeeName: attRecord.employeeName,
      employeeCode: attRecord.employeeCode,
      type: 'overtime_decision',
      action: `overtime_${status}`,
      date: attRecord.date,
      timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actor: 'admin',
      actorId: String(req.user?._id || req.user?.id || 'ADMIN'),
      actorName: finalApproverName,
      isAdminOverride: true,
      auditNote: `Overtime ${status} by ${finalApproverName}${rejectionReason ? `: ${rejectionReason}` : ''}`
    });
    await auditEntry.save();
  } catch (_) {}

  res.json({ success: true, message: `Overtime request ${status}`, data: attRecord });
});

// In-memory cache of live telemetry for sub-millisecond response to Live Operations dashboard
const liveTelemetryCache = new Map();

// ─── POST /api/attendance/heartbeat ──────────────────────────────────────────
// Lightweight telemetry pulse sent by employee client while shift or task is active
const updateLiveHeartbeat = asyncHandler(async (req, res) => {
  const {
    employeeId,
    employeeCode,
    isClockedIn,
    clockInTime,
    clockInTimestamp,
    clockOutTime,
    clockOutTimestamp,
    currentSessionStartTimestamp,
    workSeconds,
    breakSeconds,
    isOnBreak,
    breakType,
    breakStartTimestamp,
    activeTask
  } = req.body;

  const isPrivileged = Boolean(
    req.user?.isAdmin ||
    req.user?.role === 'admin' ||
    req.user?.role === 'hr' ||
    req.user?.systemRole === 'admin' ||
    req.user?.systemRole === 'hr' ||
    req.user?.permissions?.allAccess
  );

  const targetId = (!isPrivileged && req.user)
    ? String(req.user.id || req.user._id || '').trim()
    : String(employeeId || req.user?.id || req.user?._id || '').trim();

  const targetCode = (!isPrivileged && req.user)
    ? String(req.user.employeeCode || '').trim().toUpperCase()
    : String(employeeCode || req.user?.employeeCode || '').trim().toUpperCase();

  const today = req.body.date || getLocalTodayStr();

  if (!targetId && !targetCode) {
    return res.status(400).json({ success: false, message: 'employeeId or employeeCode is required' });
  }

  const cacheKey = targetCode || targetId;
  const existingCached = liveTelemetryCache.get(cacheKey);

  const safeClockOutTime = clockOutTime || req.body.clockOutTime || null;
  const safeClockOutTimestamp = clockOutTimestamp || req.body.clockOutTimestamp || null;

  const payload = {
    employeeId: targetId,
    employeeCode: targetCode,
    employeeName: req.body.employeeName || req.user?.name || '',
    date: today,
    isClockedIn: isClockedIn !== undefined ? Boolean(isClockedIn) : (existingCached ? existingCached.isClockedIn : true),
    clockInTime: existingCached?.firstClockInTime || existingCached?.clockInTime || clockInTime || null,
    firstClockInTime: existingCached?.firstClockInTime || req.body.firstClockInTime || clockInTime || existingCached?.clockInTime || null,
    clockOutTime: safeClockOutTime || (isClockedIn ? null : (existingCached?.clockOutTime || null)),
    lastClockOutTime: safeClockOutTime || req.body.lastClockOutTime || existingCached?.lastClockOutTime || existingCached?.clockOutTime || null,
    clockInTimestamp: existingCached?.clockInTimestamp || (clockInTimestamp ? Number(clockInTimestamp) : null),
    clockOutTimestamp: safeClockOutTimestamp ? Number(safeClockOutTimestamp) : (existingCached?.clockOutTimestamp || null),
    currentSessionStartTimestamp: currentSessionStartTimestamp ? Number(currentSessionStartTimestamp) : null,
    workSeconds: workSeconds !== undefined ? Number(workSeconds) : 0,
    breakSeconds: breakSeconds !== undefined ? Number(breakSeconds) : (existingCached?.breakSeconds || 0),
    isOnBreak: Boolean(isOnBreak),
    breakType: breakType || null,
    breakStartTimestamp: breakStartTimestamp ? Number(breakStartTimestamp) : (isOnBreak && existingCached?.breakStartTimestamp ? existingCached.breakStartTimestamp : (isOnBreak ? Date.now() : null)),
    activeTask: activeTask ? { ...activeTask, timerRunning: Boolean(activeTask.timerRunning !== false) } : null,
    lastHeartbeatAt: Date.now()
  };

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const nowTs = Date.now();
  let firstClockTs = Number(payload.clockInTimestamp || 0);
  if (!firstClockTs || firstClockTs < todayMidnight.getTime()) {
    if (payload.clockInTime) {
      firstClockTs = todayMidnight.getTime() + parseTimeStringToSeconds(payload.clockInTime) * 1000;
    }
  }
  const maxAllowed = (firstClockTs && firstClockTs >= todayMidnight.getTime())
    ? Math.max(0, Math.floor((nowTs - firstClockTs) / 1000))
    : Math.max(0, Math.floor((nowTs - todayMidnight.getTime()) / 1000));

  if (existingCached && Number(existingCached.workSeconds || 0) > payload.workSeconds) {
    payload.workSeconds = Number(existingCached.workSeconds);
  }
  payload.workSeconds = Math.min(payload.workSeconds, maxAllowed);

  if (payload.activeTask) {
    const taskStart = Number(payload.activeTask.startedAt) ||
      (existingCached?.activeTask?.startedAt ? Number(existingCached.activeTask.startedAt) : Date.now());
    payload.activeTask.startedAt = taskStart;
    payload.activeTask.accumulatedSeconds = Number(payload.activeTask.accumulatedSeconds || payload.activeTask.timerSeconds || 0);
  }
  liveTelemetryCache.set(cacheKey, payload);

  // Background upsert in MongoDB Atlas to persist live state (Monotonic Shield: never degrade workSeconds)
  try {
    const orClauses = [];
    if (targetId && mongoose.Types.ObjectId.isValid(targetId)) orClauses.push({ employee: targetId });
    if (targetCode) orClauses.push({ employeeCode: targetCode });

    if (orClauses.length > 0) {
      Attendance.findOne({ date: today, $or: orClauses }).then(async existing => {
        let safeWorkSecs = existing ? Math.max(Number(existing.workSeconds || 0), Number(payload.workSeconds || 0)) : Number(payload.workSeconds || 0);
        if (safeWorkSecs <= 0 && existing && existing.clockInTimestamp && (existing.clockOutTimestamp || payload.clockOutTimestamp)) {
          const outTs = Number(existing.clockOutTimestamp || payload.clockOutTimestamp);
          const inTs = Number(existing.clockInTimestamp);
          const reconstructed = Math.max(0, Math.floor((outTs - inTs) / 1000) - (Number(existing.breakSeconds) || 0));
          if (reconstructed > 0) safeWorkSecs = reconstructed;
        }
        safeWorkSecs = Math.min(safeWorkSecs, maxAllowed);

        let companySettings = null;
        try {
          const CompanySettings = require('../../settings/models/CompanySettings');
          companySettings = await CompanySettings.findOne().lean();
        } catch (_) {}
        const standardWorkHours = Number(companySettings?.standardWorkHours) || 9;
        const standardWorkSecs = standardWorkHours * 3600;
        const overtimeSecs = Math.max(0, safeWorkSecs - standardWorkSecs);
        const overtimeHours = +(overtimeSecs / 3600).toFixed(2);

        const updateObj = {
          isClockedIn: payload.isClockedIn,
          workSeconds: safeWorkSecs,
          breakSeconds: payload.breakSeconds,
          totalWorkingHours: +(safeWorkSecs / 3600).toFixed(2),
          overtimeSeconds: overtimeSecs,
          overtimeHours: overtimeHours,
          hasOvertime: overtimeSecs > 0,
          isOnBreak: payload.isOnBreak,
          breakType: payload.breakType,
          breakStartTimestamp: payload.breakStartTimestamp,
          activeTask: payload.activeTask,
          lastHeartbeatAt: payload.lastHeartbeatAt
        };
        if (overtimeSecs > 0) {
          updateObj.overtimeStatus = existing?.overtimeStatus && existing.overtimeStatus !== 'none' ? existing.overtimeStatus : 'approved';
          updateObj.overtimeReason = existing?.overtimeReason || 'Worked beyond standard shift hours';
          updateObj.overtimeApprovedBy = 'System (Auto)';
          updateObj.overtimeApprovedAt = existing?.overtimeApprovedAt || new Date();
        }
        if (payload.clockInTime) updateObj.clockInTime = payload.clockInTime;
        if (payload.clockInTimestamp) updateObj.clockInTimestamp = payload.clockInTimestamp;
        if (payload.currentSessionStartTimestamp) updateObj.currentSessionStartTimestamp = payload.currentSessionStartTimestamp;
        if (payload.breakStartTimestamp) updateObj.breakStartTimestamp = payload.breakStartTimestamp;

        if (existing) {
          return Attendance.updateOne({ _id: existing._id }, { $set: updateObj });
        } else if (payload.isClockedIn) {
          // If no existing record yet today and user is clocked in, create attendance record in MongoDB immediately!
          let initialStatus = 'present';
          let initialIsLate = false;
          let initialLateMins = 0;
          if (payload.clockInTime) {
            let companySettings = null;
            try {
              const CompanySettings = require('../../settings/models/CompanySettings');
              companySettings = await CompanySettings.findOne().lean();
            } catch (_) {}
            const shiftStartTime = companySettings?.shiftStartTime || '10:00 AM';
            const graceMins = companySettings?.gracePeriodMinutes !== undefined ? Number(companySettings.gracePeriodMinutes) : 15;
            const shiftStartSecs = parseTimeStringToSeconds(shiftStartTime);
            const graceLimitSecs = shiftStartSecs + (graceMins * 60);

            const inSecs = parseTimeStringToSeconds(payload.clockInTime);
            // Dynamic check against saved company policy (shift start + grace period)
            if (inSecs > graceLimitSecs) {
              initialStatus = 'late';
              initialIsLate = true;
              initialLateMins = Math.floor((inSecs - shiftStartSecs) / 60);
            }
          }
          const newRec = {
            ...updateObj,
            employee: targetId && mongoose.Types.ObjectId.isValid(targetId) ? targetId : new mongoose.Types.ObjectId(),
            employeeId: targetId,
            employeeCode: targetCode,
            employeeName: payload.employeeName || req.user?.name || 'Employee',
            date: today,
            status: initialStatus,
            isLate: initialIsLate,
            lateByMinutes: initialLateMins
          };
          return Attendance.create(newRec);
        }
      }).catch(e => console.warn('[heartbeat] DB update notice:', e.message));
    }
  } catch (_) {}

  const cachedState = liveTelemetryCache.get(cacheKey);
  res.json({
    success: true,
    timestamp: Date.now(),
    serverActiveTask: cachedState?.activeTask || null,
    serverIsClockedIn: cachedState?.isClockedIn !== undefined ? cachedState.isClockedIn : true
  });
});

// ─── GET /api/attendance/live-telemetry ────────────────────────────────────────
// Returns live status of all active employees for Live Operations & Admin Dashboard
const getLiveTelemetry = asyncHandler(async (req, res) => {
  const today = req.query.date || getLocalTodayStr();
  const now = Date.now();

  // Load dynamically CompanySettings for shift timing & grace period
  const CompanySettings = require('../../settings/models/CompanySettings');
  let companySettings = null;
  try {
    companySettings = await CompanySettings.findOne().lean();
  } catch (err) {}
  const shiftStartTime = companySettings?.shiftStartTime || '10:00 AM';
  const graceMins = companySettings?.gracePeriodMinutes !== undefined ? Number(companySettings.gracePeriodMinutes) : 15;
  const shiftStartSecs = parseTimeStringToSeconds(shiftStartTime);
  const graceLimitSecs = shiftStartSecs + (graceMins * 60);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayMidnightMs = todayMidnight.getTime();
  const maxPossibleGrossToday = Math.max(0, Math.floor((now - todayMidnightMs) / 1000));

  // Load all today's attendance records from MongoDB
  const query = { date: today };
  const records = await Attendance.find(query).lean();

  // Also query active tasks across the company to surface live running tasks and live ticking task seconds
  const activeTasks = await Task.find({
    $or: [
      { timerRunning: true },
      { sessionDate: today, todayWorkSeconds: { $gt: 0 } },
      { sessionDate: today, timerSeconds: { $gt: 0 } },
      { sessionDate: today, status: { $in: ['in_progress', 'on_hold'] } }
    ]
  }).lean().catch(() => []);

  const telemetryMap = {};

  records.forEach(r => {
    const code = String(r.employeeCode || '').trim().toUpperCase();
    const id = String(r.employee?._id || r.employee || r.employeeId || r._id);
    const key = code || id;

    const isClockedIn = Boolean((r.isClockedIn || (r.clockInTime && r.clockInTime !== '--' && !r.clockOutTime)) && !r.clockOutTime);
    const isClockedOut = Boolean(r.clockOutTime || r.clockOut);
    const isOnBreak = Boolean(r.isOnBreak);
    const inTimeStr = r.clockInTime || r.clockIn;

    // Dynamic shift status calibration against company policy (e.g. 10:00 AM + 15m grace)
    let recStatus = r.status || 'present';
    let recIsLate = Boolean(r.isLate);
    if (inTimeStr && inTimeStr !== '--' && inTimeStr !== '—') {
      const inSecs = parseTimeStringToSeconds(inTimeStr);
      if (inSecs > 0) {
        if (inSecs <= graceLimitSecs && (recStatus === 'late' || !recStatus)) {
          recStatus = 'present';
          recIsLate = false;
          Attendance.updateOne({ _id: r._id }, { $set: { status: 'present', isLate: false, lateByMinutes: 0 } }).catch(() => {});
        } else if (inSecs > graceLimitSecs && recStatus === 'present') {
          recStatus = 'late';
          recIsLate = true;
          const lateMins = Math.floor((inSecs - shiftStartSecs) / 60);
          Attendance.updateOne({ _id: r._id }, { $set: { status: 'late', isLate: true, lateByMinutes: lateMins } }).catch(() => {});
        }
      }
    }

    let clockInTs = Number(r.clockInTimestamp || 0);

    if (!clockInTs || clockInTs < todayMidnightMs) {
      if (inTimeStr && inTimeStr !== '--' && inTimeStr !== '—') {
        clockInTs = todayMidnightMs + parseTimeStringToSeconds(inTimeStr) * 1000;
      }
    }
    const maxAllowedSinceClockIn = (clockInTs && clockInTs >= todayMidnightMs)
      ? Math.max(0, Math.floor((now - clockInTs) / 1000))
      : maxPossibleGrossToday;

    const validSessions = Array.isArray(r.punchSessions)
      ? r.punchSessions.filter(s => Number(s.inTimestamp || 0) >= todayMidnightMs)
      : [];
    const pastSessionsSecs = validSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
    const lastSessionOut = validSessions.length > 0
      ? Math.max(...validSessions.map(s => Number(s.outTimestamp || s.inTimestamp || 0)))
      : 0;

    let liveWorkSecs = 0;
    if (isClockedIn) {
      if (isOnBreak) {
        const frozen = (Number(r.workSeconds) || 0) > 0 ? Number(r.workSeconds) : pastSessionsSecs;
        liveWorkSecs = Math.min(frozen, maxAllowedSinceClockIn);
      } else {
        let sessStart = Number(r.currentSessionStartTimestamp || 0);
        if (lastSessionOut > 0 && sessStart < lastSessionOut) {
          sessStart = lastSessionOut;
        }
        if (!sessStart || sessStart < clockInTs) {
          sessStart = lastSessionOut > 0 ? lastSessionOut : (clockInTs || now);
        }
        const curSessionElapsed = (sessStart > 0 && sessStart <= now) ? Math.max(0, Math.floor((now - sessStart) / 1000)) : 0;
        const sessionBased = pastSessionsSecs + curSessionElapsed;
        const dbWorkSecs = Number(r.workSeconds || 0);
        const bestWorkSecs = Math.max(sessionBased, dbWorkSecs);
        liveWorkSecs = Math.min(bestWorkSecs, maxAllowedSinceClockIn);
      }
    } else if (isClockedOut) {
      let finalSecs = pastSessionsSecs > 0 ? pastSessionsSecs : (Number(r.workSeconds) || 0);
      if (finalSecs <= 0 && r.totalWorkingHours) {
        finalSecs = Math.round(Number(r.totalWorkingHours) * 3600);
      }
      if (finalSecs <= 0 && clockInTs > 0 && r.clockOutTimestamp) {
        finalSecs = Math.max(0, Math.floor((Number(r.clockOutTimestamp) - clockInTs) / 1000) - (Number(r.breakSeconds) || 0));
      }
      liveWorkSecs = Math.min(finalSecs, maxAllowedSinceClockIn);
    } else {
      liveWorkSecs = pastSessionsSecs > 0 ? Math.min(pastSessionsSecs, maxAllowedSinceClockIn) : 0;
    }

    // Match any actively running task for this employee from Task collection
    let runningTask = null;
    let matchedTask = (activeTasks || []).find(t => {
      if (!t.timerRunning) return false;
      const tAssignedId = String(t.assignedToId || t.assignedTo || '').toUpperCase();
      const tActiveUser = String(t.activeUserId || '').toUpperCase();
      if (code && (tAssignedId === code || tActiveUser === code)) return true;
      if (id && (tAssignedId === String(id).toUpperCase() || tActiveUser === String(id).toUpperCase())) return true;
      if (Array.isArray(t.assignedToIds) && t.assignedToIds.some(aid => String(aid).toUpperCase() === code || String(aid).toUpperCase() === String(id).toUpperCase())) return true;
      if (Array.isArray(t.assignees) && t.assignees.some(a => String(a.employeeCode || a._id || a.id).toUpperCase() === code || String(a._id || a.id) === String(id))) return true;
      return false;
    });

    if (!matchedTask) {
      // If no actively ticking timer, find any task worked on today by this employee (even if paused / on break)
      matchedTask = (activeTasks || []).find(t => {
        const tAssignedId = String(t.assignedToId || t.assignedTo || '').toUpperCase();
        const tActiveUser = String(t.activeUserId || '').toUpperCase();
        if (code && (tAssignedId === code || tActiveUser === code)) return true;
        if (id && (tAssignedId === String(id).toUpperCase() || tActiveUser === String(id).toUpperCase())) return true;
        if (Array.isArray(t.assignedToIds) && t.assignedToIds.some(aid => String(aid).toUpperCase() === code || String(aid).toUpperCase() === String(id).toUpperCase())) return true;
        if (Array.isArray(t.assignees) && t.assignees.some(a => String(a.employeeCode || a._id || a.id).toUpperCase() === code || String(a._id || a.id) === String(id))) return true;
        return false;
      });
    }

    if (matchedTask && isClockedIn) {
      const isRunning = Boolean(matchedTask.timerRunning && !isOnBreak);
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayMidnightMs = todayMidnight.getTime();
      const rawStartTs = Number(matchedTask.startedAt) || 0;
      const isStartValid = isRunning && rawStartTs >= todayMidnightMs && rawStartTs <= now;
      const taskStart = isStartValid ? rawStartTs : null;
      const elapsedTask = isStartValid ? Math.floor((now - rawStartTs) / 1000) : 0;
      
      // Strict same-day isolation in backend telemetry: never count prior day's accumulated duration!
      let todayTaskBase = 0;
      if (matchedTask.dailySessions && typeof matchedTask.dailySessions === 'object' && matchedTask.dailySessions[today] !== undefined) {
        let baseVal = Number(matchedTask.dailySessions[today]) || 0;
        const priorSum = Object.entries(matchedTask.dailySessions)
          .filter(([d]) => d < today)
          .reduce((s, [, v]) => s + (Number(v) || 0), 0);
        if (priorSum > 0 && baseVal >= priorSum + (Number(matchedTask.todayWorkSeconds) || 0)) {
          baseVal = Math.max(0, baseVal - priorSum);
        }
        todayTaskBase = baseVal;
      } else if (matchedTask.sessionDate === today && matchedTask.todayWorkSeconds !== undefined && Number(matchedTask.todayWorkSeconds) > 0) {
        todayTaskBase = Number(matchedTask.todayBaseSecs ?? matchedTask.todayWorkSeconds);
      } else {
        todayTaskBase = 0;
      }
      todayTaskBase = Math.min(todayTaskBase, maxPossibleGrossToday);
      const liveTaskTodaySecs = Math.min(todayTaskBase + elapsedTask, maxPossibleGrossToday);
      const totalAccum = Math.max(Number(matchedTask.accumulatedSeconds !== undefined ? matchedTask.accumulatedSeconds : (matchedTask.timerSeconds || 0)), liveTaskTodaySecs);

      runningTask = {
        _id: matchedTask._id,
        id: matchedTask.id || matchedTask._id,
        taskId: matchedTask._id,
        taskCode: matchedTask.taskCode,
        title: matchedTask.title,
        projectName: matchedTask.projectName,
        accumulatedSeconds: totalAccum,
        todayWorkSeconds: todayTaskBase,
        timerSeconds: liveTaskTodaySecs,
        liveTaskSecs: liveTaskTodaySecs,
        dailySessions: matchedTask.dailySessions || {},
        sessionDate: matchedTask.sessionDate || today,
        startedAt: taskStart,
        timerRunning: isRunning
      };
    } else if (r.activeTask && isClockedIn) {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayMidnightMs = todayMidnight.getTime();
      const rawStartTs = Number(r.activeTask.startedAt) || 0;
      const isRunning = Boolean(r.activeTask.timerRunning !== false && rawStartTs >= todayMidnightMs && rawStartTs <= now && !isOnBreak);
      const taskStart = isRunning ? rawStartTs : null;
      const elapsedTask = isRunning ? Math.floor((now - rawStartTs) / 1000) : 0;
      let todayTaskBase = 0;
      if (r.activeTask.dailySessions && typeof r.activeTask.dailySessions === 'object' && r.activeTask.dailySessions[today] !== undefined) {
        let baseVal = Number(r.activeTask.dailySessions[today]) || 0;
        const priorSum = Object.entries(r.activeTask.dailySessions)
          .filter(([d]) => d < today)
          .reduce((s, [, v]) => s + (Number(v) || 0), 0);
        if (priorSum > 0 && baseVal >= priorSum + (Number(r.activeTask.todayWorkSeconds) || 0)) {
          baseVal = Math.max(0, baseVal - priorSum);
        }
        todayTaskBase = baseVal;
      } else if (r.activeTask.sessionDate === today) {
        todayTaskBase = Math.max(Number(r.activeTask.todayBaseSecs ?? r.activeTask.todayWorkSeconds ?? 0), 0);
      } else {
        todayTaskBase = 0;
      }
      todayTaskBase = Math.min(todayTaskBase, maxPossibleGrossToday);
      const liveTaskTodaySecs = Math.min(todayTaskBase + elapsedTask, maxPossibleGrossToday);
      const totalAccum = Math.max(Number(r.activeTask.accumulatedSeconds !== undefined ? r.activeTask.accumulatedSeconds : (r.activeTask.timerSeconds || todayTaskBase)), liveTaskTodaySecs);

      runningTask = {
        ...r.activeTask,
        accumulatedSeconds: totalAccum,
        todayWorkSeconds: todayTaskBase,
        timerSeconds: liveTaskTodaySecs,
        liveTaskSecs: liveTaskTodaySecs,
        timerRunning: isRunning,
        startedAt: taskStart
      };
    }

    const state = {
      employeeId: id,
      employeeCode: code,
      employeeName: r.employeeName,
      date: r.date,
      status: recStatus,
      isLate: recIsLate,
      isClockedIn,
      isClockedOut,
      isOnBreak,
      breakType: r.breakType || null,
      breakSeconds: Number(r.breakSeconds) || 0,
      breakStartTimestamp: Number(r.breakStartTimestamp) || null,
      firstClockInTime: r.firstClockInTime || r.clockInTime || r.clockIn || null,
      clockInTime: r.firstClockInTime || r.clockInTime || r.clockIn || null,
      clockInTimestamp: clockInTs,
      clockOutTime: r.clockOutTime || r.clockOut || null,
      lastClockOutTime: r.lastClockOutTime || r.clockOutTime || r.clockOut || null,
      clockOutTimestamp: r.clockOutTimestamp || null,
      currentSessionStartTimestamp: Number(r.currentSessionStartTimestamp || clockInTs || 0),
      workSeconds: liveWorkSecs,
      totalWorkingHours: +(liveWorkSecs / 3600).toFixed(2),
      activeTask: runningTask,
      lastHeartbeatAt: r.lastHeartbeatAt || now,
      timestamp: now,
      fetchedAt: now
    };

    telemetryMap[key] = state;
    if (code) {
      telemetryMap[code] = state;
      telemetryMap[code.toUpperCase()] = state;
      telemetryMap[code.toLowerCase()] = state;
    }
    if (id) {
      telemetryMap[id] = state;
      telemetryMap[String(id).toUpperCase()] = state;
      telemetryMap[String(id).toLowerCase()] = state;
    }
    const empEmail = String(r.employeeEmail || r.email || '').trim().toLowerCase();
    if (empEmail) {
      telemetryMap[empEmail] = state;
    }
  });

  // Merge ultra-fresh entries from in-memory heartbeat cache (0ms instant live reflection, up to 3 mins tolerance for background tab throttling)
  liveTelemetryCache.forEach((cachedVal, cacheKey) => {
    if (!cachedVal) return;
    if (cachedVal.date === today && (now - (cachedVal.lastHeartbeatAt || 0)) < 180000) {
      const code = String(cachedVal.employeeCode || '').trim().toUpperCase();
      const id = String(cachedVal.employeeId || '');
      const existingTelem = telemetryMap[code] || telemetryMap[id] || null;

      // SAFETY: If existing record in DB shows isClockedIn: true today and has no clockOutTime,
      // never let a stale unclocked heartbeat with older timestamp downgrade it to false!
      if (existingTelem?.isClockedIn && !existingTelem?.clockOutTime && !cachedVal.isClockedIn && !cachedVal.clockOutTime) {
        return; // Ignore stale unclocked heartbeat from before clock-in
      }

      let effectiveActiveTask = null;
      if (cachedVal && 'activeTask' in cachedVal) {
        effectiveActiveTask = cachedVal.activeTask;
      } else if (existingTelem && existingTelem.activeTask) {
        effectiveActiveTask = existingTelem.activeTask;
      }
      if (effectiveActiveTask) {
        const isRunning = Boolean(effectiveActiveTask.timerRunning !== false && effectiveActiveTask.startedAt && cachedVal.isClockedIn && !cachedVal.isOnBreak);
        const taskStart = isRunning ? Number(effectiveActiveTask.startedAt) : null;
        const elapsedTask = isRunning ? Math.max(0, Math.floor((now - taskStart) / 1000)) : 0;
        let todayTaskBase = 0;
        if (effectiveActiveTask.dailySessions && typeof effectiveActiveTask.dailySessions === 'object' && effectiveActiveTask.dailySessions[today] !== undefined) {
          todayTaskBase = Number(effectiveActiveTask.dailySessions[today]) || 0;
        } else if (effectiveActiveTask.sessionDate === today) {
          todayTaskBase = Math.max(Number(effectiveActiveTask.todayBaseSecs ?? effectiveActiveTask.todayWorkSeconds ?? 0), 0);
        } else if (effectiveActiveTask.startDate === today || String(effectiveActiveTask.createdAt || '').startsWith(today)) {
          todayTaskBase = Number(effectiveActiveTask.todayWorkSeconds || 0);
        } else {
          todayTaskBase = 0;
        }
        const liveTaskTodaySecs = todayTaskBase + elapsedTask;
        const totalAccum = Number(effectiveActiveTask.accumulatedSeconds !== undefined ? effectiveActiveTask.accumulatedSeconds : (effectiveActiveTask.timerSeconds || todayTaskBase));
        effectiveActiveTask = {
          ...effectiveActiveTask,
          startedAt: taskStart,
          accumulatedSeconds: totalAccum,
          todayWorkSeconds: todayTaskBase,
          timerSeconds: liveTaskTodaySecs,
          liveTaskSecs: liveTaskTodaySecs,
          timerRunning: isRunning
        };
      }

      const mergedState = {
        ...(existingTelem || {}),
        employeeId: id || existingTelem?.employeeId,
        employeeCode: code || existingTelem?.employeeCode,
        employeeName: cachedVal.employeeName || existingTelem?.employeeName,
        date: today,
        status: existingTelem?.status || 'present',
        isLate: existingTelem?.isLate || false,
        isClockedIn: cachedVal.isClockedIn,
        isClockedOut: Boolean(!cachedVal.isClockedIn && (cachedVal.clockOutTime || existingTelem?.clockOutTime)),
        isOnBreak: Boolean(cachedVal.isOnBreak),
        breakType: cachedVal.breakType || existingTelem?.breakType || null,
        breakSeconds: Number(cachedVal.breakSeconds !== undefined ? cachedVal.breakSeconds : (existingTelem?.breakSeconds || 0)),
        breakStartTimestamp: Number(cachedVal.breakStartTimestamp || existingTelem?.breakStartTimestamp || null),
        firstClockInTime: cachedVal.firstClockInTime || existingTelem?.firstClockInTime || cachedVal.clockInTime || existingTelem?.clockInTime || null,
        clockInTime: cachedVal.firstClockInTime || existingTelem?.firstClockInTime || cachedVal.clockInTime || existingTelem?.clockInTime || null,
        clockInTimestamp: cachedVal.clockInTimestamp || existingTelem?.clockInTimestamp || null,
        clockOutTime: cachedVal.clockOutTime || existingTelem?.clockOutTime || null,
        lastClockOutTime: cachedVal.lastClockOutTime || cachedVal.clockOutTime || existingTelem?.lastClockOutTime || existingTelem?.clockOutTime || null,
        currentSessionStartTimestamp: cachedVal.currentSessionStartTimestamp || existingTelem?.currentSessionStartTimestamp || null,
        workSeconds: (() => {
          let cacheClockInTs = Number(cachedVal.clockInTimestamp || existingTelem?.clockInTimestamp || 0);
          if (!cacheClockInTs || cacheClockInTs < todayMidnightMs) {
            const inStr = cachedVal.clockInTime || existingTelem?.clockInTime;
            if (inStr && inStr !== '--' && inStr !== '—') {
              cacheClockInTs = todayMidnightMs + parseTimeStringToSeconds(inStr) * 1000;
            }
          }
          const maxAllowedForMerged = (cacheClockInTs && cacheClockInTs >= todayMidnightMs)
            ? Math.max(0, Math.floor((now - cacheClockInTs) / 1000))
            : maxPossibleGrossToday;
          return Math.min(Math.max(Number(existingTelem?.workSeconds || 0), Number(cachedVal.workSeconds || 0)), maxAllowedForMerged);
        })(),
        totalWorkingHours: +((() => {
          let cacheClockInTs = Number(cachedVal.clockInTimestamp || existingTelem?.clockInTimestamp || 0);
          if (!cacheClockInTs || cacheClockInTs < todayMidnightMs) {
            const inStr = cachedVal.clockInTime || existingTelem?.clockInTime;
            if (inStr && inStr !== '--' && inStr !== '—') {
              cacheClockInTs = todayMidnightMs + parseTimeStringToSeconds(inStr) * 1000;
            }
          }
          const maxAllowedForMerged = (cacheClockInTs && cacheClockInTs >= todayMidnightMs)
            ? Math.max(0, Math.floor((now - cacheClockInTs) / 1000))
            : maxPossibleGrossToday;
          return Math.min(Math.max(Number(existingTelem?.workSeconds || 0), Number(cachedVal.workSeconds || 0)), maxAllowedForMerged) / 3600;
        })()).toFixed(2),
        activeTask: effectiveActiveTask,
        lastHeartbeatAt: cachedVal.lastHeartbeatAt || now,
        timestamp: now,
        fetchedAt: now
      };

      if (code) {
        telemetryMap[code] = mergedState;
        telemetryMap[code.toUpperCase()] = mergedState;
        telemetryMap[code.toLowerCase()] = mergedState;
      }
      if (id) {
        telemetryMap[id] = mergedState;
        telemetryMap[String(id).toUpperCase()] = mergedState;
        telemetryMap[String(id).toLowerCase()] = mergedState;
      }
      const cEmail = String(cachedVal.employeeEmail || cachedVal.email || '').trim().toLowerCase();
      if (cEmail) {
        telemetryMap[cEmail] = mergedState;
      }
    }
  });

  res.json({
    success: true,
    date: today,
    timestamp: now,
    count: Object.keys(telemetryMap).length,
    data: telemetryMap
  });
});

module.exports = {
  checkIsPrivileged,
  autoClosePastDayShifts,
  getMonthlyAttendance,
  getAttendanceSummary,
  getAttendanceByDate,
  markAttendance,
  bulkMarkAttendance,
  deleteAttendance: deleteAttendanceRecord,
  deleteAttendanceRecord,
  getAuditLogs,
  createAuditLog,
  forceClockOut,
  getOvertimeRequests,
  requestOvertime,
  updateOvertimeStatus,
  updateLiveHeartbeat,
  getLiveTelemetry,
  validateStrictDurationSeconds,
  validateStrictTimestamp,
  validatePunchSessions,
  computeAuditFingerprint,
  MAX_CLOCK_SKEW_MS,
  MAX_DAY_SECONDS,
  MIN_ALLOWED_TIMESTAMP_MS
};
