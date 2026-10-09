/**
 * @file BreakModal.jsx
 * @description Enterprise Break Management & History Reminder Engine:
 * 1. Choose break categories with real-time timers.
 * 2. Active break monitoring with live ticking clock and overtime reminder alerts.
 * 3. Complete Break History Timeline Log tracking every break with start/end times and durations.
 */

import React, { useState } from 'react';
import {
  X,
  Coffee,
  Utensils,
  User,
  Clock,
  Sparkles,
  Check,
  History,
  AlertTriangle,
  Play,
  Trash2,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Heart
} from 'lucide-react';
import { useTimer } from '../../context/TimerContext';

const BREAK_OPTIONS = [
  { id: 'Lunch Break', label: 'Lunch Break', icon: Utensils, duration: '45-60 min', color: '#ea580c', bg: '#fff7ed', limitText: '45 min standard' },
  { id: 'Tea / Coffee Break', label: 'Tea / Coffee Break', icon: Coffee, duration: '15-20 min', color: '#0284c7', bg: '#f0f9ff', limitText: '15 min standard' },
  { id: 'Quick Rest / Stretch', label: 'Quick Rest / Stretch', icon: Clock, duration: '5-10 min', color: '#16a34a', bg: '#f0fdf4', limitText: '10 min standard' },
  { id: 'Personal Break', label: 'Personal Break', icon: User, duration: '10-15 min', color: '#9333ea', bg: '#faf5ff', limitText: '15 min standard' },
  { id: 'Wellness & Prayer', label: 'Wellness & Prayer', icon: Heart, duration: '15-20 min', color: '#db2777', bg: '#fdf2f8', limitText: '15 min standard' }
];

export const BreakModal = ({ isOpen, onClose }) => {
  const {
    startBreak,
    isOnBreak,
    resumeFromBreak,
    breakType,
    currentBreakTimeString,
    currentBreakSeconds,
    breakStartTime,
    activeBreakLimit,
    activeBreakProgress,
    isBreakOverdue,
    breakHistory,
    breakDurationText,
    workDurationText,
    deleteBreakHistoryItem,
    clearTodayBreaks
  } = useTimer();

  const [activeTab, setActiveTab] = useState(isOnBreak ? 'active' : 'choose');
  const [breakNotes, setBreakNotes] = useState('');

  if (!isOpen) return null;

  const handleSelectBreak = (type) => {
    startBreak(type, breakNotes);
    setBreakNotes('');
    onClose();
  };

  const getBreakIcon = (type = '') => {
    if (type.includes('Lunch')) return Utensils;
    if (type.includes('Tea') || type.includes('Coffee')) return Coffee;
    if (type.includes('Wellness') || type.includes('Prayer')) return Heart;
    if (type.includes('Personal')) return User;
    return Clock;
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
        maxWidth: '560px',
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h2 style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coffee size={20} color="#ea580c" />
              <span>Break Management & Reminder Engine</span>
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Pause work clock, monitor break duration, and review your break history logs.
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f1f5f9',
          padding: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('choose')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'choose' ? '#ffffff' : 'transparent',
              color: activeTab === 'choose' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'choose' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Coffee size={15} />
            <span>{isOnBreak ? 'Active Break Timer' : 'Take a Break'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
              color: activeTab === 'history' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <History size={15} />
            <span>Break History & Logs ({breakHistory.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* TAB 1: Take / Monitor Break */}
          {activeTab === 'choose' && (
            isOnBreak ? (
              /* Active Break Live Status */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <div style={{
                  padding: '24px 20px',
                  backgroundColor: isBreakOverdue ? '#fef2f2' : '#fffbeb',
                  borderRadius: '14px',
                  border: isBreakOverdue ? '2px solid #f87171' : '1.5px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: isBreakOverdue ? '#fee2e2' : '#fef3c7',
                    color: isBreakOverdue ? '#dc2626' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}>
                    <Coffee size={32} />
                  </div>

                  <span style={{ fontSize: '11px', fontWeight: '800', color: isBreakOverdue ? '#b91c1c' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Break in Progress • Started at {breakStartTime || 'Recent'}
                  </span>

                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '4px 0 6px 0' }}>
                    {breakType}
                  </h3>

                  {/* Live Break Timer */}
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: isBreakOverdue ? '#dc2626' : '#ea580c',
                    letterSpacing: '0.05em'
                  }}>
                    {currentBreakTimeString}
                  </div>

                  {/* Overtime Reminder Alert */}
                  {isBreakOverdue ? (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={15} />
                      <span>⚠️ Reminder: You have exceeded the typical {Math.floor(activeBreakLimit / 60)}m break duration.</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      Recommended limit: {Math.floor(activeBreakLimit / 60)} mins
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resumeFromBreak();
                    onClose();
                  }}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(22, 163, 74, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Play size={16} fill="#fff" />
                  <span>Resume Work Session & Log Break 🚀</span>
                </button>
              </div>
            ) : (
              /* Select Break Option */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
                  Select Break Category
                </span>

                {BREAK_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectBreak(opt.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: opt.bg,
                          color: opt.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            Typical: {opt.duration} • <span style={{ color: opt.color, fontWeight: '600' }}>{opt.limitText}</span>
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: opt.color,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: opt.bg,
                        border: `1px solid ${opt.bg}`
                      }}>
                        Start Break →
                      </span>
                    </div>
                  );
                })}

                {/* Optional Note */}
                <div style={{ marginTop: '6px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    Quick Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grabbing coffee with engineering lead..."
                    value={breakNotes}
                    onChange={e => setBreakNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )
          )}

          {/* TAB 2: Break History & Reminders Log */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Summary Metric Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px',
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Total Breaks:</span>
                  <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                    {breakHistory.length} Sessions
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Total Break Time:</span>
                  <span style={{ fontWeight: '800', color: '#ea580c', fontSize: '14px' }}>
                    {breakDurationText}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Productive Work:</span>
                  <span style={{ fontWeight: '800', color: '#16a34a', fontSize: '14px' }}>
                    {workDurationText}
                  </span>
                </div>
              </div>

              {/* History Timeline */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                {breakHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#94a3b8', fontSize: '13px' }}>
                    <History size={32} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
                    No breaks recorded yet today. Take a break when you need to recharge!
                  </div>
                ) : (
                  breakHistory.map((item, idx) => {
                    const Icon = getBreakIcon(item.type);
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                              {item.type}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.startTime} ➔ {item.endTime} ({item.durationText})
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#f0fdf4',
                            color: '#15803d'
                          }}>
                            Completed
                          </span>

                          <button
                            type="button"
                            onClick={() => deleteBreakHistoryItem(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            title="Delete log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {breakHistory.length > 0 && (
                <div style={{ textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={clearTodayBreaks}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All Break Logs
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
