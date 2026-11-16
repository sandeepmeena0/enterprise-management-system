/**
 * @file shiftStateSelector.js
 * @description Unified, authoritative shift and live activity selector for EMS.
 * Computes live attendance, clock-in/out, break, and active task state across all employee records.
 * Serves as the single source of truth (SSOT) shared by DashboardPage and TeamOperationsPage.
 */

import { calculateShiftWorkSeconds, readTimerStorage, getLocalDateStr, formatSeconds as defaultFormatSeconds } from './timerUtils';

/**
 * Checks if a task is assigned to a specific employee
 * @param {object} task
 * @param {object} emp
 * @returns {boolean}
 */
export const isTaskAssignedToUser = (task, emp) => {
  if (!task || !emp) return false;
  const empId = emp._id ? String(emp._id) : '';
  const empCode = emp.employeeCode ? String(emp.employeeCode).trim().toUpperCase() : '';
  const empEmail = emp.email ? String(emp.email).trim().toLowerCase() : '';

  if (task.assignedToId && String(task.assignedToId) === empId) return true;
  if (task.assignedTo && typeof task.assignedTo === 'string' && (task.assignedTo === empId || task.assignedTo === empCode)) return true;
  if (task.assignedTo && typeof task.assignedTo === 'object' && (String(task.assignedTo._id) === empId || String(task.assignedTo.employeeCode).toUpperCase() === empCode)) return true;
  if (task.assignedToCode && String(task.assignedToCode).toUpperCase() === empCode) return true;
  if (task.assignedToEmail && String(task.assignedToEmail).toLowerCase() === empEmail) return true;

  if (Array.isArray(task.assignedToIds)) {
    if (task.assignedToIds.some(id => String(id) === empId || (empCode && String(id).toUpperCase() === empCode))) return true;
  }
  if (Array.isArray(task.assignees)) {
    if (task.assignees.some(a => String(a._id || a.id) === empId || (a.employeeCode && String(a.employeeCode).toUpperCase() === empCode))) return true;
  }
  return false;
};

/**
 * Checks if a task is actually finished/completed
 * @param {object} task
 * @returns {boolean}
 */
export const isTaskActuallyCompleted = (task) => {
  if (!task) return false;
  return (
    task.status === 'completed' ||
    Boolean(task.completedAt) ||
    Boolean(task.completedOn) ||
    Number(task.progress) === 100
  );
};

/**
 * Computes canonical live shift and task state for an employee on a given date.
 * 
 * @param {object} emp - Employee document
 * @param {object} options
 * @param {Array} options.attendance - Attendance records collection
 * @param {Array} options.leaves - Leaves collection
 * @param {Array} options.tasks - Tasks collection
 * @param {string} options.todayStr - Current business date 'YYYY-MM-DD'
 * @param {object} [options.currentUser] - Authenticated session user
 * @param {object} [options.liveTelemetryMap] - Live telemetry cache map
 * @param {Function} [options.formatSeconds] - Formatter function
 * @param {Map|object} [options.liveTaskMemory] - Ephemeral live task memory reference
 * @returns {object|null}
 */
export function getEmployeeLiveState(emp, options = {}) {
  if (!emp) return null;

  const {
    attendance = [],
    leaves = [],
    tasks = [],
    todayStr = new Date().toISOString().split('T')[0],
    currentUser = null,
    liveTelemetryMap = {},
    formatSeconds = defaultFormatSeconds,
    liveTaskMemory = null
  } = options;

  const empKey = emp.employeeCode || (emp._id ? String(emp._id) : '');
  const empId = emp._id ? String(emp._id) : '';
  const empName = emp.name || '';

  // Today's attendance record
  const attRec = (attendance || []).find(a =>
    a.date === todayStr && (
      String(a.employeeId) === String(empId) ||
      String(a.employee) === String(empId) ||
      (emp.employeeCode && (String(a.employeeCode) === String(emp.employeeCode) || String(a.employeeId) === String(emp.employeeCode))) ||
      (empKey && (String(a.employeeCode) === String(empKey) || String(a.employeeId) === String(empKey))) ||
      (empName && a.employeeName?.trim().toLowerCase() === empName.trim().toLowerCase())
    )
  );

  // Approved leave evaluation
  const isOnLeave = Boolean(
    attRec?.status === 'on_leave' ||
    (leaves || []).some(l =>
      l.status === 'approved' &&
      l.startDate <= todayStr &&
      l.endDate >= todayStr &&
      (
        String(l.employeeId) === String(empId) ||
        String(l.employee) === String(empId) ||
        (emp.employeeCode && l.employeeCode === emp.employeeCode) ||
        (empName && l.employeeName?.trim().toLowerCase() === empName.trim().toLowerCase())
      )
    )
  );
  const leaveNote = attRec?.notes || 'Approved Leave';

  const readTimerKey = (sub) => readTimerStorage(emp, sub);

  const storedClockedIn = readTimerKey('is_clocked_in') === 'true' || readTimerKey('is_clocked_in') === true;
  const storedOnBreak = readTimerKey('is_on_break') === 'true' || readTimerKey('is_on_break') === true;
  const storedBreakType = readTimerKey('break_type') || 'Break';
  const storedFirstLogin = readTimerKey('first_clock_in_time');
  const storedLogin = storedFirstLogin || readTimerKey('login_time');
  const storedLastClockOut = readTimerKey('last_clock_out_time');
  const storedClockOut = storedLastClockOut || readTimerKey('clock_out') || readTimerKey('clockout_time');
  let storedBreakSecs = Number(readTimerKey('break_seconds')) || 0;

  if (storedOnBreak) {
    const brkStart = Number(readTimerKey('break_start_timestamp'));
    if (brkStart && brkStart > 0) {
      const liveCurBreak = Math.max(0, Math.floor((Date.now() - brkStart) / 1000));
      const curBreakSecs = Number(readTimerKey('current_break_seconds')) || 0;
      storedBreakSecs = Math.max(storedBreakSecs, Math.max(liveCurBreak, curBreakSecs));
    }
  }

  const storedBreakHistoryRaw = readTimerKey('break_history');
  let storedBreakHistory = [];
  try {
    if (storedBreakHistoryRaw) storedBreakHistory = JSON.parse(storedBreakHistoryRaw);
  } catch (_) {}

  // Telemetry resolution
  let cachedTelemMap = {};
  try {
    const rawCachedTelem = typeof localStorage !== 'undefined' ? localStorage.getItem('ems_last_telemetry') : null;
    if (rawCachedTelem) cachedTelemMap = JSON.parse(rawCachedTelem);
  } catch (_) {}

  const telem = (liveTelemetryMap && liveTelemetryMap[String(empId)]) ||
                (emp.employeeCode && liveTelemetryMap && (liveTelemetryMap[String(emp.employeeCode)] || liveTelemetryMap[String(emp.employeeCode).toUpperCase()] || liveTelemetryMap[String(emp.employeeCode).toLowerCase()])) ||
                (empKey && liveTelemetryMap && (liveTelemetryMap[String(empKey)] || liveTelemetryMap[String(empKey).toUpperCase()] || liveTelemetryMap[String(empKey).toLowerCase()])) ||
                (emp.email && liveTelemetryMap && liveTelemetryMap[String(emp.email).toLowerCase()]) ||
                cachedTelemMap[String(empId)] ||
                (emp.employeeCode && (cachedTelemMap[String(emp.employeeCode)] || cachedTelemMap[String(emp.employeeCode).toUpperCase()] || cachedTelemMap[String(emp.employeeCode).toLowerCase()])) ||
                (empKey && (cachedTelemMap[String(empKey)] || cachedTelemMap[String(empKey).toUpperCase()] || cachedTelemMap[String(empKey).toLowerCase()])) ||
                (emp.email && cachedTelemMap[String(emp.email).toLowerCase()]) ||
                null;

  const isCloudClockedInToday = Boolean(
    telem?.isClockedIn ||
    (attRec?.date === todayStr && (attRec?.clockInTime || attRec?.clockIn) && !attRec?.clockOutTime && attRec?.isClockedIn !== false && attRec?.status !== 'absent')
  );

  const storedSessionDate = readTimerKey('work_session_date');
  const rawClockInTs = Number(readTimerKey('clock_in_timestamp')) || Number(attRec?.clockInTimestamp);
  let isStaleFromPreviousDay = false;
  if (!isCloudClockedInToday) {
    if (storedSessionDate && storedSessionDate !== todayStr) {
      isStaleFromPreviousDay = true;
    } else if (rawClockInTs > 0) {
      const inDate = getLocalDateStr(rawClockInTs);
      if (inDate !== todayStr) {
        isStaleFromPreviousDay = true;
      }
    }
  }

  const hasTodayAttClockIn = Boolean(attRec?.date === todayStr && (attRec?.clockInTime || attRec?.clockIn));
  const hasTodayAttClockOut = Boolean(attRec?.date === todayStr && (attRec?.clockOutTime || attRec?.clockOut));
  const hasTodayStoredSession = !isStaleFromPreviousDay && (storedSessionDate === todayStr || isCloudClockedInToday);
  const hasTodayStoredClockIn = Boolean(hasTodayStoredSession && (storedLogin || rawClockInTs > 0 || isCloudClockedInToday));
  const hasTodayStoredClockOut = Boolean(hasTodayStoredSession && (storedClockOut || readTimerKey('had_clocked_out') === 'true' || readTimerKey('had_clocked_out') === true));

  const isExplicitlyStoredClockedOut = !storedClockedIn && hasTodayStoredSession && (
    readTimerKey('is_clocked_in') === 'false' ||
    readTimerKey('had_clocked_out') === 'true' ||
    Boolean(storedClockOut)
  );

  const isClockedIn = !isExplicitlyStoredClockedOut && Boolean(
    (telem?.isClockedIn && !telem?.clockOutTime) ||
    (!isStaleFromPreviousDay && (
      (hasTodayStoredSession && storedClockedIn) ||
      (hasTodayAttClockIn && !hasTodayAttClockOut && attRec?.status !== 'absent' && attRec?.isClockedIn !== false)
    ))
  );

  const isClockedOut = !isClockedIn && Boolean(
    telem?.clockOutTime ||
    (!isStaleFromPreviousDay && (
      isExplicitlyStoredClockedOut ||
      (hasTodayAttClockIn && (hasTodayAttClockOut || attRec?.isClockedIn === false)) ||
      (hasTodayStoredClockIn && hasTodayStoredClockOut && !storedClockedIn)
    ))
  );

  const effectiveOnBreak = telem ? Boolean(telem.isOnBreak) : storedOnBreak;
  const effectiveBreakType = telem ? (telem.breakType || 'Break') : storedBreakType;

  const loginTime = isClockedIn
    ? (readTimerKey('first_clock_in_time') || telem?.firstClockInTime || attRec?.firstClockInTime || telem?.clockInTime || attRec?.clockInTime || storedLogin || 'Active')
    : (isClockedOut ? (readTimerKey('first_clock_in_time') || telem?.firstClockInTime || attRec?.firstClockInTime || telem?.clockInTime || attRec?.clockInTime || storedLogin || null) : null);

  const clockOutTime = isClockedOut
    ? (readTimerKey('last_clock_out_time') || telem?.lastClockOutTime || attRec?.lastClockOutTime || telem?.clockOutTime || attRec?.clockOutTime || storedClockOut || null)
    : null;

  const workSecs = calculateShiftWorkSeconds(emp, todayStr, Date.now(), {
    isClockedIn,
    isClockedOut,
    isOnBreak: effectiveOnBreak,
    attRec,
    telemetry: telem
  });

  let finalBreakSecs = storedBreakSecs;
  if (telem) {
    const telemBreaks = Number(telem.breakSeconds) || 0;
    if (effectiveOnBreak) {
      const bStart = Number(telem.breakStartTimestamp || telem.lastHeartbeatAt || telem.fetchedAt || Date.now());
      const curBreakElapsed = (bStart > 0 && bStart <= Date.now()) ? Math.max(0, Math.floor((Date.now() - bStart) / 1000)) : 0;
      finalBreakSecs = Math.max(storedBreakSecs, telemBreaks + curBreakElapsed);
    } else {
      finalBreakSecs = Math.max(storedBreakSecs, telemBreaks);
    }
  }

  // Active running task
  const rawEmpTasks = (tasks || []).filter(t => isTaskAssignedToUser(t, emp));
  const empTaskMap = new Map();
  rawEmpTasks.forEach(t => {
    const k = (t.taskCode && t.taskCode.trim()) ? `code_${t.taskCode.trim().toLowerCase()}` : `id_${t._id || t.id}`;
    if (!empTaskMap.has(k)) empTaskMap.set(k, t);
  });
  const empTasks = Array.from(empTaskMap.values());

  let activeTimer = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToTry = [
        `ems_active_task_timer_${empKey}`,
        emp._id ? `ems_active_task_timer_${emp._id}` : null,
        emp.employeeCode ? `ems_active_task_timer_${emp.employeeCode}` : null
      ].filter(Boolean);
      for (const k of keysToTry) {
        const rawTimer = localStorage.getItem(k);
        if (rawTimer) {
          const parsed = JSON.parse(rawTimer);
          if (parsed && (parsed.taskId || parsed._id)) {
            activeTimer = parsed;
            break;
          }
        }
      }
    }
  } catch (_) {}

  const isTimerTaskCompleted = (tasks || []).some(t =>
    (String(t._id || t.id) === String(activeTimer?.taskId || activeTimer?._id)) && isTaskActuallyCompleted(t)
  ) || isTaskActuallyCompleted(activeTimer);

  if (isTimerTaskCompleted && activeTimer) {
    activeTimer = null;
  }

  const isExplicitlyPausedLocally = Boolean(
    activeTimer && activeTimer.timerRunning === false &&
    (!activeTimer.date || activeTimer.date === todayStr) &&
    Number(activeTimer.lastUpdated || 0) >= Number(telem?.activeTask?.startedAt || 0)
  );

  let localRunningTask = null;
  if (activeTimer && activeTimer.timerRunning && !isTimerTaskCompleted) {
    localRunningTask = activeTimer;
  } else if (!isExplicitlyPausedLocally) {
    localRunningTask = empTasks.find(t => {
      if (!t.timerRunning || isTaskActuallyCompleted(t)) return false;
      if (t.activeUserId) {
        const act = String(t.activeUserId).toLowerCase().trim();
        return act === String(empId).toLowerCase().trim() || act === String(emp.employeeCode || '').toLowerCase().trim();
      }
      return true;
    }) || null;
  }

  const telemRunningTask = (!isExplicitlyPausedLocally && telem?.activeTask && (telem.activeTask.timerRunning || telem.activeTask.startedAt))
    ? telem.activeTask
    : null;

  let candidateTask = null;
  if (localRunningTask) {
    candidateTask = localRunningTask;
  } else if (isExplicitlyPausedLocally && activeTimer) {
    candidateTask = activeTimer;
  } else if (telemRunningTask) {
    candidateTask = telemRunningTask;
  } else if (telem?.activeTask) {
    candidateTask = telem.activeTask;
  } else {
    candidateTask = empTasks.find(t => (
      (t.sessionDate === todayStr && (Number(t.todayWorkSeconds || 0) > 0 || Number(t.dailySessions?.[todayStr] || 0) > 0)) ||
      Boolean(t.dailySessions?.[todayStr] && Number(t.dailySessions[todayStr]) > 0)
    ) && !isTaskActuallyCompleted(t)) || null;
  }

  let runningTask = null;
  if (candidateTask && isClockedIn && !isClockedOut && !isOnLeave && !isTaskActuallyCompleted(candidateTask)) {
    const isTimerRunning = Boolean(candidateTask.timerRunning && !effectiveOnBreak);
    const taskIdentityKey = String(candidateTask.taskId || candidateTask._id || candidateTask.id || candidateTask.taskCode || empKey);

    let startedAtMs = Number(candidateTask.startedAt) || (typeof candidateTask.startedAt === 'string' ? new Date(candidateTask.startedAt).getTime() : 0);
    if (isTimerRunning && (!startedAtMs || isNaN(startedAtMs))) {
      const cached = liveTaskMemory?.current?.get ? liveTaskMemory.current.get(taskIdentityKey) : null;
      if (cached?.startedAt) {
        startedAtMs = cached.startedAt;
      } else {
        startedAtMs = Date.now();
      }
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightMs = todayMidnight.getTime();
    const elapsed = (isTimerRunning && startedAtMs >= todayMidnightMs && startedAtMs <= Date.now())
      ? Math.floor((Date.now() - startedAtMs) / 1000)
      : 0;

    let todayTaskBase = 0;
    if (candidateTask.dailySessions && typeof candidateTask.dailySessions === 'object' && candidateTask.dailySessions[todayStr] !== undefined) {
      todayTaskBase = Number(candidateTask.dailySessions[todayStr]) || 0;
    } else if (candidateTask.todayBaseSecs !== undefined && candidateTask.sessionDate === todayStr) {
      todayTaskBase = Math.max(Number(candidateTask.todayBaseSecs), 0);
    } else if (!isTimerRunning && candidateTask.sessionDate === todayStr) {
      todayTaskBase = Math.max(Number(candidateTask.todayWorkSeconds || 0), 0);
    } else {
      todayTaskBase = 0;
    }

    const totalAccum = Number(candidateTask.accumulatedSeconds !== undefined ? candidateTask.accumulatedSeconds : (candidateTask.timerSeconds || todayTaskBase));
    const rawLiveSecs = todayTaskBase + elapsed;
    const maxPhysicalToday = Math.max(0, Math.floor((Date.now() - todayMidnightMs) / 1000));
    const liveTaskSecs = isTimerRunning ? Math.min(rawLiveSecs, maxPhysicalToday) : todayTaskBase;

    if (liveTaskMemory?.current?.set) {
      liveTaskMemory.current.set(taskIdentityKey, {
        date: todayStr,
        startedAt: isTimerRunning ? startedAtMs : null,
        lastLiveSecs: liveTaskSecs
      });
    }

    runningTask = {
      _id: candidateTask.taskId || candidateTask._id || candidateTask.id,
      id: candidateTask.taskId || candidateTask._id || candidateTask.id,
      taskId: candidateTask.taskId || candidateTask._id || candidateTask.id,
      taskCode: candidateTask.taskCode || 'TSK',
      title: candidateTask.title || 'Live Task',
      projectName: candidateTask.projectName || 'General Work',
      timerRunning: isTimerRunning,
      startedAt: isTimerRunning ? startedAtMs : null,
      accumulatedSeconds: totalAccum,
      todayWorkSeconds: todayTaskBase,
      timerSeconds: liveTaskSecs,
      liveTaskSecs,
      liveTaskFormatted: formatSeconds(liveTaskSecs),
      liveDurationText: formatSeconds(liveTaskSecs)
    };
  }

  const completedTasksToday = empTasks.filter(t => isTaskActuallyCompleted(t) && (t.completedAt?.startsWith(todayStr) || t.completedOn?.startsWith(todayStr)));

  const isPresent = !isOnLeave && Boolean(isClockedIn || isClockedOut || (attRec && ['present', 'late', 'half_day'].includes(attRec.status)));
  const isMarkedAbsent = !isOnLeave && attRec?.status === 'absent';
  const isNotClockedIn = !isOnLeave && !isPresent && !isMarkedAbsent;
  const isAbsent = isMarkedAbsent;

  return {
    emp,
    empKey,
    empId,
    empName,
    department: emp.department || 'General',
    isOnLeave,
    leaveNote,
    isPresent,
    isNotClockedIn,
    isAbsent,
    attStatus: attRec?.status || (isOnLeave ? 'on_leave' : (isClockedIn || isClockedOut ? 'present' : 'not_clocked_in')),
    isClockedIn: !isOnLeave && isClockedIn,
    isOnBreak: !isOnLeave && effectiveOnBreak,
    breakType: effectiveBreakType,
    isClockedOut: !isOnLeave && isClockedOut,
    loginTime: !isOnLeave ? loginTime : null,
    clockOutTime: !isOnLeave ? clockOutTime : null,
    workSecs: !isOnLeave ? workSecs : 0,
    breakSecs: !isOnLeave ? finalBreakSecs : 0,
    breakHistory: storedBreakHistory,
    runningTask: !isOnLeave ? runningTask : null,
    empTasks,
    completedTasksToday
  };
}
