/**
 * @file TimerContext.jsx
 * @description Central Work Session Timer & Dual Time-Tracking Engine:
 * 1. Daily Shift Attendance Clock (Clock In, Clock Out, Gross Shift vs Net Productive Work).
 * 2. Enterprise Break Management Engine with persistent Break History Logging and Active Break Reminders.
 * 3. Task Time estimation & progress coordination.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastContext';

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

  // ── 1. Daily Clock In / Out State ──
  const [loginTime, setLoginTime] = useState(() => {
    return localStorage.getItem('ems_login_time') || '09:04 AM';
  });

  const [clockOutTime, setClockOutTime] = useState(() => {
    return localStorage.getItem('ems_clockout_time') || null;
  });

  const [isClockedIn, setIsClockedIn] = useState(() => {
    const saved = localStorage.getItem('ems_is_clocked_in');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem('hrms_work_clock_running');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Active productive work seconds
  const [workSeconds, setWorkSeconds] = useState(() => {
    const saved = localStorage.getItem('hrms_work_clock_seconds');
    return saved ? parseInt(saved, 10) : 7961; // 02:12:41 default
  });

  // Cumulative break seconds for current day
  const [breakSeconds, setBreakSeconds] = useState(() => {
    const saved = localStorage.getItem('ems_break_seconds');
    return saved ? parseInt(saved, 10) : 0;
  });

  // ── 2. Active Break & History State ──
  const [isOnBreak, setIsOnBreak] = useState(() => {
    const saved = localStorage.getItem('ems_is_on_break');
    return saved ? JSON.parse(saved) : false;
  });

  const [breakType, setBreakType] = useState(() => {
    return localStorage.getItem('ems_break_type') || 'Lunch Break';
  });

  const [currentBreakSeconds, setCurrentBreakSeconds] = useState(() => {
    const saved = localStorage.getItem('ems_current_break_seconds');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [breakStartTime, setBreakStartTime] = useState(() => {
    return localStorage.getItem('ems_break_start_time') || null;
  });

  const [breakReminderSent, setBreakReminderSent] = useState(false);

  // Persistent Break History List
  const [breakHistory, setBreakHistory] = useState(() => {
    const saved = localStorage.getItem('ems_break_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    // Default initial mock history for seamless demonstration
    return [
      {
        id: 'brk_1',
        type: 'Tea / Coffee Break',
        startTime: '10:45 AM',
        endTime: '11:00 AM',
        durationSeconds: 900,
        durationText: '15m 00s',
        date: new Date().toISOString().split('T')[0],
        notes: 'Morning refreshment & team sync'
      },
      {
        id: 'brk_2',
        type: 'Quick Rest / Stretch',
        startTime: '12:30 PM',
        endTime: '12:38 PM',
        durationSeconds: 480,
        durationText: '8m 00s',
        date: new Date().toISOString().split('T')[0],
        notes: 'Screen break & desk stretch'
      }
    ];
  });

  // Save break history
  useEffect(() => {
    localStorage.setItem('ems_break_history', JSON.stringify(breakHistory));
  }, [breakHistory]);

  // Timer Tick Engine
  useEffect(() => {
    let interval = null;
    if (isClockedIn) {
      interval = setInterval(() => {
        if (isOnBreak) {
          // Increment total break seconds
          setBreakSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem('ems_break_seconds', next.toString());
            return next;
          });

          // Increment current session break seconds
          setCurrentBreakSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem('ems_current_break_seconds', next.toString());

            // Smart Break Overtime Reminder Check
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
          // Increment active work clock
          setWorkSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem('hrms_work_clock_seconds', next.toString());
            return next;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isRunning, isOnBreak, breakType, breakReminderSent, addToast]);

  useEffect(() => {
    localStorage.setItem('hrms_work_clock_running', JSON.stringify(isRunning));
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('ems_is_on_break', JSON.stringify(isOnBreak));
    localStorage.setItem('ems_break_type', breakType);
  }, [isOnBreak, breakType]);

  useEffect(() => {
    localStorage.setItem('ems_is_clocked_in', JSON.stringify(isClockedIn));
  }, [isClockedIn]);

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
   * Start a new break session
   */
  const startBreak = (type = 'Lunch Break', notes = '') => {
    const startTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setBreakType(type);
    setIsOnBreak(true);
    setIsRunning(false);
    setCurrentBreakSeconds(0);
    setBreakStartTime(startTimeStr);
    setBreakReminderSent(false);

    localStorage.setItem('ems_break_start_time', startTimeStr);
    localStorage.setItem('ems_current_break_seconds', '0');

    addToast({
      title: `On ${type} ☕`,
      message: `Break started at ${startTimeStr}. Working clock paused & break history logging activated.`,
      type: 'info'
    });
  };

  /**
   * Resume working from break and record into Break History
   */
  const resumeFromBreak = () => {
    const endTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const sTime = breakStartTime || loginTime;
    const duration = currentBreakSeconds > 0 ? currentBreakSeconds : 60; // at least 1 min if quick click

    const newRecord = {
      id: `brk_${Date.now()}`,
      type: breakType,
      startTime: sTime,
      endTime: endTimeStr,
      durationSeconds: duration,
      durationText: formatMinutesSeconds(duration),
      date: new Date().toISOString().split('T')[0],
      notes: `Resumed work at ${endTimeStr}`
    };

    setBreakHistory(prev => [newRecord, ...prev]);

    setIsOnBreak(false);
    setIsRunning(true);
    setCurrentBreakSeconds(0);
    setBreakStartTime(null);
    setBreakReminderSent(false);

    localStorage.setItem('ems_current_break_seconds', '0');
    localStorage.removeItem('ems_break_start_time');

    addToast({
      title: 'Welcome Back! 🚀',
      message: `Break ended (${newRecord.durationText}). Recorded to your Break History timeline.`,
      type: 'success'
    });
  };

  const deleteBreakHistoryItem = (id) => {
    setBreakHistory(prev => prev.filter(b => b.id !== id));
    addToast('Break log item removed', 'info');
  };

  const clearTodayBreaks = () => {
    setBreakHistory([]);
    setBreakSeconds(0);
    localStorage.setItem('ems_break_seconds', '0');
    localStorage.setItem('ems_break_history', JSON.stringify([]));
    addToast('Break history cleared for today', 'info');
  };

  /**
   * Clock In Handler
   */
  const handleClockIn = () => {
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLoginTime(nowStr);
    setClockOutTime(null);
    localStorage.setItem('ems_login_time', nowStr);
    localStorage.removeItem('ems_clockout_time');
    setIsClockedIn(true);
    setIsRunning(true);
    setIsOnBreak(false);

    addToast({
      title: 'Clocked In Successfully! 🟢',
      message: `Shift started at ${nowStr}. Have an awesome and productive day!`,
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
    const logoutStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setClockOutTime(logoutStr);
    localStorage.setItem('ems_clockout_time', logoutStr);

    // If on break, finalize it
    if (isOnBreak) {
      resumeFromBreak();
    }

    setIsRunning(false);
    setIsOnBreak(false);
    setIsClockedIn(false);

    addToast({
      title: 'Clocked Out for Today 🔴',
      message: `Shift ended at ${logoutStr}. Total Productive Work: ${formatHoursMinutes(workSeconds)} | Total Breaks: ${formatHoursMinutes(breakSeconds)}`,
      type: 'info'
    });
  };

  // ── Format Helpers ──
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

  // Active break limit & percentage
  const activeBreakLimit = BREAK_THRESHOLDS[breakType] || (20 * 60);
  const activeBreakProgress = Math.min(100, Math.round((currentBreakSeconds / activeBreakLimit) * 100));
  const isBreakOverdue = currentBreakSeconds > activeBreakLimit;

  return (
    <TimerContext.Provider value={{
      loginTime,
      clockOutTime,
      workSeconds,
      breakSeconds,
      grossSeconds,
      currentBreakSeconds,
      breakStartTime,
      isRunning,
      isOnBreak,
      breakType,
      isClockedIn,
      breakHistory,
      activeBreakLimit,
      activeBreakProgress,
      isBreakOverdue,
      timeString: formatSeconds(workSeconds),
      breakTimeString: formatSeconds(breakSeconds),
      currentBreakTimeString: formatSeconds(currentBreakSeconds),
      workDurationText: formatHoursMinutes(workSeconds),
      breakDurationText: formatHoursMinutes(breakSeconds),
      grossDurationText: formatHoursMinutes(grossSeconds),
      togglePauseResume,
      startBreak,
      resumeFromBreak,
      handleClockIn,
      handleClockOut,
      deleteBreakHistoryItem,
      clearTodayBreaks,
      formatSeconds,
      formatHoursMinutes,
      formatMinutesSeconds
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
