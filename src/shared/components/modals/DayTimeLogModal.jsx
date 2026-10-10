/**
 * @file DayTimeLogModal.jsx
 * @description Modal showing granular daily login, logout, break, and task activity breakdown for any day (Mon-Sun).
 */

import React from 'react';
import {
  X,
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  LogIn,
  LogOut,
  Zap,
  ListTodo,
  Briefcase
} from 'lucide-react';

export const DayTimeLogModal = ({ dayLog, onClose }) => {
  if (!dayLog) return null;

  const tasksWorked = dayLog.tasksWorked || [];

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
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
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
              {dayLog.day} Time Log ({dayLog.date})
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              Daily task activity, login/logout, and duration breakdown
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

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Total Duration Callout */}
          <div style={{
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            borderRadius: '12px',
            padding: '18px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#e0f2fe', fontWeight: '600', textTransform: 'uppercase' }}>
                Net Task Working Hours
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', fontFamily: 'monospace' }}>
                {dayLog.durationText}
              </div>
            </div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {dayLog.isSunday ? '🏖️ Sunday Off' : (dayLog.isDayOff ? '🏖️ Weekend Off' : (dayLog.isCurrentDay ? '🚀 Active Today' : '✅ Completed'))}
            </div>
          </div>

          {/* Shift Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', marginBottom: '3px' }}>
                <LogIn size={13} color="#16a34a" /> Clock In Time
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.loginTime || (dayLog.isSunday ? 'Sunday Off' : '09:00 AM')}
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', marginBottom: '3px' }}>
                <LogOut size={13} color="#dc2626" /> Clock Out Time
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.logoutTime || (dayLog.isSunday ? 'Holiday' : '06:00 PM')}
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', marginBottom: '3px' }}>
                <Coffee size={13} color="#d97706" /> Total Break Time
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.breakDuration || '0m'}
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', marginBottom: '3px' }}>
                <Zap size={13} color="#2563eb" /> Day Status
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: dayLog.isSunday ? '#d97706' : '#2563eb' }}>
                {dayLog.isSunday ? 'Sunday Holiday 🏖️' : (dayLog.isDayOff ? 'Day Off' : 'Productive Working Day')}
              </div>
            </div>
          </div>

          {/* 📋 Tasks Worked on this Day */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListTodo size={15} color="#2563eb" /> Tasks Worked on {dayLog.day} ({tasksWorked.length})
              </h4>
            </div>

            {tasksWorked.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {tasksWorked.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe'
                        }}>
                          #{t.taskCode || 'TSK'}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                          {t.taskTitle}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        color: '#0284c7',
                        backgroundColor: '#e0f2fe',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        ⏱️ {t.durationText}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                      <span>Project: <strong>{t.projectName}</strong></span>
                      <span>{t.startTime} - {t.endTime}</span>
                    </div>

                    {t.memo && (
                      <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                        "{t.memo}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '12.5px'
              }}>
                No individual task sessions logged on this day. Total logged shift duration is <strong>{dayLog.durationText}</strong>.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
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
