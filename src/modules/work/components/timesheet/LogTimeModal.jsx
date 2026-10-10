/**
 * @file LogTimeModal.jsx
 * @description Modal for manually logging working hours to the timesheet.
 * Supports:
 * 1. 🏢 Existing Project & Task Selection
 * 2. 📌 Custom / Basic Task direct entry
 * 3. ⏱️ Duration presets & easy-to-use inputs
 */

import React, { useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  User,
  FolderGit2,
  Check,
  Zap,
  Layers,
  FileText
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';
import { useToast } from '../../../../shared/context/ToastContext';

export const LogTimeModal = ({ isOpen, onClose }) => {
  const {
    projects,
    tasks,
    employees,
    currentUser,
    logTimesheet
  } = useWork();
  const { addToast } = useToast();

  const [mode, setMode] = useState(projects.length > 0 && tasks.length > 0 ? 'existing' : 'custom');

  const [formData, setFormData] = useState({
    projectId: projects[0]?._id || '',
    taskId: tasks[0]?._id || '',
    customTaskName: '',
    customProjectName: 'General Work',
    employeeId: currentUser?._id || employees[0]?._id || '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:30:00',
    endTime: '17:30:00',
    memo: '',
    isBillable: true
  });

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateDurationSeconds = () => {
    try {
      const [startH, startM] = formData.startTime.split(':').map(Number);
      const [endH, endM] = formData.endTime.split(':').map(Number);
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      return diffMinutes * 60;
    } catch {
      return 3600;
    }
  };

  const setDurationHours = (hours) => {
    try {
      const [startH, startM] = formData.startTime.split(':').map(Number);
      let endTotalMinutes = startH * 60 + startM + Math.round(hours * 60);
      let endH = Math.floor(endTotalMinutes / 60) % 24;
      let endM = endTotalMinutes % 60;
      const formatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
      setFormData(prev => ({ ...prev, endTime: formatted }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let taskCode = 'GEN';
      let taskTitle = 'General Work';
      let taskId = '';
      let projectId = '';
      let projectName = 'General Project';

      if (mode === 'existing') {
        const selectedProject = projects.find(p => p._id === formData.projectId) || projects[0];
        const selectedTask = tasks.find(t => t._id === formData.taskId) || tasks[0];
        taskCode = selectedTask?.taskCode || 'TSK-1';
        taskTitle = selectedTask?.title || 'General Task';
        taskId = selectedTask?._id || '';
        projectId = selectedProject?._id || '';
        projectName = selectedProject?.name || 'General Project';
      } else {
        taskTitle = formData.customTaskName.trim() || 'Custom Offline Work';
        taskCode = 'CUST';
        projectName = formData.customProjectName.trim() || 'General Work';
      }

      const selectedEmp = employees.find(e => e._id === formData.employeeId) || currentUser || employees[0];
      const totalSecs = calculateDurationSeconds();

      const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');

      await logTimesheet({
        taskId,
        taskCode,
        taskTitle,
        projectId,
        projectName,
        employeeId: selectedEmp?._id || '',
        employeeName: selectedEmp?.name || 'Team Member',
        employeeAvatar: selectedEmp?.avatar || '',
        employeeRole: selectedEmp?.role || '',
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        totalDurationSeconds: totalSecs,
        totalDurationText: `${hrs}h ${mins}m`,
        memo: formData.memo || (mode === 'custom' ? `Custom: ${taskTitle}` : `Manual time log`),
        isBillable: formData.isBillable,
        status: 'approved'
      });

      if (addToast) addToast(`Logged ${hrs}h ${mins}m for "${taskTitle}"`, 'success');
      onClose();
    } catch (err) {
      console.error(err);
      if (addToast) addToast('Failed to log time', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
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
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Log Time (Manual Entry)
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
              Record offline work duration for completed tasks or general work
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

        {/* Mode Toggle Switcher */}
        <div style={{ padding: '16px 24px 0 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px'
          }}>
            <button
              type="button"
              onClick={() => setMode('custom')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: mode === 'custom' ? '#ffffff' : 'transparent',
                color: mode === 'custom' ? '#2563eb' : '#64748b',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'custom' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              📌 Custom / Basic Task
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: mode === 'existing' ? '#ffffff' : 'transparent',
                color: mode === 'existing' ? '#2563eb' : '#64748b',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'existing' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              🏢 Existing Project & Task
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Custom Task Entry */}
          {mode === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Custom Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customTaskName}
                  onChange={e => handleChange('customTaskName', e.target.value)}
                  placeholder="e.g. Client Call or Bug Fixing..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Project / Tag Name
                </label>
                <input
                  type="text"
                  value={formData.customProjectName}
                  onChange={e => handleChange('customProjectName', e.target.value)}
                  placeholder="e.g. General Work, SEO..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          {/* Existing Project & Task Selection */}
          {mode === 'existing' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Project *
                </label>
                <select
                  value={formData.projectId}
                  onChange={e => handleChange('projectId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>[{p.projectCode}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Task *
                </label>
                <select
                  value={formData.taskId}
                  onChange={e => handleChange('taskId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {tasks.map(t => (
                    <option key={t._id} value={t._id}>[{t.taskCode}] {t.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Employee & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Employee (CRM Team) *
              </label>
              <select
                value={formData.employeeId}
                onChange={e => handleChange('employeeId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                {employees.map(e => (
                  <option key={e._id} value={e._id}>
                    {e.name} ({e.role || 'Member'}) {e._id === currentUser?._id ? '— You' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => handleChange('date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                Quick Set Duration:
              </label>
              <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: '700' }}>
                Total: {Math.floor(calculateDurationSeconds() / 3600)}h {Math.floor((calculateDurationSeconds() % 3600) / 60)}m
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[0.5, 1, 2, 4, 6, 8].map(hrs => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setDurationHours(hrs)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.12s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                >
                  {hrs < 1 ? '30m' : `${hrs}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Start Time & End Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Start Time *
              </label>
              <input
                type="time"
                step="1"
                required
                value={formData.startTime}
                onChange={e => handleChange('startTime', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                End Time *
              </label>
              <input
                type="time"
                step="1"
                required
                value={formData.endTime}
                onChange={e => handleChange('endTime', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Memo / Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Work Memo / Description
            </label>
            <textarea
              rows={3}
              placeholder="What did you work on during this session?"
              value={formData.memo}
              onChange={e => handleChange('memo', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Billable Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.isBillable}
              onChange={e => handleChange('isBillable', e.target.checked)}
            />
            Billable Work Session
          </label>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Check size={16} />
              {submitting ? 'Logging...' : 'Log Time'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogTimeModal;
