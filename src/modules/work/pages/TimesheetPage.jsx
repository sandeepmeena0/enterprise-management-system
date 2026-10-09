/**
 * @file TimesheetPage.jsx
 * @description Main Timesheet and Time Tracking page with active timers, logs, filters, and manual logging modal.
 */

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Clock,
  Zap,
  Calendar,
  Layers,
  User,
  CheckCircle2,
  TrendingUp,
  Download
} from 'lucide-react';
import { useWork } from '../context/WorkContext';
import { ActiveTimerCard } from '../components/timesheet/ActiveTimerCard';
import { TimesheetTable } from '../components/timesheet/TimesheetTable';
import { LogTimeModal } from '../components/timesheet/LogTimeModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';

export const TimesheetPage = () => {
  const {
    timesheets,
    timesheetFilter,
    setTimesheetFilter,
    projects,
    tasks,
    employees,
    activeRunningTask
  } = useWork();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Statistics calculation
  const totalSeconds = timesheets.reduce((acc, curr) => acc + (curr.totalDurationSeconds || 0), 0);
  const totalHoursLogged = (totalSeconds / 3600).toFixed(1);
  const activeSessionsCount = timesheets.filter(t => t.status === 'active').length + (activeRunningTask ? 1 : 0);
  const uniqueEmployees = new Set(timesheets.map(t => t.employeeId || t.employeeName)).size;

  // Export CSV
  const handleExportCSV = () => {
    if (!timesheets.length) return;
    const headers = ['Task Code', 'Task Title', 'Project', 'Employee', 'Date', 'Start Time', 'End Time', 'Duration', 'Status', 'Memo'];
    const rows = timesheets.map(ts => [
      ts.taskCode || '',
      `"${(ts.taskTitle || '').replace(/"/g, '""')}"`,
      `"${(ts.projectName || '').replace(/"/g, '""')}"`,
      `"${(ts.employeeName || '').replace(/"/g, '""')}"`,
      ts.date,
      ts.startTime || '',
      ts.endTime || '',
      ts.totalDurationText || '',
      ts.status || '',
      `"${(ts.memo || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EMS_Timesheets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
            <span>Work</span>
            <span>•</span>
            <span style={{ color: '#0f172a', fontWeight: '600' }}>Timesheet</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Timesheet & Time Tracking
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '9px 16px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Download size={15} /> Export
          </button>

          <button
            onClick={() => setIsLogModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '9px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0369a1'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0284c7'}
          >
            <Plus size={16} />
            Log Time
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Total Hours Logged</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>
              {totalHoursLogged} hrs
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Active Live Timers</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a', lineHeight: '1.2' }}>
              {activeSessionsCount}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#f8fafc',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Tracked Sessions</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>
              {timesheets.length}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#faf5ff',
            color: '#9333ea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Active Team Members</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#9333ea', lineHeight: '1.2' }}>
              {uniqueEmployees || employees.length}
            </div>
          </div>
        </div>
      </div>

      {/* Active Running Task Banner */}
      <ActiveTimerCard onSelectTask={(task) => setSelectedTask(task)} />

      {/* Filters Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '7px 12px',
          minWidth: '240px',
          flex: 1
        }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            placeholder="Search timesheet logs by task, project, employee..."
            value={timesheetFilter.search}
            onChange={e => setTimesheetFilter(prev => ({ ...prev, search: e.target.value }))}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
              color: '#0f172a'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Employee Filter */}
          <select
            value={timesheetFilter.employeeId}
            onChange={e => setTimesheetFilter(prev => ({ ...prev, employeeId: e.target.value }))}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#334155',
              outline: 'none',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="all">All Employees</option>
            {employees.map(e => (
              <option key={e._id} value={e._id}>{e.name}</option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={timesheetFilter.projectId}
            onChange={e => setTimesheetFilter(prev => ({ ...prev, projectId: e.target.value }))}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#334155',
              outline: 'none',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p._id} value={p._id}>[{p.projectCode}] {p.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={timesheetFilter.status}
            onChange={e => setTimesheetFilter(prev => ({ ...prev, status: e.target.value }))}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#334155',
              outline: 'none',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active (Running)</option>
            <option value="stopped">Logged</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      {/* Timesheet Table */}
      <TimesheetTable />

      {/* Log Time Modal */}
      <LogTimeModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
};
