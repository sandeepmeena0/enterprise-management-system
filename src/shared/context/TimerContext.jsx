/**
 * @file TimerContext.jsx
 * @description Central Work Session Timer & Dual Time-Tracking Engine:
 * 1. Multi-User Scoped Attendance Clock (Clock In, Clock Out, Gross Shift vs Net Productive Work).
 * 2. Enterprise Break Management Engine with persistent Break History Logging and Active Break Reminders.
 * 3. Accidental Clock-out Re-clock In Request with Real-Time Admin/HR Approval Workflow.
 *    - Instant timer resumption on request ("time starts tracking immediately").
 *    - Admin Acceptance: time is officially approved and merged into attendance.
 *    - Admin Rejection: unapproved extra time is discarded and not counted.
 * 4. Multi-tab and multi-user reactive synchronization without errors or crashes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from './ToastContext';
import { useHR } from '../../modules/hr/context/HRContext';
import { useAuth } from './AuthContext';
import { hrService } from '../../modules/hr/services/hrService';
import { getCompanySettings } from '../services/companySettingsService';
import { broadcastSyncEvent, SYNC_EVENTS } from '../services/realtimeSyncService';
import { getCanonicalTimerKey, getTimerMirrorKeys, parseTimeToSeconds, normalizePunchSessions, readTimerStorage, writeTimerStorage, removeTimerStorage, calculateShiftWorkSeconds, performShiftClockOut, getLocalDateStr } from '../utils/timerUtils';

const defaultTimerContext = {
  isClockedIn: false,
  isOnBreak: false,
  breakType: null,
  workSeconds: 0,
  breakSeconds: 0,
  loginTime: null,
  clockOutTime: null,
  workDurationText: '00h 00m',
  breakDurationText: '00h 00m',
  overtimeText: '00h 00m',
  overtimeSeconds: 0,
  overtimeHours: 0,
  isOvertime: false,
  clockIn: async () => {},
  clockOut: async () => {},
  startBreak: async () => {},
  endBreak: async () => {},
  recordAuditLog: async () => {},
  adminForceClockOut: async () => {}
};

const TimerContext = createContext(defaultTimerContext);

export const BREAK_THRESHOLDS = {
  'Lunch Break': 45 * 60,       // 45 minutes
  'Tea Break': 15 * 60,         // 15 minutes
  'Tea / Coffee Break': 15 * 60,// 15 minutes
  'Personal Break': 15 * 60,    // 15 minutes
  'Quick Rest / Stretch': 10 * 60, // 10 minutes
  'Short Rest': 10 * 60,        // 10 minutes
  'Wellness & Prayer': 15 * 60  // 15 minutes
};

export const TimerProvider = ({ children }) => {
  const { addToast } = useToast();
  const { currentUser: authUser } = useAuth();
  const { currentUser: hrUser } = useHR();
  const currentUser = authUser || hrUser;

  const getTodayStr = () => getLocalDateStr();

  // ⏱️ Dynamic Company Shift Policy from Settings (Syncs across changes)
  const [companySettings, setCompanySettings] = useState(getCompanySettings);
  useEffect(() => {
    const handleSettingsUpdate = () => setCompanySettings(getCompanySettings());
    window.addEventListener('company-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('company-settings-updated', handleSettingsUpdate);
  }, []);

  // Derive canonical userKey for multi-user storage isolation
  const userKey = useMemo(() => {
    return getCanonicalTimerKey(currentUser) || '';
  }, [currentUser]);

  // Anti-overwrite Hydration Lock: Prevents previous user state from overwriting new user keys on fast switch
  const prevUserKeyRef = useRef(userKey);
  const isHydratingRef = useRef(false);

  // Resolve canonical employee profile from storage to bridge _id, employeeCode, and name
  const resolvedEmp = useMemo(() => {
    if (!currentUser) return null;
    try {
      const empsRaw = localStorage.getItem('hrms_employees');
      const allEmps = empsRaw ? JSON.parse(empsRaw) : [];
      const match = allEmps.find(e =>
        (currentUser?._id && (e._id === currentUser._id || e.employeeCode === currentUser._id)) ||
        (currentUser?.employeeCode && (e.employeeCode === currentUser.employeeCode || e._id === currentUser.employeeCode)) ||
        (currentUser?.email && e.email?.toLowerCase() === currentUser.email?.toLowerCase()) ||
        (currentUser?.name && e.name?.toLowerCase() === currentUser.name?.toLowerCase()) ||
        (userKey && (e.employeeCode === userKey || e._id === userKey))
      );
      return match || currentUser;
    } catch {
      return currentUser;
    }
  }, [currentUser, userKey]);

  const targetEmpId = resolvedEmp?._id || currentUser?._id || '';
  const targetEmpCode = resolvedEmp?.employeeCode || currentUser?.employeeCode || (userKey && !userKey.startsWith('emp_') ? userKey : '');
  const targetEmpName = currentUser?.name || resolvedEmp?.name || '';

  // Helper: robustly check if an attendance record belongs to the current user (MongoDB & local storage universal)
  const isRecordForUser = useCallback((rec, dateStr) => {
    if (!rec || (dateStr && rec.date !== dateStr)) return false;
    if (!currentUser) return false;

    const recEmp = rec.employee && typeof rec.employee === 'object' ? String(rec.employee._id || '') : String(rec.employee || '');
    const recEmpId = String(rec.employeeId || recEmp || '');
    const recEmpCode = String(rec.employeeCode || '').trim().toUpperCase();
    const recEmpName = String(rec.employeeName || '').trim().toLowerCase();
    const recEmpEmail = String(rec.employeeEmail || rec.email || '').trim().toLowerCase();

    const currId = currentUser?._id ? String(currentUser._id) : '';
    const currIdStr = currentUser?.id ? String(currentUser.id) : '';
    const currCode = currentUser?.employeeCode ? String(currentUser.employeeCode).trim().toUpperCase() : '';
    const currName = String(currentUser?.name || targetEmpName || '').trim().toLowerCase();
    const currEmail = String(currentUser?.email || '').trim().toLowerCase();
    const tId = String(targetEmpId || '');
    const tCode = String(targetEmpCode || '').trim().toUpperCase();
    const uKey = String(userKey || '').trim().toUpperCase();

    // Check Employee ID / ObjectId match (ONLY if non-empty)
    if (recEmpId) {
      if (tId && recEmpId === tId) return true;
      if (currId && recEmpId === currId) return true;
      if (currIdStr && recEmpId === currIdStr) return true;
      if (tCode && recEmpId.toUpperCase() === tCode) return true;
      if (uKey && recEmpId.toUpperCase() === uKey) return true;
    }

    if (recEmp) {
      if (tId && recEmp === tId) return true;
      if (currId && recEmp === currId) return true;
      if (currIdStr && recEmp === currIdStr) return true;
      if (tCode && recEmp.toUpperCase() === tCode) return true;
      if (uKey && recEmp.toUpperCase() === uKey) return true;
    }

    // Check Employee Code match (ONLY if non-empty)
    if (recEmpCode) {
      if (tCode && recEmpCode === tCode) return true;
      if (currCode && recEmpCode === currCode) return true;
      if (uKey && recEmpCode === uKey) return true;
      if (tId && recEmpCode === tId.toUpperCase()) return true;
    }

    // Check Email match
    if (recEmpEmail && currEmail && recEmpEmail === currEmail) {
      return true;
    }

    // Strict Exact Name match ONLY if currName has at least 3 characters and is NOT a generic role word like 'admin' or 'employee'
    const genericNames = ['employee', 'admin', 'administrator', 'team member', 'hr', 'user'];
    if (recEmpName && currName && !genericNames.includes(currName) && recEmpName === currName) {
      return true;
    }

    return false;
  }, [targetEmpId, targetEmpCode, userKey, currentUser, targetEmpName]);

  // ── Helper: Accurately compute total task seconds worked today (logged timesheets + active unsubmitted timer) ──
  const getTodayTaskSecondsForUser = useCallback(() => {
    const today = getTodayStr();
    let totalSecs = 0;
    try {
      const rawTimesheets = localStorage.getItem('ems_timesheets');
      let userTodayTs = [];
      if (rawTimesheets) {
        const ts = JSON.parse(rawTimesheets) || [];
        const rawUserTs = ts.filter(t => t.date === today && (
          String(t.employeeId) === String(targetEmpId) ||
          String(t.employeeId) === String(targetEmpCode) ||
          String(t.employeeId) === String(userKey)
        ));
        // Deduplicate timesheets by task for today so multiple auto-saves don't sum cumulatively
        const taskMap = new Map();
        rawUserTs.forEach(t => {
          const key = String(t.taskId || t.taskCode || t.taskTitle || t._id);
          const dur = Number(t.totalDurationSeconds) || 0;
          if (!taskMap.has(key) || dur > (Number(taskMap.get(key).totalDurationSeconds) || 0)) {
            taskMap.set(key, t);
          }
        });
        userTodayTs = Array.from(taskMap.values());
        totalSecs = userTodayTs.reduce((acc, t) => acc + (Number(t.totalDurationSeconds) || 0), 0);
      }
      const rawActiveTimer = localStorage.getItem(`ems_active_task_timer_${userKey}`);
      if (rawActiveTimer) {
        const at = JSON.parse(rawActiveTimer);
        if (at && (at.date === today || at.sessionDate === today)) {
          // Strictly take today's session seconds, NOT all-time lifetime accumulatedSeconds!
          let atSecs = Number(at.todayWorkSeconds) || Number(at.dailySessions?.[today]) || 0;
          if (at.timerRunning && at.startedAt) {
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const effStart = Math.max(Number(at.startedAt), todayMidnight.getTime());
            atSecs += Math.max(0, Math.floor((Date.now() - effStart) / 1000));
          }
          const loggedForAt = userTodayTs
            .filter(ts => String(ts.taskId) === String(at.taskId) || (at.taskCode && ts.taskCode === at.taskCode) || (at.title && ts.taskTitle === at.title))
            .reduce((acc, t) => Math.max(acc, Number(t.totalDurationSeconds) || 0), 0);
          const unsubmittedAtSecs = Math.max(0, atSecs - loggedForAt);
          totalSecs += unsubmittedAtSecs;
        }
      }
    } catch {}
    return totalSecs;
  }, [targetEmpId, targetEmpCode, userKey]);

  // ── Centralized Audit Logging Helper ──
  const recordAuditLog = useCallback(async (eventData) => {
    try {
      const today = getTodayStr();
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      await hrService.createAttendanceAuditLog({
        employeeId: targetEmpId,
        employeeName: targetEmpName,
        employeeCode: targetEmpCode,
        date: today,
        timeFormatted: nowStr,
        actor: currentUser?.isAdmin ? 'admin' : 'employee',
        actorId: targetEmpId,
        actorName: targetEmpName,
        ...eventData
      });
    } catch (e) {
      console.warn('Failed to record attendance audit log:', e);
    }
  }, [targetEmpId, targetEmpCode, targetEmpName, currentUser]);

  // ── Admin Override Force Clock-Out Listener ──
  useEffect(() => {
    const handleForceClockOutEvent = (e) => {
      const { employeeId, adminName, adminId, auditNote } = e.detail || {};
      if (employeeId === userKey || employeeId === currentUser?._id || employeeId === currentUser?.employeeCode) {
        setIsRunning(false);
        setIsOnBreak(false);
        setIsClockedIn(false);
        setHadClockedOutToday(true);
        const logoutStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        setClockOutTime(logoutStr);

        localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
        localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
        localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
        localStorage.setItem(`ems_timer_${userKey}_clockout_time`, logoutStr);
        localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'true');

        addToast({
          title: '⚠️ Shift Forcefully Clocked Out',
          message: `Administrator ${adminName || 'Admin'} [ID: ${adminId || 'ADM'}] clocked out your shift. Reason: "${auditNote || 'Manual admin override'}"`,
          type: 'warning'
        });
      }
    };

    window.addEventListener('ems_force_clock_out', handleForceClockOutEvent);
    return () => window.removeEventListener('ems_force_clock_out', handleForceClockOutEvent);
  }, [userKey, currentUser, addToast]);

  // Zero-Flicker Telemetry Cache Resolver
  const getCachedTelemRecord = () => {
    try {
      const raw = localStorage.getItem('ems_last_telemetry');
      if (!raw) return null;
      const map = JSON.parse(raw);
      const today = getTodayStr();
      const keys = [userKey, targetEmpId, targetEmpCode, currentUser?._id, currentUser?.employeeCode, currentUser?.email].filter(Boolean);
      for (const k of keys) {
        const r = map[String(k)] || map[String(k).toUpperCase()] || map[String(k).toLowerCase()];
        if (r && r.date === today) return r;
      }
      const allVals = Object.values(map);
      const found = allVals.find(v => {
        if (!v || v.date !== today) return false;
        const vCode = String(v.employeeCode || '').toUpperCase();
        const vId = String(v.employeeId || '');
        const vEmail = String(v.employeeEmail || '').toLowerCase();
        return keys.some(k => {
          const str = String(k);
          return str.toUpperCase() === vCode || str === vId || str.toLowerCase() === vEmail;
        });
      });
      if (found) return found;
    } catch (_) {}
    return null;
  };

  // ── 1. Daily Clock In / Out State (User-Scoped & Validated against Today) ──
  const [sessionDate, setSessionDate] = useState(() => {
    const today = getTodayStr();
    const mirrorKeys = getTimerMirrorKeys(userKey, targetEmpId, targetEmpCode);
    const cachedTelem = getCachedTelemRecord();
    let hasStaleSession = false;
    for (const mk of mirrorKeys) {
      const stored = localStorage.getItem(`ems_timer_${mk}_work_session_date`);
      if (stored && stored !== today) {
        hasStaleSession = true;
        break;
      }
    }
    if (hasStaleSession) {
      if (cachedTelem?.isClockedIn && !cachedTelem?.clockOutTime) {
        for (const mk of mirrorKeys) {
          localStorage.setItem(`ems_timer_${mk}_work_session_date`, today);
          localStorage.setItem(`ems_timer_${mk}_is_clocked_in`, 'true');
          localStorage.setItem(`ems_timer_${mk}_is_running`, cachedTelem.isOnBreak ? 'false' : 'true');
          if (cachedTelem.clockInTime) localStorage.setItem(`ems_timer_${mk}_login_time`, cachedTelem.clockInTime);
          if (cachedTelem.workSeconds) localStorage.setItem(`ems_timer_${mk}_work_seconds`, String(cachedTelem.workSeconds));
        }
        return today;
      }
      for (const mk of mirrorKeys) {
        localStorage.removeItem(`ems_timer_${mk}_login_time`);
        localStorage.removeItem(`ems_timer_${mk}_clockout_time`);
        localStorage.removeItem(`ems_timer_${mk}_clock_out`);
        localStorage.removeItem(`ems_timer_${mk}_clock_in_timestamp`);
        localStorage.removeItem(`ems_timer_${mk}_clock_out_timestamp`);
        localStorage.removeItem(`ems_timer_${mk}_current_session_start_timestamp`);
        localStorage.removeItem(`ems_timer_${mk}_break_start_time`);
        localStorage.removeItem(`ems_timer_${mk}_break_start_timestamp`);
        localStorage.removeItem(`ems_timer_${mk}_break_history`);
        localStorage.removeItem(`ems_timer_${mk}_session_break_baseline`);
        localStorage.setItem(`ems_timer_${mk}_work_seconds`, '0');
        localStorage.setItem(`ems_timer_${mk}_break_seconds`, '0');
        localStorage.setItem(`ems_timer_${mk}_current_break_seconds`, '0');
        localStorage.setItem(`ems_timer_${mk}_is_clocked_in`, 'false');
        localStorage.setItem(`ems_timer_${mk}_is_running`, 'false');
        localStorage.setItem(`ems_timer_${mk}_is_on_break`, 'false');
        localStorage.setItem(`ems_timer_${mk}_had_clocked_out`, 'false');
        localStorage.setItem(`ems_timer_${mk}_work_session_date`, today);
        localStorage.removeItem(`ems_timer_${mk}_punch_sessions`);
      }
      return today;
    }
    const currentStored = localStorage.getItem(`ems_timer_${userKey}_work_session_date`);
    return currentStored || today;
  });

  const isTodaySession = sessionDate === getTodayStr();

  const [loginTime, setLoginTime] = useState(() => {
    if (!currentUser || !userKey) return null;
    const cached = getCachedTelemRecord();
    if (cached?.clockInTime) return cached.clockInTime;
    const scoped = localStorage.getItem(`ems_timer_${userKey}_login_time`);
    if (scoped) return scoped;
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const att = JSON.parse(attRaw);
        const today = getTodayStr();
        const rec = att.find(a => isRecordForUser(a, today));
        if (rec?.clockInTime || rec?.clockIn) return rec.clockInTime || rec.clockIn;
      }
    } catch {}
    return null;
  });

  const [clockOutTime, setClockOutTime] = useState(() => {
    if (!currentUser || !userKey) return null;
    const cached = getCachedTelemRecord();
    if (cached?.clockOutTime && cached.isClockedOut) return cached.clockOutTime;
    const scoped = localStorage.getItem(`ems_timer_${userKey}_clockout_time`) || localStorage.getItem(`ems_timer_${userKey}_clock_out`);
    if (scoped && scoped !== '--' && scoped !== '—' && scoped !== 'null') return scoped;
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const att = JSON.parse(attRaw);
        const today = getTodayStr();
        const rec = att.find(a => isRecordForUser(a, today));
        const val = rec?.clockOutTime || rec?.clockOut;
        if (val && val !== '--' && val !== '—' && val !== 'null') return val;
      }
    } catch {}
    return null;
  });

  const [hadClockedOutToday, setHadClockedOutToday] = useState(() => {
    const cached = getCachedTelemRecord();
    if (cached) {
      if (cached.isClockedIn) return false;
      if (cached.isClockedOut) return true;
    }
    if (!isTodaySession) return false;
    const sessionD = localStorage.getItem(`ems_timer_${userKey}_work_session_date`);
    if (sessionD && sessionD !== getTodayStr()) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_had_clocked_out`);
    if (saved !== null) return saved === 'true';
    return Boolean(clockOutTime && clockOutTime !== '--' && clockOutTime !== '—');
  });

  const [isClockedIn, setIsClockedIn] = useState(() => {
    const cached = getCachedTelemRecord();
    if (cached) {
      if (cached.isClockedIn) return true;
      if (cached.isClockedOut) return false;
    }
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const att = JSON.parse(attRaw);
        const today = getTodayStr();
        const rec = att.find(a => isRecordForUser(a, today));
        if (rec && rec.date === today && (rec.clockInTime || rec.clockIn) && !rec.clockOutTime && rec.isClockedIn !== false && rec.status !== 'on_leave') {
          return true;
        }
      }
    } catch (_) {}
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`);
    if (saved !== null) return saved === 'true';
    return false;
  });

  const [isRunning, setIsRunning] = useState(() => {
    const cached = getCachedTelemRecord();
    if (cached) {
      return Boolean(cached.isClockedIn && !cached.isOnBreak);
    }
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_running`);
    if (saved !== null) return saved === 'true';
    return false;
  });

  // Active productive work seconds (starts strictly from 0 on a fresh day, hydrates from Atlas across devices)
  const [workSeconds, setWorkSeconds] = useState(() => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightMs = todayMidnight.getTime();
    const maxGrossToday = Math.max(0, Math.floor((Date.now() - todayMidnightMs) / 1000));

    const cached = getCachedTelemRecord();
    if (cached && Number(cached.workSeconds || 0) > 0) {
      return Math.min(maxGrossToday, Number(cached.workSeconds));
    }

    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_work_seconds`);
    if (saved) return Math.min(maxGrossToday, Math.max(0, parseInt(saved, 10)));

    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const att = JSON.parse(attRaw);
        const today = getTodayStr();
        const rec = att.find(a => isRecordForUser(a, today));
        if (rec && rec.date === today) {
          if (rec.clockOutTime) {
            return Number(rec.workSeconds) || 0;
          }
          let inTs = Number(rec.clockInTimestamp);
          if (!inTs && rec.clockInTime) {
            inTs = todayMidnightMs + parseTimeToSeconds(rec.clockInTime) * 1000;
          }
          if (inTs && inTs >= todayMidnightMs) {
            return Math.min(maxGrossToday, Math.max(0, Math.floor((Date.now() - inTs) / 1000)));
          }
        }
      }
    } catch (_) {}
    return 0;
  });

  // Saved official seconds before accidental clock-out
  const [savedOfficialWorkSeconds, setSavedOfficialWorkSeconds] = useState(() => {
    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_saved_official_seconds`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Cumulative break seconds for current day
  const [breakSeconds, setBreakSeconds] = useState(() => {
    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_break_seconds`);
    if (saved) return parseInt(saved, 10);
    return 0;
  });

  // ── 2. Active Break & History State ──
  const [isOnBreak, setIsOnBreak] = useState(() => {
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_on_break`);
    if (saved) return saved === 'true';
    return false;
  });

  const [breakType, setBreakType] = useState(() => {
    return localStorage.getItem(`ems_timer_${userKey}_break_type`) || 'Lunch Break';
  });

  const [currentBreakSeconds, setCurrentBreakSeconds] = useState(() => {
    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_current_break_seconds`);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [breakStartTime, setBreakStartTime] = useState(() => {
    if (!isTodaySession) return null;
    return localStorage.getItem(`ems_timer_${userKey}_break_start_time`) || null;
  });

  const [customBreakLimitMinutes, setCustomBreakLimitMinutes] = useState(() => {
    const saved = localStorage.getItem(`ems_timer_${userKey}_custom_break_limit`);
    return saved ? parseInt(saved, 10) : 15;
  });

  const [breakReminderSent, setBreakReminderSent] = useState(false);

  // Persistent Break History List (Strictly scoped to today)
  const [breakHistory, setBreakHistory] = useState(() => {
    if (!isTodaySession) return [];
    const saved = localStorage.getItem(`ems_timer_${userKey}_break_history`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const today = getTodayStr();
          return parsed.filter(b => b.date === today);
        }
      } catch (e) {}
    }
    return [];
  });

  // ── 2.5 Multi-Session Cumulative Punch Sessions (Option 1) ──
  const [punchSessions, setPunchSessions] = useState(() => {
    if (!isTodaySession) return [];
    const saved = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // ── 3. Accidental Clock-out Re-Clock In Request State ──
  // Statuses: 'none' | 'pending' | 'approved' | 'rejected'
  const [reclockStatus, setReclockStatus] = useState(() => {
    if (!isTodaySession) return 'none';
    return localStorage.getItem(`ems_timer_${userKey}_reclock_status`) || 'none';
  });

  // Running seconds for the unapproved re-clock session
  const [reclockSessionSeconds, setReclockSessionSeconds] = useState(() => {
    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_reclock_session_seconds`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // All Re-Clock in requests across the system (for Admin / HR dashboard approvals)
  const [reclockRequests, setReclockRequests] = useState(() => {
    try {
      const raw = localStorage.getItem('ems_reclock_requests');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  // Approved Leave status for today
  const [isOnLeaveToday, setIsOnLeaveToday] = useState(false);
  const [todayLeaveRecord, setTodayLeaveRecord] = useState(null);

  // Reload timer state when userKey switches (Multi-User Safe & Anti-Overwrite Hydration)
  useEffect(() => {
    if (!userKey || !currentUser) {
      setIsClockedIn(false);
      setIsRunning(false);
      setIsOnBreak(false);
      setBreakType(null);
      setWorkSeconds(0);
      setBreakSeconds(0);
      setCurrentBreakSeconds(0);
      setLoginTime(null);
      setClockOutTime(null);
      setHadClockedOutToday(false);
      setPunchSessions([]);
      setReclockStatus('none');
      setReclockSessionSeconds(0);
      setSavedOfficialWorkSeconds(0);
      return;
    }

    const today = getTodayStr();
    const storedDate = readTimerStorage(currentUser, 'work_session_date') || today;
    const isToday = storedDate === today;
    const cachedTelem = getCachedTelemRecord();

    const isCloudClockedIn = Boolean(cachedTelem?.isClockedIn && !cachedTelem?.clockOutTime);
    const localInVal = readTimerStorage(currentUser, 'is_clocked_in');
    const isLocalClockedIn = localInVal === 'true' || localInVal === true;
    const shouldBeClockedIn = isCloudClockedIn || isLocalClockedIn;

    if (prevUserKeyRef.current !== userKey) {
      if (!shouldBeClockedIn) {
        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setBreakType(null);
        setWorkSeconds(0);
        setBreakSeconds(0);
        setCurrentBreakSeconds(0);
        setLoginTime(null);
        setClockOutTime(null);
        setHadClockedOutToday(false);
        setPunchSessions([]);
        setReclockStatus('none');
        setReclockSessionSeconds(0);
        setSavedOfficialWorkSeconds(0);
      } else {
        setIsClockedIn(true);
        setIsRunning(!cachedTelem?.isOnBreak);
        setIsOnBreak(Boolean(cachedTelem?.isOnBreak));
        if (cachedTelem?.breakType) setBreakType(cachedTelem.breakType);
        const lTime = cachedTelem?.clockInTime || readTimerStorage(currentUser, 'login_time') || null;
        if (lTime) setLoginTime(lTime);
        const wSecs = Number(cachedTelem?.workSeconds) || Number(readTimerStorage(currentUser, 'work_seconds')) || 0;
        if (wSecs > 0) setWorkSeconds(wSecs);
        setClockOutTime(null);
        setHadClockedOutToday(false);
      }
    }

    isHydratingRef.current = true;
    prevUserKeyRef.current = userKey;

    setSessionDate(storedDate);
    if (!isToday) {
      if (cachedTelem?.isClockedIn && !cachedTelem?.clockOutTime) {
        // Cloud has active shift today! Hydrate state immediately without wiping
        setSessionDate(today);
        setIsClockedIn(true);
        setIsRunning(!cachedTelem.isOnBreak);
        setIsOnBreak(Boolean(cachedTelem.isOnBreak));
        if (cachedTelem.clockInTime) setLoginTime(cachedTelem.clockInTime);
        if (cachedTelem.workSeconds) setWorkSeconds(Number(cachedTelem.workSeconds));
        setClockOutTime(null);
        setHadClockedOutToday(false);

        writeTimerStorage(currentUser, 'work_session_date', today);
        writeTimerStorage(currentUser, 'is_clocked_in', 'true');
        writeTimerStorage(currentUser, 'is_running', cachedTelem.isOnBreak ? 'false' : 'true');
        writeTimerStorage(currentUser, 'is_on_break', cachedTelem.isOnBreak ? 'true' : 'false');
        if (cachedTelem.clockInTime) writeTimerStorage(currentUser, 'login_time', cachedTelem.clockInTime);
        if (cachedTelem.workSeconds) writeTimerStorage(currentUser, 'work_seconds', String(cachedTelem.workSeconds));
      } else {
        setWorkSeconds(0);
        setBreakSeconds(0);
        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setLoginTime(null);
        setClockOutTime(null);
        setHadClockedOutToday(false);
        setReclockStatus('none');
        setReclockSessionSeconds(0);
        setSavedOfficialWorkSeconds(0);

        writeTimerStorage(currentUser, 'work_session_date', today);
        writeTimerStorage(currentUser, 'work_seconds', '0');
        writeTimerStorage(currentUser, 'break_seconds', '0');
        writeTimerStorage(currentUser, 'current_break_seconds', '0');
        writeTimerStorage(currentUser, 'is_clocked_in', 'false');
        writeTimerStorage(currentUser, 'is_running', 'false');
        writeTimerStorage(currentUser, 'is_on_break', 'false');
        writeTimerStorage(currentUser, 'had_clocked_out', 'false');
        removeTimerStorage(currentUser, 'login_time');
        removeTimerStorage(currentUser, 'clockout_time');
        removeTimerStorage(currentUser, 'clock_out');
        removeTimerStorage(currentUser, 'clock_in_timestamp');
        removeTimerStorage(currentUser, 'clock_out_timestamp');
        removeTimerStorage(currentUser, 'break_start_time');
        removeTimerStorage(currentUser, 'break_start_timestamp');
      }
    } else {
      // Authoritative cross-check with hrms_attendance & telemetry
      let attRec = null;
      try {
        const attRaw = localStorage.getItem('hrms_attendance');
        if (attRaw) {
          const list = JSON.parse(attRaw) || [];
          attRec = list.find(a => isRecordForUser(a, today));
        }
      } catch (_) {}

      const inVal = readTimerStorage(currentUser, 'is_clocked_in');
      const hasAttClockIn = Boolean(attRec && (attRec.clockInTime || attRec.clockIn) && attRec.clockInTime !== '--' && attRec.clockIn !== '--');
      const hasAttClockOut = Boolean(attRec && (attRec.clockOutTime || attRec.clockOut) && attRec.clockOutTime !== '--' && attRec.clockOut !== '--');
      const isAttClockedIn = Boolean(hasAttClockIn && !hasAttClockOut && attRec?.isClockedIn !== false && attRec?.status !== 'on_leave' && attRec?.status !== 'absent');
      const resolvedIsClockedIn = Boolean(cachedTelem?.isClockedIn || isAttClockedIn || (inVal === 'true' || inVal === true));
      setIsClockedIn(resolvedIsClockedIn);

      const runVal = readTimerStorage(currentUser, 'is_running');
      setIsRunning(runVal !== null ? (runVal === 'true' || runVal === true) : resolvedIsClockedIn);

      const onBrkVal = readTimerStorage(currentUser, 'is_on_break');
      const resolvedIsOnBreak = onBrkVal !== null ? (onBrkVal === 'true' || onBrkVal === true) : Boolean(cachedTelem?.isOnBreak || attRec?.isOnBreak);
      setIsOnBreak(resolvedIsOnBreak);

      const brkType = readTimerStorage(currentUser, 'break_type');
      setBreakType(brkType || cachedTelem?.breakType || attRec?.breakType || null);

      const lTime = readTimerStorage(currentUser, 'login_time') || cachedTelem?.clockInTime || attRec?.clockInTime || attRec?.clockIn || null;
      setLoginTime(lTime);

      const cTime = resolvedIsClockedIn ? null : (readTimerStorage(currentUser, 'clockout_time') || readTimerStorage(currentUser, 'clock_out') || attRec?.clockOutTime || attRec?.clockOut || null);
      setClockOutTime(cTime);

      const hadOut = readTimerStorage(currentUser, 'had_clocked_out');
      const resolvedHadClockedOut = resolvedIsClockedIn ? false : (hadOut !== null ? (hadOut === 'true' || hadOut === true) : Boolean(cTime || hasAttClockOut));
      setHadClockedOutToday(resolvedHadClockedOut);

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayMidnightMs = todayMidnight.getTime();

      // Clean up any dirty past-day punch sessions from today's punch_sessions in localStorage
      let localSessions = [];
      try {
        const rawS = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
        if (rawS) localSessions = JSON.parse(rawS) || [];
      } catch (_) {}
      const cleanLocalSessions = localSessions.filter(s => Number(s.inTimestamp || 0) >= todayMidnightMs);
      if (cleanLocalSessions.length !== localSessions.length) {
        localStorage.setItem(`ems_timer_${userKey}_punch_sessions`, JSON.stringify(cleanLocalSessions));
        setPunchSessions(cleanLocalSessions);
      }

      let firstInTs = Number(readTimerStorage(currentUser, 'clock_in_timestamp')) || Number(attRec?.clockInTimestamp);
      if (!firstInTs || firstInTs < todayMidnightMs) {
        if (lTime && lTime !== '--' && lTime !== 'Active') {
          firstInTs = todayMidnightMs + parseTimeToSeconds(lTime) * 1000;
        }
      }
      const maxElapsedSinceIn = (firstInTs && firstInTs >= todayMidnightMs)
        ? Math.max(0, Math.floor((Date.now() - firstInTs) / 1000))
        : Math.max(0, Math.floor((Date.now() - todayMidnightMs) / 1000));

      const secVal = readTimerStorage(currentUser, 'work_seconds');
      let resolvedWorkSecs = 0;
      if (resolvedIsClockedIn || resolvedHadClockedOut) {
        resolvedWorkSecs = secVal ? Math.min(maxElapsedSinceIn, Math.max(0, parseInt(secVal, 10))) : (Number(attRec?.workSeconds) || 0);
        resolvedWorkSecs = Math.min(resolvedWorkSecs, maxElapsedSinceIn);
        writeTimerStorage(currentUser, 'work_seconds', String(resolvedWorkSecs));
        setWorkSeconds(resolvedWorkSecs);
      } else if (inVal !== null || attRec) {
        const existingAttSecs = Number(attRec?.workSeconds) || Math.round((Number(attRec?.totalWorkingHours) || 0) * 3600);
        const existingStoredSecs = Number(secVal) || 0;
        const pastSessSecs = cleanLocalSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
        const preservedSecs = Math.max(existingAttSecs, existingStoredSecs, pastSessSecs);

        if (preservedSecs > 0) {
          resolvedWorkSecs = Math.min(preservedSecs, maxElapsedSinceIn);
          writeTimerStorage(currentUser, 'work_seconds', String(resolvedWorkSecs));
          writeTimerStorage(currentUser, 'had_clocked_out', 'true');
          setHadClockedOutToday(true);
          setWorkSeconds(resolvedWorkSecs);
        } else {
          resolvedWorkSecs = 0;
          writeTimerStorage(currentUser, 'work_seconds', '0');
          setWorkSeconds(0);
        }
      } else {
        // Fresh device boot / unhydrated storage: do not wipe with 0, immediately trigger live sync!
        syncLiveShiftState();
      }

      // Clean up hrms_attendance in localStorage if it contains dirty past-day seconds
      if (attRec && (Number(attRec.workSeconds) > maxElapsedSinceIn || (Array.isArray(attRec.punchSessions) && attRec.punchSessions.some(s => Number(s.inTimestamp || 0) < todayMidnightMs)))) {
        try {
          const rawAtt = localStorage.getItem('hrms_attendance');
          if (rawAtt) {
            const list = JSON.parse(rawAtt) || [];
            const idx = list.findIndex(a => isRecordForUser(a, today));
            if (idx >= 0) {
              list[idx].workSeconds = resolvedWorkSecs;
              list[idx].totalWorkingHours = +(resolvedWorkSecs / 3600).toFixed(2);
              list[idx].punchSessions = (list[idx].punchSessions || []).filter(s => Number(s.inTimestamp || 0) >= todayMidnightMs);
              localStorage.setItem('hrms_attendance', JSON.stringify(list));
            }
          }
        } catch (_) {}
      }

      const brkSec = readTimerStorage(currentUser, 'break_seconds');
      setBreakSeconds(brkSec ? parseInt(brkSec, 10) : (Number(attRec?.breakSeconds) || 0));

      const rStatus = readTimerStorage(currentUser, 'reclock_status') || 'none';
      setReclockStatus(rStatus);

      const rSec = readTimerStorage(currentUser, 'reclock_session_seconds');
      setReclockSessionSeconds(rSec ? parseInt(rSec, 10) : 0);

      const sSec = readTimerStorage(currentUser, 'saved_official_seconds');
      setSavedOfficialWorkSeconds(sSec ? parseInt(sSec, 10) : resolvedWorkSecs);

      // Authoritative remote state check on mount or user switch
      syncLiveShiftState();
    }

    const timer = setTimeout(() => {
      isHydratingRef.current = false;
    }, 60);
    return () => clearTimeout(timer);
  }, [userKey, currentUser, isRecordForUser]);

  // Synchronize Authoritative Live Shift State from Database across all devices / laptops
  const syncLiveShiftState = useCallback(async () => {
    if (!userKey) return;
    const today = getTodayStr();

    try {
      let rec = null;
      // 1. Check local mirror first
      try {
        const attRaw = localStorage.getItem('hrms_attendance');
        if (attRaw) {
          const list = JSON.parse(attRaw);
          if (Array.isArray(list)) {
            rec = list.find(a => isRecordForUser(a, today));
          }
        }
      } catch {}

      // 2. Query MongoDB Atlas backend for latest attendance record (Fast live telemetry SSOT first)
      try {
        const telemRes = await hrService.getLiveTelemetry(today);
        const telemMap = (telemRes && typeof telemRes === 'object') ? (telemRes.data || telemRes) : {};
        if (telemMap && Object.keys(telemMap).length > 0) {
          try {
            localStorage.setItem('ems_last_telemetry', JSON.stringify(telemMap));
          } catch (_) {}
        }
        const empKeys = [
          userKey,
          targetEmpId,
          targetEmpCode,
          currentUser?._id,
          currentUser?.employeeCode,
          currentUser?.email
        ].filter(Boolean).map(String);

        let telemRec = null;
        for (const k of empKeys) {
          if (telemMap[k]) {
            telemRec = telemMap[k];
            break;
          }
          const lowerK = k.toLowerCase();
          if (telemMap[lowerK]) {
            telemRec = telemMap[lowerK];
            break;
          }
          const upperK = k.toUpperCase();
          if (telemMap[upperK]) {
            telemRec = telemMap[upperK];
            break;
          }
        }
        if (!telemRec) {
          const telemValues = Object.values(telemMap);
          telemRec = telemValues.find(v => {
            const vCode = String(v?.employeeCode || '').toUpperCase();
            const vId = String(v?.employeeId || '');
            const vEmail = String(v?.employeeEmail || '').toLowerCase();
            return empKeys.some(k => {
              const str = String(k);
              return str.toUpperCase() === vCode || str === vId || str.toLowerCase() === vEmail;
            });
          }) || null;
        }

        if (telemRec) {
          rec = telemRec;
        } else {
          const nowD = new Date();
          const remoteList = await hrService.getMonthlyAttendance(nowD.getMonth() + 1, nowD.getFullYear(), targetEmpId);
          if (Array.isArray(remoteList)) {
            const remoteRec = remoteList.find(a => isRecordForUser(a, today));
            if (remoteRec) {
              rec = remoteRec;
              try {
                const attRaw = localStorage.getItem('hrms_attendance');
                let attList = attRaw ? JSON.parse(attRaw) : [];
                if (!Array.isArray(attList)) attList = [];
                const idx = attList.findIndex(a => isRecordForUser(a, today));
                if (idx !== -1) {
                  attList[idx] = { ...attList[idx], ...remoteRec };
                } else {
                  attList.unshift(remoteRec);
                }
                localStorage.setItem('hrms_attendance', JSON.stringify(attList));
              } catch (_) {}
            }
          }
        }
      } catch (err) {}

      // 🌟 Remote MongoDB is authoritative over stale local cache:
      // If remote record shows isClockedIn is true for today, employee is actively working regardless of local stale clock-out flag!
      const hasClockIn = Boolean(rec && (rec.clockInTime || rec.clockIn || rec.firstClockInTime) && rec.clockInTime !== '--' && rec.clockIn !== '--');
      const hasExplicitClockOut = Boolean(
        rec && (
          (rec.clockOutTime && rec.clockOutTime !== '--' && rec.clockOutTime !== '—') ||
          (rec.clockOut && rec.clockOut !== '--' && rec.clockOut !== '—') ||
          Boolean(rec.clockOutTimestamp) ||
          rec.isClockedOut === true
        )
      );
      const remoteIsClockedIn = Boolean(
        rec &&
        rec.date === today &&
        !hasExplicitClockOut &&
        (rec.isClockedIn === true || rec.isClockedIn === 'true' || hasClockIn) &&
        rec.status !== 'on_leave' &&
        rec.status !== 'absent'
      );

      const localSessionDate = localStorage.getItem(`ems_timer_${userKey}_work_session_date`);

      // If localSessionDate is from a previous calendar day, reset all live timer keys for fresh day start
      // BUT if remote MongoDB Atlas has an active shift today, DO NOT wipe it to 0/false!
      if (localSessionDate && localSessionDate !== today) {
        if (!remoteIsClockedIn) {
          localStorage.removeItem(`ems_timer_${userKey}_login_time`);
          localStorage.removeItem(`ems_timer_${userKey}_clockout_time`);
          localStorage.removeItem(`ems_timer_${userKey}_clock_in_timestamp`);
          localStorage.removeItem(`ems_timer_${userKey}_clock_out_timestamp`);
          localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);
          localStorage.removeItem(`ems_timer_${userKey}_break_start_timestamp`);
          localStorage.removeItem(`ems_timer_${userKey}_punch_sessions`);
          localStorage.removeItem(`ems_timer_${userKey}_current_session_start_timestamp`);
          localStorage.setItem(`ems_timer_${userKey}_work_seconds`, '0');
          localStorage.setItem(`ems_timer_${userKey}_break_seconds`, '0');
          localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, '0');
          localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
          localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
          localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
          localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'false');
        }
        localStorage.setItem(`ems_timer_${userKey}_work_session_date`, today);
      }

      const localIsClockedIn = localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`) === 'true';
      const localHadClockedOut = localStorage.getItem(`ems_timer_${userKey}_had_clocked_out`) === 'true';
      // 🌟 Check if employee is on approved leave today
      const isRecordOnLeave = Boolean(rec && rec.date === today && rec.status === 'on_leave');
      if (isRecordOnLeave) {
        setIsOnLeaveToday(true);
        setTodayLeaveRecord(rec);
        // If employee is on leave and NOT actively working, keep shift inactive
        // But if they explicitly clocked in for urgent work, preserve the active session!
        if (!remoteIsClockedIn && !localIsClockedIn) {
          setIsClockedIn(false);
          setIsRunning(false);
          setIsOnBreak(false);
          setHadClockedOutToday(false);
          return;
        }
      } else {
        setIsOnLeaveToday(false);
        setTodayLeaveRecord(null);
      }

      const isActuallyClockedIn = remoteIsClockedIn || (!localHadClockedOut && localIsClockedIn && (!localSessionDate || localSessionDate === today));
      const isActuallyClockedOut = !isActuallyClockedIn && (
        Boolean(rec && rec.date === today && hasExplicitClockOut) ||
        (localHadClockedOut && localSessionDate === today)
      );

      if (isActuallyClockedIn) {
        const inTime = rec?.clockInTime || rec?.clockIn || rec?.firstClockInTime || loginTime || localStorage.getItem(`ems_timer_${userKey}_login_time`) || 'Active';
        let inTs = Number(rec?.clockInTimestamp) || Number(localStorage.getItem(`ems_timer_${userKey}_clock_in_timestamp`));
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        if (!inTs || inTs < todayMidnight.getTime()) {
          const parsedSecs = parseTimeToSeconds(inTime);
          inTs = todayMidnight.getTime() + parsedSecs * 1000;
        }

        const bSecs = Number(rec?.breakSeconds) || Number(localStorage.getItem(`ems_timer_${userKey}_break_seconds`)) || 0;
        const maxGrossSecs = (inTs && inTs >= todayMidnight.getTime())
          ? Math.max(0, Math.floor((Date.now() - inTs) / 1000))
          : Math.max(0, Math.floor((Date.now() - todayMidnight.getTime()) / 1000));

        // 🌟 Option 1: Multi-session calculation for effectiveWorkSecs strictly for today
        let remoteSessions = Array.isArray(rec?.punchSessions) ? rec.punchSessions : [];
        if (remoteSessions.length === 0) {
          try {
            const rawS = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
            if (rawS) remoteSessions = JSON.parse(rawS) || [];
          } catch {}
        }
        remoteSessions = remoteSessions.filter(s => Number(s.inTimestamp || 0) >= todayMidnight.getTime());
        setPunchSessions(remoteSessions);
        localStorage.setItem(`ems_timer_${userKey}_punch_sessions`, JSON.stringify(remoteSessions));

        const pastSessionsSecs = remoteSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
        const serverSessStart = Number(rec?.currentSessionStartTimestamp || rec?.clockInTimestamp);
        let sessStartTs = Number(localStorage.getItem(`ems_timer_${userKey}_current_session_start_timestamp`)) || serverSessStart || inTs;
        sessStartTs = Math.max(sessStartTs, todayMidnight.getTime());
        const curSessionGrossSecs = Math.max(0, Math.floor((Date.now() - sessStartTs) / 1000));
        const sessionBreakBaseline = Number(localStorage.getItem(`ems_timer_${userKey}_session_break_baseline`)) || 0;
        const curSessionBreaks = Math.max(0, bSecs - sessionBreakBaseline);
        const computedSecs = Math.min(maxGrossSecs, pastSessionsSecs + Math.max(0, curSessionGrossSecs - curSessionBreaks));
        const effectiveWorkSecs = Math.max(Number(rec?.workSeconds || 0), computedSecs);

        const localIsOnBreak = localStorage.getItem(`ems_timer_${userKey}_is_on_break`) === 'true';
        const localBreakStartTs = Number(localStorage.getItem(`ems_timer_${userKey}_break_start_timestamp`));
        const hasRecentLocalBreak = localIsOnBreak && localBreakStartTs && (Date.now() - localBreakStartTs < 2 * 3600 * 1000);

        const effectiveOnBreak = hasRecentLocalBreak ? true : Boolean(rec?.isOnBreak);

        setIsClockedIn(true);
        setIsRunning(!effectiveOnBreak);
        setIsOnBreak(effectiveOnBreak);
        setLoginTime(inTime);
        setClockOutTime(null);
        setHadClockedOutToday(false);

        // 🌟 FLICKER PREVENTION: When actively on break, never overwrite breakSeconds with stale remote bSecs (which is 0 or frozen)!
        const localStoredBreakSecs = Number(localStorage.getItem(`ems_timer_${userKey}_break_seconds`)) || 0;
        const effectiveBreakSecs = effectiveOnBreak
          ? Math.max(bSecs, localStoredBreakSecs)
          : (bSecs > 0 ? bSecs : localStoredBreakSecs);
        setBreakSeconds(prev => (effectiveOnBreak ? Math.max(prev, effectiveBreakSecs) : effectiveBreakSecs));

        // 🌟 Synchronize authoritative workSeconds monotonically (Never downgrade live hours!)
        setWorkSeconds(prev => Math.max(prev, effectiveWorkSecs));

        if (rec?.breakType) setBreakType(rec.breakType);
        if (Array.isArray(rec?.breakHistory) && rec.breakHistory.length > 0) {
          setBreakHistory(rec.breakHistory);
          localStorage.setItem(`ems_timer_${userKey}_break_history`, JSON.stringify(rec.breakHistory));
        }

        // 🌟 Universal Break State & Elapsed Timer Synchronization across devices
        const bStartTs = Number(rec?.breakStartTimestamp) || Number(localStorage.getItem(`ems_timer_${userKey}_break_start_timestamp`)) || (effectiveOnBreak ? Date.now() : 0);
        if (effectiveOnBreak && bStartTs > 0) {
          setBreakStartTime(rec?.breakStartTime || new Date(bStartTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          setCurrentBreakSeconds(Math.max(0, Math.floor((Date.now() - bStartTs) / 1000)));
        } else if (!effectiveOnBreak) {
          setBreakStartTime(null);
          setCurrentBreakSeconds(0);
        }

        const mirrorKeys = [userKey, targetEmpId, targetEmpCode, currentUser?._id, currentUser?.employeeCode].filter(Boolean);
        for (const uk of mirrorKeys) {
          localStorage.setItem(`ems_timer_${uk}_work_session_date`, today);
          localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'true');
          localStorage.setItem(`ems_timer_${uk}_is_running`, effectiveOnBreak ? 'false' : 'true');
          localStorage.setItem(`ems_timer_${uk}_is_on_break`, effectiveOnBreak ? 'true' : 'false');
          localStorage.setItem(`ems_timer_${uk}_login_time`, inTime);
          localStorage.setItem(`ems_timer_${uk}_clock_in_timestamp`, String(inTs));
          localStorage.setItem(`ems_timer_${uk}_current_session_start_timestamp`, String(sessStartTs));
          localStorage.setItem(`ems_timer_${uk}_had_clocked_out`, 'false');
          const curLocalWorkSecs = Number(localStorage.getItem(`ems_timer_${uk}_work_seconds`)) || 0;
          const safeWorkSecs = Math.max(curLocalWorkSecs, effectiveWorkSecs);
          localStorage.setItem(`ems_timer_${uk}_work_seconds`, String(safeWorkSecs));
          const curStoredBreak = Number(localStorage.getItem(`ems_timer_${uk}_break_seconds`)) || 0;
          const breakToPersist = effectiveOnBreak ? Math.max(curStoredBreak, effectiveBreakSecs) : effectiveBreakSecs;
          localStorage.setItem(`ems_timer_${uk}_break_seconds`, String(breakToPersist));
          if (effectiveOnBreak && bStartTs > 0) {
            localStorage.setItem(`ems_timer_${uk}_break_start_timestamp`, String(bStartTs));
            if (rec?.breakStartTime) localStorage.setItem(`ems_timer_${uk}_break_start_time`, rec.breakStartTime);
            if (rec?.breakType) localStorage.setItem(`ems_timer_${uk}_break_type`, rec.breakType);
          } else if (!effectiveOnBreak) {
            localStorage.removeItem(`ems_timer_${uk}_break_start_timestamp`);
            localStorage.removeItem(`ems_timer_${uk}_break_start_time`);
            localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
          }
          localStorage.removeItem(`ems_timer_${uk}_clockout_time`);
          localStorage.removeItem(`ems_timer_${uk}_clock_out`);
          localStorage.removeItem(`ems_timer_${uk}_clock_out_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_last_clock_out_time`);
          localStorage.removeItem(`ems_timer_${uk}_last_clock_out_timestamp`);
        }

        if (!localIsClockedIn) {
          window.dispatchEvent(new CustomEvent('ems_clocked_in', { detail: { empKey: userKey, userKey } }));
          window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: `ems_timer_${userKey}_is_clocked_in` } }));
        }

        if (rec?.activeTask) {
          window.dispatchEvent(new CustomEvent('ems_shift_telemetry_synced', { detail: { user: currentUser, telemRec: rec } }));
        }
      } else if (isActuallyClockedOut) {
        const outTime = rec?.clockOutTime || rec?.clockOut || localStorage.getItem(`ems_timer_${userKey}_clockout_time`) || null;
        const inTime = rec?.clockInTime || rec?.clockIn || loginTime || localStorage.getItem(`ems_timer_${userKey}_login_time`) || null;
        const finalWorkSecs = Number(rec?.workSeconds) || Math.round((Number(rec?.totalWorkingHours) || 0) * 3600) || Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) || 0;
        const wasClockedInLocally = isClockedIn || isRunning;

        if (Array.isArray(rec?.punchSessions) && rec.punchSessions.length > 0) {
          setPunchSessions(rec.punchSessions);
          localStorage.setItem(`ems_timer_${userKey}_punch_sessions`, JSON.stringify(rec.punchSessions));
        }

        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setHadClockedOutToday(true);
        setClockOutTime(outTime);
        if (inTime) setLoginTime(inTime);
        if (finalWorkSecs > 0) setWorkSeconds(finalWorkSecs);

        const mirrorKeys = [userKey, targetEmpId, targetEmpCode, currentUser?._id, currentUser?.employeeCode].filter(Boolean);
        for (const uk of mirrorKeys) {
          localStorage.setItem(`ems_timer_${uk}_work_session_date`, today);
          localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'false');
          localStorage.setItem(`ems_timer_${uk}_is_running`, 'false');
          localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'false');
          localStorage.setItem(`ems_timer_${uk}_had_clocked_out`, 'true');
          if (outTime) localStorage.setItem(`ems_timer_${uk}_clockout_time`, outTime);
          if (inTime) localStorage.setItem(`ems_timer_${uk}_login_time`, inTime);
          if (finalWorkSecs > 0) localStorage.setItem(`ems_timer_${uk}_work_seconds`, String(finalWorkSecs));
          localStorage.removeItem(`ems_timer_${uk}_break_start_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_break_start_time`);
          localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
        }

        // 🌟 Remote Clock-Out Event Dispatcher: If this device was still locally active, trigger events so task timers immediately freeze!
        if (wasClockedInLocally) {
          window.dispatchEvent(new CustomEvent('ems_clocked_out', {
            detail: {
              userKey,
              employeeId: targetEmpId,
              employeeCode: targetEmpCode,
              logoutTime: outTime,
              date: today,
              reason: 'Remote device shift clock-out'
            }
          }));
          window.dispatchEvent(new CustomEvent('ems_task_timer_stopped', {
            detail: { reason: 'remote_device_clock_out' }
          }));
          window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
        }
      } else {
        // User has not clocked in today: Ensure state is cleanly reset to 0:00 and not clocked in
        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setHadClockedOutToday(false);
        setClockOutTime(null);
        setLoginTime(null);
        setWorkSeconds(0);
        setBreakSeconds(0);
      }
    } catch (e) {
      console.warn('Error in syncLiveShiftState:', e);
    }
  }, [userKey, targetEmpId, isRecordForUser, loginTime]);

  // Periodic and reactive sync for cross-device consistency (3s cloud poller)
  useEffect(() => {
    syncLiveShiftState();
    const interval = setInterval(syncLiveShiftState, 3000);
    const handleSync = () => syncLiveShiftState();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncLiveShiftState();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('online', handleSync);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('hrms_storage_change', handleSync);
    window.addEventListener('ems_clocked_in', handleSync);
    window.addEventListener('ems_clocked_out', handleSync);
    window.addEventListener('ems_shift_telemetry_synced', handleSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('online', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('hrms_storage_change', handleSync);
      window.removeEventListener('ems_clocked_in', handleSync);
      window.removeEventListener('ems_clocked_out', handleSync);
      window.removeEventListener('ems_shift_telemetry_synced', handleSync);
    };
  }, [syncLiveShiftState]);

  // Listen for global reclock requests updates (e.g. from Admin in another tab or component)
  useEffect(() => {
    const handleReclockSync = () => {
      try {
        const raw = localStorage.getItem('ems_reclock_requests');
        const list = raw ? JSON.parse(raw) : [];
        setReclockRequests(list);

        // Check if current user's request status changed
        const myActiveReq = list.find(r => r.employeeId === userKey && r.date === getTodayStr());
        if (myActiveReq) {
          if (myActiveReq.status === 'approved' && reclockStatus === 'pending') {
            setReclockStatus('approved');
            localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'approved');
            // Merge unapproved session into official
            setSavedOfficialWorkSeconds(workSeconds);
            localStorage.setItem(`ems_timer_${userKey}_saved_official_seconds`, workSeconds.toString());
            addToast('🎉 Admin approved your Re-Clock In! Hours are officially counted.', 'success');
          } else if (myActiveReq.status === 'rejected' && reclockStatus === 'pending') {
            setReclockStatus('rejected');
            setIsRunning(false);
            setIsClockedIn(false);
            // Discard unapproved seconds
            setWorkSeconds(savedOfficialWorkSeconds);
            setReclockSessionSeconds(0);
            localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'rejected');
            localStorage.setItem(`ems_timer_${userKey}_work_seconds`, savedOfficialWorkSeconds.toString());
            localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
            localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
            localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');
            addToast('❌ Re-Clock In request was rejected by Admin. Extra session time was discarded.', 'error');
          }
        }
      } catch (e) {
        console.error('Error syncing reclock requests:', e);
      }
    };

    window.addEventListener('ems_reclock_requests_updated', handleReclockSync);
    window.addEventListener('storage', handleReclockSync);
    return () => {
      window.removeEventListener('ems_reclock_requests_updated', handleReclockSync);
      window.removeEventListener('storage', handleReclockSync);
    };
  }, [userKey, reclockStatus, workSeconds, savedOfficialWorkSeconds, addToast]);

  // Check and perform auto-rollover if date changed while page was open
  useEffect(() => {
    const today = getTodayStr();
    if (sessionDate !== today) {
      // 1. Auto-close previous day's shift session in hrms_attendance so forgotten clock-outs are cleanly finalized!
      try {
        const rawAtt = localStorage.getItem('hrms_attendance');
        if (rawAtt) {
          const list = JSON.parse(rawAtt);
          if (Array.isArray(list)) {
            let changed = false;
            const updated = list.map(a => {
              const isMatch = a.date === sessionDate && (
                String(a.employeeId) === String(userKey) ||
                String(a.employee) === String(userKey) ||
                (targetEmpCode && String(a.employeeCode) === String(targetEmpCode)) ||
                (targetEmpId && String(a.employeeId) === String(targetEmpId))
              );
              if (isMatch && !a.clockOutTime) {
                changed = true;
                const prevSecs = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) || Number(a.workSeconds) || 32400;
                const cappedSecs = Math.min(Math.max(prevSecs, 28800), 32400); // 8-9h standard
                return {
                  ...a,
                  clockOutTime: '11:59 PM',
                  isClockedIn: false,
                  status: 'present',
                  workSeconds: cappedSecs,
                  totalWorkingHours: +(cappedSecs / 3600).toFixed(2),
                  notes: (a.notes ? a.notes + ' • ' : '') + 'Auto-closed at midnight (forgotten clock-out)'
                };
              }
              return a;
            });
            if (changed) {
              localStorage.setItem('hrms_attendance', JSON.stringify(updated));
              window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
            }
          }
        }
      } catch (_) {}

      localStorage.setItem(`ems_timer_${userKey}_work_session_date`, today);
      setWorkSeconds(0);
      setBreakSeconds(0);
      setIsClockedIn(false);
      setIsRunning(false);
      setIsOnBreak(false);
      setLoginTime(null);
      setClockOutTime(null);
      setHadClockedOutToday(false);
      setCurrentBreakSeconds(0);
      setBreakStartTime(null);
      setReclockStatus('none');
      setReclockSessionSeconds(0);
      setSavedOfficialWorkSeconds(0);

      localStorage.setItem(`ems_timer_${userKey}_work_seconds`, '0');
      localStorage.setItem(`ems_timer_${userKey}_break_seconds`, '0');
      localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
      localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
      localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
      localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'false');
      localStorage.removeItem(`ems_timer_${userKey}_login_time`);
      localStorage.removeItem(`ems_timer_${userKey}_clockout_time`);
      localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);
      localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'none');
      localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');
      localStorage.setItem(`ems_timer_${userKey}_saved_official_seconds`, '0');

      window.dispatchEvent(new CustomEvent('ems_day_rollover', {
        detail: { newDate: today, previousDate: sessionDate, userKey }
      }));
    }
  }, [sessionDate, userKey]);

  // Save break history
  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_break_history`, JSON.stringify(breakHistory));
  }, [breakHistory, userKey]);

  // ── True Wall-Clock Timestamp Engine (Immune to tab sleep, throttle & page reloads) ──
  useEffect(() => {
    let interval = null;

    const tick = () => {
      const today = getTodayStr();
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayMidnightMs = todayMidnight.getTime();

      const inVal = localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`) === 'true';
      const onBreakVal = localStorage.getItem(`ems_timer_${userKey}_is_on_break`) === 'true';
      const hadOutVal = localStorage.getItem(`ems_timer_${userKey}_had_clocked_out`) === 'true';
      let clockInTs = Number(localStorage.getItem(`ems_timer_${userKey}_clock_in_timestamp`));
      let breakStartTs = Number(localStorage.getItem(`ems_timer_${userKey}_break_start_timestamp`));

      // 🌙 Strict Midnight Auto-Close (User Requirement): Auto-clock out at 11:59 PM so that day's shift is cleanly sealed into today's attendance
      const nowClock = new Date();
      if (inVal && nowClock.getHours() === 23 && nowClock.getMinutes() >= 59) {
        performShiftClockOut(currentUser, { reason: 'Midnight 11:59 PM Auto-Close', nowTs: nowClock.getTime(), nowStr: '11:59 PM' });
        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setClockOutTime('11:59 PM');
        setHadClockedOutToday(true);
        window.dispatchEvent(new CustomEvent('ems_task_timer_stopped', { detail: { reason: 'midnight_autoclose' } }));
        window.dispatchEvent(new CustomEvent('ems_clocked_out', { detail: { reason: 'midnight_autoclose' } }));
        return;
      }

      // Guard: Check if active timer belongs to a prior calendar day
      const storedSessionDate = localStorage.getItem(`ems_timer_${userKey}_work_session_date`);
      const isPastDaySession = Boolean(
        (storedSessionDate && storedSessionDate !== today) ||
        (clockInTs && clockInTs < todayMidnightMs)
      );

      if (isPastDaySession) {
        // Auto-close yesterday's attendance record in background before resetting today's session
        try {
          const inDate = (clockInTs && clockInTs < todayMidnightMs)
            ? getLocalDateStr(clockInTs)
            : (storedSessionDate || '');
          const rawAtt = localStorage.getItem('hrms_attendance');
          if (rawAtt && inDate) {
            const list = JSON.parse(rawAtt);
            if (Array.isArray(list)) {
              let changed = false;
              const updated = list.map(a => {
                const isMatch = a.date === inDate && (
                  String(a.employeeId) === String(userKey) ||
                  String(a.employee) === String(userKey) ||
                  (targetEmpCode && String(a.employeeCode) === String(targetEmpCode)) ||
                  (targetEmpId && String(a.employeeId) === String(targetEmpId))
                );
                if (isMatch && !a.clockOutTime) {
                  changed = true;
                  const companySettings = getCompanySettings();
                  const autoWorkSecs = (Number(companySettings.standardWorkHours) || 9) * 3600;
                  const prevSecs = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) || Number(a.workSeconds) || 0;
                  const cappedSecs = prevSecs > 0 ? Math.min(prevSecs, autoWorkSecs) : autoWorkSecs;
                  const shiftEndTime = companySettings.shiftEndTime || '07:00 PM';
                  return {
                    ...a,
                    clockOutTime: shiftEndTime,
                    clockOut: shiftEndTime,
                    isClockedIn: false,
                    isOnBreak: false,
                    status: 'present',
                    workSeconds: cappedSecs,
                    totalWorkingHours: +(cappedSecs / 3600).toFixed(2),
                    notes: (a.notes ? a.notes + ' • ' : '') + `Auto-closed at shift end (${shiftEndTime})`
                  };
                }
                return a;
              });
              if (changed) {
                localStorage.setItem('hrms_attendance', JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
                window.dispatchEvent(new CustomEvent('ems_attendance_updated', { detail: { date: inDate } }));
              }
            }
          }
        } catch (_) {}

        clockInTs = null;
        const mirrorKeys = getTimerMirrorKeys(currentUser);
        for (const uk of mirrorKeys) {
          localStorage.removeItem(`ems_timer_${uk}_clock_in_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_clock_out_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_login_time`);
          localStorage.removeItem(`ems_timer_${uk}_clock_out`);
          localStorage.removeItem(`ems_timer_${uk}_clockout_time`);
          localStorage.removeItem(`ems_timer_${uk}_current_session_start_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_break_start_time`);
          localStorage.removeItem(`ems_timer_${uk}_break_start_timestamp`);
          localStorage.removeItem(`ems_timer_${uk}_punch_sessions`);
          localStorage.removeItem(`ems_timer_${uk}_break_history`);
          localStorage.removeItem(`ems_timer_${uk}_session_break_baseline`);
          localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'false');
          localStorage.setItem(`ems_timer_${uk}_is_running`, 'false');
          localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'false');
          localStorage.setItem(`ems_timer_${uk}_had_clocked_out`, 'false');
          localStorage.setItem(`ems_timer_${uk}_work_seconds`, '0');
          localStorage.setItem(`ems_timer_${uk}_break_seconds`, '0');
          localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
          localStorage.setItem(`ems_timer_${uk}_work_session_date`, today);
        }
        setIsClockedIn(false);
        setIsRunning(false);
        setIsOnBreak(false);
        setHadClockedOutToday(false);
        setWorkSeconds(0);
        setBreakSeconds(0);
        setCurrentBreakSeconds(0);
        setBreakHistory([]);
        setLoginTime(null);
        setClockOutTime(null);
        return;
      }

      // Calculate past completed breaks for today from break_history
      let pastBreakSecs = 0;
      try {
        const rawBh = localStorage.getItem(`ems_timer_${userKey}_break_history`);
        if (rawBh) {
          const parsed = JSON.parse(rawBh);
          if (Array.isArray(parsed)) {
            pastBreakSecs = parsed.filter(b => b.date === today).reduce((acc, b) => acc + (Number(b.durationSeconds) || 0), 0);
          }
        }
      } catch {}

      let activeBreakSecs = 0;
      // Break is strictly counted ONLY if user is clocked in AND has explicitly started a break
      if (inVal && onBreakVal) {
        if (!breakStartTs) {
          breakStartTs = Date.now();
          localStorage.setItem(`ems_timer_${userKey}_break_start_timestamp`, breakStartTs.toString());
        }
        activeBreakSecs = Math.max(0, Math.floor((Date.now() - breakStartTs) / 1000));
        setCurrentBreakSeconds(activeBreakSecs);
        localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, activeBreakSecs.toString());

        const threshold = BREAK_THRESHOLDS[breakType] || (20 * 60);
        if (activeBreakSecs >= threshold && !breakReminderSent) {
          setBreakReminderSent(true);
          addToast({
            title: `☕ Break Reminder (${breakType})`,
            message: `You've been on ${breakType} for ${Math.floor(threshold / 60)} minutes. Remember to resume when ready!`,
            type: 'warning'
          });
        }
      } else {
        // User is working or not on break - clean up any stale break timestamps
        activeBreakSecs = 0;
        setCurrentBreakSeconds(0);
        if (!onBreakVal) {
          localStorage.removeItem(`ems_timer_${userKey}_break_start_timestamp`);
          localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);
          localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, '0');
        }
      }

      const totalBreaks = pastBreakSecs + activeBreakSecs;
      setBreakSeconds(totalBreaks);

      if (inVal) {
        // ── Option 1: Cumulative Multi-Session Shift Calculation ──
        // 1. Sum of all previous completed punch sessions strictly for today (strictly normalized)
        let storedSessions = [];
        try {
          const rawSess = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
          if (rawSess) storedSessions = JSON.parse(rawSess) || [];
        } catch {}
        storedSessions = normalizePunchSessions((storedSessions || []).filter(s => Number(s.inTimestamp || 0) >= todayMidnightMs));
        const pastSessionsSecs = storedSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);

        const lastSessionOut = storedSessions.length > 0
          ? Math.max(...storedSessions.map(s => Number(s.outTimestamp || s.inTimestamp || 0)))
          : 0;

        // 2. Active session start timestamp (starts freshly from now on each clock in)
        let sessStartTs = Number(localStorage.getItem(`ems_timer_${userKey}_current_session_start_timestamp`));
        if (!sessStartTs || sessStartTs < todayMidnightMs) {
          if (lastSessionOut > 0) {
            sessStartTs = lastSessionOut;
          } else if (clockInTs && clockInTs >= todayMidnightMs && storedSessions.length === 0) {
            sessStartTs = clockInTs;
          } else {
            sessStartTs = Date.now();
          }
          localStorage.setItem(`ems_timer_${userKey}_current_session_start_timestamp`, sessStartTs.toString());
        }
        if (lastSessionOut > 0 && sessStartTs < lastSessionOut) {
          sessStartTs = lastSessionOut;
          localStorage.setItem(`ems_timer_${userKey}_current_session_start_timestamp`, sessStartTs.toString());
        }
        sessStartTs = Math.max(sessStartTs, todayMidnightMs);

        const curSessionGrossSecs = Math.max(0, Math.floor((Date.now() - sessStartTs) / 1000));
        const sessionBreakBaseline = Number(localStorage.getItem(`ems_timer_${userKey}_session_break_baseline`)) || 0;
        // Total break duration strictly incurred during this active session
        const curSessionBreaks = Math.max(0, totalBreaks - sessionBreakBaseline);

        // ⏱️ Physical Upper Bound: Shift work seconds can NEVER exceed physical wall-clock time since clock-in minus breaks!
        let firstClockInTs = (clockInTs && clockInTs >= todayMidnightMs) ? clockInTs : 0;
        if (!firstClockInTs) {
          const loginStr = localStorage.getItem(`ems_timer_${userKey}_login_time`);
          if (loginStr && loginStr !== '--' && loginStr !== 'Active') {
            firstClockInTs = todayMidnightMs + parseTimeToSeconds(loginStr) * 1000;
          }
        }
        if (!firstClockInTs || firstClockInTs < todayMidnightMs) {
          firstClockInTs = sessStartTs;
        }

        const maxPossibleElapsedSinceClockIn = Math.max(0, Math.floor((Date.now() - firstClockInTs) / 1000));
        const maxPossibleNetWorkSecs = Math.max(0, maxPossibleElapsedSinceClockIn - totalBreaks);

        let netWorkSecs = 0;
        if (onBreakVal) {
          // STRICT FREEZE: While actively on break, work seconds is mathematically FROZEN!
          // Do NOT calculate floating (curSessionGrossSecs - curSessionBreaks) which oscillates due to sub-second phase differences!
          const frozenWorkSecs = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds_at_break`)) ||
                                 Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) ||
                                 workSeconds || 0;
          netWorkSecs = frozenWorkSecs;
          setWorkSeconds(frozenWorkSecs);
        } else {
          // Total working time = completed sessions + (current active session minus active & completed breaks in this session)
          netWorkSecs = Math.min(maxPossibleNetWorkSecs, pastSessionsSecs + Math.max(0, curSessionGrossSecs - curSessionBreaks));
          setWorkSeconds(netWorkSecs);

          const nowTs = Date.now();
          const storedWorkVal = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`) || 0);
          if (nowTs - lastStorageWriteTs > 2000 || Math.abs(netWorkSecs - storedWorkVal) > 2) {
            lastStorageWriteTs = nowTs;
            const mirrorKeys = [userKey, targetEmpId, targetEmpCode].filter(Boolean);
            for (const uk of mirrorKeys) {
              localStorage.setItem(`ems_timer_${uk}_break_seconds`, totalBreaks.toString());
              localStorage.setItem(`ems_timer_${uk}_work_seconds`, netWorkSecs.toString());
            }
          }
        }

        if (reclockStatus === 'pending') {
          const rBase = Number(localStorage.getItem(`ems_timer_${userKey}_saved_official_seconds`) || 0);
          const rSecs = Math.max(0, netWorkSecs - rBase);
          setReclockSessionSeconds(rSecs);
          localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, rSecs.toString());
        }
      } else if (!hadOutVal) {
        // Not clocked in and haven't marked had_clocked_out: check if there are verified hours worked today
        const curStoredWork = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) || 0;
        let pastSessSecs = 0;
        try {
          const rawSess = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
          if (rawSess) {
            const parsed = JSON.parse(rawSess) || [];
            pastSessSecs = parsed.filter(s => Number(s.inTimestamp || 0) >= todayMidnightMs).reduce((a, b) => a + (Number(b.durationSeconds) || 0), 0);
          }
        } catch (_) {}
        const preserved = Math.max(curStoredWork, pastSessSecs);
        if (preserved > 0) {
          setWorkSeconds(preserved);
          setHadClockedOutToday(true);
          localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'true');
        } else {
          setWorkSeconds(0);
          writeTimerStorage(currentUser, 'work_seconds', '0');
        }
      }
    };

    let lastStorageWriteTs = 0;

    tick();
    interval = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isClockedIn, isOnBreak, breakType, breakReminderSent, reclockStatus, userKey, addToast]);



  useEffect(() => {
    if (!userKey || isHydratingRef.current || prevUserKeyRef.current !== userKey) return;
    writeTimerStorage(currentUser, 'is_running', isRunning);
  }, [isRunning, userKey, currentUser]);

  useEffect(() => {
    if (!userKey || isHydratingRef.current || prevUserKeyRef.current !== userKey) return;
    writeTimerStorage(currentUser, 'is_on_break', isOnBreak);
    writeTimerStorage(currentUser, 'break_type', breakType || '');
  }, [isOnBreak, breakType, userKey, currentUser]);

  useEffect(() => {
    if (!userKey || isHydratingRef.current || prevUserKeyRef.current !== userKey) return;
    writeTimerStorage(currentUser, 'is_clocked_in', isClockedIn);
  }, [isClockedIn, userKey, currentUser]);

  useEffect(() => {
    if (!userKey || isHydratingRef.current || prevUserKeyRef.current !== userKey) return;
    writeTimerStorage(currentUser, 'had_clocked_out', hadClockedOutToday);
  }, [hadClockedOutToday, userKey, currentUser]);

  // ── Actions ──
  const togglePauseResume = () => {
    if (!isClockedIn || hadClockedOutToday) {
      addToast('Cannot run timer when clocked out. Please clock in first.', 'warning');
      return;
    }
    if (isOnBreak) {
      resumeFromBreak();
      return;
    }
    setIsRunning(prev => {
      const next = !prev;
      addToast(next ? 'Work timer resumed ⏱️' : 'Work timer paused ⏸️', 'info');
      return next;
    });
  };

  /**
   * Start a new break session with custom duration support
   */
  const startBreak = (type = 'Tea Break', notes = '', customMinutes = null) => {
    const startTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const minutesChosen = customMinutes && customMinutes > 0
      ? Number(customMinutes)
      : (BREAK_THRESHOLDS[type] ? Math.round(BREAK_THRESHOLDS[type] / 60) : 15);

    setBreakType(type);
    setCustomBreakLimitMinutes(minutesChosen);
    setIsOnBreak(true);
    setIsRunning(false);
    setCurrentBreakSeconds(0);
    setBreakStartTime(startTimeStr);
    setBreakReminderSent(false);

    const mirrorKeys = getTimerMirrorKeys(currentUser);
    for (const uk of mirrorKeys) {
      localStorage.setItem(`ems_timer_${uk}_break_type`, type);
      localStorage.setItem(`ems_timer_${uk}_custom_break_limit`, minutesChosen.toString());
      localStorage.setItem(`ems_timer_${uk}_break_start_time`, startTimeStr);
      localStorage.setItem(`ems_timer_${uk}_break_start_timestamp`, Date.now().toString());
      localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
      localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'true');
      localStorage.setItem(`ems_timer_${uk}_is_running`, 'false');
      localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'true');
      localStorage.setItem(`ems_timer_${uk}_work_seconds`, (workSeconds || 0).toString());
      localStorage.setItem(`ems_timer_${uk}_work_seconds_at_break`, (workSeconds || 0).toString());
    }

    // Immediately update local hrms_attendance mirror so all UI components see isOnBreak: true synchronously
    try {
      const today = getTodayStr();
      const rawAtt = localStorage.getItem('hrms_attendance');
      if (rawAtt) {
        const list = JSON.parse(rawAtt);
        if (Array.isArray(list)) {
          const updated = list.map(a => {
            if (isRecordForUser(a, today)) {
              return { ...a, isOnBreak: true, breakType: type, status: 'present' };
            }
            return a;
          });
          localStorage.setItem('hrms_attendance', JSON.stringify(updated));
        }
      }
    } catch {}

    // Notify other components (WorkContext task timers pause) with user identity
    window.dispatchEvent(new CustomEvent('ems_break_started', {
      detail: {
        userKey,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode,
        breakType: type,
        targetMinutes: minutesChosen,
        notes
      }
    }));

    // Record audit trail event for break trigger
    const isTea = type.toLowerCase().includes('tea');
    const isLunch = type.toLowerCase().includes('lunch');
    const logType = isTea ? 'tea_break_start' : (isLunch ? 'lunch_break_start' : 'break_start');
    const logAction = isTea ? 'Tea Break Started' : (isLunch ? 'Lunch Break Started' : `${type} Started`);

    recordAuditLog({
      type: logType,
      action: logAction,
      details: `${type} (${minutesChosen} min target) started at ${startTimeStr}. Work and task timers paused.`
    });

    try {
      hrService.markAttendance({
        employee: targetEmpId,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode,
        date: getTodayStr(),
        status: 'present',
        isOnBreak: true,
        breakType: type,
        workSeconds,
        breakSeconds
      }).catch(() => {});
    } catch {}

    try {
      hrService.sendHeartbeat({
        employeeId: targetEmpId || userKey,
        employeeCode: targetEmpCode || userKey,
        isClockedIn: true,
        isOnBreak: true,
        breakType: type,
        breakStartTimestamp: Date.now(),
        breakSeconds: Number(breakSeconds) || 0,
        workSeconds
      }).catch(() => {});
    } catch (_) {}

    broadcastSyncEvent(SYNC_EVENTS.SHIFT_BREAK_STARTED, {
      employeeId: targetEmpId || userKey,
      employeeCode: targetEmpCode || userKey,
      breakType: type,
      breakSeconds: Number(breakSeconds) || 0
    });

    addToast({
      title: `On ${type} ☕ (${minutesChosen} min target)`,
      message: `Break started at ${startTimeStr}. Task & work timers paused. Break timer active.`,
      type: 'info'
    });
  };

  /**
   * Resume working from break and record into Break History
   */
  const resumeFromBreak = () => {
    const endTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const sTime = breakStartTime || loginTime;
    const breakStartMs = Number(localStorage.getItem(`ems_timer_${userKey}_break_start_timestamp`));
    const duration = breakStartMs ? Math.max(1, Math.floor((Date.now() - breakStartMs) / 1000)) : (currentBreakSeconds > 0 ? currentBreakSeconds : 60);

    const newRecord = {
      id: `brk_${Date.now()}`,
      type: breakType,
      targetMinutes: customBreakLimitMinutes,
      startTime: sTime,
      endTime: endTimeStr,
      durationSeconds: duration,
      durationText: formatMinutesSeconds(duration),
      date: getTodayStr(),
      notes: `Resumed work at ${endTimeStr}`
    };

    const today = getTodayStr();
    const updatedHistory = [newRecord, ...breakHistory.filter(b => b.date === today)];
    setBreakHistory(updatedHistory);

    setIsOnBreak(false);
    setIsRunning(true);
    setCurrentBreakSeconds(0);
    setBreakStartTime(null);
    setBreakReminderSent(false);

    const mirrorKeys = getTimerMirrorKeys(currentUser);
    // Mathematically exact sum of all completed breaks strictly for today (prevents double-counting duration)
    const totalBreaksAfterResume = updatedHistory.reduce((acc, b) => acc + (Number(b.durationSeconds) || 0), 0);

    for (const uk of mirrorKeys) {
      localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'false');
      localStorage.setItem(`ems_timer_${uk}_is_running`, 'true');
      localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
      localStorage.removeItem(`ems_timer_${uk}_break_start_time`);
      localStorage.removeItem(`ems_timer_${uk}_break_start_timestamp`);
      localStorage.removeItem(`ems_timer_${uk}_work_seconds_at_break`);
      localStorage.setItem(`ems_timer_${uk}_break_seconds`, totalBreaksAfterResume.toString());
      localStorage.setItem(`ems_timer_${uk}_break_history`, JSON.stringify(updatedHistory));
    }
    setBreakSeconds(totalBreaksAfterResume);

    // Immediately update local hrms_attendance mirror so all UI components see isOnBreak: false synchronously
    try {
      const today = getTodayStr();
      const rawAtt = localStorage.getItem('hrms_attendance');
      if (rawAtt) {
        const list = JSON.parse(rawAtt);
        if (Array.isArray(list)) {
          const updated = list.map(a => {
            if (isRecordForUser(a, today)) {
              return { ...a, isOnBreak: false, breakType: null, status: 'present', breakSeconds: totalBreaksAfterResume };
            }
            return a;
          });
          localStorage.setItem('hrms_attendance', JSON.stringify(updated));
        }
      }
    } catch {}

    // Notify other components (WorkContext task timers can resume) with user identity
    window.dispatchEvent(new CustomEvent('ems_break_ended', {
      detail: {
        userKey,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode
      }
    }));

    try {
      hrService.sendHeartbeat({
        employeeId: targetEmpId || userKey,
        employeeCode: targetEmpCode || userKey,
        isClockedIn: true,
        isOnBreak: false,
        breakType: null,
        breakSeconds: totalBreaksAfterResume,
        workSeconds
      }).catch(() => {});
    } catch (_) {}

    broadcastSyncEvent(SYNC_EVENTS.SHIFT_BREAK_ENDED, {
      employeeId: targetEmpId || userKey,
      employeeCode: targetEmpCode || userKey,
      breakSeconds: totalBreaksAfterResume
    });

    // Record audit trail event for break completion
    const isTea = breakType.toLowerCase().includes('tea');
    const isLunch = breakType.toLowerCase().includes('lunch');
    const logType = isTea ? 'tea_break_end' : (isLunch ? 'lunch_break_end' : 'break_end');
    const logAction = isTea ? 'Resumed from Tea Break' : (isLunch ? 'Resumed from Lunch Break' : `Resumed from ${breakType}`);

    recordAuditLog({
      type: logType,
      action: logAction,
      durationSeconds: duration,
      durationText: formatMinutesSeconds(duration),
      details: `Ended ${breakType} after ${formatMinutesSeconds(duration)}. Work session resumed at ${endTimeStr}.`
    });

    try {
      hrService.markAttendance({
        employee: targetEmpId,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode,
        date: getTodayStr(),
        status: 'present',
        isOnBreak: false,
        breakType: null,
        workSeconds,
        breakSeconds: totalBreaksAfterResume,
        breakHistory: [newRecord, ...breakHistory]
      }).catch(() => {});
    } catch {}

    addToast({
      title: 'Welcome Back! 🚀',
      message: `Break ended (${newRecord.durationText}). Recorded to Break History. Working timer resumed.`,
      type: 'success'
    });
  };

  /**
   * Extend active break by custom minutes
   */
  const extendBreak = (addMinutes = 5) => {
    setCustomBreakLimitMinutes(prev => {
      const next = prev + addMinutes;
      localStorage.setItem(`ems_timer_${userKey}_custom_break_limit`, next.toString());
      setBreakReminderSent(false);
      addToast(`Break extended by +${addMinutes} mins (New target: ${next} mins)`, 'info');
      return next;
    });
  };

  const deleteBreakHistoryItem = (id) => {
    setBreakHistory(prev => {
      const filtered = prev.filter(b => b.id !== id);
      const mirrorKeys = getTimerMirrorKeys(currentUser);
      for (const uk of mirrorKeys) {
        localStorage.setItem(`ems_timer_${uk}_break_history`, JSON.stringify(filtered));
      }
      return filtered;
    });
    addToast('Break log item removed', 'info');
  };

  const clearTodayBreaks = () => {
    setBreakHistory([]);
    setBreakSeconds(0);
    const mirrorKeys = getTimerMirrorKeys(currentUser);
    for (const uk of mirrorKeys) {
      localStorage.setItem(`ems_timer_${uk}_break_seconds`, '0');
      localStorage.setItem(`ems_timer_${uk}_break_history`, JSON.stringify([]));
    }
    addToast('Break history cleared for today', 'info');
  };

  const startTeaBreak = () => {
    startBreak('Tea Break', '', 15);
  };

  const startLunchBreak = () => {
    startBreak('Lunch Break', '', 45);
  };

  /**
   * Reset shift timer to 00:00:00
   */
  const resetShiftTimer = () => {
    setWorkSeconds(0);
    setBreakSeconds(0);
    setCurrentBreakSeconds(0);
    setIsRunning(false);
    setIsClockedIn(false);
    setIsOnBreak(false);
    setLoginTime(null);
    setClockOutTime(null);
    setBreakStartTime(null);
    setHadClockedOutToday(false);
    setPunchSessions([]);
    setReclockStatus('none');
    setReclockSessionSeconds(0);
    setSavedOfficialWorkSeconds(0);

    localStorage.setItem(`ems_timer_${userKey}_work_seconds`, '0');
    localStorage.setItem(`ems_timer_${userKey}_break_seconds`, '0');
    localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_punch_sessions`, JSON.stringify([]));
    localStorage.removeItem(`ems_timer_${userKey}_login_time`);
    localStorage.removeItem(`ems_timer_${userKey}_clockout_time`);
    localStorage.removeItem(`ems_timer_${userKey}_clock_in_timestamp`);
    localStorage.removeItem(`ems_timer_${userKey}_clock_out_timestamp`);
    localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);
    localStorage.removeItem(`ems_timer_${userKey}_break_start_timestamp`);
    localStorage.removeItem(`ems_timer_${userKey}_current_session_start_timestamp`);
    localStorage.removeItem(`ems_timer_${userKey}_current_session_in`);
    localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'none');
    localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');
    localStorage.setItem(`ems_timer_${userKey}_saved_official_seconds`, '0');

    addToast('Work shift timer reset to 00:00:00', 'info');
  };

  /**
   * Clock In Handler (Starts shift or resumes existing shift with continuous hour tracking)
   */
  const handleClockIn = () => {
    const today = getTodayStr();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const nowMs = Date.now();

    // 🌟 Check if user already had an active or recorded clock-in today in attendance mirror (e.g. from Online Atlas)
    let existingRec = null;
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const list = JSON.parse(attRaw);
        existingRec = list.find(a => isRecordForUser(a, today));
      }
    } catch (_) {}

    const storedSessionDate = localStorage.getItem(`ems_timer_${userKey}_work_session_date`);
    const storedLogin = (storedSessionDate === today ? localStorage.getItem(`ems_timer_${userKey}_login_time`) : null);
    const storedClockInTs = Number(localStorage.getItem(`ems_timer_${userKey}_clock_in_timestamp`));

    const hasRemoteSessionToday = Boolean(
      existingRec &&
      existingRec.date === today &&
      (existingRec.clockInTime || existingRec.clockIn)
    );

    let existingSessions = [];
    try {
      const rawS = localStorage.getItem(`ems_timer_${userKey}_punch_sessions`);
      if (rawS) existingSessions = JSON.parse(rawS) || [];
    } catch (_) {}
    const storedClockInTsForUser = Number(localStorage.getItem(`ems_timer_${userKey}_clock_in_timestamp`));
    const minSessionTs = todayMidnight.getTime();

    if (existingSessions.length === 0 && Array.isArray(existingRec?.punchSessions) && existingRec.punchSessions.length > 0) {
      existingSessions = existingRec.punchSessions;
    }
    existingSessions = (existingSessions || []).filter(s => Number(s.inTimestamp || 0) >= minSessionTs);

    const userPunchSessions = (existingSessions || []).filter(s => Number(s.inTimestamp || 0) >= minSessionTs && s.outTime);
    const storedLoginForUser = (storedSessionDate === today ? localStorage.getItem(`ems_timer_${userKey}_login_time`) : null);
    const hasValidStoredLogin = Boolean(storedSessionDate === today && storedLoginForUser && storedClockInTsForUser >= todayMidnight.getTime());

    // 🌟 Strict Single Daily Clock-In Canon:
    // First clock-in of the day is permanently preserved; subsequent clock-ins on the same day are resumes.
    const storedFirstLogin = (storedSessionDate === today ? (
      localStorage.getItem(`ems_timer_${userKey}_first_clock_in_time`) ||
      localStorage.getItem(`ems_timer_${userKey}_login_time`)
    ) : null);

    const hasPriorClockInToday = Boolean(
      storedFirstLogin ||
      (userPunchSessions.length > 0) ||
      (hasValidStoredLogin && userPunchSessions.length > 0) ||
      (hasRemoteSessionToday && existingRec && isRecordForUser(existingRec, today) && existingRec.clockInTime && existingRec.clockInTime !== '--') ||
      (existingRec && (existingRec.firstClockInTime || existingRec.clockInTime)) ||
      (storedSessionDate === today && (storedLogin || storedClockInTs > 0))
    );

    const isFirstClockIn = !hasPriorClockInToday;

    setSessionDate(today);

    let initialLoginTime = nowStr;
    let clockInTs = Number(localStorage.getItem(`ems_timer_${userKey}_first_clock_in_timestamp`)) ||
                    Number(localStorage.getItem(`ems_timer_${userKey}_clock_in_timestamp`));
    let preservedWorkSecs = 0;

    if (hasPriorClockInToday) {
      // 🌟 RESUME / RE-CLOCK IN: Preserve the original first clock-in of the day and prior work time!
      initialLoginTime = localStorage.getItem(`ems_timer_${userKey}_first_clock_in_time`) ||
                         existingRec?.firstClockInTime ||
                         userPunchSessions[0]?.inTime ||
                         existingRec?.clockInTime ||
                         existingRec?.clockIn ||
                         storedLoginForUser ||
                         nowStr;
      if (!clockInTs || clockInTs < todayMidnight.getTime()) {
        const parsedSecs = parseTimeToSeconds(initialLoginTime);
        clockInTs = todayMidnight.getTime() + parsedSecs * 1000;
      }
      setLoginTime(initialLoginTime);

      // Check task seconds worked today so preservedWorkSecs is always >= task time
      const todayTaskSecs = getTodayTaskSecondsForUser();

      // Normalize previous completed sessions strictly bounded by time elapsed since clock in
      const normalizedSessions = normalizePunchSessions(existingSessions);
      const pastSessionsSecs = normalizedSessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
      const curSavedWorkSecs = Number(localStorage.getItem(`ems_timer_${userKey}_work_seconds`)) || 0;
      const maxElapsedSinceIn = Math.max(0, Math.floor((nowMs - clockInTs) / 1000));
      preservedWorkSecs = Math.min(maxElapsedSinceIn, Math.max(pastSessionsSecs, todayTaskSecs, (curSavedWorkSecs <= maxElapsedSinceIn && curSavedWorkSecs >= pastSessionsSecs) ? curSavedWorkSecs : pastSessionsSecs));

      setWorkSeconds(preservedWorkSecs);
      setPunchSessions(normalizedSessions);

      const mirrorKeys = getTimerMirrorKeys(currentUser);
      for (const uk of mirrorKeys) {
        if (!localStorage.getItem(`ems_timer_${uk}_first_clock_in_time`)) {
          localStorage.setItem(`ems_timer_${uk}_first_clock_in_time`, initialLoginTime);
          localStorage.setItem(`ems_timer_${uk}_first_clock_in_timestamp`, String(clockInTs));
        }
        localStorage.setItem(`ems_timer_${uk}_login_time`, initialLoginTime);
        localStorage.setItem(`ems_timer_${uk}_clock_in_timestamp`, String(clockInTs));
        localStorage.setItem(`ems_timer_${uk}_work_seconds`, String(preservedWorkSecs));
        localStorage.setItem(`ems_timer_${uk}_saved_official_seconds`, String(preservedWorkSecs));
        localStorage.setItem(`ems_timer_${uk}_punch_sessions`, JSON.stringify(normalizedSessions));
        localStorage.setItem(`ems_timer_${uk}_current_session_start_timestamp`, nowMs.toString());
        localStorage.setItem(`ems_timer_${uk}_current_session_in`, nowStr);
        localStorage.setItem(`ems_timer_${uk}_session_break_baseline`, (breakSeconds || 0).toString());
      }
    } else {
      // 🌟 FIRST CLOCK-IN OF THE DAY: Fresh shift start
      clockInTs = nowMs;
      initialLoginTime = nowStr;
      setLoginTime(nowStr);
      setWorkSeconds(0);
      setBreakSeconds(0);
      setCurrentBreakSeconds(0);
      setBreakHistory([]);
      setPunchSessions([]);

      const mirrorKeys = getTimerMirrorKeys(currentUser);
      for (const uk of mirrorKeys) {
        localStorage.setItem(`ems_timer_${uk}_first_clock_in_time`, nowStr);
        localStorage.setItem(`ems_timer_${uk}_first_clock_in_timestamp`, nowMs.toString());
        localStorage.setItem(`ems_timer_${uk}_punch_sessions`, JSON.stringify([]));
        localStorage.setItem(`ems_timer_${uk}_break_history`, JSON.stringify([]));
        localStorage.setItem(`ems_timer_${uk}_break_seconds`, '0');
        localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
        localStorage.setItem(`ems_timer_${uk}_work_seconds`, '0');
        localStorage.setItem(`ems_timer_${uk}_saved_official_seconds`, '0');
        localStorage.setItem(`ems_timer_${uk}_login_time`, nowStr);
        localStorage.setItem(`ems_timer_${uk}_clock_in_timestamp`, nowMs.toString());
        localStorage.setItem(`ems_timer_${uk}_current_session_start_timestamp`, nowMs.toString());
        localStorage.setItem(`ems_timer_${uk}_current_session_in`, nowStr);
      }
    }

    const mirrorKeys = getTimerMirrorKeys(currentUser);
    for (const uk of mirrorKeys) {
      localStorage.setItem(`ems_timer_${uk}_session_break_baseline`, (breakSeconds || 0).toString());
      localStorage.setItem(`ems_timer_${uk}_work_session_date`, today);
      localStorage.removeItem(`ems_timer_${uk}_clockout_time`);
      localStorage.removeItem(`ems_timer_${uk}_clock_out`);
      localStorage.removeItem(`ems_timer_${uk}_clock_out_timestamp`);
      localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'true');
      localStorage.setItem(`ems_timer_${uk}_is_running`, 'true');
      localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'false');
      localStorage.setItem(`ems_timer_${uk}_had_clocked_out`, 'false');
      localStorage.removeItem(`ems_timer_${uk}_break_start_time`);
      localStorage.removeItem(`ems_timer_${uk}_break_start_timestamp`);
      localStorage.setItem(`ems_timer_${uk}_current_break_seconds`, '0');
      localStorage.setItem(`ems_timer_${uk}_reclock_status`, 'none');
      localStorage.setItem(`ems_timer_${uk}_reclock_session_seconds`, '0');
    }

    setClockOutTime(null);
    setIsClockedIn(true);
    setIsRunning(true);
    setIsOnBreak(false);
    setHadClockedOutToday(false);
    setReclockStatus('none');
    setReclockSessionSeconds(0);

    const initialClockIn = initialLoginTime || loginTime || nowStr;

    // Sync to Attendance Collection / Time Logs
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      const attendance = attRaw ? JSON.parse(attRaw) : [];
      const existingIdx = attendance.findIndex(a => isRecordForUser(a, today));

      const existingRec = existingIdx >= 0 ? attendance[existingIdx] : null;

      const existingPunchSessions = existingRec?.punchSessions || punchSessions || [];
      const currentWorkSeconds = isFirstClockIn ? 0 : preservedWorkSecs;

      // ⏱️ Dynamic Shift Policy Calculation from Company Settings (e.g. 10:00 AM + 15m grace)
      const companySettings = getCompanySettings();
      const shiftStartTime = companySettings.shiftStartTime || '10:00 AM';
      const graceMins = Number(companySettings.gracePeriodMinutes) || 15;
      const shiftStartSecs = parseTimeToSeconds(shiftStartTime);
      const graceLimitSecs = shiftStartSecs + (graceMins * 60);
      const clockInSecs = parseTimeToSeconds(initialClockIn);
      const isLateCheckIn = clockInSecs > graceLimitSecs;
      const lateMins = isLateCheckIn ? Math.floor((clockInSecs - shiftStartSecs) / 60) : 0;

      const computedStatus = isLateCheckIn
        ? 'late'
        : (existingRec?.status === 'absent' ? 'present' : 'present');

      const record = {
        _id: existingRec ? existingRec._id : `att_${targetEmpId}_${Date.now()}`,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode,
        employeeName: targetEmpName,
        date: today,
        status: computedStatus,
        firstClockInTime: initialClockIn,
        clockInTime: initialClockIn,
        clockIn: initialClockIn,
        clockOutTime: null,
        clockOut: null,
        firstClockInTimestamp: clockInTs || nowMs,
        clockInTimestamp: clockInTs || nowMs,
        clockOutTimestamp: null,
        workSeconds: currentWorkSeconds,
        breakSeconds: existingRec?.breakSeconds || breakSeconds || 0,
        isOnBreak: false,
        isClockedIn: true,
        punchSessions: isFirstClockIn ? [] : existingPunchSessions,
        totalWorkingHours: +(currentWorkSeconds / 3600).toFixed(2),
        isLate: isLateCheckIn,
        lateByMinutes: lateMins,
        notes: isLateCheckIn
          ? (existingRec?.notes || `Late check-in by ${lateMins} mins (Shift Start: ${shiftStartTime})`)
          : (existingRec?.notes || ''),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        attendance[existingIdx] = { ...attendance[existingIdx], ...record };
      } else {
        attendance.unshift(record);
      }
      localStorage.setItem('hrms_attendance', JSON.stringify(attendance));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
      window.dispatchEvent(new CustomEvent('ems_attendance_updated', { detail: { record } }));

      // Immediately sync clock-in to MongoDB Atlas backend via hrService
      try {
        hrService.markAttendance(record).catch(err => console.warn('Sync clock in to backend notice:', err));
      } catch (err) {}

      try {
        hrService.sendHeartbeat({
          employeeId: targetEmpId || userKey,
          employeeCode: targetEmpCode || userKey,
          isClockedIn: true,
          firstClockInTime: initialClockIn,
          clockInTime: initialClockIn,
          firstClockInTimestamp: clockInTs,
          clockInTimestamp: clockInTs,
          currentSessionStartTimestamp: nowMs,
          workSeconds: currentWorkSeconds,
          isOnBreak: false
        }).catch(() => {});
      } catch (_) {}
    } catch (e) {
      console.error('Error recording clock-in to attendance:', e);
    }

    // Notify WorkContext and other modules
    window.dispatchEvent(new CustomEvent('ems_clocked_in', {
      detail: {
        userKey,
        employeeId: targetEmpId,
        employeeCode: targetEmpCode,
        loginTime: initialClockIn,
        date: today
      }
    }));

    // Record audit trail for clock-in trigger
    recordAuditLog({
      type: 'clock_in',
      action: isFirstClockIn ? 'Shift Clock In' : 'Shift Resumed',
      details: isFirstClockIn
        ? `${targetEmpName} clocked in to begin shift at ${nowStr}. Live work timer running.`
        : `Shift resumed at ${nowStr}. Continuing time tracking.`
    });

    const isOvertimePeriod = new Date().getHours() >= 19;
    addToast({
      title: isFirstClockIn
        ? 'Clocked In Successfully! 🟢'
        : (isOvertimePeriod ? 'Shift Resumed (Overtime Period) ⏱️' : 'Shift Resumed! 🟢'),
      message: isFirstClockIn
        ? `Shift started at ${nowStr}. Live work timer running.`
        : (isOvertimePeriod
            ? `Clocked in for overtime (post 7:00 PM). Shift auto-seals at 11:59 PM.`
            : `Shift resumed at ${nowStr}. Continuing time tracking.`),
      type: 'success'
    });
  };

  // ── Periodic Live Heartbeat to Backend (Every 12s while clocked in) ──
  const heartbeatStateRef = useRef({});
  useEffect(() => {
    heartbeatStateRef.current = {
      userKey,
      targetEmpId,
      targetEmpCode,
      loginTime,
      isOnBreak,
      breakType,
      workSeconds,
      breakSeconds
    };
  });

  useEffect(() => {
    if (!isClockedIn || !userKey) return;

    const pulseHeartbeat = () => {
      try {
        const state = heartbeatStateRef.current || {};
        const uKey = state.userKey || userKey;
        const sessStart = Number(localStorage.getItem(`ems_timer_${uKey}_current_session_start_timestamp`)) ||
                          Number(localStorage.getItem(`ems_timer_${uKey}_clock_in_timestamp`)) || undefined;
        let activeTaskData = null;
        try {
          const keysToTry = [
            `ems_active_task_timer_${uKey}`,
            state.targetEmpCode ? `ems_active_task_timer_${state.targetEmpCode}` : null,
            state.targetEmpId ? `ems_active_task_timer_${state.targetEmpId}` : null,
            'ems_active_task_timer'
          ].filter(Boolean);
          for (const k of keysToTry) {
            const rawTask = localStorage.getItem(k);
            if (rawTask) {
              const p = JSON.parse(rawTask);
              if (p && (p.taskId || p._id)) {
                if (p.timerRunning !== false) {
                  activeTaskData = {
                    ...p,
                    timerRunning: true
                  };
                } else {
                  activeTaskData = {
                    ...p,
                    timerRunning: false
                  };
                }
                break;
              }
            }
          }
        } catch (_) {}

        const bStartMs = Number(localStorage.getItem(`ems_timer_${uKey}_break_start_timestamp`)) || undefined;
        const firstClockInTs = Number(localStorage.getItem(`ems_timer_${uKey}_first_clock_in_timestamp`)) ||
                               Number(localStorage.getItem(`ems_timer_${uKey}_clock_in_timestamp`)) || undefined;
        const firstClockInStr = localStorage.getItem(`ems_timer_${uKey}_first_clock_in_time`) ||
                                localStorage.getItem(`ems_timer_${uKey}_login_time`) || state.loginTime || loginTime;

        hrService.sendHeartbeat({
          employeeId: state.targetEmpId || uKey,
          employeeCode: state.targetEmpCode || uKey,
          isClockedIn: true,
          clockInTime: firstClockInStr,
          firstClockInTime: firstClockInStr,
          clockInTimestamp: firstClockInTs,
          currentSessionStartTimestamp: sessStart,
          isOnBreak: Boolean(state.isOnBreak),
          breakType: state.isOnBreak ? state.breakType : null,
          breakStartTimestamp: state.isOnBreak ? bStartMs : null,
          workSeconds: state.workSeconds !== undefined ? state.workSeconds : workSeconds,
          breakSeconds: state.breakSeconds !== undefined ? state.breakSeconds : breakSeconds,
          activeTask: activeTaskData
        }).then(resp => {
          if (resp && resp.serverIsClockedIn === false && isClockedIn) {
            window.dispatchEvent(new CustomEvent('ems_force_clock_out', { detail: { adminName: 'Admin' } }));
          }
        }).catch(() => {});
      } catch (_) {}
    };

    pulseHeartbeat();
    const hbInterval = setInterval(pulseHeartbeat, 1500);

    const onInstantStateChange = () => {
      pulseHeartbeat();
    };
    window.addEventListener('ems_task_timer_started', onInstantStateChange);
    window.addEventListener('ems_task_timer_paused', onInstantStateChange);
    window.addEventListener('ems_task_timer_stopped', onInstantStateChange);
    window.addEventListener('ems_clocked_in', onInstantStateChange);
    window.addEventListener('ems_clocked_out', onInstantStateChange);
    window.addEventListener('ems_break_started', onInstantStateChange);
    window.addEventListener('ems_break_ended', onInstantStateChange);

    return () => {
      clearInterval(hbInterval);
      window.removeEventListener('ems_task_timer_started', onInstantStateChange);
      window.removeEventListener('ems_task_timer_paused', onInstantStateChange);
      window.removeEventListener('ems_task_timer_stopped', onInstantStateChange);
      window.removeEventListener('ems_clocked_in', onInstantStateChange);
      window.removeEventListener('ems_clocked_out', onInstantStateChange);
      window.removeEventListener('ems_break_started', onInstantStateChange);
      window.removeEventListener('ems_break_ended', onInstantStateChange);
    };
  }, [isClockedIn, userKey]);

    // ── Auto Clock-In Event Listener (called when employee starts a task timer) ──
  useEffect(() => {
    const handleRequestClockIn = () => {
      if (!isClockedIn) {
        handleClockIn();
      }
    };
    window.addEventListener('ems_request_clock_in', handleRequestClockIn);
    return () => window.removeEventListener('ems_request_clock_in', handleRequestClockIn);
  }, [isClockedIn, handleClockIn]);

  /**
   * Clock Out Handler
   */
  const handleClockOut = () => {
    const today = getTodayStr();
    let attRec = null;
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      if (attRaw) {
        const att = JSON.parse(attRaw);
        attRec = att.find(a => isRecordForUser(a, today));
      }
    } catch (_) {}

    const telem = getCachedTelemRecord();
    const effectiveIn = Boolean(
      isClockedIn ||
      readTimerStorage(currentUser, 'is_clocked_in') === 'true' ||
      readTimerStorage(currentUser, 'is_clocked_in') === true ||
      (attRec && (attRec.clockInTime || attRec.clockIn) && !attRec.clockOutTime && attRec.status !== 'on_leave') ||
      (telem?.isClockedIn && !telem?.clockOutTime)
    );

    if (!effectiveIn && !attRec) {
      addToast({ title: 'Not Clocked In', message: 'You are not currently clocked in. Please clock in first.', type: 'warning' });
      return;
    }
    const logoutStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const logoutTs = Date.now();

    if (isOnBreak) {
      resumeFromBreak();
    }

    // Execute canonical unified shift clock-out
    performShiftClockOut(currentUser, { reason: 'User Manual Clock Out', nowTs: logoutTs, nowStr: logoutStr });

    const finalSecs = calculateShiftWorkSeconds(currentUser, today, logoutTs);

    setClockOutTime(logoutStr);
    setHadClockedOutToday(true);
    setSavedOfficialWorkSeconds(finalSecs);
    setWorkSeconds(finalSecs);
    setIsRunning(false);
    setIsOnBreak(false);
    setIsClockedIn(false);

    const mirrorKeys = getTimerMirrorKeys(currentUser);
    for (const uk of mirrorKeys) {
      localStorage.setItem(`ems_timer_${uk}_last_clock_out_time`, logoutStr);
      localStorage.setItem(`ems_timer_${uk}_last_clock_out_timestamp`, logoutTs.toString());
      localStorage.setItem(`ems_timer_${uk}_clockout_time`, logoutStr);
      localStorage.setItem(`ems_timer_${uk}_clock_out`, logoutStr);
      localStorage.setItem(`ems_timer_${uk}_clock_out_timestamp`, logoutTs.toString());
      localStorage.setItem(`ems_timer_${uk}_had_clocked_out`, 'true');
      localStorage.setItem(`ems_timer_${uk}_is_clocked_in`, 'false');
      localStorage.setItem(`ems_timer_${uk}_is_running`, 'false');
      localStorage.setItem(`ems_timer_${uk}_is_on_break`, 'false');
    }

    // Update local telemetry cache so telemetry queries immediately reflect clock out
    try {
      const rawTelem = localStorage.getItem('ems_live_telemetry_cache');
      if (rawTelem) {
        const parsed = JSON.parse(rawTelem);
        mirrorKeys.forEach(k => {
          if (parsed[k]) {
            parsed[k].isClockedIn = false;
            parsed[k].isClockedOut = true;
            parsed[k].clockOutTime = logoutStr;
            parsed[k].clockOutTimestamp = logoutTs;
          }
        });
        localStorage.setItem('ems_live_telemetry_cache', JSON.stringify(parsed));
      }
    } catch (_) {}

    try {
      const rawSess = readTimerStorage(currentUser, 'punch_sessions');
      if (rawSess) {
        setPunchSessions(typeof rawSess === 'string' ? JSON.parse(rawSess) : rawSess);
      }
    } catch (_) {}

    recordAuditLog({
      type: 'clock_out',
      action: 'Shift Clock Out',
      durationSeconds: finalSecs,
      durationText: formatHoursMinutes(finalSecs),
      details: `${targetEmpName} ended shift at ${logoutStr}. Total Productive Work: ${formatHoursMinutes(finalSecs)}, Total Breaks: ${formatHoursMinutes(breakSeconds)}.`
    });

    try {
      hrService.sendHeartbeat({
        employeeId: targetEmpId || userKey,
        employeeCode: targetEmpCode || userKey,
        isClockedIn: false,
        clockOutTime: logoutStr,
        lastClockOutTime: logoutStr,
        clockOutTimestamp: logoutTs,
        lastClockOutTimestamp: logoutTs,
        workSeconds: finalSecs,
        breakSeconds,
        isOnBreak: false,
        activeTask: null
      }).catch(() => {});
    } catch (_) {}

    broadcastSyncEvent(SYNC_EVENTS.SHIFT_CLOCKED_OUT, {
      employeeId: targetEmpId || userKey,
      employeeCode: targetEmpCode || userKey,
      clockOutTime: logoutStr,
      workSeconds: finalSecs
    });

    addToast({
      title: 'Shift Clocked Out 🔴',
      message: `Shift ended at ${logoutStr}. Total Productive Work: ${formatHoursMinutes(finalSecs)} | Breaks: ${formatHoursMinutes(breakSeconds)}.`,
      type: 'info'
    });
  };

  /**
   * ── Accidental Clock-out: Re-Clock In Request ──
   * Allows employee to resume working immediately while sending a real-time request to Admin.
   * "fir se clock in karne se time fir se suru ho jaye chahe admin accept kare ya nhi bhi"
   */
  const requestReclockIn = (reason = 'Accidental Clock-out / Same-day Resume') => {
    const today = getTodayStr();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // 1. Immediately resume timer so no productive time is lost!
    setIsClockedIn(true);
    setIsRunning(true);
    setIsOnBreak(false);
    setReclockStatus('pending');
    setReclockSessionSeconds(0);

    localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'pending');
    localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');

    // 2. Create Re-Clock in request record for Admin review
    const newRequest = {
      id: `reclock_${Date.now()}`,
      employeeId: userKey,
      employeeName: currentUser?.name || 'Employee',
      employeeAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      employeeRole: currentUser?.role || 'Team Member',
      date: today,
      originalClockIn: loginTime || '09:00 AM',
      accidentalClockOut: clockOutTime || nowStr,
      requestedAt: nowStr,
      reason: reason || 'Accidental Clock-out / Resuming Shift',
      status: 'pending',
      officialHoursBeforeClockout: formatHoursMinutes(savedOfficialWorkSeconds || workSeconds)
    };

    try {
      const raw = localStorage.getItem('ems_reclock_requests');
      const list = raw ? JSON.parse(raw) : [];
      // Remove any existing pending request for this user today to avoid duplicates
      const filtered = list.filter(r => !(r.employeeId === userKey && r.date === today));
      filtered.unshift(newRequest);
      localStorage.setItem('ems_reclock_requests', JSON.stringify(filtered));
      setReclockRequests(filtered);
      window.dispatchEvent(new CustomEvent('ems_reclock_requests_updated'));
    } catch (e) {
      console.error('Error saving reclock request:', e);
    }

    addToast({
      title: '🟡 Re-Clock In Request Sent!',
      message: `Your work timer has resumed immediately (${nowStr}). Admin has been notified for approval.`,
      type: 'warning'
    });
  };

  /**
   * ── Admin Action: Approve Re-Clock In Request ──
   * Officially merges the re-clocked session time into the employee's attendance!
   */
  const approveReclockRequest = (requestId) => {
    try {
      const raw = localStorage.getItem('ems_reclock_requests');
      const list = raw ? JSON.parse(raw) : [];
      const targetReq = list.find(r => r.id === requestId);

      if (!targetReq) {
        addToast('Request not found', 'error');
        return;
      }

      targetReq.status = 'approved';
      targetReq.approvedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      targetReq.reviewedBy = currentUser?.name || 'Admin';

      localStorage.setItem('ems_reclock_requests', JSON.stringify(list));
      setReclockRequests(list);

      // If approved user is the current active session
      if (targetReq.employeeId === userKey) {
        setReclockStatus('approved');
        localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'approved');
        setSavedOfficialWorkSeconds(workSeconds);
        localStorage.setItem(`ems_timer_${userKey}_saved_official_seconds`, workSeconds.toString());
      } else {
        // Update target user's storage directly
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_reclock_status`, 'approved');
      }

      // Update today's attendance record with updated status
      const attRaw = localStorage.getItem('hrms_attendance');
      const attendance = attRaw ? JSON.parse(attRaw) : [];
      const idx = attendance.findIndex(a => (
        a.employeeId === targetReq.employeeId ||
        a.employeeCode === targetReq.employeeId ||
        (a.employeeName && targetReq.employeeName && a.employeeName.toLowerCase() === targetReq.employeeName.toLowerCase())
      ) && a.date === targetReq.date);
      if (idx >= 0) {
        attendance[idx].reclockApproved = true;
        attendance[idx].clockOutTime = null; // reopened
        attendance[idx].notes = `Re-clock in approved by ${currentUser?.name || 'Admin'}`;
        localStorage.setItem('hrms_attendance', JSON.stringify(attendance));
      }

      window.dispatchEvent(new CustomEvent('ems_reclock_requests_updated'));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));

      addToast({
        title: '✅ Re-Clock In Approved',
        message: `Approved re-clock in for ${targetReq.employeeName}. Their resumed working hours are officially counted!`,
        type: 'success'
      });
    } catch (e) {
      console.error('Error approving reclock request:', e);
      addToast('Failed to approve request', 'error');
    }
  };

  /**
   * ── Admin Action: Reject Re-Clock In Request ──
   * Discards the extra re-clock session time completely!
   * "or regect kar diya to time count nhi hota"
   */
  const rejectReclockRequest = (requestId) => {
    try {
      const raw = localStorage.getItem('ems_reclock_requests');
      const list = raw ? JSON.parse(raw) : [];
      const targetReq = list.find(r => r.id === requestId);

      if (!targetReq) {
        addToast('Request not found', 'error');
        return;
      }

      targetReq.status = 'rejected';
      targetReq.rejectedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      targetReq.reviewedBy = currentUser?.name || 'Admin';

      localStorage.setItem('ems_reclock_requests', JSON.stringify(list));
      setReclockRequests(list);

      // If rejected user is currently active in this session
      if (targetReq.employeeId === userKey) {
        setReclockStatus('rejected');
        setIsRunning(false);
        setIsClockedIn(false);
        setWorkSeconds(savedOfficialWorkSeconds);
        setReclockSessionSeconds(0);

        localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'rejected');
        localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
        localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
        localStorage.setItem(`ems_timer_${userKey}_work_seconds`, savedOfficialWorkSeconds.toString());
        localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');
      } else {
        // Update target user's storage directly to rollback
        const prevOfficial = localStorage.getItem(`ems_timer_${targetReq.employeeId}_saved_official_seconds`) || '0';
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_reclock_status`, 'rejected');
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_is_clocked_in`, 'false');
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_is_running`, 'false');
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_work_seconds`, prevOfficial);
        localStorage.setItem(`ems_timer_${targetReq.employeeId}_reclock_session_seconds`, '0');
      }

      window.dispatchEvent(new CustomEvent('ems_reclock_requests_updated'));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));

      addToast({
        title: '❌ Re-Clock In Request Rejected',
        message: `Rejected request for ${targetReq.employeeName}. Unapproved extra time was discarded and will not count.`,
        type: 'info'
      });
    } catch (e) {
      console.error('Error rejecting reclock request:', e);
      addToast('Failed to reject request', 'error');
    }
  };

  // ── Format Helpers & Target Calculations (Dynamic Shift Policy) ──
  const standardWorkHours = Number(companySettings?.standardWorkHours) || 9;
  const targetShiftSeconds = standardWorkHours * 3600;
  const targetShiftHoursText = `${standardWorkHours}h 00m`;
  const overtimeSeconds = Math.max(0, workSeconds - targetShiftSeconds);
  const overtimeHours = +(overtimeSeconds / 3600).toFixed(2);
  const isOvertime = overtimeSeconds > 0;
  const shiftProgressPercent = Math.min(100, Math.round((workSeconds / targetShiftSeconds) * 100));
  const isShiftTargetReached = workSeconds >= targetShiftSeconds;
  const remainingShiftSeconds = Math.max(0, targetShiftSeconds - workSeconds);

  const formatSeconds = (totalSecs) => {
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const formatHoursMinutes = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const formatBreakDuration = (totalSecs) => {
    const safe = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatMinutesSeconds = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const grossSeconds = workSeconds + breakSeconds;

  const activeBreakLimit = (customBreakLimitMinutes > 0 ? customBreakLimitMinutes * 60 : (BREAK_THRESHOLDS[breakType] || 20 * 60));
  const activeBreakProgress = Math.min(100, Math.round((currentBreakSeconds / activeBreakLimit) * 100));
  const isBreakOverdue = currentBreakSeconds > activeBreakLimit;
  const breakRemainingSeconds = Math.max(0, activeBreakLimit - currentBreakSeconds);

  const pendingReclockRequests = (reclockRequests || []).filter(r => r.status === 'pending');

  return (
    <TimerContext.Provider value={{
      loginTime,
      clockOutTime,
      hadClockedOutToday,
      workSeconds,
      breakSeconds,
      grossSeconds,
      currentBreakSeconds,
      breakStartTime,
      isRunning,
      isOnBreak,
      breakType,
      customBreakLimitMinutes,
      isClockedIn,
      isOnLeaveToday,
      todayLeaveRecord,
      breakHistory,
      punchSessions,
      activeBreakLimit,
      activeBreakProgress,
      isBreakOverdue,
      breakRemainingSeconds,
      breakRemainingTimeString: formatMinutesSeconds(breakRemainingSeconds),
      overtimeSeconds,
      overtimeHours,
      overtimeText: formatHoursMinutes(overtimeSeconds),
      isOvertime,
      standardWorkHours,
      targetShiftSeconds,
      targetShiftHoursText,
      shiftProgressPercent,
      isShiftTargetReached,
      remainingShiftSeconds,
      remainingShiftText: isShiftTargetReached
        ? `🎉 ${targetShiftHoursText} Shift Target Completed!${isOvertime ? ` (+${formatHoursMinutes(overtimeSeconds)} Overtime)` : ''}`
        : `${formatHoursMinutes(remainingShiftSeconds)} remaining to ${targetShiftHoursText} target`,
      timeString: (!isClockedIn && !hadClockedOutToday) ? '00:00:00' : formatSeconds(workSeconds),
      breakTimeString: formatSeconds(breakSeconds),
      currentBreakTimeString: formatSeconds(currentBreakSeconds),
      workDurationText: (!isClockedIn && !hadClockedOutToday) ? '00h 00m' : formatHoursMinutes(workSeconds),
      overtimeDurationText: formatHoursMinutes(overtimeSeconds),
      breakDurationText: formatBreakDuration(breakSeconds),
      grossDurationText: formatHoursMinutes(grossSeconds),
      togglePauseResume,
      startBreak,
      startTeaBreak,
      startLunchBreak,
      resumeFromBreak,
      extendBreak,
      handleClockIn,
      handleClockOut,
      resetShiftTimer,
      deleteBreakHistoryItem,
      clearTodayBreaks,
      formatSeconds,
      formatHoursMinutes,
      formatMinutesSeconds,
      // ── Accidental Clock-out Re-clock In Request Feature ──
      reclockStatus,
      reclockSessionSeconds,
      reclockSessionTimeString: formatSeconds(reclockSessionSeconds),
      reclockRequests,
      pendingReclockRequests,
      requestReclockIn,
      approveReclockRequest,
      rejectReclockRequest,
      // ── Audit Trail & Admin Overrides ──
      recordAuditLog,
      adminForceClockOut: async (targetEmpId, auditNote) => {
        window.dispatchEvent(new CustomEvent('ems_force_clock_out', {
          detail: {
            employeeId: targetEmpId,
            adminName: currentUser?.name || 'Administrator',
            adminId: currentUser?.employeeCode || currentUser?._id || 'ADM-001',
            auditNote
          }
        }));
        hrService.adminForceClockOut(targetEmpId, auditNote)
          .catch(err => console.warn('[TimerContext] Force clock out sync notice:', err));
        return { success: true };
      }
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  return context || defaultTimerContext;
};
