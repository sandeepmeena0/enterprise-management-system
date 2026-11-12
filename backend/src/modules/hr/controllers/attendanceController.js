const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const AttendanceAudit = require('../models/AttendanceAudit');
const Task = require('../../work/models/Task');
const asyncHandler = require('../../../shared/middleware/asyncHandler');

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

    await Attendance.updateMany(
      {
        date: { $lt: todayStr },
        isClockedIn: true,
        clockOutTime: null,
        $or: [
          { clockInTimestamp: { $lt: sixteenHoursAgo } },
          { clockInTimestamp: null },
          { currentSessionStartTimestamp: { $lt: sixteenHoursAgo } }
        ]
      },
      {
        $set: {
          isClockedIn: false,
          isOnBreak: false,
          clockOutTime: autoOutTime,
          clockOut: autoOutTime,
          workSeconds: autoSecs,
          totalWorkingHours: autoHours,
          notes: 'Auto-closed past-day shift (daily shift reset)'
        }
      }
    );
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
  // Reject future date attendance for active presence statuses (present, late, half_day, absent).
  // Future dates can only be scheduled for 'on_leave' or 'holiday'.
  if (date > todayStr && ['present', 'late', 'half_day', 'absent'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot mark attendance as '${status}' for a future date (${date}). Attendance can only be recorded for today or past dates.`
    });
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

  const targetEmpId = empDoc ? empDoc._id : (mongoose.Types.ObjectId.isValid(rawEmp) ? rawEmp : new mongoose.Types.ObjectId());
  const targetEmpName = empDoc ? empDoc.name : (req.body.employeeName || 'Employee');
  const targetEmpCode = empDoc ? empDoc.employeeCode : (req.body.employeeCode || String(rawEmp));
  const targetEmpRole = empDoc ? empDoc.role : (req.body.employeeRole || 'Team Member');
  const targetEmpAvatar = empDoc ? empDoc.avatar : (req.body.employeeAvatar || '');

  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.permissions?.editAttendance || req.user?.permissions?.allAccess;
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

  // Compute working hours and late calculation dynamically based on company policy
  let totalWorkingHours = 0;
  let isLate = false;
  let lateByMinutes = 0;
  let calculatedStatus = status;

  if (clockInTime) {
    const inSecs = parseTimeStringToSeconds(clockInTime);
    if (inSecs > graceLimitSecs) {
      isLate = true;
      lateByMinutes = Math.floor((inSecs - shiftStartSecs) / 60);
      calculatedStatus = 'late';
    } else {
      isLate = false;
      lateByMinutes = 0;
      if (calculatedStatus === 'late' || !calculatedStatus) {
        calculatedStatus = 'present';
      }
    }
  }

  if (clockInTime && clockOutTime) {
    const inSecs = parseTimeStringToSeconds(clockInTime);
    const outSecs = parseTimeStringToSeconds(clockOutTime);
    let diffSecs = outSecs - inSecs;
    if (diffSecs < 0) {
      // Cross-midnight shift (e.g. 10:00 PM to 06:00 AM)
      diffSecs += 24 * 3600;
    }
    totalWorkingHours = +(diffSecs / 3600).toFixed(2);
  }

  const effectiveWorkHours = (workSeconds !== undefined && Number(workSeconds) > 0)
    ? +(Number(workSeconds) / 3600).toFixed(2)
    : totalWorkingHours;

  // Evaluate half-day if employee worked fewer hours than company half-day threshold
  if (clockOutTime && effectiveWorkHours > 0 && effectiveWorkHours < halfDayThresholdHours && !['on_leave', 'holiday', 'day_off'].includes(calculatedStatus)) {
    calculatedStatus = 'half_day';
  }

  // Calculate Overtime if employee worked beyond standard work hours
  let overtimeHours = 0;
  let overtimeSeconds = 0;
  if (effectiveWorkHours > standardWorkHours) {
    overtimeHours = +(effectiveWorkHours - standardWorkHours).toFixed(2);
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
    notes: notes || (auditNote ? `Adjusted by ${adminActorName}: ${auditNote}` : ''),
    markedBy: adminActorName,
    overtimeHours,
    overtimeSeconds
  };

  const existingRecord = await Attendance.findOne({
    date,
    $or: [{ employee: targetEmpId }, { employeeCode: targetEmpCode }]
  });

  if (existingRecord && (existingRecord.firstClockInTime || existingRecord.clockInTime)) {
    updateFields.firstClockInTime = existingRecord.firstClockInTime || existingRecord.clockInTime;
    updateFields.clockInTime = existingRecord.firstClockInTime || existingRecord.clockInTime;
    updateFields.clockInTimestamp = existingRecord.firstClockInTimestamp || existingRecord.clockInTimestamp || clockInTimestamp;
  } else if (clockInTime !== undefined) {
    updateFields.firstClockInTime = req.body.firstClockInTime || clockInTime;
    updateFields.clockInTime = req.body.firstClockInTime || clockInTime;
    if (clockInTimestamp !== undefined) updateFields.clockInTimestamp = clockInTimestamp;
  }

  if ('clockOutTime' in req.body) {
    updateFields.clockOutTime = clockOutTime;
    if (clockOutTime) updateFields.lastClockOutTime = clockOutTime;
  }
  if ('clockOutTimestamp' in req.body) {
    updateFields.clockOutTimestamp = clockOutTimestamp;
    if (clockOutTimestamp) updateFields.lastClockOutTimestamp = clockOutTimestamp;
  }
  if (workSeconds !== undefined) updateFields.workSeconds = Number(workSeconds) || 0;
  if (breakSeconds !== undefined) updateFields.breakSeconds = Number(breakSeconds) || 0;
  if (isOnBreak !== undefined) updateFields.isOnBreak = Boolean(isOnBreak);
  if (breakType !== undefined) updateFields.breakType = breakType;
  if (breakHistory !== undefined) updateFields.breakHistory = breakHistory;
  if ('punchSessions' in req.body) updateFields.punchSessions = req.body.punchSessions;
  if (req.body.currentSessionStartTimestamp !== undefined) updateFields.currentSessionStartTimestamp = Number(req.body.currentSessionStartTimestamp) || null;
  if (req.body.breakStartTimestamp !== undefined) updateFields.breakStartTimestamp = Number(req.body.breakStartTimestamp) || null;
  if ('activeTask' in req.body) updateFields.activeTask = req.body.activeTask;
  updateFields.lastHeartbeatAt = Date.now();

  if (isClockedIn !== undefined) {
    updateFields.isClockedIn = Boolean(isClockedIn);
  } else if (clockInTime && !clockOutTime) {
    updateFields.isClockedIn = true;
  } else if (clockOutTime) {
    updateFields.isClockedIn = false;
  }

  if (workSeconds !== undefined && Number(workSeconds) > 0) {
    updateFields.totalWorkingHours = +(Number(workSeconds) / 3600).toFixed(2);
  } else if (totalWorkingHours > 0) {
    updateFields.totalWorkingHours = totalWorkingHours;
  }
  updateFields.isLate = isLate;
  updateFields.lateByMinutes = lateByMinutes;

  const record = await Attendance.findOneAndUpdate(
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

  // Mandatory Audit Trail for Admin manual modifications
  if (auditNote || isAdminOverride || isPrivileged) {
    try {
      await AttendanceAudit.create({
        employee: targetEmpId,
        employeeId: String(targetEmpId),
        employeeName: record.employeeName || 'Employee',
        employeeCode: record.employeeCode || '',
        date,
        timeFormatted: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        type: 'admin_shift_adjustment',
        action: 'Admin Shift Hour Adjustment',
        durationSeconds: (record.totalWorkingHours || 0) * 3600,
        durationText: `${record.totalWorkingHours || 0}h`,
        actor: 'admin',
        actorId: String(adminActorId),
        actorName: adminActorName,
        isAdminOverride: true,
        adminId: String(adminActorId),
        adminName: adminActorName,
        auditNote: auditNote || 'Manual administrative attendance adjustment',
        details: `Shift manually adjusted by Admin ${adminActorName} (ID: ${adminActorId}). Status: ${status}, In: ${clockInTime || '—'}, Out: ${clockOutTime || '—'}. Reason: "${auditNote || 'Administrative review'}"`
      });
    } catch (auditErr) {
      console.warn('Failed to record admin shift adjustment audit:', auditErr);
    }
  }

  const resObj = record.toObject ? record.toObject() : { ...record };
  resObj.employeeId = String(resObj.employee || targetEmpId);
  res.status(200).json({ success: true, data: resObj });
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
  const { records } = req.body;
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ success: false, message: 'records array is required' });
  }

  const operations = records.map(r => ({
    updateOne: {
      filter: { employee: r.employee, date: r.date },
      update: { $set: r },
      upsert: true
    }
  }));

  const result = await Attendance.bulkWrite(operations);
  res.status(200).json({ success: true, message: 'Bulk attendance recorded', data: result });
});

// ─── DELETE /api/attendance/:id ───────────────────────────────────────────────
const deleteAttendanceRecord = asyncHandler(async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
  res.json({ success: true, message: 'Record deleted', data: {} });
});

// ═════════════════════════════════════════════════════════════════════════════
// 📋 AUDIT TRAIL & ADMIN OVERRIDE CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/attendance/audit ───────────────────────────────────────────────
const getAuditLogs = asyncHandler(async (req, res) => {
  const { employeeId, date, month, year, type, onlyOverrides } = req.query;
  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.systemRole === 'admin' || req.user?.permissions?.viewAuditTrail || req.user?.permissions?.allAccess;

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

  const employeeId = String(auditData.employeeId || auditData.employeeCode || req.user?.id || req.user?._id || '');
  const type = auditData.type || auditData.action || 'system';
  const action = auditData.action || auditData.type || 'audit';

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'employeeId is required' });
  }

  const isPrivileged = req.user?.isAdmin || req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.permissions?.editAttendance || req.user?.permissions?.allAccess;
  const isAdminOverride = !!auditData.isAdminOverride || (isPrivileged && auditData.actor === 'admin');

  // Sanitize employee field - must be valid Mongo ObjectId or omitted
  const mongoose = require('mongoose');
  let validEmployeeObjId = undefined;
  if (auditData.employee && mongoose.Types.ObjectId.isValid(auditData.employee)) {
    validEmployeeObjId = auditData.employee;
  }
  delete auditData.employee;

  let actor = auditData.actor || (isPrivileged ? 'admin' : 'employee');
  if (!['employee', 'admin', 'system'].includes(actor)) {
    actor = isPrivileged ? 'admin' : 'employee';
  }

  const employeeName = auditData.employeeName || req.user?.name || 'Employee';

  const record = new AttendanceAudit({
    ...auditData,
    employee: validEmployeeObjId,
    employeeId,
    employeeName,
    type,
    action,
    date: auditData.date || new Date().toISOString().split('T')[0],
    timeFormatted: auditData.timeFormatted || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    actor,
    actorId: auditData.actorId || req.user?.id || req.user?._id || 'unknown',
    actorName: auditData.actorName || req.user?.name || 'User',
    isAdminOverride,
    adminId: isAdminOverride ? (auditData.adminId || req.user?.id || req.user?._id) : null,
    adminName: isAdminOverride ? (auditData.adminName || req.user?.name) : null,
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
    }
    attRecord.notes = `Manual Clock-Out by Admin ${adminName}: "${noteText}"`;
    attRecord.markedBy = adminName;
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

  // Create official Audit Trail record
  const auditEntry = new AttendanceAudit({
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
    details: `Administrator ${adminName} [ID: ${adminId}] manually forced shift clock-out. Reason: "${noteText}"`
  });

  // Automatically pause any running task in MongoDB for this employee
  try {
    const taskMatch = [
      { assignedToId: String(employeeId) },
      { assignedToId: String(targetEmpCode) },
      { assignedToIds: String(employeeId) },
      { assignedToIds: String(targetEmpCode) },
      { activeUserId: String(employeeId) },
      { activeUserId: String(targetEmpCode) }
    ];
    if (targetEmpId) {
      taskMatch.push({ assignedTo: targetEmpId });
    }
    const runningTasks = await Task.find({
      timerRunning: true,
      $or: taskMatch
    });
    for (const rt of runningTasks) {
      let currentSecs = (rt.accumulatedSeconds !== undefined && rt.accumulatedSeconds !== null)
        ? Number(rt.accumulatedSeconds)
        : (Number(rt.timerSeconds) || 0);
      if (rt.startedAt) {
        currentSecs += Math.max(0, Math.floor((Date.now() - Number(rt.startedAt)) / 1000));
      }
      rt.timerRunning = false;
      rt.startedAt = null;
      rt.accumulatedSeconds = currentSecs;
      rt.timerSeconds = currentSecs;
      await rt.save();
    }
  } catch (taskErr) {
    console.warn('Failed to auto-pause tasks during force clock-out:', taskErr);
  }

  try {
    await auditEntry.save();
  } catch (auditErr) {
    console.warn('Could not save auditEntry in forceClockOut:', auditErr);
  }

  res.status(200).json({
    success: true,
    message: `Shift forcefully clocked out by Admin ${adminName}`,
    data: { attendance: attRecord, audit: auditEntry }
  });
});

// ─── GET /api/attendance/overtime ─────────────────────────────────────────────
const getOvertimeRequests = asyncHandler(async (req, res) => {
  const query = { overtimeStatus: { $in: ['pending', 'approved', 'rejected'] } };
  const records = await Attendance.find(query).sort({ date: -1, updatedAt: -1 });
  res.json({ success: true, count: records.length, data: records });
});

// ─── POST /api/attendance/overtime ────────────────────────────────────────────
const requestOvertime = asyncHandler(async (req, res) => {
  const { employeeId, employeeCode, employeeName, date, overtimeHours, overtimeSeconds, overtimeReason, overtimeTasks, requestedToId, requestedToName, isSelfApproved } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const mongoose = require('mongoose');
  let attRecord = await Attendance.findOne({
    date: targetDate,
    $or: [
      { employeeCode: employeeCode ? String(employeeCode).toUpperCase() : undefined },
      { employeeId: String(employeeId) },
      mongoose.Types.ObjectId.isValid(employeeId) ? { employee: employeeId } : null
    ].filter(Boolean)
  });

  const status = isSelfApproved ? 'approved' : 'pending';
  const approverName = isSelfApproved ? (employeeName || req.user?.name || 'Admin') : '';
  const approvedAt = isSelfApproved ? new Date() : null;

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
      employee: attRecord?.employee || employeeId,
      employeeName: employeeName || 'Employee',
      employeeCode: employeeCode || '',
      type: 'overtime_request',
      action: isSelfApproved ? 'overtime_self_approved' : 'overtime_requested',
      date: targetDate,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      performedBy: employeeName || req.user?.name || 'User',
      note: `${isSelfApproved ? 'Self-approved' : 'Submitted'} overtime of ${overtimeHours || 0}h: ${overtimeReason || ''}`
    });
    await auditEntry.save();
  } catch (_) {}

  res.json({ success: true, message: `Overtime request ${status}`, data: attRecord });
});

// ─── PUT /api/attendance/overtime/:id/status ──────────────────────────────────
const updateOvertimeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, approverName, rejectionReason } = req.body;

  const attRecord = await Attendance.findById(id);
  if (!attRecord) {
    return res.status(404).json({ success: false, message: 'Attendance record not found' });
  }

  attRecord.overtimeStatus = status;
  attRecord.overtimeApprovedBy = approverName || req.user?.name || 'Admin';
  attRecord.overtimeApprovedAt = new Date();
  if (rejectionReason) {
    attRecord.notes = attRecord.notes ? `${attRecord.notes} | Overtime rejected: ${rejectionReason}` : `Overtime rejected: ${rejectionReason}`;
  }
  await attRecord.save();

  // Create audit log
  try {
    const auditEntry = new AttendanceAudit({
      employee: attRecord.employee,
      employeeName: attRecord.employeeName,
      employeeCode: attRecord.employeeCode,
      type: 'overtime_decision',
      action: `overtime_${status}`,
      date: attRecord.date,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      performedBy: approverName || req.user?.name || 'Admin',
      note: `Overtime ${status} by ${approverName || 'Admin'}${rejectionReason ? `: ${rejectionReason}` : ''}`
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

  const targetId = String(employeeId || req.user?.id || req.user?._id || '').trim();
  const targetCode = String(employeeCode || req.user?.employeeCode || '').trim().toUpperCase();
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
    activeTask: (activeTask && activeTask.timerRunning !== false) ? { ...activeTask, timerRunning: true } : null,
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
  const activeTasks = await Task.find({ timerRunning: true }).lean().catch(() => []);

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
        liveWorkSecs = Math.min(sessionBased, maxAllowedSinceClockIn);
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
    const matchedTask = (activeTasks || []).find(t => {
      const tAssignedId = String(t.assignedToId || t.assignedTo || '').toUpperCase();
      const tActiveUser = String(t.activeUserId || '').toUpperCase();
      if (code && (tAssignedId === code || tActiveUser === code)) return true;
      if (id && (tAssignedId === String(id).toUpperCase() || tActiveUser === String(id).toUpperCase())) return true;
      if (Array.isArray(t.assignedToIds) && t.assignedToIds.some(aid => String(aid).toUpperCase() === code || String(aid).toUpperCase() === String(id).toUpperCase())) return true;
      if (Array.isArray(t.assignees) && t.assignees.some(a => String(a.employeeCode || a._id || a.id).toUpperCase() === code || String(a._id || a.id) === String(id))) return true;
      return false;
    });

    if (matchedTask && isClockedIn && !isOnBreak) {
      const taskStart = Number(matchedTask.startedAt || now);
      const elapsedTask = Math.max(0, Math.floor((now - taskStart) / 1000));
      
      // Strict same-day isolation in backend telemetry: never count prior day's accumulated duration!
      let todayTaskBase = 0;
      if (matchedTask.dailySessions && typeof matchedTask.dailySessions === 'object' && matchedTask.dailySessions[today] !== undefined) {
        todayTaskBase = Number(matchedTask.dailySessions[today]) || 0;
      } else if (matchedTask.sessionDate === today && matchedTask.todayWorkSeconds !== undefined && Number(matchedTask.todayWorkSeconds) > 0) {
        todayTaskBase = Number(matchedTask.todayWorkSeconds);
      } else if (matchedTask.startDate === today || String(matchedTask.createdAt || '').startsWith(today)) {
        todayTaskBase = Number(matchedTask.accumulatedSeconds || matchedTask.timerSeconds || 0);
      } else {
        todayTaskBase = 0;
      }
      const liveTaskTodaySecs = todayTaskBase + elapsedTask;
      const totalAccum = Number(matchedTask.accumulatedSeconds !== undefined ? matchedTask.accumulatedSeconds : (matchedTask.timerSeconds || 0));

      runningTask = {
        _id: matchedTask._id,
        id: matchedTask.id || matchedTask._id,
        taskId: matchedTask._id,
        taskCode: matchedTask.taskCode,
        title: matchedTask.title,
        projectName: matchedTask.projectName,
        accumulatedSeconds: totalAccum,
        todayWorkSeconds: todayTaskBase,
        liveTaskSecs: liveTaskTodaySecs,
        startedAt: matchedTask.startedAt,
        timerRunning: true
      };
    } else if (r.activeTask && r.activeTask.timerRunning !== false && r.activeTask.startedAt && isClockedIn && !isOnBreak) {
      const taskStart = Number(r.activeTask.startedAt);
      const elapsedTask = Math.max(0, Math.floor((now - taskStart) / 1000));
      let todayTaskBase = 0;
      if (r.activeTask.dailySessions && typeof r.activeTask.dailySessions === 'object' && r.activeTask.dailySessions[today] !== undefined) {
        todayTaskBase = Number(r.activeTask.dailySessions[today]) || 0;
      } else if (r.activeTask.sessionDate === today && r.activeTask.todayWorkSeconds !== undefined && Number(r.activeTask.todayWorkSeconds) > 0) {
        todayTaskBase = Number(r.activeTask.todayWorkSeconds);
      } else if (r.activeTask.startDate === today || String(r.activeTask.createdAt || '').startsWith(today)) {
        todayTaskBase = Number(r.activeTask.accumulatedSeconds || r.activeTask.timerSeconds || 0);
      } else {
        todayTaskBase = 0;
      }
      const liveTaskTodaySecs = todayTaskBase + elapsedTask;
      const totalAccum = Number(r.activeTask.accumulatedSeconds || 0);

      runningTask = {
        ...r.activeTask,
        accumulatedSeconds: totalAccum,
        todayWorkSeconds: todayTaskBase,
        liveTaskSecs: liveTaskTodaySecs,
        timerRunning: true
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
      telemetryMap[code.toLowerCase()] = state;
    }
    if (id) {
      telemetryMap[id] = state;
    }
    const empEmail = String(r.employeeEmail || r.email || '').trim().toLowerCase();
    if (empEmail) {
      telemetryMap[empEmail] = state;
    }
  });

  // Merge ultra-fresh entries from in-memory heartbeat cache (0ms instant live reflection)
  liveTelemetryCache.forEach((cachedVal, cacheKey) => {
    if (!cachedVal) return;
    if (cachedVal.date === today && (now - (cachedVal.lastHeartbeatAt || 0)) < 30000) {
      const code = String(cachedVal.employeeCode || '').trim().toUpperCase();
      const id = String(cachedVal.employeeId || '');
      const existingTelem = telemetryMap[code] || telemetryMap[id] || null;

      let effectiveActiveTask = null;
      if (cachedVal && 'activeTask' in cachedVal) {
        effectiveActiveTask = (cachedVal.activeTask && cachedVal.activeTask.timerRunning !== false) ? cachedVal.activeTask : null;
      } else if (existingTelem && existingTelem.activeTask && existingTelem.activeTask.timerRunning !== false) {
        effectiveActiveTask = existingTelem.activeTask;
      }
      if (effectiveActiveTask && effectiveActiveTask.startedAt && cachedVal.isClockedIn && !cachedVal.isOnBreak) {
        const taskStart = Number(effectiveActiveTask.startedAt);
        const elapsedTask = Math.max(0, Math.floor((now - taskStart) / 1000));
        let todayTaskBase = 0;
        if (effectiveActiveTask.dailySessions && typeof effectiveActiveTask.dailySessions === 'object' && effectiveActiveTask.dailySessions[today] !== undefined) {
          todayTaskBase = Number(effectiveActiveTask.dailySessions[today]) || 0;
        } else if (effectiveActiveTask.sessionDate === today && effectiveActiveTask.todayWorkSeconds !== undefined && Number(effectiveActiveTask.todayWorkSeconds) > 0) {
          todayTaskBase = Number(effectiveActiveTask.todayWorkSeconds);
        } else if (effectiveActiveTask.startDate === today || String(effectiveActiveTask.createdAt || '').startsWith(today)) {
          todayTaskBase = Number(effectiveActiveTask.accumulatedSeconds || effectiveActiveTask.timerSeconds || 0);
        } else {
          todayTaskBase = 0;
        }
        const liveTaskTodaySecs = todayTaskBase + elapsedTask;
        const totalAccum = Number(effectiveActiveTask.accumulatedSeconds || 0);
        effectiveActiveTask = {
          ...effectiveActiveTask,
          startedAt: taskStart,
          accumulatedSeconds: totalAccum,
          todayWorkSeconds: todayTaskBase,
          liveTaskSecs: liveTaskTodaySecs,
          timerRunning: true
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
        telemetryMap[code.toLowerCase()] = mergedState;
      }
      if (id) {
        telemetryMap[id] = mergedState;
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
  getLiveTelemetry
};
