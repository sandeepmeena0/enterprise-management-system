/**
 * @file TasksTable.jsx
 * @description Task management table view matching Screenshot 2 with active ticking session timers, status controls, and HR integration.
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  MoreVertical,
  Clock,
  Eye,
  Trash2,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

const STATUS_CONFIG = {
  incomplete: { label: 'Incomplete', color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  under_review: { label: 'Under Review', color: '#9333ea', bg: '#faf5ff', dot: '#a855f7' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' }
};

export const TasksTable = ({ onSelectTask }) => {
  const {
    tasks,
    deleteTask,
    changeTaskStatus,
    startTaskTimer,
    pauseTaskTimer,
    stopTaskTimer,
    isEmployeeOnLeave
  } = useWork();

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTaskIds(tasks.map(t => t._id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const toggleSelectTask = (id, e) => {
    e.stopPropagation();
    setSelectedTaskIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTask(id);
    }
    setActiveMenuId(null);
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: '#3b82f6'
        }}>
          <Clock size={28} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
          No Tasks Found
        </h3>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
          Create a new task to assign it to team members and start tracking work.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '14px 16px', width: '36px' }}>
                <input
                  type="checkbox"
                  onChange={toggleSelectAll}
                  checked={selectedTaskIds.length === tasks.length && tasks.length > 0}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Code
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Timer
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Task
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Completed On
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Start Date
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Due Date
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Estimated Time
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Hours Logged
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Assigned To
              </th>
              <th style={{ padding: '14px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Status
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.incomplete;
              const isMenuOpen = activeMenuId === task._id;
              const isSelected = selectedTaskIds.includes(task._id);
              const isOnLeave = isEmployeeOnLeave(task.assignedToId || task.assignedTo);

              return (
                <tr
                  key={task._id}
                  onClick={() => onSelectTask && onSelectTask(task)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isSelected ? '#f8fafc' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: '16px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelectTask(task._id, e)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>

                  {/* Code (e.g. CPC-0) */}
                  <td style={{ padding: '16px 14px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    {task.taskCode || 'TSK-1'}
                  </td>

                  {/* Timer Pill with Controls (Matching Screenshot 2) */}
                  <td style={{ padding: '16px 14px', whiteSpace: 'nowrap' }}>
                    {task.timerRunning ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
                      }}>
                        {/* Pause button */}
                        <button
                          title="Pause Timer"
                          onClick={(e) => {
                            e.stopPropagation();
                            pauseTaskTimer(task._id);
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <Pause size={10} fill="#ffffff" />
                        </button>

                        {/* Stop & Log button */}
                        <button
                          title="Stop Timer & Log to Timesheet"
                          onClick={(e) => {
                            e.stopPropagation();
                            stopTaskTimer(task._id);
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <Square size={9} fill="#ffffff" />
                        </button>

                        <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                          ⏱️ {task.hoursLoggedText || '02:17:21'}
                        </span>
                      </div>
                    ) : (
                      <button
                        title="Start Tracking Work"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTaskTimer(task._id);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#eff6ff';
                          e.currentTarget.style.color = '#2563eb';
                          e.currentTarget.style.borderColor = '#93c5fd';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                      >
                        <Play size={11} fill="#475569" />
                        <span>Start</span>
                      </button>
                    )}
                  </td>

                  {/* Task Name & Project Name subtitle */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.02em' }}>
                      {task.projectName || 'General Work'}
                    </div>
                  </td>

                  {/* Completed On */}
                  <td style={{ padding: '16px 14px', fontSize: '13px', color: '#64748b' }}>
                    {task.completedOn || '—'}
                  </td>

                  {/* Start Date */}
                  <td style={{ padding: '16px 14px', fontSize: '13px', color: '#0f172a' }}>
                    {task.startDate === '2026-09-25' ? 'Today' : task.startDate}
                  </td>

                  {/* Due Date */}
                  <td style={{ padding: '16px 14px', fontSize: '13px', color: '#0f172a' }}>
                    {task.hasNoDueDate ? 'No Due Date' : (task.dueDate === '2026-09-25' ? 'Today' : task.dueDate)}
                  </td>

                  {/* Estimated Time */}
                  <td style={{ padding: '16px 14px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: '700',
                      fontSize: '12px',
                      border: '1px solid #dbeafe'
                    }}>
                      ⏱️ {task.estimatedHours ? `${task.estimatedHours}h 00m` : '0h (Open)'}
                    </span>
                  </td>

                  {/* Hours Logged with Visual Progress Bar */}
                  <td style={{ padding: '16px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                        <span>{task.hoursLogged ? `${task.hoursLogged}h` : (task.hoursLoggedText || '0s')}</span>
                        {task.estimatedHours > 0 && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            color: (Number(task.hoursLogged) || 0) > Number(task.estimatedHours) ? '#dc2626' : '#16a34a'
                          }}>
                            {Math.round(((Number(task.hoursLogged) || 0) / Number(task.estimatedHours)) * 100)}%
                          </span>
                        )}
                      </div>
                      {task.estimatedHours > 0 && (
                        <div style={{
                          width: '100%',
                          height: '5px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round(((Number(task.hoursLogged) || 0) / Number(task.estimatedHours)) * 100))}%`,
                            backgroundColor: (Number(task.hoursLogged) || 0) > Number(task.estimatedHours) ? '#ef4444' : '#2563eb',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Assigned To (Avatar + Name + Smart Leave Badge + Assigner info) */}
                  <td style={{ padding: '16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={task.assignedToAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={task.assignedToName}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          {task.assignedToName || 'Unassigned'}
                        </div>
                        {task.assignedBy && task.assignedBy !== task.assignedToName && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            By {task.assignedBy}
                          </div>
                        )}
                        {isOnLeave && (
                          <span style={{
                            fontSize: '10px',
                            color: '#d97706',
                            backgroundColor: '#fef3c7',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            🌴 On Leave
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status Dropdown */}
                  <td style={{ padding: '16px 14px' }}>
                    <select
                      value={task.status}
                      onClick={e => e.stopPropagation()}
                      onChange={(e) => changeTaskStatus(task._id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: status.bg,
                        color: status.color,
                        border: `1px solid ${status.dot}33`,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="incomplete">🔴 Incomplete</option>
                      <option value="in_progress">🔵 In Progress</option>
                      <option value="under_review">🟣 Under Review</option>
                      <option value="completed">🟢 Completed</option>
                    </select>
                  </td>

                  {/* Action Dropdown Menu */}
                  <td style={{ padding: '16px 16px', textAlign: 'right', position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : task._id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isMenuOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          right: '16px',
                          top: '40px',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          border: '1px solid #e2e8f0',
                          padding: '6px',
                          zIndex: 50,
                          minWidth: '150px',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          onClick={() => {
                            onSelectTask && onSelectTask(task);
                            setActiveMenuId(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            color: '#334155',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Eye size={14} color="#3b82f6" /> View Details
                        </div>
                        <div
                          onClick={(e) => handleDelete(task._id, e)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={14} /> Delete Task
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer & Pagination (Matching Screenshot 2) */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Show</span>
          <select
            defaultValue="25"
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              color: '#334155',
              outline: 'none'
            }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span>entries</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Showing 1 to {tasks.length} of {tasks.length} entries</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              disabled
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Previous
            </button>
            <button
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #0284c7',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              1
            </button>
            <button
              disabled
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
