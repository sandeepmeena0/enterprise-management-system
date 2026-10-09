/**
 * @file TimesheetTable.jsx
 * @description Table displaying active and historical timesheet tracking records.
 */

import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  MoreVertical,
  Calendar,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

const STATUS_CONFIG = {
  active: { label: 'Active (Running)', color: '#0284c7', bg: '#e0f2fe', dot: '#0284c7' },
  stopped: { label: 'Logged', color: '#64748b', bg: '#f1f5f9', dot: '#94a3b8' },
  approved: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' }
};

export const TimesheetTable = () => {
  const { timesheets, deleteTimesheet } = useWork();
  const [activeMenuId, setActiveMenuId] = useState(null);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this timesheet entry?')) {
      deleteTimesheet(id);
    }
    setActiveMenuId(null);
  };

  if (!timesheets || timesheets.length === 0) {
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
          No Timesheet Records Found
        </h3>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
          Run an active task timer or click "Log Time" to add hours worked.
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
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Task Name
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Project
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Assigned Employee
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Start Time
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                End Time
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Duration
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Date
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Status
              </th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {timesheets.map((entry) => {
              const status = STATUS_CONFIG[entry.status] || STATUS_CONFIG.stopped;
              const isMenuOpen = activeMenuId === entry._id;

              return (
                <tr
                  key={entry._id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Task Name & Code */}
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        {entry.taskCode || 'TSK'}
                      </span>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a' }}>
                          {entry.taskTitle || 'Session'}
                        </div>
                        {entry.memo && (
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            {entry.memo}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Project */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                      {entry.projectName || 'General Work'}
                    </div>
                  </td>

                  {/* Employee */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={entry.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={entry.employeeName}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>
                          {entry.employeeName || 'Avinash'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {entry.employeeRole || 'Strategic'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Start Time */}
                  <td style={{ padding: '16px', fontSize: '13px', color: '#334155', fontFamily: 'monospace' }}>
                    {entry.startTime || '09:30:00'}
                  </td>

                  {/* End Time */}
                  <td style={{ padding: '16px', fontSize: '13px', color: '#334155', fontFamily: 'monospace' }}>
                    {entry.endTime || (entry.status === 'active' ? '— (Running)' : '18:00:00')}
                  </td>

                  {/* Total Duration */}
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: entry.status === 'active' ? '#e0f2fe' : '#f1f5f9',
                      color: entry.status === 'active' ? '#0284c7' : '#0f172a',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      fontFamily: 'monospace'
                    }}>
                      ⏱️ {entry.totalDurationText || '00:00:00'}
                    </span>
                  </td>

                  {/* Date */}
                  <td style={{ padding: '16px', fontSize: '13px', color: '#475569' }}>
                    {entry.date}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      borderRadius: '16px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      backgroundColor: status.bg,
                      color: status.color
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: status.dot
                      }} />
                      {status.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '16px 18px', textAlign: 'right', position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : entry._id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isMenuOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          right: '18px',
                          top: '40px',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          border: '1px solid #e2e8f0',
                          padding: '6px',
                          zIndex: 50,
                          minWidth: '140px',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          onClick={(e) => handleDelete(entry._id, e)}
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
                          <Trash2 size={14} /> Delete Entry
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
    </div>
  );
};
