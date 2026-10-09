/**
 * @file DayTimeLogModal.jsx
 * @description Modal showing granular daily login, logout, break, and net working hour breakdown.
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
  Zap
} from 'lucide-react';

export const DayTimeLogModal = ({ dayLog, onClose }) => {
  if (!dayLog) return null;

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
              {dayLog.day} Time Log ({dayLog.date})
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              Detailed breakdown of login, logout, and break timings
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
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                Net Working Hours
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
              {dayLog.isDayOff ? '🏖️ Weekend' : (dayLog.isCurrentDay ? '🚀 Active Today' : '✅ Completed')}
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                <LogIn size={14} color="#16a34a" /> Clock In Time
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.loginTime}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                <LogOut size={14} color="#dc2626" /> Clock Out Time
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.logoutTime}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                <Coffee size={14} color="#d97706" /> Total Break Time
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                {dayLog.breakDuration}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                <Zap size={14} color="#2563eb" /> Status
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb' }}>
                {dayLog.isDayOff ? 'Day Off' : 'Productive Day'}
              </div>
            </div>
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
              padding: '8px 18px',
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
