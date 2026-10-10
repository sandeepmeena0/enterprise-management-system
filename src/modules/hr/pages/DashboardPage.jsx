/**
 * @file DashboardPage.jsx
 * @description Comprehensive, modern Employee CRM & HR Management Dashboard
 * perfectly replicating Screenshots 1, 2, 3, 4 with live timers, attendance clock,
 * task management, weekly timelogs, calendar, tickets, WFH, and notices.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  User,
  Palmtree,
  UserCheck,
  UserX,
  CalendarCheck,
  Award,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  ThumbsUp,
  Trophy,
  Filter,
  UserPlus,
  Play,
  Pause,
  Square,
  Coffee,
  LogOut,
  FolderGit2,
  ListTodo,
  LifeBuoy,
  Bell,
  Home,
  Cake,
  Plane,
  Eye,
  Check,
  Briefcase,
  RefreshCw,
  Shield
} from 'lucide-react';
import { useHR } from '../context/HRContext';
import { useAuth } from '../../../shared/context/AuthContext';
import { useWork } from '../../work/context/WorkContext';
import { useTimer } from '../../../shared/context/TimerContext';
import { useCRM } from '../../../shared/context/CRMContext';
import { useToast } from '../../../shared/context/ToastContext';
import { ROLES, ROLE_CONFIGS, getUserRole } from '../../../shared/utils/permissionUtils';

// Modals
import { BreakModal } from '../../../shared/components/modals/BreakModal';
import { EditProfileModal } from '../../../shared/components/modals/EditProfileModal';
import { RaiseTicketModal } from '../../../shared/components/modals/RaiseTicketModal';
import { NoticeDetailModal } from '../../../shared/components/modals/NoticeDetailModal';
import { AddNoticeModal } from '../../../shared/components/modals/AddNoticeModal';
import { DayTimeLogModal } from '../../../shared/components/modals/DayTimeLogModal';
import { TaskDetailModal } from '../../work/components/tasks/TaskDetailModal';
import { ProjectDetailModal } from '../../work/components/projects/ProjectDetailModal';
import { AddTaskModal } from '../../work/components/tasks/AddTaskModal';
import { NewLeaveModal } from '../components/leaves/NewLeaveModal';
import { TicketDetailModal } from '../../crm/components/tickets/TicketDetailModal';
import { EmployeeDirectoryModal } from '../components/employees/EmployeeDirectoryModal';
import { SnoozeTaskModal } from '../../work/components/tasks/SnoozeTaskModal';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentUser: authUser, role: authRole, roleConfig: authRoleConfig } = useAuth();
  const { employees, leaves, attendance, holidays, appreciations, currentUser: hrUser, updateLeaveStatus } = useHR();
  const currentUser = authUser || hrUser;
  const {
    projects,
    tasks,
    timesheets,
    startTaskTimer,
    pauseTaskTimer,
    stopTaskTimer,
    activeRunningTask,
    changeTaskStatus,
    completeTask,
    formatSeconds,
    snoozeTask,
    resumeSnoozedTask,
    dismissTaskReminder
  } = useWork();
  const { tickets, notices, events, birthdays, computedBirthdays, computedAnniversaries, wfhEmployees, weeklyTimeLogs } = useCRM();
  const [activeSelectedTaskId, setActiveSelectedTaskId] = useState(null);
  const [snoozeTaskTarget, setSnoozeTaskTarget] = useState(null);
  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const {
    loginTime,
    clockOutTime,
    hadClockedOutToday,
    workDurationText,
    breakDurationText,
    grossDurationText,
    timeString,
    isRunning,
    isOnBreak,
    breakType,
    customBreakLimitMinutes,
    currentBreakTimeString,
    breakRemainingTimeString,
    isBreakOverdue,
    isClockedIn,
    togglePauseResume,
    handleClockIn,
    handleClockOut,
    startTeaBreak,
    startLunchBreak,
    resumeFromBreak,
    extendBreak
  } = useTimer();

  // Current Live Clock (with live seconds for sharp digital readout)
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [currentDayStr, setCurrentDayStr] = useState(() => new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const [currentDateFormatted, setCurrentDateFormatted] = useState(() => new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  // Modals state
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isRaiseTicketOpen, setIsRaiseTicketOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [isEmpDirectoryOpen, setIsEmpDirectoryOpen] = useState(false);
  const [isAddNoticeOpen, setIsAddNoticeOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedDayLog, setSelectedDayLog] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [calendarView, setCalendarView] = useState('list'); // 'month' | 'week' | 'day' | 'list'

  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDayStr(now.toLocaleDateString('en-US', { weekday: 'long' }));
      setCurrentDateFormatted(now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper for matching tasks assigned to a specific user (handles IDs, codes, names, emails)
  const isTaskAssignedToUser = (task, user) => {
    if (!task || !user) return false;
    const userIds = [user._id, user.id, user.employeeCode, user.email].filter(Boolean).map(s => String(s).toLowerCase());
    const taskAssigneeIds = [task.assignedToId, task.assignedTo, task.employeeId, task.assignedToEmail].filter(Boolean).map(s => String(s).toLowerCase());

    if (userIds.some(uid => taskAssigneeIds.includes(uid))) return true;

    const userName = (user.name || '').trim().toLowerCase();
    const taskAssigneeName = (task.assignedToName || '').trim().toLowerCase();
    if (userName && taskAssigneeName) {
      if (userName === taskAssigneeName) return true;
      const userFirst = userName.split(' ')[0];
      const taskFirst = taskAssigneeName.split(' ')[0];
      if (userFirst && taskFirst && userFirst === taskFirst && userFirst.length > 2) return true;
    }
    return false;
  };

  // Role & Scope Detection
  const userRole = authRole || getUserRole(currentUser);
  const isUserAdminOrHR = userRole === ROLES.ADMIN || userRole === ROLES.HR;
  const roleConfig = authRoleConfig || ROLE_CONFIGS[userRole] || ROLE_CONFIGS[ROLES.TEAM_MEMBER];

  // Dashboard Task Filter State
  const [taskScopeFilter, setTaskScopeFilter] = useState('all'); // 'all' | 'my' | 'delegated'
  const [taskMemberFilter, setTaskMemberFilter] = useState('all');
  const [taskStatusTab, setTaskStatusTab] = useState('active'); // 'active' (New & Pending) | 'completed' (Recently Done) | 'all'

  // Direct tasks for currently logged-in user
  const myDirectTasks = (tasks || []).filter(t => isTaskAssignedToUser(t, currentUser));

  // Tasks delegated / assigned by this user (Admin / HR)
  const delegatedByMeTasks = (tasks || []).filter(t =>
    (t?.assignedBy === currentUser?.name || t?.assignedById === currentUser?._id) &&
    !isTaskAssignedToUser(t, currentUser)
  );

  // Base Scoped Tasks
  const baseScopedTasks = (tasks || []).filter(t => {
    if (!t) return false;
    if (taskMemberFilter !== 'all') {
      return (
        t.assignedToId === taskMemberFilter ||
        t.assignedTo === taskMemberFilter ||
        t.assignedToName === taskMemberFilter
      );
    }
    if (taskScopeFilter === 'my') {
      return isTaskAssignedToUser(t, currentUser);
    }
    if (taskScopeFilter === 'delegated') {
      return t.assignedBy === currentUser?.name || t.assignedById === currentUser?._id;
    }
    if (isUserAdminOrHR) return true;
    return isTaskAssignedToUser(t, currentUser) || !t.assignedToId;
  });

  // 1. Active & Newly Assigned Tasks (Sorted by in_progress first, then newest assigned/created at top)
  const activeScopedTasks = baseScopedTasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      if (a.timerRunning && !b.timerRunning) return -1;
      if (!a.timerRunning && b.timerRunning) return 1;
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      const timeA = new Date(a.createdAt || a.assignedAt || a.startDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.assignedAt || b.startDate || 0).getTime();
      return timeB - timeA;
    });

  // 2. Recently Completed Tasks (Sorted by completion time descending - latest completed at top)
  const completedScopedTasks = baseScopedTasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => {
      const timeA = new Date(a.completedAt || a.completedOn || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.completedAt || b.completedOn || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  // Filtered tasks for the "My Tasks & Delegation" table
  const tableDisplayTasks = taskStatusTab === 'active'
    ? activeScopedTasks
    : taskStatusTab === 'completed'
      ? completedScopedTasks
      : [...activeScopedTasks, ...completedScopedTasks];

  // Dashboard Ticket Filter State
  const [ticketFilterTab, setTicketFilterTab] = useState('all'); // 'all' | 'open' | 'resolved'
  const openTicketsList = (tickets || []).filter(t => t?.status !== 'resolved' && t?.status !== 'closed');
  const resolvedTicketsList = (tickets || []).filter(t => t?.status === 'resolved' || t?.status === 'closed');
  const displayTickets = ticketFilterTab === 'open'
    ? openTicketsList
    : ticketFilterTab === 'resolved'
      ? resolvedTicketsList
      : (tickets || []);

  // Effective personal tasks for Timer & KPI counters
  const myTasks = myDirectTasks.length > 0 ? myDirectTasks : (isUserAdminOrHR ? (tasks || []) : myDirectTasks);
  const myPendingTasks = myTasks.filter(t => t?.status !== 'completed');
  const myCompletedTasks = myTasks.filter(t => t?.status === 'completed');
  const pendingTasksCount = myPendingTasks.length;
  const overdueTasksCount = myPendingTasks.filter(t => t?.dueDate && t?.dueDate < todayStr).length;

  const activeProjectsCount = (projects || []).filter(p => p?.status === 'in_progress').length || 1;
  const overdueProjectsCount = (projects || []).filter(p => p?.status !== 'completed' && p?.deadline && p?.deadline < todayStr).length || 0;

  // Snoozed / Reminded Tasks (Tasks on hold with CRM reminder)
  const snoozedTasks = (tasks || []).filter(t =>
    t?.snoozed && t?.remindAt && !t?.reminderDismissed && t?.status !== 'completed' &&
    (isTaskAssignedToUser(t, currentUser) || isUserAdminOrHR)
  );

  // Reminders that are currently DUE (scheduled time has arrived)
  const dueReminders = snoozedTasks.filter(t => Number(t.remindAt) <= Date.now());

  // Active Task for "My Active Timer" card (prioritizes live running, user selection, first pending)
  const displayActiveTask =
    activeRunningTask ||
    (activeSelectedTaskId ? (tasks || []).find(t => t._id === activeSelectedTaskId) : null) ||
    myPendingTasks.find(t => !t.snoozed) ||
    (tasks || []).find(t => t?.status !== 'completed' && !t.snoozed) ||
    myTasks[0] ||
    (tasks || [])[0];

  // Upcoming Next tasks in queue (excluding current active task and snoozed tasks)
  const upcomingQueueTasks = (myPendingTasks.length > 0 ? myPendingTasks : (tasks || []).filter(t => t?.status !== 'completed'))
    .filter(t => t._id !== displayActiveTask?._id && !t.snoozed);

  const upNextTask = upcomingQueueTasks[0] || null;

  // Live dynamic total duration today (timesheets logged today + live ticking timer seconds)
  const todayTimesheets = (timesheets || []).filter(ts => {
    const isToday = ts.date === todayStr || ts.createdAt?.startsWith(todayStr);
    const isMine = !ts.employeeId || ts.employeeId === (currentUser?._id || 'emp_001') || ts.employeeName?.toLowerCase() === (currentUser?.name || '').toLowerCase();
    return isToday && isMine;
  });

  const totalLoggedTodaySecs = todayTimesheets.reduce((acc, curr) => acc + (Number(curr.totalDurationSeconds) || 0), 0);
  const liveTickingSecs = activeRunningTask?.timerSeconds || 0;
  const currentTotalTodaySecs = totalLoggedTodaySecs + liveTickingSecs;

  const totalActivityFormatted = currentTotalTodaySecs > 0
    ? formatSeconds(currentTotalTodaySecs)
    : (activeRunningTask?.hoursLoggedText || displayActiveTask?.hoursLoggedText || '00:00:00');

  const totalWeeklyHours = (weeklyTimeLogs || []).reduce((acc, curr) => acc + (Number(curr.durationHours) || 0), 0);
  const totalWeeklyFormatted = `${Math.floor(totalWeeklyHours)}h ${String(Math.round((totalWeeklyHours % 1) * 60)).padStart(2, '0')}m`;

  const dayNamesShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const todayDayShort = dayNamesShort[new Date().getDay()];

  // Employees on leave today (Dynamic real-time date check)
  const employeesOnLeave = (leaves || []).filter(l =>
    l?.status === 'approved' && (
      (l?.startDate <= todayStr && l?.endDate >= todayStr) ||
      (l?.startDate <= '2026-09-25' && l?.endDate >= '2026-09-25') // fallback for simulated date
    )
  );

  // Pending leave requests waiting for my approval or for admin/HR
  const pendingLeaveRequestsForMe = (leaves || []).filter(l => {
    if (l?.status !== 'pending') return false;
    const isTarget = l.appliedToId === currentUser?._id || l.appliedToName === currentUser?.name;
    return isTarget || isUserAdminOrHR || !l.appliedToId;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* ── ⏰ LIVE DUE TASK REMINDER ALERT BANNER ── */}
      {dueReminders.length > 0 && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fb923c',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(251, 146, 60, 0.15)',
          animation: 'reminderPulseGlow 2.5s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ea580c',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Bell size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#fed7aa', color: '#9a3412', padding: '1px 6px', borderRadius: '4px' }}>
                  ⏰ REMINDER DUE
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  #{dueReminders[0].taskCode || 'TSK'}: {dueReminders[0].title}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#7c2d12', marginTop: '2px' }}>
                Paused at <strong>{dueReminders[0].hoursLoggedText || formatSeconds(dueReminders[0].timerSeconds || 0)}</strong>
                {dueReminders[0].reminderNote ? ` • Note: "${dueReminders[0].reminderNote}"` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => resumeSnoozedTask(dueReminders[0]._id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)'
              }}
            >
              <Play size={12} fill="#fff" />
              <span>Resume Timer & Work</span>
            </button>

            <button
              onClick={() => snoozeTask(dueReminders[0]._id, { remindInMinutes: 15, note: 'Snoozed 15m' })}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#9a3412',
                border: '1px solid #fdba74',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Snooze for another 15 minutes"
            >
              +15m Snooze
            </button>

            <button
              onClick={() => dismissTaskReminder(dueReminders[0]._id)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: '#9a3412',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Dismiss reminder"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TOP SECTION: Welcome Profile Card & Attendance Shift Clock (Compact & Sleek)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px',
        alignItems: 'stretch'
      }}>
        {/* Welcome Profile Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser?.name}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}
              />
              <span style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isClockedIn ? '#10b981' : '#94a3b8',
                border: '2px solid #ffffff'
              }} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Welcome {currentUser?.name || 'User'}
                </h2>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: roleConfig?.badgeBg || '#eff6ff',
                  color: roleConfig?.badgeColor || '#2563eb',
                  border: `1px solid ${roleConfig?.badgeColor || '#93c5fd'}40`
                }}>
                  {roleConfig?.label || 'Team Member'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', marginTop: '1px' }}>
                {currentUser?.role || roleConfig?.label || 'Team Member'} • <span style={{ color: '#94a3b8' }}>ID: #{currentUser?.employeeCode || currentUser?._id || 'EMP-01'}</span>
              </div>
            </div>
          </div>

          {/* Quick Informational Snapshot (Shift Status & Available Leaves) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <div style={{ padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Shift Status</div>
              <div style={{ fontSize: '11.5px', fontWeight: '700', marginTop: '1px', color: isClockedIn ? (isOnBreak ? '#b45309' : '#16a34a') : '#64748b' }}>
                {isClockedIn
                  ? (isOnBreak ? `☕ On ${breakType}` : '🟢 Shift Active')
                  : (hadClockedOutToday ? '🔴 Shift Ended' : '⚪ Not Clocked In')}
              </div>
            </div>

            <div
              onClick={() => setIsApplyLeaveOpen(true)}
              style={{ cursor: 'pointer', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}
              title="Click to apply for leave"
            >
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Leave Balance</div>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a', marginTop: '1px' }}>
                Casual: 10d • Sick: 8d
              </div>
            </div>
          </div>

          {/* Quick Direct Buttons for Employees & Profile */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => navigate('/employees')}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Users size={12} />
              <span>Directory</span>
            </button>

            <button
              onClick={() => setIsEditProfileOpen(true)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Edit My Profile"
            >
              <User size={12} /> Edit Profile
            </button>
          </div>
        </div>

        {/* Live Work Timer & Attendance Shift Clock (Compact & Functional) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'monospace' }}>
                {currentTime}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                {currentDayStr}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Clock In: <strong>{loginTime || (isClockedIn ? 'Just now' : 'Not yet')}</strong></span>
                {isClockedIn && (
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: '700',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isOnBreak ? '#fef3c7' : '#dcfce7',
                    color: isOnBreak ? '#b45309' : '#16a34a'
                  }}>
                    {isOnBreak ? `On ${breakType}` : 'Active'}
                  </span>
                )}
              </div>
            </div>

            {/* Clock In, Out & Break Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
              {isOnBreak ? (
                /* Active Break Controls */
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: isBreakOverdue ? '#fef2f2' : '#fffbeb',
                    border: isBreakOverdue ? '1px solid #ef4444' : '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: isBreakOverdue ? '#dc2626' : '#b45309',
                    fontSize: '11.5px',
                    fontWeight: '700'
                  }}>
                    <Coffee size={13} color={isBreakOverdue ? '#dc2626' : '#d97706'} />
                    <span>{breakType}: <strong>{currentBreakTimeString}</strong></span>
                  </div>

                  <button
                    onClick={() => extendBreak(5)}
                    style={{
                      padding: '5px 7px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    title="Extend break by 5 minutes"
                  >
                    +5m
                  </button>

                  <button
                    id="btn-resume-work-dashboard"
                    onClick={resumeFromBreak}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 11px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                    }}
                    title="Resume working and unpause work timer"
                  >
                    <Play size={11} fill="#fff" />
                    Resume
                  </button>

                  <button
                    onClick={() => setIsBreakModalOpen(true)}
                    style={{
                      padding: '5px 8px',
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Break Settings & History"
                  >
                    Log
                  </button>
                </div>
              ) : isClockedIn ? (
                /* Working Shift Active Controls */
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <button
                    id="btn-tea-break"
                    onClick={startTeaBreak}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#f0f9ff',
                      color: '#0284c7',
                      border: '1px solid #bae6fd',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    title="Take 15-minute Tea Break"
                  >
                    <Coffee size={12} color="#0284c7" />
                    Tea Break (15m)
                  </button>

                  <button
                    id="btn-more-breaks"
                    onClick={() => setIsBreakModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Choose Custom Break, Lunch, or Stretch"
                  >
                    <span>More...</span>
                  </button>

                  <button
                    id="btn-clock-out"
                    onClick={handleClockOut}
                    title="End shift and save attendance logs"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 11px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
                    }}
                  >
                    <Square size={10} fill="#fff" />
                    Clock Out
                  </button>
                </div>
              ) : (
                /* Direct Clock In */
                <button
                  id="btn-clock-in"
                  onClick={handleClockIn}
                  title="Start your daily shift timer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 15px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#15803d'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                >
                  <Play size={12} fill="#fff" />
                  Clock In (Start Shift)
                </button>
              )}

              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                {isClockedIn
                  ? `Shift is running (Net: ${workDurationText})`
                  : (hadClockedOutToday
                    ? `Shift ended at ${clockOutTime} (${workDurationText} total).`
                    : 'Click Clock In to begin shift.')}
              </span>
            </div>
          </div>

          {/* Time Calculation Subtitle */}
          <div
            onClick={() => navigate('/attendance')}
            style={{
              padding: '5px 10px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '11px',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '4px',
              cursor: 'pointer'
            }}
            title="Click to view Attendance logs"
          >
            <span>Gross: <strong>{grossDurationText || '0h 0m'}</strong></span>
            <span>•</span>
            <span>Break: <strong>{breakDurationText || '0m'}</strong></span>
            <span>•</span>
            <span style={{ color: '#0284c7', fontWeight: '700' }}>Net Shift: {workDurationText || '0h 0m'}</span>
            <span style={{ color: '#0284c7', fontSize: '10.5px', fontWeight: '600' }}>Logs →</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          MIDDLE ROW: My Active Timer & Week Timelogs (Compact, High-Density)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px',
        alignItems: 'stretch'
      }}>
        {/* Left: My Active Timer Card (Compact & Modern) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <h3
                onClick={() => navigate('/timesheet')}
                style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0, cursor: 'pointer' }}
                title="Click to open Timesheet"
              >
                My Active Timer ⏱️
              </h3>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Today Activity:</span>
                <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                  {totalActivityFormatted}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
              {currentDateFormatted}
            </div>
          </div>

          {displayActiveTask && displayActiveTask.status !== 'completed' ? (
            <>
              <div style={{
                padding: '8px 10px',
                backgroundColor: '#f8fafc',
                borderRadius: '7px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {isOnBreak && (
                  <div style={{
                    padding: '4px 8px',
                    backgroundColor: '#fffbeb',
                    borderRadius: '5px',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Coffee size={12} color="#d97706" />
                      <span>Paused (On {breakType})</span>
                    </span>
                    <button
                      onClick={resumeFromBreak}
                      style={{
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Resume
                    </button>
                  </div>
                )}

                {/* Line 1: Task Title + Project */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayActiveTask?.title}>
                    <span style={{ color: '#0284c7', fontFamily: 'monospace' }}>#{displayActiveTask?.taskCode || 'TSK'}:</span> {displayActiveTask?.title}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#2563eb', flexShrink: 0 }}>
                    {displayActiveTask?.projectName || 'General'}
                  </span>
                </div>

                {/* Line 2: Meta info (Start Time • Assignee • Assigner) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span>Start: <strong style={{ color: '#334155' }}>{displayActiveTask?.timerStartTime || (displayActiveTask?.timerRunning ? 'Running ⏱️' : (isOnBreak ? 'On Break ☕' : '09:30 AM'))}</strong></span>
                  <span>Assignee: <strong style={{ color: '#0f172a' }}>{displayActiveTask?.assignedToName || 'Me'}</strong></span>
                  <span>By: <strong style={{ color: '#64748b' }}>{displayActiveTask?.assignedBy || 'Admin'}</strong></span>
                </div>

                {/* Line 3: Progress Bar */}
                {displayActiveTask?.estimatedHours > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>
                      <span>Budget: {displayActiveTask.estimatedHours}h</span>
                      <span style={{ color: (Number(displayActiveTask.hoursLogged) || 0) > Number(displayActiveTask.estimatedHours) ? '#dc2626' : '#16a34a' }}>
                        {displayActiveTask.hoursLogged ? `${displayActiveTask.hoursLogged}h logged` : (displayActiveTask.hoursLoggedText || '0s')}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '3.5px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.round(((Number(displayActiveTask.hoursLogged) || 1) / Number(displayActiveTask.estimatedHours || 4)) * 100))}%`,
                        backgroundColor: (Number(displayActiveTask.hoursLogged) || 0) > Number(displayActiveTask.estimatedHours) ? '#ef4444' : '#0284c7',
                        borderRadius: '2px'
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons with Do Later / Remind Me */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    const res = await completeTask(displayActiveTask._id);
                    if (res?.nextTask) {
                      setActiveSelectedTaskId(res.nextTask._id);
                    }
                  }}
                  style={{
                    flex: 1.2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(22, 163, 74, 0.25)'
                  }}
                  title="Mark completed & advance queue"
                >
                  <CheckCircle2 size={13} />
                  <span>Complete & Next</span>
                </button>

                <button
                  onClick={() => {
                    if (displayActiveTask?.timerRunning) {
                      pauseTaskTimer(displayActiveTask._id);
                    } else {
                      startTaskTimer(displayActiveTask._id);
                    }
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {displayActiveTask?.timerRunning ? <Pause size={12} /> : <Play size={12} />}
                  <span>{displayActiveTask?.timerRunning ? 'Pause' : 'Resume'}</span>
                </button>

                <button
                  onClick={() => {
                    setSnoozeTaskTarget(displayActiveTask);
                    setIsSnoozeModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    backgroundColor: '#faf5ff',
                    color: '#7e22ce',
                    border: '1px solid #e9d5ff',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  title="Pause task right here and schedule CRM reminder"
                >
                  <Bell size={12} />
                  <span>Do Later ⏰</span>
                </button>

                <button
                  onClick={() => stopTaskTimer(displayActiveTask._id)}
                  style={{
                    flex: 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Stop timer and log hours"
                >
                  <Square size={10} fill="#64748b" />
                  <span>Stop</span>
                </button>
              </div>

              {/* ── ⏭️ NEXT UP IN QUEUE (Upcoming Tasks) ── */}
              {upcomingQueueTasks.length > 0 && (
                <div style={{
                  padding: '8px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '7px',
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⏭️</span> Next Up In Queue ({upcomingQueueTasks.length})
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Click to start next task</span>
                  </div>

                  {upcomingQueueTasks.slice(0, 2).map(nextT => (
                    <div
                      key={nextT._id}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#0284c7' }}>#{nextT.taskCode || 'TSK'}:</span> {nextT.title}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                          <span>{nextT.projectName || 'General'}</span>
                          <span>•</span>
                          <span>{nextT.estimatedHours ? `${nextT.estimatedHours}h` : 'No est.'}</span>
                          <span style={{
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: '700',
                            backgroundColor: nextT.priority === 'urgent' ? '#fee2e2' : nextT.priority === 'high' ? '#ffedd5' : '#eff6ff',
                            color: nextT.priority === 'urgent' ? '#dc2626' : nextT.priority === 'high' ? '#ea580c' : '#2563eb'
                          }}>
                            {nextT.priority?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            startTaskTimer(nextT._id);
                            setActiveSelectedTaskId(nextT._id);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Start working on this task immediately"
                        >
                          <Play size={10} fill="#fff" />
                          <span>Start 🚀</span>
                        </button>

                        <button
                          onClick={() => {
                            setSnoozeTaskTarget(nextT);
                            setIsSnoozeModalOpen(true);
                          }}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '5px',
                            backgroundColor: '#f1f5f9',
                            color: '#7e22ce',
                            border: '1px solid #cbd5e1',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="Snooze / Do Later"
                        >
                          ⏰
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── ⏰ SNOOZED / ON-HOLD REMINDER TASKS ── */}
              {snoozedTasks.length > 0 && (
                <div style={{
                  padding: '8px 10px',
                  backgroundColor: '#faf5ff',
                  borderRadius: '7px',
                  border: '1px solid #e9d5ff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⏰</span> Tasks On Hold / Reminded ({snoozedTasks.length})
                    </span>
                    <span style={{ fontSize: '10px', color: '#9333ea' }}>Timer paused & saved</span>
                  </div>

                  {snoozedTasks.slice(0, 2).map(snz => {
                    const isDue = Number(snz.remindAt) <= Date.now();
                    const remindTimeStr = new Date(snz.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={snz._id}
                        style={{
                          padding: '6px 8px',
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          border: isDue ? '1px solid #f97316' : '1px solid #e9d5ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#7e22ce' }}>#{snz.taskCode || 'TSK'}:</span> {snz.title}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                            <span>Paused at: <strong>{snz.hoursLoggedText || formatSeconds(snz.timerSeconds || 0)}</strong></span>
                            <span>•</span>
                            <span style={{ color: isDue ? '#ea580c' : '#7e22ce', fontWeight: '700' }}>
                              {isDue ? '🚨 Due Now!' : `Reminding at ${remindTimeStr}`}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => resumeSnoozedTask(snz._id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            backgroundColor: '#7e22ce',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0
                          }}
                        >
                          <Play size={10} fill="#fff" />
                          <span>Resume 🚀</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Clean Minimal All Tasks Completed View */
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '7px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#16a34a" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                    All tasks completed ({myCompletedTasks.length} finished)
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                    No pending tasks in queue.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={() => setIsAddTaskOpen(true)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <Plus size={11} /> Add Task
                </button>
                <button
                  onClick={() => navigate('/timesheet')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Timesheet →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Week Timelogs (Compact & Sleek) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {/* Week Timelogs header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Week Timelogs 📅
              </h4>
              <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                Mon to Sun task activity logs. Click day for breakdown.
              </p>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#0284c7',
              backgroundColor: '#e0f2fe',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}>
              ⚡ {totalWeeklyFormatted} Week
            </span>
          </div>

          {/* Day Circles (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            {(weeklyTimeLogs || []).map((log) => {
              const isToday = log?.isCurrentDay || log?.shortDay === todayDayShort;
              const isSunday = log?.shortDay === 'Su' || log?.isSunday;

              return (
                <div
                  key={log?.shortDay || Math.random()}
                  onClick={() => setSelectedDayLog(log)}
                  title={isSunday ? 'Sunday: Weekly Holiday / Day Off 🏖️' : `${log?.day || ''}: ${log?.durationText || ''} (Click for details)`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '10.5px', color: isToday ? '#0284c7' : isSunday ? '#b45309' : '#64748b', fontWeight: isToday || isSunday ? '800' : '600' }}>
                    {log.shortDay}
                  </span>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: isToday ? '#0284c7' : isSunday ? '#fef3c7' : '#f1f5f9',
                    color: isToday ? '#ffffff' : isSunday ? '#b45309' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: isToday ? '1.5px solid #0284c7' : isSunday ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
                    boxShadow: isToday ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
                    transition: 'all 0.15s ease'
                  }}>
                    {isSunday ? '🏖️' : log.shortDay}
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: isToday ? '#0284c7' : isSunday ? '#b45309' : '#64748b',
                    backgroundColor: isSunday ? '#fef3c7' : 'transparent',
                    padding: isSunday ? '0px 3px' : '0',
                    borderRadius: '3px'
                  }}>
                    {isSunday ? 'OFF' : (isToday && (totalActivityFormatted !== '00:00:00' && totalActivityFormatted !== '0s') ? totalActivityFormatted.split(':')[0] + 'h' : (log.durationText?.split(' ')[0] || '0h'))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Horizontal Progress Timeline */}
          <div>
            <div style={{
              height: '6px',
              backgroundColor: '#0284c7',
              borderRadius: '3px',
              width: '100%'
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
              <span>Today: <strong>{totalActivityFormatted}</strong></span>
              <span>Weekly: <strong>{totalWeeklyFormatted} Logged</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 1: My Tasks & Tickets (Compact & High-Density)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '14px',
        alignItems: 'stretch'
      }}>
        {/* My Tasks & Delegation Table Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  {isUserAdminOrHR ? 'Tasks & Delegation' : 'My Tasks'}
                </h3>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '700',
                  color: '#0284c7',
                  backgroundColor: '#e0f2fe',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {activeScopedTasks.length} Active / New
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {activeScopedTasks.length} pending / newly assigned • {completedScopedTasks.length} recently completed
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Scope Pills for Admin/HR */}
              {isUserAdminOrHR && (
                <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                  <button
                    onClick={() => {
                      setTaskScopeFilter('all');
                      setTaskMemberFilter('all');
                    }}
                    style={{
                      border: 'none',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      backgroundColor: taskScopeFilter === 'all' && taskMemberFilter === 'all' ? '#ffffff' : 'transparent',
                      color: taskScopeFilter === 'all' && taskMemberFilter === 'all' ? '#0284c7' : '#64748b',
                      boxShadow: taskScopeFilter === 'all' && taskMemberFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    All ({(tasks || []).length})
                  </button>
                  <button
                    onClick={() => {
                      setTaskScopeFilter('my');
                      setTaskMemberFilter('all');
                    }}
                    style={{
                      border: 'none',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      backgroundColor: taskScopeFilter === 'my' ? '#ffffff' : 'transparent',
                      color: taskScopeFilter === 'my' ? '#0284c7' : '#64748b',
                      boxShadow: taskScopeFilter === 'my' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    My ({myDirectTasks.length})
                  </button>
                  <button
                    onClick={() => {
                      setTaskScopeFilter('delegated');
                      setTaskMemberFilter('all');
                    }}
                    style={{
                      border: 'none',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      backgroundColor: taskScopeFilter === 'delegated' ? '#ffffff' : 'transparent',
                      color: taskScopeFilter === 'delegated' ? '#0284c7' : '#64748b',
                      boxShadow: taskScopeFilter === 'delegated' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Delegated ({delegatedByMeTasks.length})
                  </button>
                </div>
              )}

              {/* Member filter select for Admin */}
              {isUserAdminOrHR && (employees || []).length > 0 && (
                <select
                  value={taskMemberFilter}
                  onChange={(e) => {
                    setTaskMemberFilter(e.target.value);
                    setTaskScopeFilter('all');
                  }}
                  style={{
                    padding: '3px 6px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">👥 All Members</option>
                  {(employees || []).map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                id="btn-add-task-dashboard"
                onClick={() => setIsAddTaskOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 9px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Assign Task
              </button>
              <button
                onClick={() => navigate('/tasks')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
              >
                All →
              </button>
            </div>
          </div>

          {/* Quick Sub-Filter Tabs: Active & New vs Recently Completed vs All */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '6px',
            marginTop: '2px',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setTaskStatusTab('active')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: taskStatusTab === 'active' ? '#e0f2fe' : 'transparent',
                  color: taskStatusTab === 'active' ? '#0284c7' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>⚡ Active & New</span>
                <span style={{
                  fontSize: '9.5px',
                  backgroundColor: taskStatusTab === 'active' ? '#0284c7' : '#e2e8f0',
                  color: taskStatusTab === 'active' ? '#ffffff' : '#475569',
                  padding: '1px 5px',
                  borderRadius: '8px'
                }}>
                  {activeScopedTasks.length}
                </span>
              </button>

              <button
                onClick={() => setTaskStatusTab('completed')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: taskStatusTab === 'completed' ? '#dcfce7' : 'transparent',
                  color: taskStatusTab === 'completed' ? '#16a34a' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>✅ Recently Completed</span>
                <span style={{
                  fontSize: '9.5px',
                  backgroundColor: taskStatusTab === 'completed' ? '#16a34a' : '#e2e8f0',
                  color: taskStatusTab === 'completed' ? '#ffffff' : '#475569',
                  padding: '1px 5px',
                  borderRadius: '8px'
                }}>
                  {completedScopedTasks.length}
                </span>
              </button>

              <button
                onClick={() => setTaskStatusTab('all')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: taskStatusTab === 'all' ? '#f1f5f9' : 'transparent',
                  color: taskStatusTab === 'all' ? '#334155' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>All Tasks</span>
                <span style={{
                  fontSize: '9.5px',
                  backgroundColor: taskStatusTab === 'all' ? '#334155' : '#e2e8f0',
                  color: taskStatusTab === 'all' ? '#ffffff' : '#475569',
                  padding: '1px 5px',
                  borderRadius: '8px'
                }}>
                  {baseScopedTasks.length}
                </span>
              </button>
            </div>

            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              Click row for details • Instant timer play
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Task#</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Task Title</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Assignee</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Date / Timeline</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tableDisplayTasks.length > 0 ? (
                  tableDisplayTasks.slice(0, 6).map(task => {
                    const isCompleted = task.status === 'completed';
                    const isTaskRunning = task.timerRunning;
                    const isSnoozed = task.snoozed && task.remindAt && !task.reminderDismissed;
                    const isNewAssignment = !isCompleted && (task.status === 'in_progress' || task.status === 'incomplete');

                    return (
                      <tr
                        key={task._id}
                        onClick={() => setSelectedTask(task)}
                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Click to view full task details"
                      >
                        <td style={{ padding: '7px 4px', color: '#0284c7', fontWeight: '700', fontFamily: 'monospace', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                          #{task.taskCode}
                        </td>
                        <td style={{ padding: '7px 4px', color: '#0f172a', fontWeight: '600' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              {task.title}
                            </span>
                            {isTaskRunning && (
                              <span style={{ fontSize: '9px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>
                                ⏱️ LIVE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '400', marginTop: '1px' }}>
                            📁 {task.projectName || 'General Work'}
                          </div>
                        </td>
                        <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <img
                              src={task.assignedToAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                              alt={task.assignedToName}
                              style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155' }}>
                                {task.assignedToName || 'Unassigned'}
                              </span>
                              {task.assignedBy && task.assignedBy !== task.assignedToName && (
                                <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                                  by {task.assignedBy}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}>
                          {isCompleted ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '10.5px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              border: '1px solid #bbf7d0',
                              backgroundColor: '#f0fdf4',
                              color: '#16a34a',
                              fontWeight: '700'
                            }}>
                              <CheckCircle2 size={11} /> Completed
                            </span>
                          ) : isTaskRunning ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '10.5px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              border: '1px solid #bae6fd',
                              backgroundColor: '#f0f9ff',
                              color: '#0284c7',
                              fontWeight: '700'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#0284c7', animation: 'pulse 1.5s infinite' }} />
                              In Progress
                            </span>
                          ) : isSnoozed ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '10.5px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              border: '1px solid #e9d5ff',
                              backgroundColor: '#faf5ff',
                              color: '#7e22ce',
                              fontWeight: '700'
                            }}>
                              <Clock size={10} /> Paused / Remind
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '10.5px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              border: '1px solid #fed7aa',
                              backgroundColor: '#fff7ed',
                              color: '#ea580c',
                              fontWeight: '700'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ea580c' }} />
                              New Assigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '7px 4px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {isCompleted ? (
                            <span style={{ color: '#16a34a', fontWeight: '600' }}>
                              Done: {task.completedOn === todayStr ? 'Today' : (task.completedOn || 'Recent')}
                            </span>
                          ) : task.dueDate === todayStr ? (
                            <span style={{ color: '#ea580c', fontWeight: '700' }}>Due: Today</span>
                          ) : (
                            <span>Due: {task.dueDate || 'Open'}</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {!isCompleted && !isTaskRunning && (
                              <button
                                title="Start Task Timer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTaskTimer(task._id);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  backgroundColor: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                <Play size={9} fill="#fff" /> Start
                              </button>
                            )}

                            {!isCompleted && isTaskRunning && (
                              <button
                                title="Pause Task Timer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pauseTaskTimer(task._id);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  backgroundColor: '#d97706',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                <Pause size={9} fill="#fff" /> Pause
                              </button>
                            )}

                            <button
                              title={isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
                              onClick={(e) => {
                                e.stopPropagation();
                                changeTaskStatus(task._id, isCompleted ? 'incomplete' : 'completed');
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                backgroundColor: isCompleted ? '#f1f5f9' : '#16a34a',
                                color: isCompleted ? '#475569' : '#ffffff',
                                border: 'none',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <CheckCircle2 size={10} />
                              {isCompleted ? 'Reopen' : 'Done'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '18px 0', color: '#94a3b8' }}>
                      <ListTodo size={22} style={{ margin: '0 auto 4px', display: 'block', color: '#cbd5e1' }} />
                      <div style={{ fontSize: '12px', fontWeight: '600' }}>
                        {taskStatusTab === 'completed'
                          ? 'No recently completed tasks found in this view.'
                          : 'No active or new assigned tasks right now.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Support Tickets Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                🎫 Support Tickets
              </h3>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '700',
                color: '#0284c7',
                backgroundColor: '#e0f2fe',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {openTicketsList.length} Open
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setIsRaiseTicketOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 9px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Raise Ticket
              </button>
              <button
                onClick={() => navigate('/tickets')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
              >
                All →
              </button>
            </div>
          </div>

          {/* Ticket Filter Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '6px',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setTicketFilterTab('all')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: ticketFilterTab === 'all' ? '#f1f5f9' : 'transparent',
                  color: ticketFilterTab === 'all' ? '#0f172a' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                All ({(tickets || []).length})
              </button>
              <button
                onClick={() => setTicketFilterTab('open')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: ticketFilterTab === 'open' ? '#eff6ff' : 'transparent',
                  color: ticketFilterTab === 'open' ? '#0284c7' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                Open ({openTicketsList.length})
              </button>
              <button
                onClick={() => setTicketFilterTab('resolved')}
                style={{
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: ticketFilterTab === 'resolved' ? '#f0fdf4' : 'transparent',
                  color: ticketFilterTab === 'resolved' ? '#16a34a' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                Resolved ({resolvedTicketsList.length})
              </button>
            </div>

            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              Click row to view discussion
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Ticket#</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Subject</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Priority</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '6px 4px', fontWeight: '600', textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayTickets.length > 0 ? (
                  displayTickets.slice(0, 6).map(tkt => (
                    <tr
                      key={tkt?._id || Math.random()}
                      onClick={() => setSelectedTicket(tkt)}
                      style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Click to view full discussion & reply"
                    >
                      <td style={{ padding: '7px 4px', color: '#0284c7', fontWeight: '700', fontFamily: 'monospace', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        #{tkt?.ticketCode || 'TKT-1'}
                      </td>
                      <td style={{ padding: '7px 4px', color: '#0f172a', fontWeight: '600' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {tkt?.subject}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>
                          From: {tkt?.requestedBy || tkt?.clientName || 'Employee'}
                        </div>
                      </td>
                      <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: tkt?.priority === 'high' || tkt?.priority === 'urgent' ? '#fef2f2' : (tkt?.priority === 'medium' ? '#fffbeb' : '#f0fdf4'),
                          color: tkt?.priority === 'high' || tkt?.priority === 'urgent' ? '#dc2626' : (tkt?.priority === 'medium' ? '#d97706' : '#16a34a'),
                          border: `1px solid ${tkt?.priority === 'high' || tkt?.priority === 'urgent' ? '#fecaca' : (tkt?.priority === 'medium' ? '#fde68a' : '#bbf7d0')}`
                        }}>
                          {tkt?.priority || 'Normal'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '10.5px',
                          fontWeight: '600',
                          backgroundColor: tkt?.status === 'resolved' || tkt?.status === 'closed' ? '#f0fdf4' : '#eff6ff',
                          color: tkt?.status === 'resolved' || tkt?.status === 'closed' ? '#16a34a' : '#2563eb',
                          border: `1px solid ${tkt?.status === 'resolved' || tkt?.status === 'closed' ? '#bbf7d0' : '#bfdbfe'}`
                        }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: tkt?.status === 'resolved' || tkt?.status === 'closed' ? '#16a34a' : '#2563eb' }} />
                          {tkt?.status || 'Open'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 4px', textAlign: 'right', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {tkt?.requestedOn || 'Today'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '18px 0', color: '#94a3b8' }}>
                      <LifeBuoy size={22} style={{ margin: '0 auto 4px', display: 'block', color: '#cbd5e1' }} />
                      <div style={{ fontSize: '12px', fontWeight: '600' }}>No {ticketFilterTab} support tickets found.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 2: Birthdays, Appreciations & Calendar (Compact & Clean)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px',
        alignItems: 'stretch'
      }}>
        {/* Birthdays Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              🎂 Birthdays
            </h3>
            <button
              onClick={() => navigate('/calendar')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              All →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(computedBirthdays && computedBirthdays.length > 0 ? computedBirthdays : birthdays || []).slice(0, 3).map(bday => (
              <div
                key={bday?._id || Math.random()}
                onClick={() => addToast(`🎉 Birthday wishes sent to ${bday?.name || 'Colleague'}!`, 'success')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffbeb'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                title="Click to send birthday greetings"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={bday?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={bday?.name}
                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{bday?.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>{bday?.role}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#d97706' }}>
                    {bday?.birthdayDate}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {bday?.daysRemainingText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Appreciations Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              🏆 Appreciations
            </h3>
            <button
              onClick={() => navigate('/appreciation')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              All →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(appreciations || []).slice(0, 2).map(app => (
              <div
                key={app?._id || Math.random()}
                onClick={() => navigate('/appreciation')}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Award size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                    {app?.givenToName} — <span style={{ color: '#d97706' }}>{app?.awardName}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    "{app?.appreciationNote}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Calendar Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              📅 Schedule & Events
            </h3>
            <button
              onClick={() => navigate('/calendar')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              Full Calendar →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(events || []).slice(0, 3).map(ev => (
              <div
                key={ev?._id || Math.random()}
                onClick={() => navigate('/calendar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  backgroundColor: ev?.bgColor || '#eff6ff',
                  borderRadius: '5px',
                  borderLeft: `3.5px solid ${ev?.color || '#2563eb'}`,
                  cursor: 'pointer'
                }}
                title="Click to open calendar"
              >
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: ev?.color || '#2563eb', fontFamily: 'monospace' }}>
                  {ev?.time || ev?.startTime || 'All Day'}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#0f172a' }}>
                  {ev?.title || ev?.eventName || 'Company Event'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 3: On Leave, Anniversaries & WFH (Compact & Sleek)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px',
        alignItems: 'stretch'
      }}>
        {/* On Leave Today */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              🏖️ On Leave Today
            </h3>
            <button
              onClick={() => setIsApplyLeaveOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                backgroundColor: '#f1f5f9',
                color: '#0284c7',
                border: '1px solid #cbd5e1',
                padding: '3px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Palmtree size={12} /> Apply
            </button>
          </div>

          {/* Pending Leave Requests for Approval Widget */}
          {pendingLeaveRequestsForMe.length > 0 && (
            <div style={{
              padding: '8px 10px',
              backgroundColor: '#fffbeb',
              borderRadius: '7px',
              border: '1px solid #fde68a',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>⏳ For Your Review ({pendingLeaveRequestsForMe.length})</span>
                <span onClick={() => navigate('/leaves')} style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '10.5px' }}>
                  Manage →
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {pendingLeaveRequestsForMe.slice(0, 2).map(l => (
                  <div key={l._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 7px', backgroundColor: '#ffffff', borderRadius: '5px', border: '1px solid #fef3c7' }}>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a' }}>{l.employeeName}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{l.leaveType} ({l.durationText})</div>
                    </div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button
                        onClick={() => updateLeaveStatus(l._id, 'approved')}
                        style={{ padding: '2px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                        title="Accept & approve leave"
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Optional reason for denying leave:', 'Schedule requirement');
                          if (reason !== null) updateLeaveStatus(l._id, 'rejected', reason);
                        }}
                        style={{ padding: '2px 6px', borderRadius: '3px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                        title="Deny leave"
                      >
                        ✕ Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {employeesOnLeave.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {employeesOnLeave.map(l => (
                <div key={l._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <img src={l.employeeAvatar} alt={l.employeeName} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{l.employeeName}</div>
                    <div style={{ fontSize: '10px', color: '#0284c7' }}>{l.leaveType} ({l.durationText})</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8' }}>
              <Plane size={22} style={{ margin: '0 auto 3px' }} />
              <div style={{ fontSize: '11.5px' }}>No leaves today</div>
            </div>
          )}
        </div>

        {/* Today's Joinings & Work Anniversary */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              🌟 Milestones
            </h3>
            <button
              onClick={() => navigate('/calendar')}
              style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
            >
              Calendar →
            </button>
          </div>

          {(computedAnniversaries || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(computedAnniversaries || []).slice(0, 3).map(anniv => (
                <div
                  key={anniv?._id || Math.random()}
                  onClick={() => addToast(`🌟 Work Anniversary wishes sent to ${anniv?.name || 'Colleague'}! 🎉`, 'success')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    backgroundColor: '#faf5ff',
                    borderRadius: '8px',
                    border: '1px solid #f3e8ff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3e8ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#faf5ff'}
                  title="Click to send anniversary wishes"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={anniv?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={anniv?.name}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #7c3aed' }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                        {anniv?.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600' }}>
                        🌟 {anniv?.serviceYearsText} Anniversary
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                      💼 {anniv?.anniversaryDate}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                      {anniv?.daysRemainingText}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8' }}>
              <Cake size={22} style={{ margin: '0 auto 3px' }} />
              <div style={{ fontSize: '11.5px' }}>No upcoming milestones</div>
            </div>
          )}
        </div>

        {/* On Work From Home Today */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            🏠 Work From Home Today
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            maxHeight: '140px',
            overflowY: 'auto'
          }}>
            {(wfhEmployees || []).map(emp => (
              <div
                key={emp?.id || Math.random()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 7px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '5px'
                }}
              >
                <img
                  src={emp?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={emp?.name}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp?.name} {emp?.isCurrentUser && <span style={{ fontSize: '9px', color: '#2563eb' }}>(You)</span>}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp?.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          BOTTOM SECTION: Company Notices / Announcements (Compact & Sleek)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              📢 Company Notices & Announcements
            </h3>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '1px 0 0 0' }}>
              Official HR notices, policy updates, and team announcements
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isUserAdminOrHR && (
              <button
                onClick={() => setIsAddNoticeOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Add Notice
              </button>
            )}
            <button
              onClick={() => navigate('/notice-board')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              All Notices →
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', alignItems: 'start' }}>
          {(notices || []).map(not => (
            <div
              key={not?._id || Math.random()}
              onClick={() => setSelectedNotice(not)}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: not?.isImportant ? '#dc2626' : '#2563eb',
                    backgroundColor: not?.isImportant ? '#fee2e2' : '#eff6ff',
                    padding: '1px 5px',
                    borderRadius: '3px'
                  }}>
                    {not?.category}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>{not?.date}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                  {not?.title}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px', lineHeight: '1.4' }}>
                  {not?.shortDescription}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>By: <strong>{not?.postedBy}</strong></span>
                <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>View Details →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          MODALS
      ───────────────────────────────────────────────────────────────────────── */}
      <BreakModal
        isOpen={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      <RaiseTicketModal
        isOpen={isRaiseTicketOpen}
        onClose={() => setIsRaiseTicketOpen(false)}
      />

      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
      />

      <EmployeeDirectoryModal
        isOpen={isEmpDirectoryOpen}
        onClose={() => setIsEmpDirectoryOpen(false)}
      />

      <NoticeDetailModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />

      <DayTimeLogModal
        dayLog={selectedDayLog}
        onClose={() => setSelectedDayLog(null)}
      />

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
      />

      <SnoozeTaskModal
        isOpen={isSnoozeModalOpen}
        onClose={() => setIsSnoozeModalOpen(false)}
        task={snoozeTaskTarget}
      />

      <NewLeaveModal
        isOpen={isApplyLeaveOpen}
        onClose={() => setIsApplyLeaveOpen(false)}
      />

      <AddNoticeModal
        isOpen={isAddNoticeOpen}
        onClose={() => setIsAddNoticeOpen(false)}
      />
    </div>
  );
};
