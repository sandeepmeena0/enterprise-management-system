/**
 * @file ActiveTimerCard.jsx
 * @description Real-time running timer card for active task tracking with Stop & Log controls.
 */

import React, { useState } from 'react';
import {
  Clock,
  Square,
  Eye,
  Pause,
  Play,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

export const ActiveTimerCard = ({ onSelectTask }) => {
  const {
    activeRunningTask,
    stopTaskTimer,
    pauseTaskTimer,
    startTaskTimer,
    formatSeconds
  } = useWork();

  const [memo, setMemo] = useState('');
  const [stopping, setStopping] = useState(false);

  if (!activeRunningTask) {
    return (
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '20px 24px',
        border: '1px dashed #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
              No Active Task Timer Running
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Start tracking from the Tasks table or click "Log Time" to add past hours manually.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStop = async () => {
    setStopping(true);
    await stopTaskTimer(activeRunningTask._id, memo);
    setStopping(false);
    setMemo('');
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      borderRadius: '14px',
      padding: '24px 28px',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '20px',
      boxShadow: '0 10px 20px -5px rgba(2, 132, 199, 0.4)'
    }}>
      {/* Left Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <Zap size={28} fill="#ffffff" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.04em'
            }}>
              {activeRunningTask.taskCode}
            </span>
            <span style={{ fontSize: '12px', color: '#e0f2fe', fontWeight: '500' }}>
              {activeRunningTask.projectName}
            </span>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: '#ffffff' }}>
            {activeRunningTask.title}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#bae6fd' }}>
            <span>👤 Assigned: <strong>{activeRunningTask.assignedToName}</strong></span>
            <span>•</span>
            <span>Started: Today</span>
          </div>
        </div>
      </div>

      {/* Right Controls & Live Clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11.5px', color: '#e0f2fe', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
            Running Duration
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: '800',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {activeRunningTask.hoursLoggedText || '02:17:21'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => onSelectTask && onSelectTask(activeRunningTask)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)'}
          >
            <Eye size={16} /> View
          </button>

          <button
            onClick={handleStop}
            disabled={stopping}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            <Square size={14} fill="#ffffff" />
            {stopping ? 'Logging...' : 'Stop Timer'}
          </button>
        </div>
      </div>
    </div>
  );
};
