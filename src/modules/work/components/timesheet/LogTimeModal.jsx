/**
 * @file LogTimeModal.jsx
 * @description Modal for manually logging working hours to the timesheet.
 */

import React, { useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  User,
  FolderGit2,
  Check
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

export const LogTimeModal = ({ isOpen, onClose }) => {
  const {
    projects,
    tasks,
    employees,
    currentUser,
    logTimesheet
  } = useWork();

  const [formData, setFormData] = useState({
    projectId: projects[0]?._id || '',
    taskId: tasks[0]?._id || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedProject = projects.find(p => p._id === formData.projectId) || projects[0];
      const selectedTask = tasks.find(t => t._id === formData.taskId) || tasks[0];
      const selectedEmp = employees.find(e => e._id === formData.employeeId) || employees[0];
      const totalSecs = calculateDurationSeconds();

      const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
      const secs = String(totalSecs % 60).padStart(2, '0');

      await logTimesheet({
        taskId: selectedTask?._id || '',
        taskCode: selectedTask?.taskCode || 'TSK-1',
        taskTitle: selectedTask?.title || 'General Work',
        projectId: selectedProject?._id || '',
        projectName: selectedProject?.name || 'General Project',
        employeeId: selectedEmp?._id || '',
        employeeName: selectedEmp?.name || 'Avinash',
        employeeAvatar: selectedEmp?.avatar || '',
        employeeRole: selectedEmp?.role || '',
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        totalDurationSeconds: totalSecs,
        totalDurationText: `${hrs}h ${mins}m`,
        memo: formData.memo || 'Manual time log',
        isBillable: formData.isBillable,
        status: 'approved'
      });

      onClose();
    } catch (err) {
      console.error(err);
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
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Log Time (Manual Entry)
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Record offline work duration for previous or completed tasks
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Project & Task */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Project *
              </label>
              <select
                value={formData.projectId}
                onChange={e => handleChange('projectId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Task *
              </label>
              <select
                value={formData.taskId}
                onChange={e => handleChange('taskId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
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

          {/* Employee & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Employee (CRM Team) *
              </label>
              <select
                value={formData.employeeId}
                onChange={e => handleChange('employeeId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                {employees.map(e => (
                  <option key={e._id} value={e._id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => handleChange('date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Start Time & End Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
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
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
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
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Memo / Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
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
