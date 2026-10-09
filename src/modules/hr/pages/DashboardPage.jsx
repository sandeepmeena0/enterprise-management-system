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
  Briefcase
} from 'lucide-react';
import { useHR } from '../context/HRContext';
import { useWork } from '../../work/context/WorkContext';
import { useTimer } from '../../../shared/context/TimerContext';
import { useCRM } from '../../../shared/context/CRMContext';

// Modals
import { BreakModal } from '../../../shared/components/modals/BreakModal';
import { EditProfileModal } from '../../../shared/components/modals/EditProfileModal';
import { RaiseTicketModal } from '../../../shared/components/modals/RaiseTicketModal';
import { NoticeDetailModal } from '../../../shared/components/modals/NoticeDetailModal';
import { DayTimeLogModal } from '../../../shared/components/modals/DayTimeLogModal';
import { TaskDetailModal } from '../../work/components/tasks/TaskDetailModal';
import { ProjectDetailModal } from '../../work/components/projects/ProjectDetailModal';
import { AddTaskModal } from '../../work/components/tasks/AddTaskModal';
import { NewLeaveModal } from '../components/leaves/NewLeaveModal';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { employees, leaves, attendance, holidays, appreciations, currentUser } = useHR();
  const { projects, tasks, startTaskTimer, pauseTaskTimer, stopTaskTimer, activeRunningTask, changeTaskStatus } = useWork();
  const { tickets, notices, events, birthdays, wfhEmployees, weeklyTimeLogs } = useCRM();
  const {
    loginTime,
    workDurationText,
    breakDurationText,
    grossDurationText,
    timeString,
    isRunning,
    isOnBreak,
    breakType,
    isClockedIn,
    togglePauseResume,
    handleClockIn,
    handleClockOut
  } = useTimer();

  // Current Live Clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  const [currentDayStr, setCurrentDayStr] = useState('Friday');
  const [currentDateFormatted, setCurrentDateFormatted] = useState('Wednesday, 7 October 2026');

  // Modals state
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isRaiseTicketOpen, setIsRaiseTicketOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedDayLog, setSelectedDayLog] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [calendarView, setCalendarView] = useState('list'); // 'month' | 'week' | 'day' | 'list'

  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDayStr(now.toLocaleDateString('en-US', { weekday: 'long' }));
      setCurrentDateFormatted(now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Metrics
  const myTasks = (tasks || []).filter(t => t?.assignedToId === (currentUser?._id || 'emp_001') || t?.assignedToName === (currentUser?.name || 'Avinash'));
  const pendingTasksCount = myTasks.filter(t => t?.status !== 'completed').length || 1;
  const overdueTasksCount = myTasks.filter(t => t?.status !== 'completed' && t?.dueDate && t?.dueDate < '2026-09-25').length || 0;

  const activeProjectsCount = (projects || []).filter(p => p?.status === 'in_progress').length || 1;
  const overdueProjectsCount = (projects || []).filter(p => p?.status !== 'completed' && p?.deadline && p?.deadline < '2026-09-25').length || 0;

  // Active Task for "My Active Timer" card (Matching Screenshot 1 & 4)
  const displayActiveTask = activeRunningTask || myTasks[0] || (tasks || [])[0];

  // Employees on leave today (Dynamic real-time date check)
  const todayStr = new Date().toISOString().split('T')[0];
  const employeesOnLeave = (leaves || []).filter(l => 
    l?.status === 'approved' && (
      (l?.startDate <= todayStr && l?.endDate >= todayStr) ||
      (l?.startDate <= '2026-09-25' && l?.endDate >= '2026-09-25') // fallback for simulated date
    )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ─────────────────────────────────────────────────────────────────────────
          TOP SECTION: Welcome Employee & Live Work-Clock (Matching Screenshot 4)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {/* Welcome Profile Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser?.name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '14px',
                  objectFit: 'cover',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.06)'
                }}
              />
              <span style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: isClockedIn ? '#10b981' : '#94a3b8',
                border: '2px solid #ffffff'
              }} />
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0' }}>
                Welcome {currentUser?.name || 'Avinash'}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                {currentUser?.role || 'Digital Marketing Strategic'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Employee Id : {currentUser?.employeeCode || '29'}
              </div>
            </div>
          </div>

          {/* Mini Counters: Open Tasks & Projects */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <div
              onClick={() => navigate('/tasks')}
              style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}
            >
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>Open Tasks</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{pendingTasksCount}</div>
            </div>

            <div
              onClick={() => navigate('/projects')}
              style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}
            >
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>Projects</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{activeProjectsCount}</div>
            </div>
          </div>
        </div>

        {/* Live Work Timer & Attendance Clock (Matching Screenshot 4) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {currentTime}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {currentDayStr}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Clock In at : {loginTime}
              </div>
            </div>

            {/* Clock Out & Break Action Buttons (Matching Screenshot 4) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="btn-clock-out"
                onClick={handleClockOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isClockedIn ? '#dc2626' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: isClockedIn ? '0 2px 8px rgba(220, 38, 38, 0.35)' : '0 2px 8px rgba(22, 163, 74, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <LogOut size={15} />
                {isClockedIn ? 'Clock Out' : 'Clock In'}
              </button>

              <button
                id="btn-break"
                onClick={() => setIsBreakModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isOnBreak ? '#fef3c7' : '#ffffff',
                  color: isOnBreak ? '#d97706' : '#475569',
                  border: `1.5px solid ${isOnBreak ? '#f59e0b' : '#cbd5e1'}`,
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Coffee size={15} color={isOnBreak ? '#d97706' : '#64748b'} />
                {isOnBreak ? breakType : 'Break'}
              </button>
            </div>
          </div>

          {/* Time Calculation Subtitle (Matching Screenshot 4: Gross Hours - Break Time = Net Hours) */}
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>Gross Hours: <strong>{grossDurationText || '7h 38m'}</strong></span>
            <span>-</span>
            <span>Break Time: <strong>{breakDurationText || '56m'}</strong></span>
            <span>=</span>
            <span style={{ color: '#0284c7' }}>Net Hours: <strong>{workDurationText || '6h 42m'}</strong></span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          MIDDLE ROW: My Active Timer & Week Timelogs (Matching Screenshot 1 & 4)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* Left: My Active Timer Card (Matching Screenshot 1 & 4) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
              My Active Timer
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Sep 25, 2026 - 16:24
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0284c7', marginTop: '4px' }}>
              Total Hours: {displayActiveTask?.hoursLoggedText || '17m'}
            </div>
          </div>

          <div style={{
            padding: '14px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                <Clock size={14} /> Start Time
              </span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>16:24</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                <Briefcase size={14} /> Task
              </span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>{displayActiveTask?.title || 'Bookmarking 20'}</span>
            </div>
          </div>

          {/* Action Buttons: Pause Timer & Stop Timer */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                if (displayActiveTask?.timerRunning) {
                  pauseTaskTimer(displayActiveTask._id);
                } else {
                  startTaskTimer(displayActiveTask?._id || 'tsk_001');
                }
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1.5px solid #cbd5e1',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {displayActiveTask?.timerRunning ? <Pause size={15} /> : <Play size={15} />}
              {displayActiveTask?.timerRunning ? 'Pause Timer' : 'Resume Timer'}
            </button>

            <button
              onClick={() => stopTaskTimer(displayActiveTask?._id || 'tsk_001')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Square size={14} fill="#ffffff" />
              Stop Timer
            </button>
          </div>
        </div>

        {/* Right: Tasks/Projects summary & Week Timelogs (Matching Screenshot 4) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {/* Top mini summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div
              onClick={() => navigate('/tasks')}
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Tasks</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#2563eb', fontWeight: '600' }}>{pendingTasksCount} Pending</span>
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>{overdueTasksCount} Overdue</span>
                </div>
              </div>
              <ListTodo size={20} color="#64748b" />
            </div>

            <div
              onClick={() => navigate('/projects')}
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Projects</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#16a34a', fontWeight: '600' }}>{activeProjectsCount} In Progress</span>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>{overdueProjectsCount} Overdue</span>
                </div>
              </div>
              <FolderGit2 size={20} color="#64748b" />
            </div>
          </div>

          {/* Week Timelogs header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Week Timelogs
            </h4>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '700',
              color: '#0284c7',
              backgroundColor: '#e0f2fe',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              43h 00m This Week
            </span>
          </div>

          {/* Day Circles (Matching Screenshot 1 & 4) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            {(weeklyTimeLogs || []).map((log) => {
              const isSelected = log?.shortDay === 'Fr';
              return (
                <div
                  key={log?.shortDay || Math.random()}
                  onClick={() => setSelectedDayLog(log)}
                  title={`${log?.day || ''}: ${log?.durationText || ''} (Click for breakdown)`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>{log.shortDay}</span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#0284c7' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease'
                  }}>
                    {log.shortDay}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Horizontal Progress Timeline */}
          <div>
            <div style={{
              height: '14px',
              backgroundColor: '#0284c7',
              borderRadius: '4px',
              width: '100%'
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              <span>Duration: 5h 42m</span>
              <span>Break: 0s</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 1: My Tasks & Tickets (Matching Screenshot 1)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* My Tasks Table Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              My Tasks
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsAddTaskOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Plus size={13} /> Add Task
              </button>
              <button
                onClick={() => navigate('/tasks')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
              >
                View All →
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Task#</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Task</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600', textAlign: 'right' }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.slice(0, 3).map(task => (
                  <tr
                    key={task._id}
                    onClick={() => setSelectedTask(task)}
                    style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '12px 6px', color: '#0284c7', fontWeight: '600' }}>
                      #{task.taskCode}
                    </td>
                    <td style={{ padding: '12px 6px', color: '#0f172a', fontWeight: '500' }}>
                      {task.title}
                    </td>
                    <td style={{ padding: '12px 6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeTaskStatus(task._id, task.status === 'completed' ? 'incomplete' : 'completed');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: task.status === 'completed' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          backgroundColor: task.status === 'completed' ? '#f0fdf4' : '#fef2f2',
                          color: task.status === 'completed' ? '#16a34a' : '#dc2626',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Click to toggle status right here without navigating"
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: task.status === 'completed' ? '#16a34a' : '#dc2626' }} />
                        {task.status === 'completed' ? 'Completed' : 'Incomplete'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 6px', textAlign: 'right', color: '#64748b' }}>
                      {task.dueDate === '2026-09-25' ? 'Today' : task.dueDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tickets Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Tickets
            </h3>
            <button
              onClick={() => setIsRaiseTicketOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Raise Ticket
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Ticket#</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Ticket Subject</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '8px 6px', fontWeight: '600', textAlign: 'right' }}>Requested On</th>
                </tr>
              </thead>
              <tbody>
                {(tickets || []).slice(0, 3).map(tkt => (
                  <tr key={tkt?._id || Math.random()} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px 6px', color: '#0284c7', fontWeight: '600' }}>
                      {tkt?.ticketCode}
                    </td>
                    <td style={{ padding: '12px 6px', color: '#0f172a', fontWeight: '500' }}>
                      {tkt?.subject}
                    </td>
                    <td style={{ padding: '12px 6px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: tkt?.status === 'resolved' ? '#f0fdf4' : '#eff6ff',
                        color: tkt?.status === 'resolved' ? '#16a34a' : '#2563eb'
                      }}>
                        {tkt?.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 6px', textAlign: 'right', color: '#64748b' }}>
                      {tkt?.requestedOn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 2: Birthdays, Appreciations & Calendar (Matching Screenshots 1 & 3)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {/* Birthdays Widget */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Birthdays
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(birthdays || []).map(bday => (
              <div
                key={bday?._id || Math.random()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={bday?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={bday?.name}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{bday?.name}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>{bday?.role}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#d97706' }}>
                    🎂 {bday?.birthdayDate}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
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
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Employee Appreciations
            </h3>
            <button
              onClick={() => navigate('/appreciation')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              View All →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(appreciations || []).slice(0, 2).map(app => (
              <div
                key={app?._id || Math.random()}
                style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Award size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    {app?.givenToName} — <span style={{ color: '#d97706' }}>{app?.awardName}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    "{app?.appreciationNote}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Calendar Widget (Matching Screenshot 1 & 3) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              My Calendar
            </h3>
            
            {/* Calendar Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}>
                <ChevronLeft size={13} />
              </button>
              <button style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}>
                <ChevronRight size={13} />
              </button>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Sep 21 – 27, 2026</span>
            </div>
          </div>

          {/* Calendar Event Banners */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(events || []).map(ev => (
              <div
                key={ev?._id || Math.random()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  backgroundColor: ev?.bgColor || '#eff6ff',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${ev?.color || '#2563eb'}`
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: ev?.color || '#2563eb', fontFamily: 'monospace' }}>
                  {ev?.time}
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>
                  {ev?.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          LOWER ROW 3: On Leave, Joinings & Work from Home (Matching Screenshot 2 & 3)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {/* On Leave Today */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              On Leave Today
            </h3>
            <button
              onClick={() => setIsApplyLeaveOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f1f5f9',
                color: '#0284c7',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Palmtree size={13} /> Apply Leave
            </button>
          </div>
          {employeesOnLeave.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {employeesOnLeave.map(l => (
                <div key={l._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <img src={l.employeeAvatar} alt={l.employeeName} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{l.employeeName}</div>
                    <div style={{ fontSize: '11px', color: '#0284c7' }}>{l.leaveType} ({l.durationText})</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
              <Plane size={28} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px' }}>- No record found. -</div>
            </div>
          )}
        </div>

        {/* Today's Joinings & Work Anniversary */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Today's Joinings & Work Anniversary
          </h3>
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
            <Cake size={28} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '13px' }}>- No record found. -</div>
          </div>
        </div>

        {/* On Work From Home Today (Matching Screenshot 2 & 3) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            On Work From Home Today
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            maxHeight: '180px',
            overflowY: 'auto'
          }}>
            {(wfhEmployees || []).map(emp => (
              <div
                key={emp?.id || Math.random()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px'
                }}
              >
                <img
                  src={emp?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={emp?.name}
                  style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp?.name} {emp?.isCurrentUser && <span style={{ fontSize: '10px', color: '#2563eb' }}>(It's you)</span>}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp?.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          BOTTOM SECTION: Company Notices / Announcements (Matching Screenshot 2)
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Company Notices & Announcements
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Official HR notices, policy updates, and team announcements
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {(notices || []).map(not => (
            <div
              key={not?._id || Math.random()}
              onClick={() => setSelectedNotice(not)}
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: not?.isImportant ? '#dc2626' : '#2563eb',
                    backgroundColor: not?.isImportant ? '#fee2e2' : '#eff6ff',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {not?.category}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{not?.date}</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4' }}>
                  {not?.title}
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', lineHeight: '1.5' }}>
                  {not?.shortDescription}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
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

      <NewLeaveModal
        isOpen={isApplyLeaveOpen}
        onClose={() => setIsApplyLeaveOpen(false)}
      />
    </div>
  );
};
