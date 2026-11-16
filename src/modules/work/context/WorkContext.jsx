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
import { hrService } from '../../hr/services/hrService';
import { OverdueTaskModal } from '../components/tasks/OverdueTaskModal';
import { broadcastSyncEvent, subscribeToSyncEvents, SYNC_EVENTS } from '../../../shared/services/realtimeSyncService';
import { isHRorAdmin, canDeleteTask, canDeleteProject, canCreateTasks, canEditAnyTask, canManageProjects } from '../../../shared/utils/permissionUtils';
import { readTimerStorage, sanitizeTaskDailySessions } from '../../../shared/utils/timerUtils';
import { initTimerOfflineSync } from '../services/timerOfflineQueue';

const defaultWorkContext = {
  projects: [],
  tasks: [],
  timesheets: [],
  loading: false,
  activeTaskId: null,
  activeTimer: null,
  timerRunning: false,
  timerSeconds: 0,
  refreshWorkData: async () => {},
  createProject: async () => {},
  updateProject: async () => {},
  deleteProject: async () => {},
  createTask: async () => {},
  updateTask: async () => {},
  changeTaskStatus: async () => {},
  completeTask: async () => {},
  completeAndNextTask: async () => {},
  deleteTask: async () => {},
  startTaskTimer: () => {},
  pauseTaskTimer: () => {},
  stopTaskTimer: () => {},
  snoozeTask: async () => {},
  resumeSnoozedTask: async () => {},
  dismissTaskReminder: async () => {},
  logTimesheet: async () => {},
  deleteTimesheet: async () => {},
  employees: [],
  currentUser: null,
  isEmployeeOnLeave: () => false,
  isTaskOverdue: () => false,
  overdueTaskPrompt: null,
  syncAuthoritativeTimerState: async () => {},
  extendTaskDeadline: async () => {},
  rescheduleTaskForFuture: async () => {}
};

const WorkContext = createContext(defaultWorkContext);

export const WorkProvider = ({ children }) => {
  const { addToast } = useToast();
  const { currentUser: authUser } = useAuth();
  const { employees, leaves, currentUser: hrUser } = useHR();
  const currentUser = authUser || hrUser;

  const [projects, setProjects] = useState(() => getCollection(KEYS.PROJECTS) || []);
  const [tasks, setTasks] = useState(() => getCollection(KEYS.TASKS) || []);
  const [timesheets, setTimesheets] = useState(() => {
    const raw = getCollection(KEYS.TIMESHEETS) || [];
    const auth = authUser || hrUser;
    const isPriv = auth && (auth.isAdmin || auth.systemRole === 'admin' || auth.systemRole === 'hr' || auth.role === 'Administrator' || auth.role === 'HR Manager');
    if (!isPriv && auth) {
      return raw.filter(ts =>
        ts.employeeId === auth._id ||
        ts.employee === auth._id ||
        ts.employeeId === auth.employeeCode ||
        ts.employee === auth.employeeCode ||
        (ts.employeeName && auth.name && ts.employeeName.toLowerCase() === auth.name.toLowerCase())
      );
    }
    return raw;
  });
  const [loading, setLoading] = useState(false);
  const [overdueTaskPrompt, setOverdueTaskPrompt] = useState(null);

  // Network storm & debounce guards to prevent ERR_INSUFFICIENT_RESOURCES
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const alertedTaskIdsRef = useRef(new Set());

  // Monotonic sequence and request ID tracking to reject stale out-of-order responses
  const latestServerVersionRef = useRef(0);
  const inFlightRequestIdRef = useRef(0);
  const isTimerActionInFlightRef = useRef(false);

  // Derive stable userKey matching TimerContext for seamless cross-module sync
  const userKey = useMemo(() => {
    return currentUser?.employeeCode || (currentUser?._id ? String(currentUser._id) : '');
  }, [currentUser]);


  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const activeTimerKey = useMemo(() => `ems_active_task_timer_${userKey}`, [userKey]);

  const isTaskAssignedToMe = useCallback((t) => {
    if (!t || !currentUser) return false;
    const myIds = [userKey, currentUser?._id, currentUser?.employeeCode, currentUser?.email]
      .filter(Boolean)
      .map(s => String(s).toLowerCase());

    const directAssignedTo = (t.assignedTo && typeof t.assignedTo === 'object')
      ? String(t.assignedTo._id || t.assignedTo.id || '')
      : String(t.assignedTo || '');

    const directIds = [t.assignedToId, directAssignedTo, t.employeeId, t.assignedToEmail, t.activeUserId]
      .filter(Boolean)
      .map(s => String(s).toLowerCase());
    if (myIds.some(uid => directIds.includes(uid))) return true;

    if (Array.isArray(t.assignedToIds) && t.assignedToIds.some(id => myIds.includes(String(id).toLowerCase()))) {
      return true;
    }
    if (Array.isArray(t.assignees) && t.assignees.some(a => {
      const aIds = [a._id, a.id, a.employeeCode, a.email].filter(Boolean).map(s => String(s).toLowerCase());
      if (myIds.some(uid => aIds.includes(uid))) return true;
      if (currentUser?.name && a.name && a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;
      return false;
    })) {
      return true;
    }
    if (Array.isArray(t.assignedMembers) && t.assignedMembers.some(m => {
      const mIds = [m._id, m.id, m.employeeCode, m.email].filter(Boolean).map(s => String(s).toLowerCase());
      if (myIds.some(uid => mIds.includes(uid))) return true;
      if (currentUser?.name && m.name && m.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;
      return false;
    })) {
      return true;
    }

    if (t.assignedToName && currentUser?.name) {
      const myName = currentUser.name.trim().toLowerCase();
      const aName = t.assignedToName.trim().toLowerCase();
      if (myName === aName || myName.includes(aName) || aName.includes(myName)) return true;
      const myTokens = myName.split(/\s+/).filter(tok => tok.length >= 3);
      const aTokens = aName.split(/\s+/).filter(tok => tok.length >= 3);
      if (myTokens.some(mt => aTokens.includes(mt))) return true;
    }
    return false;
  }, [userKey, currentUser]);

  // Permission authorization helper: only Admin, HR, Assigner/Creator, or Authorized Manager/Assignee can control tasks
  const canUserControlTask = useCallback((targetTask) => {
    if (!targetTask || !currentUser) return false;
    const isUserAdminOrHR = currentUser?.isAdmin ||
      currentUser?.systemRole === 'admin' ||
      currentUser?.systemRole === 'hr' ||
      currentUser?.role === 'Administrator' ||
      currentUser?.role === 'HR Manager' ||
      isHRorAdmin(currentUser) ||
      canEditAnyTask(currentUser) ||
      canCreateTasks(currentUser) ||
      canManageProjects(currentUser);
    if (isUserAdminOrHR) return true;

    // Check assigner / creator
    const myIds = [userKey, currentUser?._id, currentUser?.employeeCode, currentUser?.email].filter(Boolean).map(s => String(s).toLowerCase());
    const creatorIds = [targetTask.assignedById, targetTask.assignedByCode].filter(Boolean).map(s => String(s).toLowerCase());
    if (myIds.some(id => creatorIds.includes(id))) return true;
    if (targetTask.assignedBy && currentUser?.name && targetTask.assignedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;

    // Check assigned member (single or multi-assignee)
    if (isTaskAssignedToMe(targetTask)) return true;

    return false;
  }, [currentUser, userKey, isTaskAssignedToMe]);

  const isEventForMe = useCallback((e) => {
    if (!e || !e.detail) return true;
    const { userKey: evKey, employeeId: evId, employeeCode: evCode } = e.detail;
    if (!evKey && !evId && !evCode) return true;
    return evKey === userKey ||
      (currentUser?._id && evId && String(evId) === String(currentUser._id)) ||
      (currentUser?.employeeCode && (evKey === currentUser.employeeCode || evCode === currentUser.employeeCode));
  }, [userKey, currentUser]);

  // Read active timer snapshot from storage strictly scoped to current user
  const getActiveTimerSnapshot = useCallback(() => {
    try {
      const keysToCheck = [
        activeTimerKey,
        currentUser?.employeeCode ? `ems_active_task_timer_${currentUser.employeeCode}` : null,
        currentUser?._id ? `ems_active_task_timer_${currentUser._id}` : null
      ].filter(Boolean);

      const today = getTodayStr();
      for (const k of keysToCheck) {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (!parsed.date || parsed.date === today)) {
            return parsed;
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [activeTimerKey, currentUser]);

  // Multi-user & Multi-assignee Active Task Guard:
  // Verifies that a running task timer actually belongs to the given user,
  // preventing one team member's active timer from leaking into another's personal dashboard/timer.
  const isTaskActiveForUser = useCallback((t, targetUser = currentUser) => {
    if (!t || !t.timerRunning || t.status === 'completed' || t.completedAt) return false;
    const u = targetUser || currentUser;
    if (!u) return false;
    const uKeyStr = String(targetUser === currentUser ? userKey : (u._id || u.employeeCode || '')).toLowerCase().trim();
    const myIds = [
      uKeyStr,
      u._id ? String(u._id).toLowerCase().trim() : null,
      u.id ? String(u.id).toLowerCase().trim() : null,
      u.employeeCode ? String(u.employeeCode).toLowerCase().trim() : null,
      u.email ? String(u.email).toLowerCase().trim() : null
    ].filter(Boolean);

    // 1. If activeUserId is explicitly stamped, it MUST match this user
    if (t.activeUserId) {
      return myIds.includes(String(t.activeUserId).toLowerCase().trim());
    }

    // 2. If single-assignee task with assignedToId
    if (t.assignedToId && (!Array.isArray(t.assignedToIds) || t.assignedToIds.length <= 1)) {
      return myIds.includes(String(t.assignedToId).toLowerCase().trim());
    }

    // 3. Direct assignee object
    const directAssigned = typeof t.assignedTo === 'object' ? (t.assignedTo?._id || t.assignedTo?.employeeCode) : t.assignedTo;
    if (directAssigned && (!Array.isArray(t.assignedToIds) || t.assignedToIds.length <= 1)) {
      return myIds.includes(String(directAssigned).toLowerCase().trim());
    }

    // 4. Multi-assignee task where activeUserId is not yet set: only consider active if local snapshot confirms it
    const activeTimer = getActiveTimerSnapshot();
    if (activeTimer && activeTimer.timerRunning && (String(activeTimer.taskId) === String(t._id || t.id) || activeTimer.taskCode === t.taskCode)) {
      return true;
    }

    return false;
  }, [currentUser, userKey, getActiveTimerSnapshot]);

  // Save active timer snapshot to storage strictly scoped to current user
  const saveActiveTimerSnapshot = useCallback((state) => {
    try {
      if (state) {
        const payload = JSON.stringify({
          ...state,
          activeUserId: state.activeUserId || userKey
        });
        localStorage.setItem(activeTimerKey, payload);
        if (currentUser?.employeeCode) {
          localStorage.setItem(`ems_active_task_timer_${currentUser.employeeCode}`, payload);
        }
        if (currentUser?._id) {
          localStorage.setItem(`ems_active_task_timer_${currentUser._id}`, payload);
        }
      } else {
        localStorage.removeItem(activeTimerKey);
        if (currentUser?.employeeCode) localStorage.removeItem(`ems_active_task_timer_${currentUser.employeeCode}`);
        if (currentUser?._id) localStorage.removeItem(`ems_active_task_timer_${currentUser._id}`);
      }
    } catch (e) {
      console.error('Error saving active timer snapshot:', e);
    }
  }, [activeTimerKey, currentUser, userKey]);

  // Calculate live elapsed seconds using real-world wall-clock timestamps
  const getElapsedSeconds = useCallback((timerState) => {
    if (!timerState) return 0;
    const today = getTodayStr();
    // Guard against previous-day runaway calculations
    if (timerState.date && timerState.date !== today) {
      return Number(timerState.accumulatedSeconds) || Number(timerState.timerSeconds) || 0;
    }
    const base = (timerState.accumulatedSeconds !== undefined && timerState.accumulatedSeconds !== null)
      ? Number(timerState.accumulatedSeconds)
      : (Number(timerState.timerSeconds) || 0);
    if (!timerState.timerRunning || !timerState.startedAt) {
      return base;
    }
    const startTs = typeof timerState.startedAt === 'number' ? timerState.startedAt : new Date(timerState.startedAt).getTime();
    if (!startTs || isNaN(startTs)) return base;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightMs = todayMidnight.getTime();
    if (startTs < todayMidnightMs || startTs > Date.now()) {
      return base;
    }

    const elapsedSinceStart = Math.min(Math.max(0, Math.floor((Date.now() - startTs) / 1000)), 14 * 3600);
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

  // Canonical Shared Hydration Engine: Single authoritative pipeline for all timer state updates
  const reconcileAuthoritativeTimer = useCallback((timerState, { source = 'unknown', force = false } = {}) => {
    if (!currentUser || !timerState) return null;
    const serverVersion = typeof timerState.version === 'number' ? timerState.version : 0;
    // Monotonic server version guard: NEVER accept an older server version even when force is true
    if (serverVersion > 0 && latestServerVersionRef.current > 0 && serverVersion < latestServerVersionRef.current) {
      console.warn(`[WorkContext] Discarding stale server timer version ${serverVersion} < ${latestServerVersionRef.current} from ${source}`);
      return null;
    }
    if (serverVersion > 0) {
      latestServerVersionRef.current = Math.max(latestServerVersionRef.current, serverVersion);
    }

    const today = getTodayStr();
    const now = Date.now();

    if (timerState.status === 'RUNNING' && timerState.taskId) {
      const serverTaskId = String(timerState.taskId._id || timerState.taskId.id || timerState.taskId);
      const serverTaskObj = typeof timerState.taskId === 'object' ? timerState.taskId : null;
      const startMs = timerState.startedAt ? new Date(timerState.startedAt).getTime() : now;
      const accumSecs = Number(timerState.accumulatedSeconds ?? serverTaskObj?.accumulatedSeconds ?? 0);
      const timerSecs = Number(timerState.timerSeconds ?? serverTaskObj?.timerSeconds ?? 0);
      const todaySecs = Number(timerState.todayWorkSeconds ?? serverTaskObj?.todayWorkSeconds ?? 0);

      const authoritativeSnapshot = {
        taskId: serverTaskId,
        taskCode: serverTaskObj?.taskCode || timerState.taskCode || '',
        title: serverTaskObj?.title || timerState.title || 'Active Task',
        projectName: serverTaskObj?.projectName || timerState.projectName || 'General Work',
        timerRunning: true,
        startedAt: startMs,
        accumulatedSeconds: accumSecs,
        timerSeconds: timerSecs,
        todayWorkSeconds: todaySecs,
        activeUserId: userKey,
        date: today,
        sessionDate: today,
        serverVersion,
        lastUpdated: now
      };

      saveActiveTimerSnapshot(authoritativeSnapshot);

      setTasks(prevTasks => {
        const updated = prevTasks.map(t => {
          const tId = String(t._id || t.id);
          if (tId === serverTaskId) {
            return {
              ...t,
              ...(serverTaskObj || {}),
              _id: t._id,
              id: t.id,
              timerRunning: true,
              startedAt: startMs,
              accumulatedSeconds: accumSecs,
              timerSeconds: timerSecs,
              todayWorkSeconds: todaySecs,
              activeUserId: userKey,
              status: t.status === 'incomplete' ? 'in_progress' : t.status
            };
          }
          if (t.timerRunning && (isTaskAssignedToMe(t) || String(t.activeUserId) === String(userKey))) {
            return {
              ...t,
              timerRunning: false,
              startedAt: null,
              activeUserId: null
            };
          }
          return t;
        });
        saveCollection(KEYS.TASKS, updated);
        return updated;
      });

      window.dispatchEvent(new CustomEvent('ems_task_timer_started', {
        detail: { taskId: serverTaskId, userKey, fromServerSync: true, source }
      }));

      return authoritativeSnapshot;
    } else if (timerState.status === 'PAUSED' && timerState.taskId) {
      const serverTaskId = String(timerState.taskId._id || timerState.taskId.id || timerState.taskId);
      const serverTaskObj = typeof timerState.taskId === 'object' ? timerState.taskId : null;
      const accumSecs = Number(timerState.accumulatedSeconds ?? serverTaskObj?.accumulatedSeconds ?? 0);
      const timerSecs = Number(timerState.timerSeconds ?? serverTaskObj?.timerSeconds ?? 0);
      const todaySecs = Number(timerState.todayWorkSeconds ?? serverTaskObj?.todayWorkSeconds ?? 0);

      const pausedSnapshot = {
        taskId: serverTaskId,
        taskCode: serverTaskObj?.taskCode || timerState.taskCode || '',
        title: serverTaskObj?.title || timerState.title || 'Active Task',
        projectName: serverTaskObj?.projectName || timerState.projectName || 'General Work',
        timerRunning: false,
        startedAt: null,
        accumulatedSeconds: accumSecs,
        timerSeconds: timerSecs,
        todayWorkSeconds: todaySecs,
        activeUserId: null,
        date: today,
        sessionDate: today,
        serverVersion,
        lastUpdated: now
      };
      saveActiveTimerSnapshot(pausedSnapshot);

      setTasks(prevTasks => {
        let changed = false;
        const updated = prevTasks.map(t => {
          const tId = String(t._id || t.id);
          if (tId === serverTaskId) {
            changed = true;
            return {
              ...t,
              timerRunning: false,
              startedAt: null,
              activeUserId: null,
              accumulatedSeconds: accumSecs,
              timerSeconds: timerSecs,
              todayWorkSeconds: todaySecs
            };
          }
          if (t.timerRunning && (isTaskAssignedToMe(t) || String(t.activeUserId) === String(userKey))) {
            changed = true;
            return {
              ...t,
              timerRunning: false,
              startedAt: null,
              activeUserId: null
            };
          }
          return t;
        });
        if (changed) {
          saveCollection(KEYS.TASKS, updated);
        }
        return updated;
      });

      window.dispatchEvent(new CustomEvent('ems_task_timer_paused', {
        detail: { taskId: serverTaskId, userKey, fromServerSync: true, source }
      }));

      return pausedSnapshot;
    } else {
      // IDLE or Stopped: strictly clear active timer snapshot
      saveActiveTimerSnapshot(null);

      setTasks(prevTasks => {
        let changed = false;
        const updated = prevTasks.map(t => {
          if (t.timerRunning && (isTaskAssignedToMe(t) || String(t.activeUserId) === String(userKey))) {
            changed = true;
            return {
              ...t,
              timerRunning: false,
              startedAt: null,
              activeUserId: null
            };
          }
          return t;
        });
        if (changed) {
          saveCollection(KEYS.TASKS, updated);
        }
        return updated;
      });

      window.dispatchEvent(new CustomEvent('ems_task_timer_stopped', {
        detail: { userKey, fromServerSync: true, source }
      }));

      return null;
    }
  }, [currentUser, userKey, saveActiveTimerSnapshot, isTaskAssignedToMe]);

  // Canonical Single Source of Truth: Sync timer state directly from MongoDB ActiveTaskTimer
  const syncAuthoritativeTimerState = useCallback(async ({ force = false, source = 'manual' } = {}) => {
    if (!currentUser) return null;
    const reqId = ++inFlightRequestIdRef.current;
    try {
      const activeSessionData = await workService.getActiveWorkSession();
      // Out-of-order response guard: discard if a newer request was dispatched while this was in-flight
      if (reqId < inFlightRequestIdRef.current) {
        return null;
      }

      if (!activeSessionData || !activeSessionData.success || !activeSessionData.data) {
        return null;
      }

      return reconcileAuthoritativeTimer(activeSessionData.data, { source, force });
    } catch (err) {
      console.warn('[WorkContext] Error during syncAuthoritativeTimerState:', err);
      return null;
    }
  }, [currentUser, reconcileAuthoritativeTimer]);

  // Account switch isolation: reset monotonic version ref, request ID ref, in-flight action ref, clear previous active timer snapshot, and sync state for the new user
  useEffect(() => {
    latestServerVersionRef.current = 0;
    inFlightRequestIdRef.current = 0;
    isTimerActionInFlightRef.current = false;
    saveActiveTimerSnapshot(null);
    if (userKey) {
      syncAuthoritativeTimerState({ force: true, source: 'account_switch' });
    }
  }, [userKey, saveActiveTimerSnapshot, syncAuthoritativeTimerState]);

  // Active filter states
  const [projectFilter, setProjectFilter] = useState({ status: 'all', category: 'all', department: 'all', search: '' });
  const [taskFilter, setTaskFilter] = useState({ projectId: 'all', status: 'all', priority: 'all', assignedTo: 'all', hideCompleted: false, search: '' });
  const [timesheetFilter, setTimesheetFilter] = useState({ employeeId: 'all', projectId: 'all', taskId: 'all', date: '', status: 'all', search: '' });

  // Load all Work module data and merge active persistent timer
  const loadWorkData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      if (!isSilent) setLoading(true);
      const [prjs, rawTsks, times, activeTimerRes] = await Promise.all([
        workService.getProjects(projectFilter),
        workService.getTasks(taskFilter),
        workService.getTimesheets(timesheetFilter),
        workService.getActiveWorkSession()
      ]);

      const authoritativeTimer = (activeTimerRes && activeTimerRes.success && activeTimerRes.data)
        ? activeTimerRes.data
        : null;
      const isServerRunning = authoritativeTimer?.status === 'RUNNING';
      const serverRunningTaskId = isServerRunning && authoritativeTimer.taskId
        ? String(authoritativeTimer.taskId._id || authoritativeTimer.taskId.id || authoritativeTimer.taskId)
        : null;
      const serverRunningStartMs = isServerRunning && authoritativeTimer.startedAt
        ? new Date(authoritativeTimer.startedAt).getTime()
        : null;

      const activeTimer = getActiveTimerSnapshot();
      const localTasks = getCollection(KEYS.TASKS) || [];
      const today = getTodayStr();

      // Synchronize local snapshot with server active state if response received
      if (authoritativeTimer) {
        reconcileAuthoritativeTimer(authoritativeTimer, { source: 'loadWorkData' });
      }

      // Unified map to ensure no tasks created or updated locally are ever dropped on reload
      const taskMap = new Map();

      const isLegacyTask = (t) => {
        if (!t) return true;
        const code = (t.taskCode || '').toUpperCase().trim();
        if (code === 'CPC-0' || t._id === 'tsk_003' || code.startsWith('MOCK')) return true;
        return false;
      };

      // Authoritative task list from backend MongoDB Atlas
      const localMap = new Map();
      localTasks.forEach(lt => {
        const id = String(lt._id || lt.id);
        if (id && !isLegacyTask(lt)) localMap.set(id, lt);
      });

      // 1. Map backend tasks with live timer overlay (strictly honors completions across all devices)
      (rawTsks || []).forEach(bt => {
        const id = String(bt._id || bt.id);
        if (id && !isLegacyTask(bt)) {
          const codeKey = bt.taskCode && bt.taskCode.trim() ? `code_${bt.taskCode.trim().toLowerCase()}` : null;
          const existing = localMap.get(id) || (codeKey ? localMap.get(codeKey) : null);
          const isBackendCompleted = bt.status === 'completed' || !!bt.completedAt;
          const isLocalCompleted = existing && (existing.status === 'completed' || !!existing.completedAt);
          const finalCompleted = isBackendCompleted || isLocalCompleted;

          if (existing) {
            const localSecs = Number(existing.timerSeconds) || 0;
            const backendSecs = Number(bt.timerSeconds) || 0;
            const localAccum = Number(existing.accumulatedSeconds) || 0;
            const backendAccum = Number(bt.accumulatedSeconds) || 0;

            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const todayMidnightMs = todayMidnight.getTime();
            const isStartedToday = bt.startedAt && Number(bt.startedAt) >= todayMidnightMs;
            const isBackendActive = Boolean(bt.timerRunning && isStartedToday);
            const isLocalActive = Boolean(existing.timerRunning || (activeTimer && String(activeTimer.taskId) === id && activeTimer.timerRunning));
            const isExplicitlyPausedLocally = Boolean(
              (activeTimer && String(activeTimer.taskId) === id && activeTimer.timerRunning === false && Number(activeTimer.lastUpdated || 0) >= Number(bt.startedAt || 0)) ||
              (existing && existing.timerRunning === false && Number(existing.lastUpdated || 0) >= Number(bt.startedAt || 0))
            );

            // Completed tasks can NEVER run
            // Single Source of Truth: When server authoritative timer is available, server determines running state
            let effectiveRunning = false;
            let effectiveStartedAt = null;
            if (!finalCompleted) {
              if (authoritativeTimer) {
                if (isServerRunning && serverRunningTaskId === id) {
                  effectiveRunning = true;
                  effectiveStartedAt = serverRunningStartMs || bt.startedAt || Date.now();
                } else {
                  effectiveRunning = false;
                  effectiveStartedAt = null;
                }
              } else {
                // Offline fallback
                if (isExplicitlyPausedLocally) {
                  effectiveRunning = false;
                  effectiveStartedAt = null;
                } else if (isLocalActive) {
                  effectiveRunning = true;
                  effectiveStartedAt = existing.startedAt || activeTimer?.startedAt || Date.now();
                } else if (isBackendActive && !isExplicitlyPausedLocally) {
                  effectiveRunning = true;
                  effectiveStartedAt = bt.startedAt;
                }
              }
            }

            if (finalCompleted && activeTimer && (String(activeTimer.taskId) === id || activeTimer.taskCode === bt.taskCode)) {
              saveActiveTimerSnapshot(null);
            }

            const mergedDailySessions = {
              ...(existing.dailySessions && typeof existing.dailySessions === 'object' ? existing.dailySessions : {}),
              ...(bt.dailySessions && typeof bt.dailySessions === 'object' ? bt.dailySessions : {})
            };
            const resolvedSessionDate = (bt.sessionDate === today || existing.sessionDate === today) ? today : (bt.sessionDate || existing.sessionDate || today);
            const activeToday = (activeTimer && (String(activeTimer.taskId) === id || activeTimer.taskCode === bt.taskCode) && (!activeTimer.date || activeTimer.date === today) && activeTimer.sessionDate === today)
              ? Math.max(0, Number(activeTimer.todayWorkSeconds || 0))
              : 0;
            const isExistingFromToday = existing && existing.sessionDate === today && Number(existing.todayWorkSeconds || 0) > 0;
            const isBackendFromToday = bt && bt.sessionDate === today && Number(bt.todayWorkSeconds || 0) > 0;
            // Strict Single Source of Truth: When connected to authoritative server, server values govern
            const resolvedTodaySecs = authoritativeTimer
              ? (isBackendFromToday ? Number(bt.todayWorkSeconds || 0) : Number(bt.dailySessions?.[today] || 0))
              : Math.max(
                  (isBackendFromToday ? Number(bt.todayWorkSeconds || 0) : 0),
                  Number(bt.dailySessions?.[today] || 0),
                  (isExistingFromToday ? Number(existing.todayWorkSeconds || 0) : 0),
                  Number(existing?.dailySessions?.[today] || 0),
                  activeToday
                );
            if (resolvedTodaySecs > 0) {
              mergedDailySessions[today] = Math.max(Number(mergedDailySessions[today] || 0), resolvedTodaySecs);
            } else if (mergedDailySessions[today] !== undefined && resolvedTodaySecs === 0) {
              delete mergedDailySessions[today];
            }

            const resolvedAccumSecs = authoritativeTimer
              ? Number(bt.accumulatedSeconds || resolvedTodaySecs || 0)
              : (Number(bt.accumulatedSeconds || 0) > 0 ? Number(bt.accumulatedSeconds) : Math.max(localAccum, backendAccum, resolvedTodaySecs));

            taskMap.set(id, {
              ...existing,
              ...bt,
              dailySessions: mergedDailySessions,
              sessionDate: resolvedSessionDate,
              todayWorkSeconds: resolvedTodaySecs,
              timerRunning: effectiveRunning,
              startedAt: effectiveStartedAt,
              timerSeconds: (resolvedSessionDate === today) ? resolvedTodaySecs : 0,
              accumulatedSeconds: resolvedAccumSecs,
              status: finalCompleted ? 'completed' : (bt.status || existing.status),
              completedAt: bt.completedAt || existing.completedAt || (finalCompleted ? new Date().toISOString() : null),
              completedOn: bt.completedOn || existing.completedOn || (finalCompleted ? today : null)
            });
          } else {
            const activeToday = (activeTimer && (String(activeTimer.taskId) === id || activeTimer.taskCode === bt.taskCode) && (!activeTimer.date || activeTimer.date === today) && activeTimer.sessionDate === today)
              ? Math.max(0, Number(activeTimer.todayWorkSeconds || 0))
              : 0;
            const isBackendFromToday = bt && bt.sessionDate === today && Number(bt.todayWorkSeconds || 0) > 0;
            const resolvedTodaySecs = authoritativeTimer
              ? (isBackendFromToday ? Number(bt.todayWorkSeconds || 0) : Number(bt.dailySessions?.[today] || 0))
              : Math.max(
                  (isBackendFromToday ? Number(bt.todayWorkSeconds || 0) : 0),
                  Number(bt.dailySessions?.[today] || 0),
                  activeToday
                );
            const mergedDailySessions = {
              ...(bt.dailySessions && typeof bt.dailySessions === 'object' ? bt.dailySessions : {})
            };
            if (resolvedTodaySecs > 0) {
              mergedDailySessions[today] = Math.max(Number(mergedDailySessions[today] || 0), resolvedTodaySecs);
            } else if (mergedDailySessions[today] !== undefined && resolvedTodaySecs === 0) {
              delete mergedDailySessions[today];
            }

            const effectiveRunningNew = !finalCompleted && (authoritativeTimer ? (isServerRunning && serverRunningTaskId === id) : Boolean(bt.timerRunning));
            const effectiveStartedNew = effectiveRunningNew ? (serverRunningStartMs || bt.startedAt || Date.now()) : null;

            taskMap.set(id, {
              ...bt,
              dailySessions: mergedDailySessions,
              sessionDate: bt.sessionDate || today,
              todayWorkSeconds: resolvedTodaySecs,
              timerRunning: effectiveRunningNew,
              startedAt: effectiveStartedNew,
              timerSeconds: (bt.sessionDate === today) ? resolvedTodaySecs : 0,
              accumulatedSeconds: authoritativeTimer ? Number(bt.accumulatedSeconds || resolvedTodaySecs || 0) : Math.max(Number(bt.accumulatedSeconds || 0), resolvedTodaySecs),
              status: finalCompleted ? 'completed' : bt.status
            });
          }
        }
      });

      // 2. Preserve any pending local-only offline tasks (tsk_ prefix) not yet synced
      const remoteIds = new Set((rawTsks || []).map(r => String(r._id || r.id)));
      const remoteCodes = new Set((rawTsks || []).map(r => (r.taskCode || '').toLowerCase()).filter(Boolean));
      localTasks.forEach(lt => {
        const id = String(lt._id || lt.id);
        const code = (lt.taskCode || '').toLowerCase();
        const alreadyHasCode = code && remoteCodes.has(code);
        const alreadyHasSameTitleAndProject = (rawTsks || []).some(rt =>
          rt.title && lt.title && rt.title.trim().toLowerCase() === lt.title.trim().toLowerCase() &&
          String(rt.projectId || rt.project || '') === String(lt.projectId || lt.project || '')
        );
        if (id.startsWith('tsk_') && !remoteIds.has(id) && !alreadyHasCode && !alreadyHasSameTitleAndProject && !isLegacyTask(lt)) {
          taskMap.set(id, { ...lt });
        }
      });

      // Background-sync offline tasks to Atlas if backend is accessible
      if (Array.isArray(rawTsks) && rawTsks.length > 0) {
        localTasks.forEach(lt => {
          const id = String(lt._id || lt.id);
          if (id.startsWith('tsk_') && !remoteIds.has(id) && !isLegacyTask(lt)) {
            workService.createTask(lt).then(created => {
              if (created && created._id && created._id !== id) {
                const cur = getCollection(KEYS.TASKS) || [];
                const swapped = cur.map(t => (t._id === id || t.id === id ? { ...t, ...created, _id: created._id, id: created._id } : t));
                saveCollection(KEYS.TASKS, swapped);
                window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
              }
            }).catch(() => {});
          }
        });
      }

      // 3. Apply active timer state if running (strictly 1 active running task per user)
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayMidnightMs = todayMidnight.getTime();

      const mergedList = Array.from(taskMap.values()).map(t => {
        const today = getTodayStr();
        const tId = String(t._id || t.id);
        const isCompleted = t.status === 'completed' || !!t.completedAt;

        // Completed tasks MUST NEVER have a running timer
        if (isCompleted) {
          const staticSecs = Number(t.timerSeconds) || Number(t.durationSeconds) || 0;
          return {
            ...t,
            timerRunning: false,
            startedAt: null,
            timerSeconds: staticSecs,
            accumulatedSeconds: staticSecs,
            liveDurationText: formatSeconds(staticSecs),
            hoursLoggedText: t.hoursLogged ? `${t.hoursLogged}h` : (t.hoursLoggedText || formatSeconds(staticSecs))
          };
        }

        const isAssignedToMe = isTaskAssignedToMe(t);
        const isTaskIdMatch = activeTimer && (
          String(activeTimer.taskId) === tId ||
          String(activeTimer._id) === tId ||
          (activeTimer.taskCode && t.taskCode && String(activeTimer.taskCode).trim().toLowerCase() === String(t.taskCode).trim().toLowerCase())
        );
        const isActive = Boolean(activeTimer && activeTimer.timerRunning && isTaskIdMatch);
        const startTs = Number(t.startedAt) || (typeof t.startedAt === 'string' ? (isNaN(Number(t.startedAt)) ? new Date(t.startedAt).getTime() : Number(t.startedAt)) : 0);
        const isStartedToday = startTs > 0 && startTs >= todayMidnightMs && startTs <= Date.now();
        const isMyRemoteTask = isTaskActiveForUser(t, currentUser);
        const isRemoteActive = Boolean(t.timerRunning && isMyRemoteTask && (isStartedToday || (!t.sessionDate || t.sessionDate === today)));

        // For current user: ONLY the single active task timer is running!
        let isRunning = false;
        if (isAssignedToMe) {
          // If local snapshot explicitly matches this task and is paused, respect local pause!
          const isExplicitlyPausedLocally = Boolean(
            isTaskIdMatch && activeTimer && activeTimer.timerRunning === false &&
            (!activeTimer.date || activeTimer.date === today) &&
            Number(activeTimer.lastUpdated || 0) >= Number(startTs || 0)
          );
          if (isExplicitlyPausedLocally) {
            isRunning = false;
          } else if (isActive) {
            isRunning = true;
          } else if (isRemoteActive && (!activeTimer || !activeTimer.timerRunning || Number(startTs || 0) > Number(activeTimer.lastUpdated || 0))) {
            // Hydrate from remote Atlas across devices
            isRunning = true;
            const restoredTimer = {
              taskId: t._id,
              taskCode: t.taskCode,
              title: t.title,
              projectName: t.projectName,
              assignedToId: t.assignedToId || userKey,
              assignedToName: t.assignedToName || currentUser?.name,
              timerRunning: true,
              startedAt: isStartedToday ? startTs : Date.now(),
              accumulatedSeconds: Number(t.accumulatedSeconds || t.timerSeconds || 0),
              timerSeconds: Number(t.todayWorkSeconds !== undefined ? t.todayWorkSeconds : (t.dailySessions?.[today] || 0)),
              todayWorkSeconds: Number(t.todayWorkSeconds !== undefined ? t.todayWorkSeconds : (t.dailySessions?.[today] || 0)),
              dailySessions: t.dailySessions || {},
              date: today,
              sessionDate: today
            };
            saveActiveTimerSnapshot(restoredTimer);
          } else {
            isRunning = false;
          }
        } else {
          isRunning = Boolean(t.timerRunning && isStartedToday);
        }

        if (isRunning) {
          const startedAtTs = (isActive && activeTimer.startedAt) ? Number(activeTimer.startedAt) : (Number(t.startedAt) || 0);
          const elapsed = (startedAtTs >= todayMidnightMs && startedAtTs <= Date.now())
            ? Math.floor((Date.now() - startedAtTs) / 1000)
            : 0;

          // Determine today's baseline (frozen before this active running stretch began)
          let todayBaseSecs = 0;
          if (isActive && activeTimer.todayBaseSecs !== undefined && (!activeTimer.date || activeTimer.date === today)) {
            todayBaseSecs = Math.max(0, Number(activeTimer.todayBaseSecs) || 0);
          } else if (t.dailySessions && typeof t.dailySessions === 'object' && t.dailySessions[today] !== undefined) {
            todayBaseSecs = Math.max(0, Number(t.dailySessions[today]) || 0);
          } else if (t.sessionDate === today && !t.timerRunning) {
            todayBaseSecs = Math.max(0, Number(t.todayWorkSeconds || t.todayBaseSecs || 0));
          }

          const maxPhysicalToday = Math.max(0, Math.floor((Date.now() - todayMidnightMs) / 1000));
          const todaySecs = Math.min(todayBaseSecs + elapsed, maxPhysicalToday);

          // Lifetime accumulated seconds across all days (strictly prior days + today)
          let priorDaysSum = 0;
          if (t.dailySessions && typeof t.dailySessions === 'object') {
            for (const [d, val] of Object.entries(t.dailySessions)) {
              if (d < today) priorDaysSum += Math.max(0, Number(val) || 0);
            }
          }
          if (priorDaysSum === 0 && Number(t.accumulatedSeconds || 0) > todayBaseSecs && (!t.timerRunning || !t.startedAt)) {
            priorDaysSum = Math.max(0, Number(t.accumulatedSeconds || 0) - todayBaseSecs);
          }
          const currentSecs = priorDaysSum + todaySecs;

          return {
            ...t,
            timerRunning: true,
            timerSeconds: todaySecs,
            todayWorkSeconds: todaySecs,
            todayBaseSecs: todayBaseSecs,
            accumulatedSeconds: currentSecs,
            startedAt: startedAtTs,
            sessionDate: today,
            dailySessions: { ...(t.dailySessions || {}), [today]: todayBaseSecs },
            liveDurationText: formatSeconds(todaySecs),
            hoursLoggedText: t.hoursLogged ? `${t.hoursLogged}h` : formatSeconds(currentSecs)
          };
        }

        const activeSecs = (isActive && (!activeTimer.date || activeTimer.date === today) && activeTimer.sessionDate === today)
          ? Number(activeTimer.todayWorkSeconds || 0)
          : 0;

        let todayStaticSecs = 0;
        if (t.dailySessions && typeof t.dailySessions === 'object' && t.dailySessions[today] !== undefined) {
          todayStaticSecs = Math.max(activeSecs, Number(t.dailySessions[today]) || 0);
        } else if (t.sessionDate === today) {
          todayStaticSecs = Math.max(activeSecs, Number(t.todayWorkSeconds) || 0);
        } else {
          todayStaticSecs = 0;
        }

        let staticPriorDaysSum = 0;
        if (t.dailySessions && typeof t.dailySessions === 'object') {
          for (const [d, val] of Object.entries(t.dailySessions)) {
            if (d < today) staticPriorDaysSum += Math.max(0, Number(val) || 0);
          }
        }
        const staticTotalSecs = Math.max(
          staticPriorDaysSum + todayStaticSecs,
          (t.accumulatedSeconds !== undefined && t.accumulatedSeconds !== null) ? Number(t.accumulatedSeconds) : todayStaticSecs,
          todayStaticSecs
        );

        return {
          ...t,
          timerRunning: false,
          startedAt: null,
          timerSeconds: todayStaticSecs,
          todayWorkSeconds: todayStaticSecs,
          todayBaseSecs: todayStaticSecs,
          accumulatedSeconds: staticTotalSecs,
          sessionDate: (t.sessionDate === today || todayStaticSecs > 0) ? today : t.sessionDate,
          liveDurationText: formatSeconds(todayStaticSecs),
          hoursLoggedText: t.hoursLogged ? `${t.hoursLogged}h` : (t.hoursLoggedText || formatSeconds(staticTotalSecs))
        };
      });

      // 4. Strict Deduplication: ensure each task appears strictly ONCE by taskCode or ID
      const finalTasksMap = new Map();
      mergedList.forEach(t => {
        const canonicalKey = (t.taskCode && t.taskCode.trim())
          ? `code_${t.taskCode.trim().toLowerCase()}`
          : `id_${t._id || t.id}`;
        if (!finalTasksMap.has(canonicalKey)) {
          finalTasksMap.set(canonicalKey, t);
        } else {
          const existing = finalTasksMap.get(canonicalKey);
          // Prefer MongoDB ObjectId over local tsk_ stub
          const isExistingStub = String(existing._id || '').startsWith('tsk_');
          const isCurrentStub = String(t._id || '').startsWith('tsk_');
          const base = (!isCurrentStub && isExistingStub) ? t : existing;
          const other = (!isCurrentStub && isExistingStub) ? existing : t;
          const resolvedTimerRunning = Boolean(existing.timerRunning || t.timerRunning);
          finalTasksMap.set(canonicalKey, {
            ...other,
            ...base,
            timerRunning: resolvedTimerRunning,
            startedAt: resolvedTimerRunning ? (existing.startedAt || t.startedAt) : null,
            timerSeconds: Math.max(Number(existing.timerSeconds) || 0, Number(t.timerSeconds) || 0),
            todayWorkSeconds: Math.max(Number(existing.todayWorkSeconds || existing.timerSeconds || 0), Number(t.todayWorkSeconds || t.timerSeconds || 0)),
            accumulatedSeconds: Math.max(Number(existing.accumulatedSeconds) || 0, Number(t.accumulatedSeconds) || 0)
          });
        }
      });
      const cleanMergedTasks = Array.from(finalTasksMap.values()).map(sanitizeTaskDailySessions);

      // Keep localStorage synchronized so tasks survive refreshes silently without recursive loop
      localStorage.setItem(KEYS.TASKS, JSON.stringify(cleanMergedTasks));

      // Synchronize running task timer across devices / laptops
      const remoteRunningTask = cleanMergedTasks.find(t => isTaskActiveForUser(t, currentUser));
      const curSnapshot = getActiveTimerSnapshot();

      if (remoteRunningTask) {
        const rTaskId = String(remoteRunningTask._id || remoteRunningTask.id);
        const isLocallyPausedSnapshot = Boolean(
          curSnapshot &&
          (String(curSnapshot.taskId) === rTaskId || curSnapshot.taskCode === remoteRunningTask.taskCode) &&
          curSnapshot.timerRunning === false &&
          Number(curSnapshot.lastUpdated || 0) >= Number(remoteRunningTask.startedAt || 0)
        );
        if (!isLocallyPausedSnapshot && (!curSnapshot || String(curSnapshot.taskId) !== rTaskId || !curSnapshot.timerRunning)) {
          saveActiveTimerSnapshot({
            taskId: remoteRunningTask._id || remoteRunningTask.id,
            taskCode: remoteRunningTask.taskCode || 'TSK',
            title: remoteRunningTask.title,
            projectName: remoteRunningTask.projectName || 'General Work',
            assignedToId: userKey,
            assignedToName: remoteRunningTask.assignedToName || currentUser?.name || 'User',
            timerRunning: true,
            startedAt: remoteRunningTask.startedAt || Date.now(),
            accumulatedSeconds: remoteRunningTask.accumulatedSeconds !== undefined ? Number(remoteRunningTask.accumulatedSeconds) : (Number(remoteRunningTask.timerSeconds) || 0),
            todayWorkSeconds: Number(remoteRunningTask.todayWorkSeconds || 0),
            dailySessions: remoteRunningTask.dailySessions || {},
            sessionDate: remoteRunningTask.sessionDate || today,
            date: today,
            lastUpdated: Date.now()
          });
        }
      } else if (curSnapshot?.timerRunning) {
        const matchTask = cleanMergedTasks.find(t =>
          String(t._id || t.id) === String(curSnapshot.taskId) ||
          (curSnapshot.taskCode && t.taskCode && String(curSnapshot.taskCode).trim().toLowerCase() === String(t.taskCode).trim().toLowerCase())
        );
        if (matchTask && (!matchTask.timerRunning || matchTask.status === 'completed' || matchTask.completedAt)) {
          saveActiveTimerSnapshot({
            ...curSnapshot,
            timerRunning: false,
            startedAt: null,
            accumulatedSeconds: matchTask.accumulatedSeconds !== undefined ? Number(matchTask.accumulatedSeconds) : Number(matchTask.timerSeconds),
            timerSeconds: Number(matchTask.todayWorkSeconds !== undefined ? matchTask.todayWorkSeconds : (matchTask.dailySessions?.[today] || 0)),
            todayWorkSeconds: Number(matchTask.todayWorkSeconds !== undefined ? matchTask.todayWorkSeconds : (matchTask.dailySessions?.[today] || 0))
          });
        }
      }

      setProjects(prjs || []);
      setTasks(prevTasks => {
        // Monotonic Shield: if a task is currently ticking in memory, do not let server response downgrade its seconds!
        return cleanMergedTasks.map(ct => {
          const prevMatch = (prevTasks || []).find(pt => String(pt._id || pt.id) === String(ct._id || ct.id));
          if (prevMatch && prevMatch.timerRunning && ct.timerRunning) {
            const maxSecs = Math.max(Number(prevMatch.timerSeconds) || 0, Number(ct.timerSeconds) || 0);
            return {
              ...ct,
              timerSeconds: maxSecs,
              liveDurationText: formatSeconds(maxSecs),
              hoursLoggedText: formatSeconds(maxSecs)
            };
          }
          return ct;
        });
      });
      setTimesheets(times || []);
      if (Array.isArray(times) && times.length > 0) {
        localStorage.setItem(KEYS.TIMESHEETS, JSON.stringify(times));
      }
    } catch (err) {
      console.error('Error loading Work module data:', err);
      if (!isSilent) addToast('Failed to sync Work module data', 'error');
    } finally {
      isFetchingRef.current = false;
      if (!isSilent) setLoading(false);
    }
  }, [projectFilter, taskFilter, timesheetFilter, getActiveTimerSnapshot, getElapsedSeconds, formatSeconds, addToast, isTaskAssignedToMe, isTaskActiveForUser, saveActiveTimerSnapshot, userKey, currentUser]);

  // Derived reactive active running task strictly scoped to current logged-in user
  const activeRunningTask = useMemo(() => {
    if (!currentUser) return null;
    const cachedTelem = (() => {
      try {
        const raw = localStorage.getItem('ems_last_telemetry');
        if (!raw) return null;
        const map = JSON.parse(raw);
        const keys = [userKey, currentUser?._id, currentUser?.employeeCode, currentUser?.email].filter(Boolean);
        for (const k of keys) {
          const r = map[String(k)] || map[String(k).toUpperCase()] || map[String(k).toLowerCase()];
          if (r) return r;
        }
      } catch (_) {}
      return null;
    })();

    const isShiftClockedIn = Boolean(
      cachedTelem?.isClockedIn ||
      readTimerStorage(currentUser, 'is_clocked_in') === 'true' ||
      readTimerStorage(currentUser, 'is_clocked_in') === true ||
      (userKey && localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`) === 'true') ||
      (currentUser?.employeeCode && localStorage.getItem(`ems_timer_${currentUser.employeeCode}_is_clocked_in`) === 'true')
    );
    if (!isShiftClockedIn) return null;

    return tasks.find(t => isTaskActiveForUser(t, currentUser)) || null;
  }, [tasks, currentUser, isTaskActiveForUser, userKey]);

  useEffect(() => {
    loadWorkData(false);

    const scheduleDebouncedLoad = (silent = true) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        loadWorkData(silent);
      }, 80);
    };

    const handleStorageUpdate = (e) => {
      const changedKey = e?.key || e?.detail?.key;
      // 🚀 0ms Synchronous local tasks injection
      if (!changedKey || changedKey === KEYS.TASKS) {
        try {
          const localTasks = getCollection(KEYS.TASKS);
          if (Array.isArray(localTasks) && localTasks.length > 0) {
            setTasks(localTasks);
          }
        } catch (_) {}
      }
      if (
        !changedKey ||
        ['ems_projects', 'ems_tasks', 'ems_timesheets', activeTimerKey, 'ems_active_task_timer'].includes(changedKey) ||
        changedKey.startsWith('ems_active_task_timer') ||
        changedKey.startsWith('ems_timer_')
      ) {
        scheduleDebouncedLoad(true);
      }
    };
    window.addEventListener('hrms_storage_change', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    // Cross-tab & cross-device real-time event subscription for 0ms latency sync
    const unsubscribeSync = subscribeToSyncEvents((ev) => {
      if ([
        SYNC_EVENTS.TASK_TIMER_STARTED,
        SYNC_EVENTS.TASK_TIMER_PAUSED,
        SYNC_EVENTS.TASK_TIMER_STOPPED,
        SYNC_EVENTS.TASK_COMPLETED,
        SYNC_EVENTS.TIMER_OUTBOX_EVENT,
        SYNC_EVENTS.ATTENDANCE_STATE_UPDATED,
        SYNC_EVENTS.SHIFT_CLOCKED_OUT,
        SYNC_EVENTS.SHIFT_BREAK_STARTED,
        SYNC_EVENTS.STORAGE_MUTATION
      ].includes(ev.type)) {
        if (ev.payload?.activeTask || ev.payload?.timerState) {
          reconcileAuthoritativeTimer(ev.payload.activeTask || ev.payload.timerState, { source: ev.type });
        } else {
          syncAuthoritativeTimerState({ force: false, source: ev.type });
        }
        scheduleDebouncedLoad(true);
      }
    });

    // Periodic synchronization from DB + tab focus across devices / laptops
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncAuthoritativeTimerState({ source: 'poll' });
        scheduleDebouncedLoad(true);
      }
    }, 20000);

    const handleFocus = () => {
      syncAuthoritativeTimerState({ force: false, source: 'focus' });
      scheduleDebouncedLoad(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAuthoritativeTimerState({ force: false, source: 'visibility' });
        scheduleDebouncedLoad(true);
      }
    };
    const handleSocketStatus = (e) => {
      if (e?.detail?.connected) {
        syncAuthoritativeTimerState({ force: false, source: 'socket_connect' });
        scheduleDebouncedLoad(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('ems_socket_status', handleSocketStatus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('ems_socket_status', handleSocketStatus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('hrms_storage_change', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
      unsubscribeSync();
    };
  }, [loadWorkData, syncAuthoritativeTimerState, activeTimerKey]);

  // Persistent offline action queue listener (scoped to current authenticated user)
  useEffect(() => {
    const currentUid = currentUser?._id || currentUser?.id || currentUser?.employeeCode || null;
    const cleanupOfflineSync = initTimerOfflineSync(workService, currentUid);
    return () => {
      cleanupOfflineSync();
    };
  }, [currentUser]);

  // =========================================================================
  // ⏱️ WALL-CLOCK LIVE TICKING TASK TIMER ENGINE (Refresh & Tab-switch Immune)
  // =========================================================================
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const activeTimer = getActiveTimerSnapshot();

      const isShiftOnBreak = readTimerStorage(currentUser, 'is_on_break') === 'true' ||
        readTimerStorage(currentUser, 'is_on_break') === true;

      let isShiftClockedIn = Boolean(
        readTimerStorage(currentUser, 'is_clocked_in') === 'true' ||
        readTimerStorage(currentUser, 'is_clocked_in') === true ||
        (userKey && localStorage.getItem(`ems_timer_${userKey}_is_clocked_in`) === 'true') ||
        (currentUser?.employeeCode && localStorage.getItem(`ems_timer_${currentUser.employeeCode}_is_clocked_in`) === 'true')
      );

      const cachedTelem = (() => {
        try {
          const raw = localStorage.getItem('ems_last_telemetry');
          if (!raw) return null;
          const map = JSON.parse(raw);
          const keys = [userKey, currentUser?._id, currentUser?.employeeCode, currentUser?.email].filter(Boolean);
          for (const k of keys) {
            const r = map[String(k)] || map[String(k).toUpperCase()] || map[String(k).toLowerCase()];
            if (r) return r;
          }
        } catch (_) {}
        return null;
      })();

      if (!isShiftClockedIn && cachedTelem?.isClockedIn) {
        isShiftClockedIn = true;
      }

      if (!isShiftClockedIn) {
        try {
          const attRaw = localStorage.getItem('hrms_attendance');
          if (attRaw) {
            const list = JSON.parse(attRaw) || [];
            const today = getTodayStr();
            const rec = list.find(a => a.date === today && (
              String(a.employeeId) === String(userKey) ||
              String(a.employee) === String(userKey) ||
              (currentUser?.employeeCode && String(a.employeeCode) === String(currentUser.employeeCode)) ||
              (currentUser?._id && String(a.employeeId) === String(currentUser._id))
            ));
            if (rec && (rec.clockInTime || rec.clockIn) && !rec.clockOutTime && rec.isClockedIn !== false) {
              isShiftClockedIn = true;
            }
          }
        } catch (_) {}
      }

      const todayStr = getTodayStr();
      const storedSessionDate = readTimerStorage(currentUser, 'work_session_date');
      const isTodaySession = storedSessionDate === todayStr;
      const hasExplicitClockOut = !cachedTelem?.isClockedIn && Boolean(
        isTodaySession && (
          readTimerStorage(currentUser, 'had_clocked_out') === 'true' ||
          readTimerStorage(currentUser, 'had_clocked_out') === true ||
          readTimerStorage(currentUser, 'clockout_time') ||
          readTimerStorage(currentUser, 'clock_out')
        )
      );

      // Auto-pause task timer strictly when employee is on break OR explicitly clocked out today!
      // CRITICAL: NEVER auto-pause when !isShiftClockedIn is merely unhydrated on initial boot across devices!
      if ((isShiftOnBreak || hasExplicitClockOut) && activeTimer?.timerRunning) {
        syncAuthoritativeTimerState({ force: false, source: 'break_or_clockout_guard' });
        return;
      }

      setTasks((prevTasks) => {
        let changed = false;
        const now = Date.now();
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const todayMidnightMs = todayMidnight.getTime();

        const updated = prevTasks.map((t) => {
          const tId = String(t._id || t.id);
          const isCompleted = t.status === 'completed' || !!t.completedAt;

          if (isCompleted) {
            if (t.timerRunning) {
              changed = true;
              return { ...t, timerRunning: false, startedAt: null };
            }
            return t;
          }

          const isAssignedToMe = isTaskAssignedToMe(t);
          const isMyActive = activeTimer && activeTimer.timerRunning && (
            String(activeTimer.taskId) === tId ||
            String(activeTimer._id) === tId ||
            (activeTimer.taskCode && t.taskCode && String(activeTimer.taskCode).trim().toLowerCase() === String(t.taskCode).trim().toLowerCase())
          );

          const isExplicitlyStopped = isShiftOnBreak || hasExplicitClockOut;
          if (isAssignedToMe && isExplicitlyStopped && t.timerRunning && isTaskActiveForUser(t, currentUser)) {
            changed = true;
            return { ...t, timerRunning: false, startedAt: null };
          }

          const isTaskRunning = isTaskActiveForUser(t, currentUser) && !isExplicitlyStopped;

          if (isTaskRunning) {
            changed = true;
            const startTs = (isMyActive && activeTimer.startedAt) ? Number(activeTimer.startedAt) : Number(t.startedAt);
            const elapsed = (startTs >= todayMidnightMs && startTs <= now)
              ? Math.floor((now - startTs) / 1000)
              : 0;

            // Determine today's base (frozen before this active running stretch began)
            let baseToday = 0;
            if (isMyActive && activeTimer.todayBaseSecs !== undefined) {
              baseToday = Number(activeTimer.todayBaseSecs) || 0;
            } else if (t.todayBaseSecs !== undefined && t.sessionDate === todayStr) {
              baseToday = Number(t.todayBaseSecs) || 0;
            } else if (t.dailySessions && t.dailySessions[todayStr] !== undefined) {
              baseToday = Number(t.dailySessions[todayStr]) || 0;
            } else if (t.sessionDate === todayStr && !t.timerRunning) {
              baseToday = Number(t.todayWorkSeconds) || 0;
            }

            const todaySecs = Math.min(baseToday + elapsed, 24 * 3600);

            // Lifetime accumulated seconds across all days
            let priorDaysSum = 0;
            if (t.dailySessions && typeof t.dailySessions === 'object') {
              for (const [d, val] of Object.entries(t.dailySessions)) {
                if (d < todayStr) priorDaysSum += Math.max(0, Number(val) || 0);
              }
            }
            if (priorDaysSum === 0 && Number(t.accumulatedSeconds || 0) > baseToday) {
              priorDaysSum = (Number(t.accumulatedSeconds || 0)) - baseToday;
            }
            const lifetimeSecs = priorDaysSum + todaySecs;
            const todayText = formatSeconds(todaySecs);
            const lifetimeText = formatSeconds(lifetimeSecs);

            return {
              ...t,
              timerRunning: true,
              startedAt: startTs,
              accumulatedSeconds: lifetimeSecs,
              timerSeconds: todaySecs,
              todayWorkSeconds: todaySecs,
              todayBaseSecs: baseToday,
              dailySessions: { ...(t.dailySessions || {}), [todayStr]: baseToday },
              liveDurationText: todayText,
              hoursLoggedText: lifetimeText,
              sessionDate: todayStr
            };
          }
          return t;
        });

        return changed ? updated : prevTasks;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [getActiveTimerSnapshot, getElapsedSeconds, formatSeconds, userKey, saveActiveTimerSnapshot, currentUser, isTaskAssignedToMe, isTaskActiveForUser]);

  // Fast cross-device telemetry listener: immediately hydrate running task from cloud
  useEffect(() => {
    const handleShiftTelem = (e) => {
      const telemRec = e.detail?.telemRec;
      if (!telemRec?.activeTask) return;
      const at = telemRec.activeTask;
      if (at && isTaskAssignedToMe(at)) {
        reconcileAuthoritativeTimer(at, { source: 'shift_telemetry_sync' });
      }
    };
    window.addEventListener('ems_shift_telemetry_synced', handleShiftTelem);
    return () => window.removeEventListener('ems_shift_telemetry_synced', handleShiftTelem);
  }, [isTaskAssignedToMe, reconcileAuthoritativeTimer]);

  // ── Automatic Task Timer Pause & Resume on Break ──
  useEffect(() => {
    const handleBreakStarted = (e) => {
      if (!isEventForMe(e)) return; // Ignore breaks for other employees!
      syncAuthoritativeTimerState({ force: false, source: 'break_started' });
    };

    const handleBreakEnded = (e) => {
      if (!isEventForMe(e)) return; // Ignore break ends for other employees!
      syncAuthoritativeTimerState({ force: false, source: 'break_ended' });
    };

    window.addEventListener('ems_break_started', handleBreakStarted);
    window.addEventListener('ems_break_ended', handleBreakEnded);
    return () => {
      window.removeEventListener('ems_break_started', handleBreakStarted);
      window.removeEventListener('ems_break_ended', handleBreakEnded);
    };
  }, [isEventForMe, syncAuthoritativeTimerState]);

  // ── On Clock-In: Shift Clock In does NOT automatically start or resume task timer ──
  // User must explicitly click "Start" or "Resume" on a task for task time to begin ticking.
  useEffect(() => {
    const handleClockedIn = (e) => {
      if (!isEventForMe(e)) return; // Ignore clock-in for other employees!
      syncAuthoritativeTimerState({ force: false, source: 'clock_in' });
    };

    window.addEventListener('ems_clocked_in', handleClockedIn);
    window.addEventListener('ems_reclock_in', handleClockedIn);
    return () => {
      window.removeEventListener('ems_clocked_in', handleClockedIn);
      window.removeEventListener('ems_reclock_in', handleClockedIn);
    };
  }, [isEventForMe, syncAuthoritativeTimerState]);

  // ── Automatic Task Timer Pause on Clock-Out ──
  useEffect(() => {
    const handleClockedOut = (e) => {
      if (!isEventForMe(e)) return; // Ignore clock-out for other employees!
      syncAuthoritativeTimerState({ force: true, source: 'clock_out' });
      addToast('Shift Clocked Out: Active task timer paused ⏸️', 'info');
    };

    window.addEventListener('ems_clocked_out', handleClockedOut);
    window.addEventListener('ems_force_clock_out', handleClockedOut);
    window.addEventListener('ems_shift_ended', handleClockedOut);
    window.addEventListener('ems_reclock_requests_updated', handleClockedOut);
    return () => {
      window.removeEventListener('ems_clocked_out', handleClockedOut);
      window.removeEventListener('ems_force_clock_out', handleClockedOut);
      window.removeEventListener('ems_shift_ended', handleClockedOut);
      window.removeEventListener('ems_reclock_requests_updated', handleClockedOut);
    };
  }, [isEventForMe, syncAuthoritativeTimerState, addToast]);

  // ── Day Change Rollover Check (New Day fresh start, 00:00:00 reset) ──
  useEffect(() => {
    const checkDayRollover = () => {
      const today = getTodayStr();
      const storedWorkDate = localStorage.getItem(`ems_work_session_date_${userKey}`) || today;

      if (storedWorkDate !== today) {
        localStorage.setItem(`ems_work_session_date_${userKey}`, today);
        setWorkSessionDate(today);

        // Reset active timer snapshot for the new day so Day starts clean
        saveActiveTimerSnapshot(null);
        syncAuthoritativeTimerState({ force: true, source: 'day_rollover' });
      }
    };

    checkDayRollover();
    const interval = setInterval(checkDayRollover, 15000); // Check every 15s

    const handleRolloverEvent = () => checkDayRollover();
    window.addEventListener('ems_day_rollover', handleRolloverEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ems_day_rollover', handleRolloverEvent);
    };
  }, [userKey, saveActiveTimerSnapshot, syncAuthoritativeTimerState]);

  // =========================================================================
  // 🏢 PROJECT ACTIONS
  // =========================================================================
  const createProject = async (projectData) => {
    try {
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const tempId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let nextCode = projectData.projectCode;
      if (!nextCode) {
        const existingNums = allProjects.map(p => {
          const m = String(p.projectCode || '').match(/PRJ-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        });
        const maxNum = existingNums.length > 0 ? Math.max(0, ...existingNums) : 100;
        nextCode = `PRJ-${maxNum + 1}`;
      }

      const optimisticProject = {
        _id: tempId,
        id: tempId,
        projectCode: nextCode,
        name: projectData.name || projectData.title || 'New Project',
        status: projectData.status || 'in_progress',
        progress: Number(projectData.progress) || 0,
        createdAt: new Date().toISOString(),
        ...projectData
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedList = [optimisticProject, ...allProjects];
      saveCollection(KEYS.PROJECTS, updatedList);
      setProjects(updatedList);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));
      addToast(`Project "${optimisticProject.name}" created successfully!`, 'success');

      // Asynchronous background sync
      workService.createProject(projectData)
        .then(created => {
          if (created && created._id && created._id !== tempId) {
            setProjects(prev => prev.map(p => (p._id === tempId || p.id === tempId ? { ...p, ...created, _id: created._id, id: created._id } : p)));
            const cur = getCollection(KEYS.PROJECTS) || [];
            const swapped = cur.map(p => (p._id === tempId || p.id === tempId ? { ...p, ...created, _id: created._id, id: created._id } : p));
            saveCollection(KEYS.PROJECTS, swapped);
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));
          }
        })
        .catch(err => console.warn('[WorkContext] Project saved locally; cloud sync queued:', err));

      return optimisticProject;
    } catch (err) {
      addToast('Failed to create project', 'error');
      throw err;
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      // 🚀 0ms Instant Optimistic Local Update
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const updatedList = allProjects.map(p => (String(p._id || p.id) === String(id) || p.projectCode === id ? { ...p, ...projectData, updatedAt: new Date().toISOString() } : p));
      saveCollection(KEYS.PROJECTS, updatedList);
      setProjects(updatedList);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));
      addToast(`Project "${projectData.name || 'Project'}" updated`, 'success');

      // Asynchronous background sync
      workService.updateProject(id, projectData).catch(err => console.warn('[WorkContext] Sync project update to DB:', err));
      return { _id: id, ...projectData };
    } catch (err) {
      addToast('Failed to update project', 'error');
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const targetProj = (projects || []).find(p => String(p._id || p.id) === String(id) || p.projectCode === id) ||
        allProjects.find(p => String(p._id || p.id) === String(id) || p.projectCode === id);

      if (!canDeleteProject(currentUser, targetProj)) {
        addToast('⛔ Access Denied: You do not have permission to delete projects.', 'error');
        return;
      }

      // 🚀 0ms Instant Optimistic Local Removal
      const filtered = allProjects.filter(p => String(p._id || p.id) !== String(id) && p.projectCode !== id);
      saveCollection(KEYS.PROJECTS, filtered);
      setProjects(filtered);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));
      addToast('Project removed successfully', 'info');

      // Asynchronous background sync
      workService.deleteProject(id).catch(err => console.warn('[WorkContext] Sync project deletion to DB:', err));
    } catch (err) {
      addToast('Failed to delete project', 'error');
      throw err;
    }
  };

  const submitProjectForCompletion = async (id, notes = '') => {
    try {
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const targetProj = allProjects.find(p => String(p._id || p.id) === String(id) || p.projectCode === id);
      const updatePayload = {
        status: 'under_review',
        progress: 100,
        completionSubmittedBy: currentUser?.name || 'Team Member',
        completionSubmittedById: currentUser?._id,
        completionSubmittedAt: new Date().toISOString(),
        completionNotes: notes || 'Project submitted for Admin final sign-off',
        finalApproved: false,
        reopened: false
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedProjects = allProjects.map(p => (String(p._id || p.id) === String(id) || p.projectCode === id) ? { ...p, ...updatePayload } : p);
      saveCollection(KEYS.PROJECTS, updatedProjects);
      setProjects(updatedProjects);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));
      addToast(`🚀 Project "${targetProj?.name || id}" submitted for Admin completion review!`, 'success');

      // Asynchronous background persistence
      workService.updateProject(id, updatePayload)
        .catch(err => console.warn('Sync project submit to backend:', err));

      return { ...(targetProj || {}), ...updatePayload };
    } catch (err) {
      console.error('Error submitting project for completion:', err);
      addToast('Failed to submit project for completion', 'error');
      throw err;
    }
  };

  const approveProjectCompletion = async (id) => {
    try {
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const targetProj = allProjects.find(p => String(p._id || p.id) === String(id) || p.projectCode === id);
      const approverName = currentUser?.name || 'Admin';
      const updatePayload = {
        status: 'completed',
        progress: 100,
        finalApproved: true,
        finalApprovedBy: approverName,
        finalApprovedAt: new Date().toISOString(),
        reopened: false,
        reopenReason: ''
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedProjects = allProjects.map(p => (String(p._id || p.id) === String(id) || p.projectCode === id) ? { ...p, ...updatePayload } : p);
      saveCollection(KEYS.PROJECTS, updatedProjects);
      setProjects(updatedProjects);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));

      try {
        hrService.createAttendanceAuditLog({
          type: 'project_final_approved',
          action: 'project_final_approved',
          date: new Date().toISOString().split('T')[0],
          employeeId: currentUser?._id || 'admin',
          employeeName: approverName,
          note: `Project #${targetProj?.projectCode || id} "${targetProj?.name || ''}" officially finalized and approved by ${approverName}`
        });
      } catch (_) {}

      addToast(`🎉 Project "${targetProj?.name || id}" officially finalized & marked complete!`, 'success');

      // Asynchronous background persistence
      workService.updateProject(id, updatePayload)
        .catch(err => console.warn('Sync project approval to backend:', err));

      return { ...(targetProj || {}), ...updatePayload };
    } catch (err) {
      console.error('Error approving project completion:', err);
      addToast('Failed to approve project completion', 'error');
      throw err;
    }
  };

  const reopenProject = async (id, reason = 'Work incomplete / revisions required') => {
    try {
      const allProjects = getCollection(KEYS.PROJECTS) || [];
      const targetProj = allProjects.find(p => String(p._id || p.id) === String(id) || p.projectCode === id);
      const adminName = currentUser?.name || 'Admin';
      const updatePayload = {
        status: 'in_progress',
        progress: 85,
        finalApproved: false,
        reopened: true,
        reopenReason: reason || 'Reopened by Admin for required revisions',
        reopenedBy: adminName,
        reopenedAt: new Date().toISOString()
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedProjects = allProjects.map(p => (String(p._id || p.id) === String(id) || p.projectCode === id) ? { ...p, ...updatePayload } : p);
      saveCollection(KEYS.PROJECTS, updatedProjects);
      setProjects(updatedProjects);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.PROJECTS } }));

      try {
        hrService.createAttendanceAuditLog({
          type: 'project_reopened',
          action: 'project_reopened',
          date: new Date().toISOString().split('T')[0],
          employeeId: currentUser?._id || 'admin',
          employeeName: adminName,
          note: `Project #${targetProj?.projectCode || id} "${targetProj?.name || ''}" reopened by ${adminName}: ${reason}`
        });
      } catch (_) {}

      addToast(`🔄 Project "${targetProj?.name || id}" reopened for revisions!`, 'info');

      // Asynchronous background persistence
      workService.updateProject(id, updatePayload)
        .catch(err => console.warn('Sync project reopen to backend:', err));

      return { ...(targetProj || {}), ...updatePayload };
    } catch (err) {
      console.error('Error reopening project:', err);
      addToast('Failed to reopen project', 'error');
      throw err;
    }
  };

  // =========================================================================
  // 📋 TASK ACTIONS & ROBUST TIMERS
  // =========================================================================
  const createTask = async (taskData) => {
    try {
      const allTasks = getCollection(KEYS.TASKS) || [];
      const tempId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Auto-compute next sequential taskCode if not provided
      let nextCode = taskData.taskCode;
      if (!nextCode) {
        const existingNums = allTasks.map(t => {
          const m = String(t.taskCode || '').match(/TSK-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        });
        const maxNum = existingNums.length > 0 ? Math.max(0, ...existingNums) : 100;
        nextCode = `TSK-${maxNum + 1}`;
      }

      const optimisticTask = {
        _id: tempId,
        id: tempId,
        taskCode: nextCode,
        status: taskData.status || 'incomplete',
        priority: taskData.priority || 'medium',
        progress: 0,
        hoursLogged: 0,
        hoursLoggedText: '00h 00m',
        timerRunning: false,
        timerSeconds: 0,
        accumulatedSeconds: 0,
        createdAt: new Date().toISOString(),
        ...taskData
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedList = [optimisticTask, ...allTasks];
      saveCollection(KEYS.TASKS, updatedList);
      setTasks(updatedList);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      broadcastSyncEvent('TASK_CREATED', optimisticTask);

      // Asynchronous background sync to MongoDB Atlas
      workService.createTask(taskData)
        .then(created => {
          if (created && created._id && created._id !== tempId) {
            // Smart ID swap: update temporary ID in state and cache silently
            setTasks(prev => prev.map(t => (t._id === tempId || t.id === tempId ? { ...t, ...created, _id: created._id, id: created._id } : t)));
            const cur = getCollection(KEYS.TASKS) || [];
            const swapped = cur.map(t => (t._id === tempId || t.id === tempId ? { ...t, ...created, _id: created._id, id: created._id } : t));
            saveCollection(KEYS.TASKS, swapped);
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
          }
        })
        .catch(err => {
          console.warn('[WorkContext] Task saved locally; cloud sync queued:', err);
        });

      return optimisticTask;
    } catch (err) {
      addToast('Failed to create task', 'error');
      throw err;
    }
  };

  const updateTask = async (id, taskData) => {
    try {
      // 🚀 0ms Instant Optimistic Local Update
      const allTasks = getCollection(KEYS.TASKS) || [];
      let updatedTaskObj = null;
      const updatedAll = allTasks.map(t => {
        if (String(t._id || t.id) === String(id) || t.taskCode === id) {
          updatedTaskObj = { ...t, ...taskData };
          return updatedTaskObj;
        }
        return t;
      });
      saveCollection(KEYS.TASKS, updatedAll);
      setTasks(updatedAll);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      addToast(`Task "${updatedTaskObj?.title || taskData?.title || 'Task'}" updated`, 'success');

      // Asynchronous background persistence
      workService.updateTask(id, taskData)
        .catch(err => console.warn('Sync task update to backend:', err));

      return updatedTaskObj || { id, ...taskData };
    } catch (err) {
      addToast('Failed to update task', 'error');
      throw err;
    }
  };

  const changeTaskStatus = async (id, status) => {
    try {
      const allTasks = getCollection(KEYS.TASKS) || [];
      const targetTask = (tasks || []).find(t => String(t._id || t.id) === String(id)) ||
        allTasks.find(t => String(t._id || t.id) === String(id));
      if (targetTask && !canUserControlTask(targetTask)) {
        addToast('⛔ Access Denied: Only assigned team members, the task creator, or HR/Admin can update this task.', 'error');
        return;
      }

      if (status === 'completed') {
        return await completeTask(id);
      }
      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && activeTimer.taskId === id && activeTimer.timerRunning) {
        if (status === 'on_hold' || status === 'incomplete' || status === 'pending') {
          pauseTaskTimer(id);
        } else {
          stopTaskTimer(id, `Status changed to ${status}`).catch(() => {});
        }
      }

      // 🚀 0ms Instant Optimistic Local Update
      const updatedAll = allTasks.map(t => String(t._id || t.id) === String(id) ? { ...t, status } : t);
      saveCollection(KEYS.TASKS, updatedAll);
      setTasks(updatedAll);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      addToast(`Task status changed to ${status.replace('_', ' ').toUpperCase()}`, 'success');

      // Sync backend asynchronously
      workService.updateTask(id, { status }).catch(err => console.warn('Sync status to backend:', err));
    } catch (err) {
      addToast('Failed to change task status', 'error');
    }
  };

  const deleteTask = async (id) => {
    try {
      const allTasks = getCollection(KEYS.TASKS) || [];
      const targetTask = (tasks || []).find(t => String(t._id || t.id) === String(id)) ||
        allTasks.find(t => String(t._id || t.id) === String(id));

      if (!canDeleteTask(currentUser, targetTask)) {
        addToast('⛔ Access Denied: You do not have permission to delete tasks.', 'error');
        return;
      }

      const activeTimer = getActiveTimerSnapshot();
      if (activeTimer && (activeTimer.taskId === id || activeTimer._id === id)) {
        saveActiveTimerSnapshot(null);
      }

      // 🚀 0ms Instant Optimistic Delete
      const filtered = allTasks.filter(t => String(t._id || t.id) !== String(id));
      saveCollection(KEYS.TASKS, filtered);
      setTasks(filtered);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      addToast('Task deleted successfully', 'info');

      // Sync backend asynchronously
      workService.deleteTask(id).catch(err => console.warn('Sync delete to backend:', err));
    } catch (err) {
      addToast('Failed to delete task', 'error');
    }
  };

  // ── Overdue Task Detection ──
  const isTaskOverdue = useCallback((task) => {
    if (!task || !task.dueDate || task.hasNoDueDate || task.isUntimed || task.status === 'completed') return false;
    const today = getTodayStr();
    return task.dueDate < today;
  }, []);

  const rescheduleTaskForFuture = useCallback(async (taskId, newDueDate, note = '') => {
    try {
      const target = tasks.find(t => String(t._id || t.id) === String(taskId));
      if (!target) return;

      const nowIso = new Date().toISOString();
      const historyItem = {
        id: `hist_${Date.now()}_reschedule`,
        action: 'rescheduled',
        title: 'Task Assigned / Rescheduled for Future Date',
        timestamp: nowIso,
        performedBy: currentUser?.name || 'User',
        performedById: currentUser?._id,
        from: target.dueDate || 'Past / No Date',
        to: newDueDate,
        details: `Task #${target.taskCode || ''} rescheduled to future date: ${newDueDate}${note ? ` (${note})` : ''}`
      };

      const updatedHistory = [...(Array.isArray(target.history) ? target.history : []), historyItem];

      await updateTask(taskId, {
        dueDate: newDueDate,
        hasNoDueDate: false,
        isUntimed: false,
        snoozed: false,
        remindAt: null,
        reminderAlerted: false,
        history: updatedHistory,
        rescheduleNote: note
      });

      if (overdueTaskPrompt && String(overdueTaskPrompt._id || overdueTaskPrompt.id) === String(taskId)) {
        setOverdueTaskPrompt(null);
      }

      addToast(`📅 Task #${target.taskCode || ''} assigned/scheduled for ${newDueDate}!`, 'success');
      loadWorkData(true).catch(() => {});
    } catch (e) {
      console.error('Error rescheduling task:', e);
      addToast('Failed to reschedule task for future', 'error');
    }
  }, [tasks, currentUser, updateTask, overdueTaskPrompt, loadWorkData, addToast]);

  const extendTaskDeadline = useCallback(async (taskId, days = 1) => {
    try {
      const target = tasks.find(t => String(t._id || t.id) === String(taskId));
      if (!target) return;
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + days);
      const newDueDate = baseDate.toISOString().split('T')[0];

      await rescheduleTaskForFuture(taskId, newDueDate, `Extended +${days} day${days > 1 ? 's' : ''}`);
      // Auto start timer once deadline extended
      setTimeout(() => {
        startTaskTimer(taskId, { forceOverdue: true });
      }, 80);
    } catch (e) {
      addToast('Failed to extend task deadline', 'error');
    }
  }, [tasks, rescheduleTaskForFuture, addToast]);

  // ── Start / Resume Task Timer (Server-Authoritative Only) ──
  const startTaskTimer = async (taskId, options = {}) => {
    if (isTimerActionInFlightRef.current) {
      console.warn('[WorkContext] Timer action already in flight, ignoring duplicate request');
      return;
    }

    const allTasks = getCollection(KEYS.TASKS) || [];
    const targetTask = tasks.find(t => String(t._id || t.id) === String(taskId)) ||
      allTasks.find(t => String(t._id || t.id) === String(taskId));
    if (!targetTask) return;

    // Strict Permission Guard: Only authorized members can start/control this task
    if (!canUserControlTask(targetTask)) {
      addToast('⛔ Access Denied: Only assigned team members, the task creator, or HR/Admin can start this task.', 'error');
      return;
    }

    // Detect if this task is assigned to another employee
    const assignedEmpId = targetTask.assignedToId ||
      (typeof targetTask.assignedTo === 'string' ? targetTask.assignedTo : targetTask.assignedTo?._id) ||
      (Array.isArray(targetTask.assignedToIds) && targetTask.assignedToIds[0]) ||
      (Array.isArray(targetTask.assignees) && (targetTask.assignees[0]?._id || targetTask.assignees[0]?.employeeCode)) ||
      userKey;
    const assignedEmpName = targetTask.assignedToName ||
      (Array.isArray(targetTask.assignees) && targetTask.assignees[0]?.name) ||
      'Employee';
    const isUserAdminOrHR = currentUser?.isAdmin || currentUser?.systemRole === 'admin' || currentUser?.systemRole === 'hr' || currentUser?.role === 'Administrator' || currentUser?.role === 'HR Manager' || isHRorAdmin(currentUser) || canEditAnyTask(currentUser);
    const isForOtherEmployee = (isUserAdminOrHR || targetTask.assignedById === currentUser?._id) &&
      !isTaskAssignedToMe(targetTask) &&
      assignedEmpId &&
      String(assignedEmpId) !== String(userKey) &&
      String(assignedEmpId) !== String(currentUser?._id);

    const targetUserKey = isForOtherEmployee ? String(assignedEmpId) : String(userKey);

    // 0. Overdue Task Guard
    const isOverdue = isTaskOverdue(targetTask);
    if (isOverdue && !options.forceOverdue) {
      setOverdueTaskPrompt(targetTask);
      addToast(`⚠️ Task #${targetTask.taskCode || ''} is overdue (Due: ${targetTask.dueDate})! Please update deadline or mark completed.`, 'warning');
      return;
    }

    isTimerActionInFlightRef.current = true;
    try {
      const res = await workService.startWorkSession({
        taskId,
        targetEmployeeId: isForOtherEmployee ? targetUserKey : undefined,
        reason: 'Task timer started from UI'
      });

      if (!res || !res.success) {
        if (res?.offline || res?.queued) {
          addToast('Action queued offline. Will sync when reconnected.', 'info');
        } else {
          // Reconcile with server to restore authoritative state
          await syncAuthoritativeTimerState({ force: true, source: 'start_rejected' });
          const errMsg = res?.message || res?.error || 'Failed to start task timer on server';
          addToast(`⛔ ${errMsg}`, 'error');
        }
        return;
      }

      // Backend confirmed success! Hydrate authoritative state
      const confirmedState = res.data || res.state;
      if (confirmedState) {
        reconcileAuthoritativeTimer(confirmedState, { source: 'start_confirmed', force: true });
      } else {
        await syncAuthoritativeTimerState({ force: true, source: 'start_confirmed' });
      }

      if (isForOtherEmployee) {
        addToast(`⏱️ Started timer for ${assignedEmpName} on "${targetTask.title}"!`, 'success');
      } else {
        addToast(`⏱️ Started tracking work on "${targetTask.title}"!`, 'success');
      }
    } catch (err) {
      console.error('[WorkContext] startTaskTimer error:', err);
      await syncAuthoritativeTimerState({ force: true, source: 'start_error' });
      addToast(err?.message || 'Error starting task timer', 'error');
    } finally {
      isTimerActionInFlightRef.current = false;
    }
  };

  // ── Pause Task Timer (Server-Authoritative Only) ──
  const pauseTaskTimer = async (taskId) => {
    if (isTimerActionInFlightRef.current) {
      console.warn('[WorkContext] Timer action already in flight, ignoring duplicate request');
      return;
    }

    const allTasks = getCollection(KEYS.TASKS) || [];
    const targetTask = tasks.find(t => String(t._id || t.id) === String(taskId)) ||
      allTasks.find(t => String(t._id || t.id) === String(taskId));
    if (!targetTask) return;

    if (!canUserControlTask(targetTask)) {
      addToast('⛔ Access Denied: Only assigned team members, the task creator, or HR/Admin can pause this task.', 'error');
      return;
    }

    const assignedEmpId = targetTask.assignedToId ||
      (typeof targetTask.assignedTo === 'string' ? targetTask.assignedTo : targetTask.assignedTo?._id) ||
      (Array.isArray(targetTask.assignedToIds) && targetTask.assignedToIds[0]) ||
      (Array.isArray(targetTask.assignees) && (targetTask.assignees[0]?._id || targetTask.assignees[0]?.employeeCode)) ||
      userKey;
    const isUserAdminOrHR = currentUser?.isAdmin || currentUser?.systemRole === 'admin' || currentUser?.systemRole === 'hr' || currentUser?.role === 'Administrator' || currentUser?.role === 'HR Manager' || isHRorAdmin(currentUser) || canEditAnyTask(currentUser);
    const isForOtherEmployee = (isUserAdminOrHR || targetTask.assignedById === currentUser?._id) &&
      !isTaskAssignedToMe(targetTask) &&
      assignedEmpId &&
      String(assignedEmpId) !== String(userKey) &&
      String(assignedEmpId) !== String(currentUser?._id);
    const targetUserKey = isForOtherEmployee ? String(assignedEmpId) : String(userKey);

    isTimerActionInFlightRef.current = true;
    try {
      const res = await workService.pauseWorkSession({
        taskId,
        targetEmployeeId: isForOtherEmployee ? targetUserKey : undefined,
        reason: 'Task timer paused from UI'
      });

      if (!res || !res.success) {
        if (res?.offline || res?.queued) {
          addToast('Pause action queued offline.', 'info');
        } else {
          await syncAuthoritativeTimerState({ force: true, source: 'pause_rejected' });
          const errMsg = res?.message || res?.error || 'Failed to pause task timer on server';
          addToast(`⛔ ${errMsg}`, 'error');
        }
        return;
      }

      const confirmedState = res.data || res.state;
      if (confirmedState) {
        reconcileAuthoritativeTimer(confirmedState, { source: 'pause_confirmed', force: true });
      } else {
        await syncAuthoritativeTimerState({ force: true, source: 'pause_confirmed' });
      }

      if (isForOtherEmployee) {
        addToast(`⏸️ Task timer paused for ${targetTask.assignedToName || 'Employee'}!`, 'info');
      } else {
        addToast('Task timer paused ⏸️', 'info');
      }
    } catch (err) {
      console.error('[WorkContext] pauseTaskTimer error:', err);
      await syncAuthoritativeTimerState({ force: true, source: 'pause_error' });
      addToast(err?.message || 'Error pausing task timer', 'error');
    } finally {
      isTimerActionInFlightRef.current = false;
    }
  };

  // ── Stop Task Timer & Log to Timesheet (Server-Authoritative Only) ──
  const stopTaskTimer = async (taskId, memo = 'Work session stopped') => {
    if (isTimerActionInFlightRef.current) return;
    const allTasks = getCollection(KEYS.TASKS) || [];
    const targetTask = tasks.find(t => String(t._id || t.id) === String(taskId)) ||
      allTasks.find(t => String(t._id || t.id) === String(taskId));
    if (!targetTask) return;

    if (!canUserControlTask(targetTask)) {
      addToast('⛔ Access Denied: Only assigned team members, the task creator, or HR/Admin can stop this task.', 'error');
      return;
    }

    isTimerActionInFlightRef.current = true;
    try {
      const res = await workService.stopWorkSession({
        taskId,
        reason: memo
      });

      if (res && res.success) {
        const confirmedState = res.data || res.state;
        if (confirmedState) {
          reconcileAuthoritativeTimer(confirmedState, { source: 'stop_confirmed', force: true });
        } else {
          await syncAuthoritativeTimerState({ force: true, source: 'stop_confirmed' });
        }
        addToast('Task timer stopped and logged.', 'success');
      } else {
        await syncAuthoritativeTimerState({ force: true, source: 'stop_rejected' });
        addToast(res?.message || res?.error || 'Failed to stop task timer on server', 'error');
      }
    } catch (err) {
      console.error('[WorkContext] stopTaskTimer error:', err);
      await syncAuthoritativeTimerState({ force: true, source: 'stop_error' });
      addToast(err?.message || 'Error stopping task timer', 'error');
    } finally {
      isTimerActionInFlightRef.current = false;
    }
  };

  // ── Complete Task & Advance to Next (Server-Authoritative Only) ──
  const completeTask = async (taskId, customMemo = '', autoStartNext = false) => {
    if (isTimerActionInFlightRef.current) return null;
    const allTasks = getCollection(KEYS.TASKS) || [];
    const targetTask = tasks.find(t => String(t._id || t.id) === String(taskId)) ||
      allTasks.find(t => String(t._id || t.id) === String(taskId));
    if (!targetTask) return null;

    if (!canUserControlTask(targetTask)) {
      addToast('⛔ Access Denied: Only assigned team members, the task creator, or HR/Admin can complete this task.', 'error');
      return null;
    }

    isTimerActionInFlightRef.current = true;
    try {
      const res = await workService.completeWorkSession({
        taskId,
        reason: customMemo || 'Task completed from UI'
      });

      // Strict Failure & Offline Handling:
      // If backend returns success: false, do not mark task completed, do not show success toast, do not auto-start next task.
      if (!res || !res.success) {
        if (res?.offline || res?.queued) {
          addToast('Task completion enqueued offline. Will sync with server when online.', 'info');
          return null;
        }
        const errMsg = res?.message || res?.error || 'Failed to complete task on server';
        addToast(`⛔ ${errMsg}`, 'error');
        await syncAuthoritativeTimerState({ force: true, source: 'complete_rejected' });
        return null;
      }

      // Confirmed backend success only:
      const todayStr = getTodayStr();
      const completedIso = new Date().toISOString();

      // Update task completion status and metadata (only non-timer projections)
      await workService.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        completedAt: completedIso,
        completedOn: todayStr
      }).catch(err => console.warn('[WorkContext] Non-timer task update after complete notice:', err));

      const confirmedState = res.data || res.state;
      if (confirmedState) {
        reconcileAuthoritativeTimer(confirmedState, { source: 'complete_confirmed', force: true });
      } else {
        await syncAuthoritativeTimerState({ force: true, source: 'complete_confirmed' });
      }

      // Update local task state
      setTasks(prev => prev.map(t => {
        if (String(t._id || t.id) === String(taskId)) {
          return {
            ...t,
            status: 'completed',
            progress: 100,
            timerRunning: false,
            startedAt: null,
            activeUserId: null,
            completedAt: completedIso,
            completedOn: todayStr
          };
        }
        return t;
      }));

      addToast(`🎉 Task "${targetTask.title}" marked as completed!`, 'success');

      let nextTask = null;
      if (autoStartNext) {
        const remainingTasks = (tasks || []).filter(t =>
          String(t._id || t.id) !== String(taskId) &&
          t.status !== 'completed' &&
          !t.completedAt &&
          isTaskAssignedToMe(t)
        );
        if (remainingTasks.length > 0) {
          nextTask = remainingTasks[0];
          setTimeout(() => {
            startTaskTimer(nextTask._id || nextTask.id);
          }, 200);
        }
      }

      return { completedTask: targetTask, nextTask };
    } catch (err) {
      console.error('[WorkContext] completeTask error:', err);
      await syncAuthoritativeTimerState({ force: true, source: 'complete_error' });
      addToast(err?.message || 'Error completing task', 'error');
      return null;
    } finally {
      isTimerActionInFlightRef.current = false;
    }
  };

  const completeAndNextTask = async (taskId, customMemo = '') => {
    return await completeTask(taskId, customMemo, true);
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
      let targetTask = tasks.find(t => String(t._id || t.id) === String(taskId) || t.taskCode === taskId);
      if (!targetTask) {
        const cached = getCollection(KEYS.TASKS) || [];
        targetTask = cached.find(t => String(t._id || t.id) === String(taskId) || t.taskCode === taskId);
      }
      if (!targetTask) {
        addToast('Task not found for snooze', 'error');
        return;
      }

      // 1. Pause active timer if running for this task and record time spent
      const activeTimer = getActiveTimerSnapshot();
      let currentSecs = (targetTask.accumulatedSeconds !== undefined && targetTask.accumulatedSeconds !== null)
        ? Number(targetTask.accumulatedSeconds)
        : (Number(targetTask.timerSeconds) || 0);

      if (targetTask.timerRunning && targetTask.startedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - Number(targetTask.startedAt)) / 1000));
        currentSecs = currentSecs + elapsed;
      } else if (activeTimer && (String(activeTimer.taskId) === String(taskId) || String(activeTimer._id) === String(taskId))) {
        currentSecs = getElapsedSeconds(activeTimer);
      }

      if (activeTimer && (String(activeTimer.taskId) === String(taskId) || String(activeTimer._id) === String(taskId))) {
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

      const reminderTimeStr = new Date(remindAtTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const historyItem = {
        id: `hist_${Date.now()}_snooze`,
        action: 'snoozed',
        title: 'Task Snoozed (CRM Reminder Set)',
        timestamp: new Date().toISOString(),
        performedBy: currentUser?.name || 'User',
        performedById: currentUser?._id,
        details: `Task paused at ${formatSeconds(currentSecs)} and snoozed until ${reminderTimeStr}${note ? ` (${note})` : ''}`
      };
      const updatedHistory = [...(Array.isArray(targetTask.history) ? targetTask.history : []), historyItem];

      // 3. Update task in storage & state
      const updatePayload = {
        status: 'on_hold',
        timerRunning: false,
        timerSeconds: currentSecs,
        snoozed: true,
        remindAt: remindAtTimestamp,
        reminderNote: note || `Paused at ${formatSeconds(currentSecs)}`,
        reminderAlerted: false,
        reminderDismissed: false,
        history: updatedHistory
      };

      // 🚀 0ms Instant Optimistic Local Update
      const allTasks = getCollection(KEYS.TASKS) || [];
      const updatedAll = allTasks.map(t => {
        if (String(t._id || t.id) === String(taskId) || t.taskCode === taskId) {
          return { ...t, ...updatePayload };
        }
        return t;
      });
      saveCollection(KEYS.TASKS, updatedAll);

      setTasks(prev => prev.map(t => {
        if (String(t._id || t.id) === String(taskId) || t.taskCode === taskId) {
          return { ...t, ...updatePayload, hoursLoggedText: formatSeconds(currentSecs) };
        }
        return t;
      }));

      // Clear alerted cache so new reminder can fire when its new time comes
      alertedTaskIdsRef.current.delete(String(taskId));
      if (targetTask?.taskCode) alertedTaskIdsRef.current.delete(String(targetTask.taskCode));

      addToast(`⏰ Task "#${targetTask.taskCode || 'TSK'}" paused & snoozed! CRM will remind you at ${reminderTimeStr}.`, 'info');

      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TASKS } }));
      window.dispatchEvent(new CustomEvent('ems_task_reminded', { detail: { taskId, remindAt: remindAtTimestamp } }));

      // Asynchronous background persistence
      workService.updateTask(taskId, updatePayload)
        .catch(err => console.warn('Sync snooze to backend:', err));

      return true;
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
      const targetTask = tasks.find(t => t._id === taskId);
      const historyItem = {
        id: `hist_${Date.now()}_resumed`,
        action: 'resumed',
        title: 'Task Resumed from Snooze',
        timestamp: new Date().toISOString(),
        performedBy: currentUser?.name || 'User',
        performedById: currentUser?._id,
        details: 'Task timer resumed from snooze reminder'
      };
      const updatedHistory = [...(Array.isArray(targetTask?.history) ? targetTask.history : []), historyItem];

      const updatePayload = {
        snoozed: false,
        remindAt: null,
        reminderAlerted: false,
        reminderDismissed: true,
        history: updatedHistory
      };

      // 🚀 0ms Instant Optimistic Local Update
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

      // Mark as alerted in-memory so reminder never triggers again
      alertedTaskIdsRef.current.add(String(taskId));
      if (targetTask?.taskCode) alertedTaskIdsRef.current.add(String(targetTask.taskCode));

      // Start the task timer right away in 0ms
      startTaskTimer(taskId);

      // Asynchronous background persistence
      workService.updateTask(taskId, updatePayload)
        .catch(err => console.warn('Sync resume to backend:', err));
    } catch (err) {
      console.error('Error resuming task:', err);
      addToast('Failed to resume task', 'error');
    }
  };

  /**
   * Dismiss a reminder banner without starting timer yet (Scoped per user so one user dismissing doesn't hide it for other assignees)
   */
  const dismissTaskReminder = async (taskId, userOverrideId) => {
    try {
      const activeUid = userOverrideId || currentUser?._id || currentUser?.employeeCode || 'global';
      alertedTaskIdsRef.current.add(String(taskId));
      const allTasks = getCollection(KEYS.TASKS) || [];
      const currentTask = allTasks.find(t => String(t._id || t.id) === String(taskId));
      const existingDismissedBy = Array.isArray(currentTask?.reminderDismissedBy) ? currentTask.reminderDismissedBy : (currentTask?.reminderDismissed ? ['global'] : []);
      const updatedDismissedBy = [...new Set([...existingDismissedBy, String(activeUid)])];

      const updatePayload = {
        snoozed: false,
        remindAt: null,
        reminderAlerted: true,
        reminderDismissed: true,
        reminderDismissedBy: updatedDismissedBy
      };

      // 🚀 0ms Instant Optimistic Local Update
      const updatedAll = allTasks.map(t => String(t._id || t.id) === String(taskId) ? { ...t, ...updatePayload } : t);
      saveCollection(KEYS.TASKS, updatedAll);
      setTasks(prev => prev.map(t => String(t._id || t.id) === String(taskId) ? { ...t, ...updatePayload } : t));
      addToast('Task reminder dismissed', 'info');

      // Asynchronous background persistence
      workService.updateTask(taskId, updatePayload)
        .catch(err => console.warn('Sync dismiss to backend:', err));
    } catch (e) {
      console.error(e);
    }
  };

  // Heartbeat checker for due reminders (strictly once per task, scoped to current assignee)
  useEffect(() => {
    const reminderInterval = setInterval(() => {
      const now = Date.now();
      const allTasks = getCollection(KEYS.TASKS) || [];
      let hasUpdate = false;

      allTasks.forEach(t => {
        const tId = String(t._id || t.id);
        const isDue = t.snoozed && t.remindAt && Number(t.remindAt) <= now;
        const alreadyAlerted = t.reminderAlerted || t.reminderDismissed || alertedTaskIdsRef.current.has(tId);

        if (isDue && !alreadyAlerted && isTaskAssignedToMe(t)) {
          hasUpdate = true;
          t.reminderAlerted = true;
          alertedTaskIdsRef.current.add(tId);
          if (t.taskCode) alertedTaskIdsRef.current.add(String(t.taskCode));

          addToast(`⏰ Reminder: Time to resume task "#${t.taskCode || 'TSK'}: ${t.title}"! (Paused at ${formatSeconds(t.timerSeconds || 0)})`, 'warning');

          // Persist reminderAlerted flag to backend so MongoDB keeps it
          workService.updateTask(tId, { reminderAlerted: true }).catch(err => {
            console.warn('Failed to persist reminderAlerted to backend:', err);
          });
        }
      });

      if (hasUpdate) {
        saveCollection(KEYS.TASKS, allTasks);
        setTasks(prev => prev.map(t => {
          const matched = allTasks.find(x => String(x._id || x.id) === String(t._id || t.id));
          return matched ? { ...t, reminderAlerted: matched.reminderAlerted } : t;
        }));
      }
    }, 8000);

    return () => clearInterval(reminderInterval);
  }, [formatSeconds, addToast, isTaskAssignedToMe]);

  // =========================================================================
  // ⏱️ TIMESHEET ACTIONS
  // =========================================================================
  const logTimesheet = async (entryData) => {
    try {
      const tempId = `ts_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const optimisticEntry = {
        _id: tempId,
        id: tempId,
        date: entryData.date || getTodayStr(),
        createdAt: new Date().toISOString(),
        ...entryData
      };

      // 🚀 0ms Instant Optimistic Local Update
      const allTimesheets = getCollection(KEYS.TIMESHEETS) || [];
      const updatedList = [optimisticEntry, ...allTimesheets];
      saveCollection(KEYS.TIMESHEETS, updatedList);
      setTimesheets(updatedList);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TIMESHEETS } }));
      addToast('Time logged successfully to Timesheet!', 'success');

      // Asynchronous background sync
      workService.createTimesheet(entryData)
        .then(created => {
          if (created && created._id && created._id !== tempId) {
            setTimesheets(prev => prev.map(ts => (ts._id === tempId || ts.id === tempId ? { ...ts, ...created, _id: created._id, id: created._id } : ts)));
            const cur = getCollection(KEYS.TIMESHEETS) || [];
            const swapped = cur.map(ts => (ts._id === tempId || ts.id === tempId ? { ...ts, ...created, _id: created._id, id: created._id } : ts));
            saveCollection(KEYS.TIMESHEETS, swapped);
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TIMESHEETS } }));
          }
        })
        .catch(err => console.warn('[WorkContext] Timesheet cloud sync queued:', err));

      return optimisticEntry;
    } catch (err) {
      addToast('Failed to log time', 'error');
      throw err;
    }
  };

  const deleteTimesheet = async (id) => {
    try {
      // 🚀 0ms Instant Optimistic Local Removal
      const allTimesheets = getCollection(KEYS.TIMESHEETS) || [];
      const filtered = allTimesheets.filter(ts => String(ts._id || ts.id) !== String(id));
      saveCollection(KEYS.TIMESHEETS, filtered);
      setTimesheets(filtered);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TIMESHEETS } }));
      addToast('Timesheet entry removed', 'info');

      // Asynchronous background sync
      workService.deleteTimesheet(id).catch(err => console.warn('[WorkContext] Sync delete timesheet error:', err));
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



  const workContextValue = useMemo(() => ({
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
    syncAuthoritativeTimerState,
    formatSeconds,
    // Project Methods
    createProject,
    updateProject,
    deleteProject,
    submitProjectForCompletion,
    approveProjectCompletion,
    reopenProject,
    // Task Methods
    createTask,
    updateTask,
    changeTaskStatus,
    completeTask,
    completeAndNextTask,
    deleteTask,
    startTaskTimer,
    resumeTaskTimer: startTaskTimer,
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
    isEmployeeOnLeave,
    // Overdue Task Guards
    isTaskOverdue,
    overdueTaskPrompt,
    setOverdueTaskPrompt,
    extendTaskDeadline,
    rescheduleTaskForFuture
  }), [
    loading, projects, tasks, timesheets, activeRunningTask,
    projectFilter, taskFilter, timesheetFilter, loadWorkData, syncAuthoritativeTimerState,
    formatSeconds, createProject, updateProject, deleteProject,
    submitProjectForCompletion, approveProjectCompletion, reopenProject,
    createTask, updateTask, changeTaskStatus, completeTask,
    completeAndNextTask, deleteTask, startTaskTimer, pauseTaskTimer,
    stopTaskTimer, snoozeTask, resumeSnoozedTask, dismissTaskReminder,
    logTimesheet, deleteTimesheet, employees, currentUser,
    isEmployeeOnLeave, isTaskOverdue, overdueTaskPrompt, extendTaskDeadline, rescheduleTaskForFuture
  ]);

  return (
    <WorkContext.Provider value={workContextValue}>
      {children}
      {overdueTaskPrompt && (
        <OverdueTaskModal
          task={overdueTaskPrompt}
          onClose={() => setOverdueTaskPrompt(null)}
          onExtend={extendTaskDeadline}
          onComplete={completeTask}
          onContinueAnyway={(taskId) => startTaskTimer(taskId, { forceOverdue: true })}
        />
      )}
    </WorkContext.Provider>
  );
};

export const useWork = () => {
  const context = useContext(WorkContext);
  return context || defaultWorkContext;
};

