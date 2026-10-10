/**
 * @file WorkContext.jsx
 * @description Central state management for Work Module (Projects, Tasks, Timesheets)
 * with robust, wall-clock persistent live ticking timers (immune to page refresh / tab close)
 * and seamless HR module cross-connection.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { workService } from '../services/workService';
import { getCollection, saveCollection, KEYS } from '../../../shared/services/storageService';
import { useHR } from '../../hr/context/HRContext';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/context/ToastContext';

const WorkContext = createContext();

export const WorkProvider = ({ children }) => {
  const { addToast } = useToast();
  const { currentUser: authUser } = useAuth();
  const { employees, leaves, currentUser: hrUser } = useHR();
  const currentUser = authUser || hrUser;

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive stable userKey for timer persistence
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

  const activeTimerKey = useMemo(() => `ems_active_task_timer_${userKey}`, [userKey]);

  // Read active timer snapshot from storage
  const getActiveTimerSnapshot = useCallback(() => {
    try {
      const saved = localStorage.getItem(activeTimerKey) || localStorage.getItem('ems_active_task_timer');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, [activeTimerKey]);

  // Save active timer snapshot to storage
  const saveActiveTimerSnapshot = useCallback((state) => {
    try {
      if (state) {
        localStorage.setItem(activeTimerKey, JSON.stringify(state));
        localStorage.setItem('ems_active_task_timer', JSON.stringify(state));
      } else {
        localStorage.removeItem(activeTimerKey);
        localStorage.removeItem('ems_active_task_timer');
      }
    } catch (e) {
      console.error('Error saving active timer snapshot:', e);
    }
  }, [activeTimerKey]);

  // Calculate live elapsed seconds using real-world wall-clock timestamps
  const getElapsedSeconds = useCallback((timerState) => {
    if (!timerState) return 0;
    const base = Number(timerState.accumulatedSeconds) || 0;
    if (!timerState.timerRunning || !timerState.startedAt) {
      return base;
    }
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - Number(timerState.startedAt)) / 1000));
    return base + elapsedSinceStart;
  }, []);

  // Format seconds to HH:MM:SS
  const formatSeconds = useCallback((totalSecs) => {
    const safe = Math.max(0, Number(totalSecs) || 0);
    const hrs = String(Math.floor(safe / 3600)).padStart(2, '0');
    const mins = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const secs = String(safe % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }, []);

  // Active filter states
  const [projectFilter, setProjectFilter] = useState({ status: 'all', category: 'all', department: 'all', search: '' });
  const [taskFilter, setTaskFilter] = useState({ projectId: 'all', status: 'all', priority: 'all', assignedTo: 'all', hideCompleted: false, search: '' });
  const [timesheetFilter, setTimesheetFilter] = useState({ employeeId: 'all', projectId: 'all', taskId: 'all', date: '', status: 'all', search: '' });

  // Load all Work module data and merge active persistent timer
  const loadWorkData = useCallback(async () => {
    try {
      setLoading(true);
      const [prjs, rawTsks, times] = await Promise.all([
        workService.getProjects(projectFilter),
        workService.getTasks(taskFilter),
        workService.getTimesheets(timesheetFilter)
      ]);

      const activeTimer = getActiveTimerSnapshot();
      let mergedTasks = (rawTsks || []).map(t => {
        if (activeTimer && activeTimer.taskId === t._id) {
          const currentSecs = getElapsedSeconds(activeTimer);
          return {
            ...t,
            timerRunning: !!activeTimer.timerRunning,
            timerSeconds: currentSecs,
            hoursLoggedText: formatSeconds(currentSecs)
          };
        }
        return {
          ...t,
          timerRunning: !!t.timerRunning,
          timerSeconds: t.timerSeconds || 0,
          hoursLoggedText: t.hoursLoggedText || formatSeconds(t.timerSeconds || 0)
        };
      });

      setProjects(prjs || []);
      setTasks(mergedTasks);
      setTimesheets(times || []);
    } catch (err) {
      console.error('Error loading Work module data:', err);
      addToast('Failed to sync Work module data', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, taskFilter, timesheetFilter, getActiveTimerSnapshot, getElapsedSeconds, formatSeconds, addToast]);

  useEffect(() => {
    loadWorkData();

    const handleStorageUpdate = (e) => {
      if (['ems_projects', 'ems_tasks', 'ems_timesheets', activeTimerKey, 'ems_active_task_timer'].includes(e.detail?.key)) {
        loadWorkData();
      }
    };
    window.addEventListener('hrms_storage_change', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('hrms_storage_change', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [loadWorkData, activeTimerKey]);

  // =========================================================================
  // ⏱️ WALL-CLOCK LIVE TICKING TASK TIMER ENGINE (Refresh & Tab-switch Immune)
  // =========================================================================
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const activeTimer = getActiveTimerSnapshot();
      if (!activeTimer || !activeTimer.timerRunning) return;

      const liveSecs = getElapsedSeconds(activeTimer);
      const text = formatSeconds(liveSecs);

      setTasks((prevTasks) => {
        let changed = false;
        const updated = prevTasks.map((t) => {
          if (t._id === activeTimer.taskId) {
            changed = true;
            return {
              ...t,
              timerRunning: true,
              timerSeconds: liveSecs,
              hoursLoggedText: text
            };
          }
          if (t.timerRunning && t._id !== activeTimer.taskId) {
            changed = true;
            return { ...t, timerRunning: false };
          }
          return t;
        });
        return changed ? updated : prevTasks;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [getActiveTimerSnapshot, getElapsedSeconds, formatSeconds]);

  // Catch up immediately when tab gains focus or visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const activeTimer = getActiveTimerSnapshot();
        if (activeTimer && activeTimer.timerRunning) {
          const liveSecs = getElapsedSeconds(activeTimer);
          const text = formatSeconds(liveSecs);
          setTasks(prev => prev.map(t => t._id === activeTimer.taskId ? { ...t, timerRunning: true, timerSeconds: liveSecs, hoursLoggedText: text } : t));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [getActiveTimerSnapshot, getElapsedSeconds, formatSeconds]);

  // ── Automatic Task Timer Pause & Resume on Break ──
  useEffect(() => {
    const handleBreakStarted = () => {
      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && activeTimer.timerRunning) {
        const currentSecs = getElapsedSeconds(activeTimer);
        const pausedState = {
          ...activeTimer,
          timerRunning: false,
          startedAt: null,
          accumulatedSeconds: currentSecs,
          wasPausedForBreak: true
        };
        saveActiveTimerSnapshot(pausedState);

        setTasks(prevTasks => prevTasks.map(t => {
          if (t._id === activeTimer.taskId) {
            return { ...t, timerRunning: false, timerSeconds: currentSecs, wasPausedForBreak: true };
          }
          return t;
        }));
      }
    };

    const handleBreakEnded = () => {
      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && activeTimer.wasPausedForBreak) {
        const now = Date.now();
        const resumedState = {
          ...activeTimer,
          timerRunning: true,
          startedAt: now,
          wasPausedForBreak: false
        };
        saveActiveTimerSnapshot(resumedState);

        setTasks(prevTasks => prevTasks.map(t => {
          if (t._id === activeTimer.taskId) {
            return { ...t, timerRunning: true, wasPausedForBreak: false };
          }
          return t;
        }));
      }
    };

    window.addEventListener('ems_break_started', handleBreakStarted);
    window.addEventListener('ems_break_ended', handleBreakEnded);
    return () => {
      window.removeEventListener('ems_break_started', handleBreakStarted);
      window.removeEventListener('ems_break_ended', handleBreakEnded);
    };
  }, [getActiveTimerSnapshot, getElapsedSeconds, saveActiveTimerSnapshot]);

  // =========================================================================
  // 🏢 PROJECT ACTIONS
  // =========================================================================
  const createProject = async (projectData) => {
    try {
      const created = await workService.createProject(projectData);
      addToast(`Project "${created.name}" created successfully!`, 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to create project', 'error');
      throw err;
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      const updated = await workService.updateProject(id, projectData);
      addToast(`Project "${updated.name}" updated`, 'success');
      await loadWorkData();
      return updated;
    } catch (err) {
      addToast('Failed to update project', 'error');
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      await workService.deleteProject(id);
      addToast('Project removed successfully', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete project', 'error');
      throw err;
    }
  };

  // =========================================================================
  // 📋 TASK ACTIONS & ROBUST TIMERS
  // =========================================================================
  const createTask = async (taskData) => {
    try {
      const created = await workService.createTask(taskData);
      addToast(`Task "${created.title}" assigned successfully!`, 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to create task', 'error');
      throw err;
    }
  };

  const updateTask = async (id, taskData) => {
    try {
      const updated = await workService.updateTask(id, taskData);
      addToast(`Task "${updated.title}" updated`, 'success');
      await loadWorkData();
      return updated;
    } catch (err) {
      addToast('Failed to update task', 'error');
      throw err;
    }
  };

  const changeTaskStatus = async (id, status) => {
    try {
      if (status === 'completed') {
        return await completeTask(id);
      }
      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && activeTimer.taskId === id && activeTimer.timerRunning) {
        await stopTaskTimer(id, `Status changed to ${status}`);
      }
      await workService.updateTaskStatus(id, status);
      addToast(`Task status changed to ${status.replace('_', ' ').toUpperCase()}`, 'success');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to change task status', 'error');
    }
  };

  const deleteTask = async (id) => {
    try {
      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && activeTimer.taskId === id) {
        saveActiveTimerSnapshot(null);
      }
      await workService.deleteTask(id);
      addToast('Task deleted successfully', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete task', 'error');
    }
  };

  // ── Start / Resume Task Timer (Wall-Clock Precision) ──
  const startTaskTimer = (taskId) => {
    const targetTask = tasks.find(t => t._id === taskId);
    if (!targetTask) return;

    const now = Date.now();
    const existingSecs = Number(targetTask.timerSeconds) || 0;

    const newTimerState = {
      taskId: targetTask._id,
      taskCode: targetTask.taskCode || 'TSK',
      title: targetTask.title,
      projectName: targetTask.projectName || 'General Work',
      assignedToId: targetTask.assignedToId || userKey,
      assignedToName: targetTask.assignedToName || currentUser?.name || 'User',
      timerRunning: true,
      startedAt: now,
      accumulatedSeconds: existingSecs,
      lastUpdated: now
    };

    saveActiveTimerSnapshot(newTimerState);

    // Save in storage collection
    const allTasks = getCollection(KEYS.TASKS) || [];
    const updatedAll = allTasks.map(t => {
      if (t._id === taskId) {
        return {
          ...t,
          timerRunning: true,
          timerSeconds: existingSecs,
          status: t.status === 'incomplete' ? 'in_progress' : t.status
        };
      }
      if (t.timerRunning) {
        return { ...t, timerRunning: false };
      }
      return t;
    });
    saveCollection(KEYS.TASKS, updatedAll);

    setTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        return {
          ...t,
          timerRunning: true,
          timerSeconds: existingSecs,
          status: t.status === 'incomplete' ? 'in_progress' : t.status
        };
      }
      if (t.timerRunning) {
        return { ...t, timerRunning: false };
      }
      return t;
    }));

    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
    addToast('Task timer started! ⏱️ Tracking active work.', 'info');
  };

  // ── Pause Task Timer ──
  const pauseTaskTimer = (taskId) => {
    const activeTimer = getActiveTimerSnapshot();
    const targetTask = tasks.find(t => t._id === taskId);
    const currentSecs = (activeTimer && activeTimer.taskId === taskId)
      ? getElapsedSeconds(activeTimer)
      : (targetTask?.timerSeconds || 0);

    const pausedTimerState = {
      ...(activeTimer || {}),
      taskId,
      timerRunning: false,
      startedAt: null,
      accumulatedSeconds: currentSecs
    };
    saveActiveTimerSnapshot(pausedTimerState);

    // Save in storage collection
    const allTasks = getCollection(KEYS.TASKS) || [];
    const updatedAll = allTasks.map(t => {
      if (t._id === taskId) {
        return { ...t, timerRunning: false, timerSeconds: currentSecs };
      }
      return t;
    });
    saveCollection(KEYS.TASKS, updatedAll);

    setTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        return { ...t, timerRunning: false, timerSeconds: currentSecs };
      }
      return t;
    }));

    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
    addToast('Task timer paused ⏸️', 'info');
  };

  // ── Stop Task Timer & Log to Timesheet ──
  const stopTaskTimer = async (taskId, memo = 'Completed session') => {
    const activeTimer = getActiveTimerSnapshot();
    const targetTask = tasks.find(t => t._id === taskId);
    if (!targetTask && !activeTimer) return;

    let totalSecs = (activeTimer && activeTimer.taskId === taskId)
      ? getElapsedSeconds(activeTimer)
      : (targetTask?.timerSeconds || 0);

    if (totalSecs <= 0) totalSecs = 60; // Minimum 1 min fallback if stopped instantly

    try {
      await workService.stopTimer({
        taskId: targetTask?._id || taskId,
        totalDurationSeconds: totalSecs,
        memo: memo || `Work on ${targetTask?.title || 'Task'}`
      });

      saveActiveTimerSnapshot(null);

      // In storage tasks collection reset timer
      const allTasks = getCollection(KEYS.TASKS) || [];
      const updatedAll = allTasks.map(t => {
        if (t._id === taskId) {
          return { ...t, timerRunning: false, timerSeconds: 0 };
        }
        return t;
      });
      saveCollection(KEYS.TASKS, updatedAll);

      setTasks(prev => prev.map(t => {
        if (t._id === taskId) {
          return { ...t, timerRunning: false, timerSeconds: 0 };
        }
        return t;
      }));

      addToast(`Timer stopped! ${formatSeconds(totalSecs)} logged to Timesheet.`, 'success');
      await loadWorkData();
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
    } catch (err) {
      addToast('Failed to save timer session', 'error');
    }
  };

  // =========================================================================
  // 🚀 COMPLETE TASK & ADVANCE TO NEXT TASK (Auto duration addition)
  // =========================================================================
  const completeTask = async (taskId, customMemo = '') => {
    try {
      const activeTimer = getActiveTimerSnapshot();
      const targetTask = tasks.find(t => t._id === taskId);
      if (!targetTask) return null;

      // Calculate duration spent on this task
      let durationSecs = (activeTimer && activeTimer.taskId === taskId)
        ? getElapsedSeconds(activeTimer)
        : ((targetTask.timerSeconds && targetTask.timerSeconds > 0)
          ? targetTask.timerSeconds
          : (targetTask.estimatedHours ? Math.round(targetTask.estimatedHours * 3600) : 3600));

      if (durationSecs <= 0) durationSecs = 1800;

      // Stop timer and log entry into timesheet
      await workService.stopTimer({
        taskId: targetTask._id,
        totalDurationSeconds: durationSecs,
        memo: customMemo || `Completed task: ${targetTask.title}`
      });

      saveActiveTimerSnapshot(null);

      // Update status to completed
      await workService.updateTaskStatus(taskId, 'completed');
      await workService.updateTask(taskId, { progress: 100, timerRunning: false, timerSeconds: 0 });

      // Refresh work data
      await loadWorkData();

      // Find remaining pending tasks assigned to this user
      const assignedEmpId = targetTask.assignedToId || currentUser?._id;
      const updatedTasks = getCollection(KEYS.TASKS) || [];
      const remainingTasks = updatedTasks.filter(t => 
        (t.assignedToId === assignedEmpId || t.assignedToName === targetTask.assignedToName) && 
        t.status !== 'completed' && 
        t._id !== taskId
      );

      const nextTask = remainingTasks[0] || null;
      const hrsFormatted = formatSeconds(durationSecs);

      if (nextTask) {
        addToast(`🎉 Task "${targetTask.title}" completed! ${hrsFormatted} added to duration. Next task "${nextTask.title}" is now active!`, 'success');
      } else {
        addToast(`🏆 Task "${targetTask.title}" completed! ${hrsFormatted} added. All assigned tasks are done!`, 'success');
      }

      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      return { completedTask: targetTask, nextTask };
    } catch (err) {
      console.error('Error completing task:', err);
      addToast('Failed to complete task', 'error');
      return null;
    }
  };

  // =========================================================================
  // ⏰ TASK SNOOZE, "DO LATER" & CRM REMINDERS
  // =========================================================================
  /**
   * Snooze / Postpone a task and set a reminder.
   * Pauses the timer right here, preserves accumulated seconds, and schedules reminder.
   */
  const snoozeTask = async (taskId, { remindInMinutes = 30, customDateTime = null, note = '' }) => {
    try {
      const targetTask = tasks.find(t => t._id === taskId);
      if (!targetTask) return;

      // 1. Pause active timer if running for this task and record time spent
      const activeTimer = getActiveTimerSnapshot();
      let currentSecs = (activeTimer && activeTimer.taskId === taskId)
        ? getElapsedSeconds(activeTimer)
        : (targetTask.timerSeconds || 0);

      if (activeTimer && activeTimer.taskId === taskId) {
        saveActiveTimerSnapshot({
          ...activeTimer,
          timerRunning: false,
          startedAt: null,
          accumulatedSeconds: currentSecs
        });
      }

      // 2. Compute reminder timestamp (in ms)
      let remindAtTimestamp;
      if (customDateTime) {
        remindAtTimestamp = new Date(customDateTime).getTime();
      } else {
        remindAtTimestamp = Date.now() + (Number(remindInMinutes) * 60 * 1000);
      }

      // 3. Update task in storage & state
      const updatePayload = {
        timerRunning: false,
        timerSeconds: currentSecs,
        snoozed: true,
        remindAt: remindAtTimestamp,
        reminderNote: note || `Paused at ${formatSeconds(currentSecs)}`,
        reminderAlerted: false,
        reminderDismissed: false
      };

      await workService.updateTask(taskId, updatePayload);

      // Save collection update
      const allTasks = getCollection(KEYS.TASKS) || [];
      const updatedAll = allTasks.map(t => {
        if (t._id === taskId) {
          return { ...t, ...updatePayload };
        }
        return t;
      });
      saveCollection(KEYS.TASKS, updatedAll);

      setTasks(prev => prev.map(t => {
        if (t._id === taskId) {
          return { ...t, ...updatePayload, hoursLoggedText: formatSeconds(currentSecs) };
        }
        return t;
      }));

      const reminderTimeStr = new Date(remindAtTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      addToast(`⏰ Task "#${targetTask.taskCode || 'TSK'}" paused & saved! CRM will remind you at ${reminderTimeStr}.`, 'info');

      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      window.dispatchEvent(new CustomEvent('ems_task_reminded', { detail: { taskId, remindAt: remindAtTimestamp } }));
    } catch (err) {
      console.error('Error snoozing task:', err);
      addToast('Failed to set task reminder', 'error');
    }
  };

  /**
   * Resume a snoozed/reminded task immediately: clears reminder and starts timer!
   */
  const resumeSnoozedTask = async (taskId) => {
    try {
      const updatePayload = {
        snoozed: false,
        remindAt: null,
        reminderAlerted: false,
        reminderDismissed: true
      };

      await workService.updateTask(taskId, updatePayload);

      const allTasks = getCollection(KEYS.TASKS) || [];
      const updatedAll = allTasks.map(t => {
        if (t._id === taskId) {
          return { ...t, ...updatePayload };
        }
        return t;
      });
      saveCollection(KEYS.TASKS, updatedAll);

      setTasks(prev => prev.map(t => {
        if (t._id === taskId) {
          return { ...t, ...updatePayload };
        }
        return t;
      }));

      // Start the task timer right away
      startTaskTimer(taskId);
    } catch (err) {
      console.error('Error resuming task:', err);
      addToast('Failed to resume task', 'error');
    }
  };

  /**
   * Dismiss a reminder banner without starting timer yet
   */
  const dismissTaskReminder = async (taskId) => {
    try {
      const updatePayload = {
        snoozed: false,
        remindAt: null,
        reminderDismissed: true
      };
      await workService.updateTask(taskId, updatePayload);
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, ...updatePayload } : t));
      addToast('Task reminder dismissed', 'info');
    } catch (e) {
      console.error(e);
    }
  };

  // Heartbeat checker for due reminders
  useEffect(() => {
    const reminderInterval = setInterval(() => {
      const now = Date.now();
      const allTasks = getCollection(KEYS.TASKS) || [];
      let hasUpdate = false;

      allTasks.forEach(t => {
        if (t.snoozed && t.remindAt && Number(t.remindAt) <= now && !t.reminderAlerted && !t.reminderDismissed) {
          hasUpdate = true;
          t.reminderAlerted = true;
          addToast(`⏰ Reminder: Time to resume task "#${t.taskCode || 'TSK'}: ${t.title}"! (Paused at ${formatSeconds(t.timerSeconds || 0)})`, 'warning');
        }
      });

      if (hasUpdate) {
        saveCollection(KEYS.TASKS, allTasks);
        setTasks(prev => prev.map(t => {
          const matched = allTasks.find(x => x._id === t._id);
          return matched ? { ...t, reminderAlerted: matched.reminderAlerted } : t;
        }));
      }
    }, 8000);

    return () => clearInterval(reminderInterval);
  }, [formatSeconds, addToast]);

  // =========================================================================
  // ⏱️ TIMESHEET ACTIONS
  // =========================================================================
  const logTimesheet = async (entryData) => {
    try {
      const created = await workService.createTimesheet(entryData);
      addToast('Time logged successfully to Timesheet!', 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to log time', 'error');
      throw err;
    }
  };

  const deleteTimesheet = async (id) => {
    try {
      await workService.deleteTimesheet(id);
      addToast('Timesheet entry removed', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete timesheet entry', 'error');
    }
  };

  // =========================================================================
  // 🔗 HR & CRM CROSS-CONNECTION INTELLIGENCE
  // =========================================================================
  // Check if an employee is currently on approved leave for a specific date
  const isEmployeeOnLeave = (empId, checkDate = new Date().toISOString().split('T')[0]) => {
    if (!leaves || !leaves.length) return false;
    return leaves.some(l => {
      if (l.employeeId !== empId && l.employee !== empId) return false;
      if (l.status !== 'approved') return false;
      return checkDate >= l.startDate && checkDate <= l.endDate;
    });
  };

  // Active running task if any
  const activeRunningTask = tasks.find(t => t.timerRunning);

  return (
    <WorkContext.Provider value={{
      loading,
      projects,
      tasks,
      timesheets,
      activeRunningTask,
      // Filters
      projectFilter,
      setProjectFilter,
      taskFilter,
      setTaskFilter,
      timesheetFilter,
      setTimesheetFilter,
      // Refetch
      loadWorkData,
      formatSeconds,
      // Project Methods
      createProject,
      updateProject,
      deleteProject,
      // Task Methods
      createTask,
      updateTask,
      changeTaskStatus,
      completeTask,
      deleteTask,
      startTaskTimer,
      pauseTaskTimer,
      stopTaskTimer,
      snoozeTask,
      resumeSnoozedTask,
      dismissTaskReminder,
      // Timesheet Methods
      logTimesheet,
      deleteTimesheet,
      // HR cross connection
      employees,
      currentUser,
      isEmployeeOnLeave
    }}>
      {children}
    </WorkContext.Provider>
  );
};

export const useWork = () => useContext(WorkContext);

