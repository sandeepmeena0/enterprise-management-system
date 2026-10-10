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

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { useHR } from '../../modules/hr/context/HRContext';

const TimerContext = createContext();

// Recommended break thresholds (in seconds) for smart reminder notifications
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
  const { currentUser } = useHR();

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  // Derive stable userKey for multi-user storage isolation
  const userKey = useMemo(() => {
    if (currentUser?._id) return String(currentUser._id);
    if (currentUser?.employeeCode) return String(currentUser.employeeCode);
    try {
      const emps = JSON.parse(localStorage.getItem('ems_employees') || '[]');
      const curr = emps.find(e => e.isCurrentUser);
      if (curr?._id) return String(curr._id);
    } catch (e) {}
    return 'emp_001';
  }, [currentUser]);

  const k = useCallback((name) => `ems_timer_${userKey}_${name}`, [userKey]);

  // ── Helper to read state with userKey scoping and legacy fallback ──
  const readUserItem = useCallback((name, fallback = null) => {
    const scoped = localStorage.getItem(`ems_timer_${userKey}_${name}`);
    if (scoped !== null) return scoped;
    // Fallback to legacy key for emp_001 to prevent data loss
    if (userKey === 'emp_001') {
      const legacy = localStorage.getItem(`ems_${name}`) || localStorage.getItem(`hrms_${name}`);
      if (legacy !== null) return legacy;
    }
    return fallback;
  }, [userKey]);

  // ── 1. Daily Clock In / Out State (User-Scoped & Validated against Today) ──
  const [sessionDate, setSessionDate] = useState(() => {
    return localStorage.getItem(`ems_timer_${userKey}_work_session_date`) || getTodayStr();
  });

  const isTodaySession = sessionDate === getTodayStr();

  const [loginTime, setLoginTime] = useState(() => {
    if (!isTodaySession) return null;
    return localStorage.getItem(`ems_timer_${userKey}_login_time`) || (userKey === 'emp_001' ? localStorage.getItem('ems_login_time') : null);
  });

  const [clockOutTime, setClockOutTime] = useState(() => {
    if (!isTodaySession) return null;
    return localStorage.getItem(`ems_timer_${userKey}_clockout_time`) || (userKey === 'emp_001' ? localStorage.getItem('ems_clockout_time') : null);
  });

  const [hadClockedOutToday, setHadClockedOutToday] = useState(() => {
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_had_clocked_out`);
    if (saved !== null) return JSON.parse(saved);
    return !!clockOutTime;
  });

  const [isClockedIn, setIsClockedIn] = useState(() => {
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`);
    if (saved !== null) return JSON.parse(saved);
    if (userKey === 'emp_001') {
      const leg = localStorage.getItem('ems_is_clocked_in');
      return leg !== null ? JSON.parse(leg) : false;
    }
    return false;
  });

  const [isRunning, setIsRunning] = useState(() => {
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_running`);
    if (saved !== null) return JSON.parse(saved);
    if (userKey === 'emp_001') {
      const leg = localStorage.getItem('hrms_work_clock_running');
      return leg !== null ? JSON.parse(leg) : false;
    }
    return false;
  });

  // Active productive work seconds (starts strictly from 0 on a fresh day)
  const [workSeconds, setWorkSeconds] = useState(() => {
    if (!isTodaySession) return 0;
    const saved = localStorage.getItem(`ems_timer_${userKey}_work_seconds`);
    if (saved) return parseInt(saved, 10);
    if (userKey === 'emp_001') {
      const leg = localStorage.getItem('hrms_work_clock_seconds');
      return leg ? parseInt(leg, 10) : 0;
    }
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
    if (userKey === 'emp_001') {
      const leg = localStorage.getItem('ems_break_seconds');
      return leg ? parseInt(leg, 10) : 0;
    }
    return 0;
  });

  // ── 2. Active Break & History State ──
  const [isOnBreak, setIsOnBreak] = useState(() => {
    if (!isTodaySession) return false;
    const saved = localStorage.getItem(`ems_timer_${userKey}_is_on_break`);
    if (saved) return JSON.parse(saved);
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

  // Persistent Break History List
  const [breakHistory, setBreakHistory] = useState(() => {
    const saved = localStorage.getItem(`ems_timer_${userKey}_break_history`);
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

  // Reload timer state when userKey switches (Multi-User Safe)
  useEffect(() => {
    const today = getTodayStr();
    const storedDate = localStorage.getItem(`ems_timer_${userKey}_work_session_date`) || today;
    const isToday = storedDate === today;

    setSessionDate(storedDate);
    if (!isToday) {
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
    } else {
      const inVal = localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`);
      setIsClockedIn(inVal ? JSON.parse(inVal) : false);

      const runVal = localStorage.getItem(`ems_timer_${userKey}_is_running`);
      setIsRunning(runVal ? JSON.parse(runVal) : false);

      const secVal = localStorage.getItem(`ems_timer_${userKey}_work_seconds`);
      setWorkSeconds(secVal ? parseInt(secVal, 10) : 0);

      const brkSec = localStorage.getItem(`ems_timer_${userKey}_break_seconds`);
      setBreakSeconds(brkSec ? parseInt(brkSec, 10) : 0);

      const lTime = localStorage.getItem(`ems_timer_${userKey}_login_time`);
      setLoginTime(lTime || null);

      const cTime = localStorage.getItem(`ems_timer_${userKey}_clockout_time`);
      setClockOutTime(cTime || null);

      const hadOut = localStorage.getItem(`ems_timer_${userKey}_had_clocked_out`);
      setHadClockedOutToday(hadOut ? JSON.parse(hadOut) : !!cTime);

      const rStatus = localStorage.getItem(`ems_timer_${userKey}_reclock_status`) || 'none';
      setReclockStatus(rStatus);

      const rSec = localStorage.getItem(`ems_timer_${userKey}_reclock_session_seconds`);
      setReclockSessionSeconds(rSec ? parseInt(rSec, 10) : 0);

      const sSec = localStorage.getItem(`ems_timer_${userKey}_saved_official_seconds`);
      setSavedOfficialWorkSeconds(sSec ? parseInt(sSec, 10) : (secVal ? parseInt(secVal, 10) : 0));
    }
  }, [userKey]);

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
      setSessionDate(today);
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
    }
  }, [sessionDate, userKey]);

  // Save break history
  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_break_history`, JSON.stringify(breakHistory));
  }, [breakHistory, userKey]);

  // ── Timer Tick Engine with Timestamp Delta Tracking ──
  useEffect(() => {
    let interval = null;
    let lastTime = Date.now();
    localStorage.setItem(`ems_timer_${userKey}_last_tick`, lastTime.toString());

    const catchUpTimer = () => {
      const storedLast = localStorage.getItem(`ems_timer_${userKey}_last_tick`);
      if (storedLast && isClockedIn) {
        const now = Date.now();
        const deltaSecs = Math.floor((now - Number(storedLast)) / 1000);
        if (deltaSecs > 1) {
          if (isOnBreak) {
            setBreakSeconds(p => {
              const next = p + deltaSecs;
              localStorage.setItem(`ems_timer_${userKey}_break_seconds`, next.toString());
              return next;
            });
            setCurrentBreakSeconds(p => {
              const next = p + deltaSecs;
              localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, next.toString());
              return next;
            });
          } else if (isRunning) {
            setWorkSeconds(p => {
              const next = p + deltaSecs;
              localStorage.setItem(`ems_timer_${userKey}_work_seconds`, next.toString());
              return next;
            });
            if (reclockStatus === 'pending') {
              setReclockSessionSeconds(p => {
                const next = p + deltaSecs;
                localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, next.toString());
                return next;
              });
            }
          }
        }
        localStorage.setItem(`ems_timer_${userKey}_last_tick`, now.toString());
      }
    };

    if (isClockedIn) {
      catchUpTimer();

      interval = setInterval(() => {
        const now = Date.now();
        localStorage.setItem(`ems_timer_${userKey}_last_tick`, now.toString());

        if (isOnBreak) {
          // Increment total break seconds
          setBreakSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem(`ems_timer_${userKey}_break_seconds`, next.toString());
            return next;
          });

          // Increment current session break seconds
          setCurrentBreakSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, next.toString());

            const threshold = BREAK_THRESHOLDS[breakType] || (20 * 60);
            if (next === threshold && !breakReminderSent) {
              setBreakReminderSent(true);
              addToast({
                title: `☕ Break Reminder (${breakType})`,
                message: `You've been on ${breakType} for ${Math.floor(threshold / 60)} minutes. Remember to resume when ready!`,
                type: 'warning'
              });
            }
            return next;
          });
        } else if (isRunning) {
          // If in pending re-clock request mode, increment pending reclock seconds
          if (reclockStatus === 'pending') {
            setReclockSessionSeconds(prevR => {
              const nextR = prevR + 1;
              localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, nextR.toString());
              return nextR;
            });
            setWorkSeconds(prev => {
              const next = prev + 1;
              localStorage.setItem(`ems_timer_${userKey}_work_seconds`, next.toString());
              return next;
            });
          } else {
            // Normal shift running
            setWorkSeconds(prev => {
              const next = prev + 1;
              localStorage.setItem(`ems_timer_${userKey}_work_seconds`, next.toString());
              return next;
            });
          }
        }
      }, 1000);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        catchUpTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isClockedIn, isRunning, isOnBreak, breakType, breakReminderSent, reclockStatus, userKey, addToast]);

  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_is_running`, JSON.stringify(isRunning));
  }, [isRunning, userKey]);

  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, JSON.stringify(isOnBreak));
    localStorage.setItem(`ems_timer_${userKey}_break_type`, breakType);
  }, [isOnBreak, breakType, userKey]);

  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, JSON.stringify(isClockedIn));
  }, [isClockedIn, userKey]);

  useEffect(() => {
    localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, JSON.stringify(hadClockedOutToday));
  }, [hadClockedOutToday, userKey]);

  // ── Actions ──
  const togglePauseResume = () => {
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

    localStorage.setItem(`ems_timer_${userKey}_break_type`, type);
    localStorage.setItem(`ems_timer_${userKey}_custom_break_limit`, minutesChosen.toString());
    localStorage.setItem(`ems_timer_${userKey}_break_start_time`, startTimeStr);
    localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, '0');
    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');

    // Notify other components (WorkContext task timers pause)
    window.dispatchEvent(new CustomEvent('ems_break_started', {
      detail: { breakType: type, targetMinutes: minutesChosen, notes }
    }));

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
    const duration = currentBreakSeconds > 0 ? currentBreakSeconds : 60;

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

    setBreakHistory(prev => [newRecord, ...prev]);

    setIsOnBreak(false);
    setIsRunning(true);
    setCurrentBreakSeconds(0);
    setBreakStartTime(null);
    setBreakReminderSent(false);

    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_current_break_seconds`, '0');
    localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);

    // Notify other components (WorkContext task timers can resume)
    window.dispatchEvent(new CustomEvent('ems_break_ended'));

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
    setBreakHistory(prev => prev.filter(b => b.id !== id));
    addToast('Break log item removed', 'info');
  };

  const clearTodayBreaks = () => {
    setBreakHistory([]);
    setBreakSeconds(0);
    localStorage.setItem(`ems_timer_${userKey}_break_seconds`, '0');
    localStorage.setItem(`ems_timer_${userKey}_break_history`, JSON.stringify([]));
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

    addToast('Work shift timer reset to 00:00:00', 'info');
  };

  /**
   * Clock In Handler (Starts shift or resumes existing shift with continuous hour tracking)
   */
  const handleClockIn = () => {
    const today = getTodayStr();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isFirstClockIn = !loginTime || sessionDate !== today;

    setSessionDate(today);
    if (isFirstClockIn) {
      setLoginTime(nowStr);
      localStorage.setItem(`ems_timer_${userKey}_login_time`, nowStr);
    }
    setClockOutTime(null);
    setIsClockedIn(true);
    setIsRunning(true);
    setIsOnBreak(false);
    setHadClockedOutToday(false);
    setReclockStatus('none');
    setReclockSessionSeconds(0);

    localStorage.setItem(`ems_timer_${userKey}_work_session_date`, today);
    localStorage.removeItem(`ems_timer_${userKey}_clockout_time`);
    localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'false');
    localStorage.removeItem(`ems_timer_${userKey}_break_start_time`);
    localStorage.setItem(`ems_timer_${userKey}_reclock_status`, 'none');
    localStorage.setItem(`ems_timer_${userKey}_reclock_session_seconds`, '0');

    // Sync to Attendance Collection / Time Logs
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      const attendance = attRaw ? JSON.parse(attRaw) : [];
      const existingIdx = attendance.findIndex(a => a.employeeId === userKey && a.date === today);

      const record = {
        _id: existingIdx >= 0 ? attendance[existingIdx]._id : `att_${userKey}_${Date.now()}`,
        employeeId: userKey,
        employeeName: currentUser?.name || 'Employee',
        date: today,
        status: 'present',
        clockInTime: isFirstClockIn ? nowStr : (attendance[existingIdx]?.clockInTime || loginTime || nowStr),
        clockOutTime: null,
        totalWorkingHours: +(workSeconds / 3600).toFixed(2),
        isLate: false,
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        attendance[existingIdx] = { ...attendance[existingIdx], ...record };
      } else {
        attendance.push(record);
      }
      localStorage.setItem('hrms_attendance', JSON.stringify(attendance));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
    } catch (e) {
      console.error('Error recording clock-in to attendance:', e);
    }

    addToast({
      title: isFirstClockIn ? 'Clocked In Successfully! 🟢' : 'Shift Resumed! 🟢',
      message: isFirstClockIn
        ? `Shift started at ${nowStr}. Live work timer running.`
        : `Shift resumed at ${nowStr}. Continuing time tracking.`,
      type: 'success'
    });
  };

  /**
   * Clock Out Handler
   */
  const handleClockOut = () => {
    if (!isClockedIn) {
      handleClockIn();
      return;
    }
    const today = getTodayStr();
    const logoutStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setClockOutTime(logoutStr);
    setHadClockedOutToday(true);
    setSavedOfficialWorkSeconds(workSeconds);

    localStorage.setItem(`ems_timer_${userKey}_clockout_time`, logoutStr);
    localStorage.setItem(`ems_timer_${userKey}_had_clocked_out`, 'true');
    localStorage.setItem(`ems_timer_${userKey}_saved_official_seconds`, workSeconds.toString());

    if (isOnBreak) {
      resumeFromBreak();
    }

    setIsRunning(false);
    setIsOnBreak(false);
    setIsClockedIn(false);

    localStorage.setItem(`ems_timer_${userKey}_is_clocked_in`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_is_running`, 'false');
    localStorage.setItem(`ems_timer_${userKey}_is_on_break`, 'false');

    // Update Attendance Collection record with final verified hours
    try {
      const attRaw = localStorage.getItem('hrms_attendance');
      const attendance = attRaw ? JSON.parse(attRaw) : [];
      const existingIdx = attendance.findIndex(a => a.employeeId === userKey && a.date === today);
      const computedHours = +(workSeconds / 3600).toFixed(2);

      if (existingIdx >= 0) {
        attendance[existingIdx] = {
          ...attendance[existingIdx],
          clockOutTime: logoutStr,
          totalWorkingHours: computedHours,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('hrms_attendance', JSON.stringify(attendance));
        window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'hrms_attendance' } }));
      }
    } catch (e) {
      console.error('Error updating clock-out to attendance:', e);
    }

    addToast({
      title: 'Shift Clocked Out 🔴',
      message: `Shift ended at ${logoutStr}. Total Productive Work: ${formatHoursMinutes(workSeconds)} | Breaks: ${formatHoursMinutes(breakSeconds)}.`,
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
      const idx = attendance.findIndex(a => a.employeeId === targetReq.employeeId && a.date === targetReq.date);
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

  // ── Format Helpers & Target Calculations ──
  const TARGET_SHIFT_SECONDS = 8.5 * 3600; // Standard 8 hours 30 mins daily shift target
  const targetShiftSeconds = TARGET_SHIFT_SECONDS;
  const targetShiftHoursText = '8h 30m';
  const shiftProgressPercent = Math.min(100, Math.round((workSeconds / TARGET_SHIFT_SECONDS) * 100));
  const isShiftTargetReached = workSeconds >= TARGET_SHIFT_SECONDS;
  const remainingShiftSeconds = Math.max(0, TARGET_SHIFT_SECONDS - workSeconds);

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
      breakHistory,
      activeBreakLimit,
      activeBreakProgress,
      isBreakOverdue,
      breakRemainingSeconds,
      breakRemainingTimeString: formatMinutesSeconds(breakRemainingSeconds),
      targetShiftSeconds,
      targetShiftHoursText,
      shiftProgressPercent,
      isShiftTargetReached,
      remainingShiftSeconds,
      remainingShiftText: isShiftTargetReached
        ? '🎉 8h 30m Shift Target Completed!'
        : `${formatHoursMinutes(remainingShiftSeconds)} remaining to 8h 30m target`,
      timeString: formatSeconds(workSeconds),
      breakTimeString: formatSeconds(breakSeconds),
      currentBreakTimeString: formatSeconds(currentBreakSeconds),
      workDurationText: formatHoursMinutes(workSeconds),
      breakDurationText: formatHoursMinutes(breakSeconds),
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
      rejectReclockRequest
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
