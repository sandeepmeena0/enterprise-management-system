/**
 * @file TimerContext.jsx
 * @description Central Work Session Timer and Attendance Clock tracking
 * with Login time, Break modes (Lunch, Tea, Personal), Gross/Net hours, and Clock Out.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  const { addToast } = useToast();

  // Login time
  const [loginTime, setLoginTime] = useState(() => {
    return localStorage.getItem('ems_login_time') || '09:04 AM';
  });

  // Working seconds (active work)
  const [workSeconds, setWorkSeconds] = useState(() => {
    const saved = localStorage.getItem('hrms_work_clock_seconds');
    return saved ? parseInt(saved, 10) : 7961; // 02:12:41 default matching screenshot
  });

  // Break seconds
  const [breakSeconds, setBreakSeconds] = useState(() => {
    const saved = localStorage.getItem('ems_break_seconds');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isOnBreak, setIsOnBreak] = useState(() => {
    const saved = localStorage.getItem('ems_is_on_break');
    return saved ? JSON.parse(saved) : false;
  });

  const [breakType, setBreakType] = useState(() => {
    return localStorage.getItem('ems_break_type') || 'Lunch Break';
  });

  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem('hrms_work_clock_running');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isClockedIn, setIsClockedIn] = useState(() => {
    const saved = localStorage.getItem('ems_is_clocked_in');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Timer Tick Engine
  useEffect(() => {
    let interval = null;
    if (isClockedIn) {
      interval = setInterval(() => {
        if (isOnBreak) {
          setBreakSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem('ems_break_seconds', next.toString());
            return next;
          });
        } else if (isRunning) {
          setWorkSeconds(prev => {
            const next = prev + 1;
            localStorage.setItem('hrms_work_clock_seconds', next.toString());
            return next;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isRunning, isOnBreak]);

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

  // Actions
  const togglePauseResume = () => {
    if (isOnBreak) {
      resumeFromBreak();
      return;
    }
    setIsRunning(prev => {
      const next = !prev;
      addToast(next ? 'Work timer resumed' : 'Work timer paused', 'info');
      return next;
    });
  };

  const startBreak = (type = 'Lunch Break') => {
    setBreakType(type);
    setIsOnBreak(true);
    setIsRunning(false);
    addToast(`On ${type} ☕. Working timer paused.`, 'info');
  };

  const resumeFromBreak = () => {
    setIsOnBreak(false);
    setIsRunning(true);
    addToast('Welcome back! Working timer resumed 🚀', 'success');
  };

  const handleClockIn = () => {
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLoginTime(nowStr);
    localStorage.setItem('ems_login_time', nowStr);
    setIsClockedIn(true);
    setIsRunning(true);
    setIsOnBreak(false);
    addToast(`Clocked in at ${nowStr}! Have a productive day.`, 'success');
  };

  const handleClockOut = () => {
    if (!isClockedIn) {
      handleClockIn();
      return;
    }
    const logoutStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setIsRunning(false);
    setIsOnBreak(false);
    setIsClockedIn(false);
    addToast(`Clocked out at ${logoutStr}. Total work: ${formatHoursMinutes(workSeconds)}`, 'info');
  };

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

  const grossSeconds = workSeconds + breakSeconds;

  return (
    <TimerContext.Provider value={{
      loginTime,
      workSeconds,
      breakSeconds,
      grossSeconds,
      isRunning,
      isOnBreak,
      breakType,
      isClockedIn,
      timeString: formatSeconds(workSeconds),
      breakTimeString: formatSeconds(breakSeconds),
      workDurationText: formatHoursMinutes(workSeconds),
      breakDurationText: formatHoursMinutes(breakSeconds),
      grossDurationText: formatHoursMinutes(grossSeconds),
      togglePauseResume,
      startBreak,
      resumeFromBreak,
      handleClockIn,
      handleClockOut,
      formatSeconds,
      formatHoursMinutes
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
