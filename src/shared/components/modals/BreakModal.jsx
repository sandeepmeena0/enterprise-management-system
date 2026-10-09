/**
 * @file BreakModal.jsx
 * @description Modal for selecting break options (Lunch, Tea, Personal) and pausing work session.
 */

import React from 'react';
import {
  X,
  Coffee,
  Utensils,
  User,
  Clock,
  Sparkles,
  Check
} from 'lucide-react';
import { useTimer } from '../../context/TimerContext';

const BREAK_OPTIONS = [
  { id: 'Lunch Break', label: 'Lunch Break', icon: Utensils, duration: '45-60 min', color: '#ea580c', bg: '#fff7ed' },
  { id: 'Tea Break', label: 'Tea / Coffee Break', icon: Coffee, duration: '15-20 min', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'Personal Break', label: 'Personal Break', icon: User, duration: '10-15 min', color: '#9333ea', bg: '#faf5ff' },
  { id: 'Short Rest', label: 'Quick Rest / Stretch', icon: Clock, duration: '5-10 min', color: '#16a34a', bg: '#f0fdf4' }
];

export const BreakModal = ({ isOpen, onClose }) => {
  const { startBreak, isOnBreak, resumeFromBreak, breakType } = useTimer();

  if (!isOpen) return null;

  const handleSelectBreak = (type) => {
    startBreak(type);
    onClose();
  };

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
        maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              {isOnBreak ? 'Current Break Active' : 'Take a Break'}
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              {isOnBreak ? `You are currently on ${breakType}` : 'Select a break category to pause your working clock'}
            </p>
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

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isOnBreak ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Coffee size={32} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
                On {breakType}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                Your break duration is actively tracking. Click below to resume work.
              </p>
              <button
                onClick={() => {
                  resumeFromBreak();
                  onClose();
                }}
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)'
                }}
              >
                Resume Work Session 🚀
              </button>
            </div>
          ) : (
            BREAK_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectBreak(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = opt.bg;
                    e.currentTarget.style.borderColor = opt.color;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: opt.bg,
                      color: opt.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Typical: {opt.duration}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: opt.color,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: opt.bg
                  }}>
                    Start Break →
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
