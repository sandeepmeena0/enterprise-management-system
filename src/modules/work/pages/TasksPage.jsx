/**
 * @file TasksPage.jsx
 * @description Main Tasks management page matching Screenshot 2 with filters, CSV export, Table/Kanban views, and modals.
 */

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  UserCheck,
  LayoutList,
  Kanban,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { useWork } from '../context/WorkContext';
import { TasksTable } from '../components/tasks/TasksTable';
import { TasksKanban } from '../components/tasks/TasksKanban';
import { AddTaskModal } from '../components/tasks/AddTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';

export const TasksPage = () => {
  const {
    tasks,
    taskFilter,
    setTaskFilter,
    currentUser,
    projects,
    employees
  } = useWork();

  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [scopeMode, setScopeMode] = useState('all'); // 'all' | 'assigned_to_me' | 'assigned_by_me'

  // Handle Scope Switching
  const handleScopeChange = (mode) => {
    setScopeMode(mode);
    if (mode === 'assigned_to_me') {
      setTaskFilter(prev => ({
        ...prev,
        assignedTo: currentUser?._id || 'emp_001',
        assignedBy: 'all'
      }));
    } else if (mode === 'assigned_by_me') {
      setTaskFilter(prev => ({
        ...prev,
        assignedTo: 'all',
        assignedBy: currentUser?._id || currentUser?.name || 'Avinash'
      }));
    } else {
      setTaskFilter(prev => ({
        ...prev,
        assignedTo: 'all',
        assignedBy: 'all'
      }));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!tasks.length) return;
    const headers = ['Code', 'Title', 'Project', 'Category', 'Assignee', 'Assigned By', 'Start Date', 'Due Date', 'Status', 'Estimated Hours', 'Hours Logged'];
    const rows = tasks.map(t => [
      t.taskCode,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.projectName.replace(/"/g, '""')}"`,
      t.category,
      t.assignedToName,
      t.assignedBy || 'Avinash',
      t.startDate,
      t.hasNoDueDate ? 'No Due Date' : t.dueDate,
      t.status,
      t.estimatedHours || 0,
      t.hoursLogged || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EMS_Tasks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Breadcrumb & Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span>Home</span>
            <span>•</span>
            <span style={{ color: '#0f172a', fontWeight: '600' }}>Tasks</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Tasks & Delegation
          </h1>
        </div>
      </div>

      {/* Top Filter Controls Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '12px 18px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: 1 }}>
          {/* Member Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Member</span>
            <select
              value={taskFilter.assignedTo || 'all'}
              onChange={(e) => {
                setTaskFilter(prev => ({ ...prev, assignedTo: e.target.value, assignedBy: 'all' }));
                setScopeMode('all');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="all">All Members</option>
              {employees?.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Status</span>
            <select
              value={taskFilter.hideCompleted ? 'hide_completed' : taskFilter.status}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'hide_completed') {
                  setTaskFilter(prev => ({ ...prev, hideCompleted: true, status: 'all' }));
                } else {
                  setTaskFilter(prev => ({ ...prev, hideCompleted: false, status: val }));
                }
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="hide_completed">Hide Completed Task</option>
              <option value="all">All Tasks</option>
              <option value="incomplete">Incomplete</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 12px',
            minWidth: '220px',
            flex: 1
          }}>
            <Search size={15} color="#64748b" />
            <input
              type="text"
              placeholder="Search by task title, project, assignee or assigner..."
              value={taskFilter.search}
              onChange={e => setTaskFilter(prev => ({ ...prev, search: e.target.value }))}
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
        </div>
      </div>

      {/* Action Sub-Bar: + Add Task, All / Assigned to Me / Assigned by Me, Export, View Mode */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Add Task Button (Anyone can assign to anyone) */}
          <button
            id="btn-add-task"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0369a1'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0284c7'}
          >
            <Plus size={16} />
            Assign New Task
          </button>

          {/* Scope Filter Pills (All / Assigned To Me / Assigned By Me) */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            gap: '2px'
          }}>
            <button
              onClick={() => handleScopeChange('all')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: scopeMode === 'all' ? '700' : '500',
                backgroundColor: scopeMode === 'all' ? '#ffffff' : 'transparent',
                color: scopeMode === 'all' ? '#0f172a' : '#64748b',
                boxShadow: scopeMode === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              All Team Tasks
            </button>
            <button
              onClick={() => handleScopeChange('assigned_to_me')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: scopeMode === 'assigned_to_me' ? '700' : '500',
                backgroundColor: scopeMode === 'assigned_to_me' ? '#ffffff' : 'transparent',
                color: scopeMode === 'assigned_to_me' ? '#2563eb' : '#64748b',
                boxShadow: scopeMode === 'assigned_to_me' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => handleScopeChange('assigned_by_me')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: scopeMode === 'assigned_by_me' ? '700' : '500',
                backgroundColor: scopeMode === 'assigned_by_me' ? '#ffffff' : 'transparent',
                color: scopeMode === 'assigned_by_me' ? '#0284c7' : '#64748b',
                boxShadow: scopeMode === 'assigned_by_me' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Assigned by Me
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            Export
          </button>
        </div>

        {/* View Switchers: Table, Kanban */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <button
            title="Table View"
            onClick={() => setViewMode('table')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              border: 'none',
              backgroundColor: viewMode === 'table' ? '#0284c7' : 'transparent',
              color: viewMode === 'table' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutList size={16} />
          </button>

          <button
            title="Kanban Board"
            onClick={() => setViewMode('kanban')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              border: 'none',
              backgroundColor: viewMode === 'kanban' ? '#0284c7' : 'transparent',
              color: viewMode === 'kanban' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Kanban size={16} />
          </button>
        </div>
      </div>

      {/* Main View: Table or Kanban */}
      {viewMode === 'table' ? (
        <TasksTable onSelectTask={(task) => setSelectedTask(task)} />
      ) : (
        <TasksKanban onSelectTask={(task) => setSelectedTask(task)} />
      )}

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
};
