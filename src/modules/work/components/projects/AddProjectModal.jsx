/**
 * @file AddProjectModal.jsx
 * @description Streamlined, responsive, and easy-to-write project creation modal.
 */

import React, { useState } from 'react';
import {
  X,
  FolderGit2,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';
import { useToast } from '../../../../shared/context/ToastContext';

const CATEGORIES = [
  'Digital Marketing',
  'Web Development',
  'Mobile App Development',
  'UI/UX Design',
  'Cloud Infrastructure',
  'SEO & Growth',
  'Internal / Ops'
];

const DEPARTMENTS = [
  'Marketing & Growth',
  'Engineering',
  'Product Design',
  'Human Resources',
  'Sales & CRM',
  'Executive Management'
];

export const AddProjectModal = ({ isOpen, onClose }) => {
  const { createProject, employees, projects } = useWork();
  const { addToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 2);
  const deadlineStr = nextMonth.toISOString().split('T')[0];

  const defaultCode = `PRJ-${String(projects.length + 1).padStart(3, '0')}`;

  const [formData, setFormData] = useState({
    name: '',
    projectCode: defaultCode,
    client: '',
    category: 'Digital Marketing',
    department: 'Engineering',
    startDate: todayStr,
    deadline: deadlineStr,
    budget: '50000',
    currency: 'INR',
    summary: '',
    selectedMembers: employees.slice(0, 3).map(e => e._id)
  });

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleMember = (empId) => {
    setFormData(prev => {
      const exists = prev.selectedMembers.includes(empId);
      const next = exists
        ? prev.selectedMembers.filter(id => id !== empId)
        : [...prev.selectedMembers, empId];
      return { ...prev, selectedMembers: next };
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Please enter a project name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createProject({
        name: formData.name.trim(),
        projectCode: (formData.projectCode || defaultCode).toUpperCase(),
        client: formData.client.trim() || 'Internal Company Project',
        category: formData.category,
        department: formData.department,
        startDate: formData.startDate,
        deadline: formData.deadline,
        budget: Number(formData.budget) || 0,
        currency: formData.currency,
        summary: formData.summary.trim(),
        status: 'in_progress',
        progress: 0,
        members: employees
          .filter(e => formData.selectedMembers.includes(e._id))
          .map(e => ({
            _id: e._id,
            name: e.name,
            avatar: e.avatar,
            role: e.role
          }))
      });

      addToast(`Project "${formData.name}" created successfully!`, 'success');
      onClose();
    } catch (err) {
      console.error(err);
      addToast('Failed to create project', 'error');
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
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '760px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe'
            }}>
              <FolderGit2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Create New Project
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Set up a new client or internal project milestone
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Project Name & Code */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                Project Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Inforag Cloud Dashboard"
                autoFocus
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14.5px',
                  fontWeight: '500',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Project Code
              </label>
              <input
                type="text"
                value={formData.projectCode}
                onChange={(e) => handleChange('projectCode', e.target.value)}
                placeholder="PRJ-001"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#2563eb',
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                  textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          {/* Client & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Client / Company Name
              </label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="e.g. Apex Media Group / In-House"
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates & Budget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Project Deadline
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => handleChange('deadline', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Budget (INR ₹)
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => handleChange('budget', e.target.value)}
                placeholder="50000"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Team Members Assignment */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              Assign Team Members ({formData.selectedMembers.length} Selected)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
              {employees.map(emp => {
                const isSelected = formData.selectedMembers.includes(emp._id);
                return (
                  <div
                    key={emp._id}
                    onClick={() => toggleMember(emp._id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <img
                      src={emp.avatar}
                      alt={emp.name}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#1d4ed8' : '#334155' }}>
                      {emp.name}
                    </span>
                    {isSelected && <CheckCircle2 size={13} color="#2563eb" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Summary Textarea */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Project Summary & Scope
            </label>
            <textarea
              rows={3}
              value={formData.summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              placeholder="Describe the main objectives, deliverables, timeline and scope of this project..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                lineHeight: '1.5',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Footer Actions */}
          <div style={{
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Creating Project...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;
