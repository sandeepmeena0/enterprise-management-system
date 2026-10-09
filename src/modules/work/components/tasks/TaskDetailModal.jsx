/**
 * @file TaskDetailModal.jsx
 * @description Detailed view modal for a single task with timer controls and status updates.
 */

import React, { useState } from 'react';
import {
  X,
  Play,
  Pause,
  Square,
  Clock,
  Calendar,
  User,
  Tag,
  FolderGit2,
  CheckCircle2,
  Check
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

export const TaskDetailModal = ({ task, onClose }) => {
  const {
    startTaskTimer,
    pauseTaskTimer,
    stopTaskTimer,
    changeTaskStatus
  } = useWork();

  if (!task) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                padding: '3px 8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #bfdbfe'
              }}>
                {task.taskCode}
              </span>
              <span style={{
                padding: '3px 8px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                fontWeight: '500'
              }}>
                {task.projectName}
              </span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Timer Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: task.timerRunning ? '#eff6ff' : '#f8fafc',
            borderRadius: '10px',
            border: `1px solid ${task.timerRunning ? '#bfdbfe' : '#e2e8f0'}`
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                {task.timerRunning ? 'Work Session In Progress' : 'Work Session Timer'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: task.timerRunning ? '#0284c7' : '#0f172a', fontFamily: 'monospace' }}>
                {task.hoursLoggedText || '00:00:00'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {task.timerRunning ? (
                <>
                  <button
                    onClick={() => pauseTaskTimer(task._id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <Pause size={14} /> Pause
                  </button>
                  <button
                    onClick={() => {
                      stopTaskTimer(task._id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <Square size={14} /> Stop & Log
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startTaskTimer(task._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Play size={14} /> Start Tracking
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0' }}>
              Task Description
            </h4>
            <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {task.description || 'No specific description provided for this task.'}
            </div>
          </div>

          {/* Meta Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px' }}>Assigned Member</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={task.assignedToAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={task.assignedToName}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{task.assignedToName}</span>
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px' }}>Timeline</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                {task.startDate} → {task.hasNoDueDate ? 'No Due Date' : task.dueDate}
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px' }}>Priority</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', textTransform: 'capitalize' }}>
                {task.priority || 'Medium'}
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px' }}>Current Status</div>
              <select
                value={task.status}
                onChange={e => changeTaskStatus(task._id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  outline: 'none'
                }}
              >
                <option value="incomplete">Incomplete</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
