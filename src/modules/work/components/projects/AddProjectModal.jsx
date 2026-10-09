/**
 * @file AddProjectModal.jsx
 * @description Modal form for creating a new project matching Screenshot 1.
 */

import React, { useState } from 'react';
import {
  X,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Image,
  Link,
  Table,
  Type,
  Check,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

const DEPARTMENTS = [
  'Marketing & Growth',
  'Product Design',
  'Engineering',
  'Human Resources',
  'Infrastructure',
  'Sales & CRM',
  'Finance & Accounts'
];

const CATEGORIES = [
  'Digital Marketing',
  'UI/UX Design',
  'Web Development',
  'Mobile App Development',
  'Cloud Infrastructure',
  'SEO & Growth',
  'General'
];

const CLIENTS = [
  'City Prime Care',
  'Novainfinity Global',
  'In-House Tech Suite',
  'Global Cloud Systems',
  'Apex Media Group',
  'HealthFirst Clinic'
];

export const AddProjectModal = ({ isOpen, onClose }) => {
  const { createProject, employees } = useWork();

  const [formData, setFormData] = useState({
    projectCode: '',
    name: '',
    startDate: '2026-09-25',
    deadline: '2026-11-30',
    hasNoDeadline: false,
    category: 'Digital Marketing',
    department: 'Marketing & Growth',
    client: 'City Prime Care',
    summary: '',
    status: 'in_progress',
    progress: 0,
    publicGanttChart: true,
    publicTaskBoard: true,
    taskApprovalRequired: false,
    budget: '',
    currency: 'INR',
    selectedMembers: []
  });

  const [showOtherDetails, setShowOtherDetails] = useState(false);
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
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }

    setSubmitting(true);
    try {
      const membersList = employees
        .filter(e => formData.selectedMembers.includes(e._id))
        .map(e => ({ _id: e._id, name: e.name, avatar: e.avatar, role: e.role }));

      const code = formData.projectCode.trim()
        ? formData.projectCode.trim().toUpperCase()
        : formData.name.substring(0, 3).toUpperCase();

      await createProject({
        ...formData,
        projectCode: code,
        members: formData.selectedMembers,
        membersList: membersList,
        budget: Number(formData.budget) || 0
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
        maxWidth: '860px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px',
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
              Add Project
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Create a new client or internal enterprise project
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
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row 1: Short Code & Project Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Project Short Code *
              </label>
              <input
                type="text"
                placeholder="e.g. CPC, ERP, NBR"
                value={formData.projectCode}
                onChange={e => handleChange('projectCode', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  textTransform: 'uppercase'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Write a project name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter full project title"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Row 2: Start Date & Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={e => handleChange('startDate', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Deadline *
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.hasNoDeadline}
                    onChange={e => handleChange('hasNoDeadline', e.target.checked)}
                  />
                  There is no project deadline
                </label>
              </div>
              <input
                type="date"
                disabled={formData.hasNoDeadline}
                value={formData.hasNoDeadline ? '' : formData.deadline}
                onChange={e => handleChange('deadline', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: formData.hasNoDeadline ? '#f1f5f9' : '#ffffff',
                  cursor: formData.hasNoDeadline ? 'not-allowed' : 'auto'
                }}
              />
            </div>
          </div>

          {/* Row 3: Category, Department, Client */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Project Category
              </label>
              <select
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Department
              </label>
              <select
                value={formData.department}
                onChange={e => handleChange('department', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Client
              </label>
              <select
                value={formData.client}
                onChange={e => handleChange('client', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                {CLIENTS.map(cl => (
                  <option key={cl} value={cl}>{cl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Summary with Toolbar (as in Screenshot 1) */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Project Summary
            </label>
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                flexWrap: 'wrap'
              }}>
                <select style={{ fontSize: '12px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option>Normal</option>
                  <option>Heading 1</option>
                  <option>Heading 2</option>
                </select>
                <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><List size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ListOrdered size={14} color="#64748b" /></button>
                <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Bold size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Italic size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Underline size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Strikethrough size={14} color="#64748b" /></button>
                <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Image size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Link size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Table size={14} color="#64748b" /></button>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Type size={14} color="#64748b" /></button>
              </div>
              <textarea
                rows={4}
                placeholder="Write project scope, milestones, deliverables, and requirements..."
                value={formData.summary}
                onChange={e => handleChange('summary', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* Toggle Switches / Radio Group (Matching Screenshot 1) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Public Gantt Chart
              </span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="gantt"
                    checked={formData.publicGanttChart === true}
                    onChange={() => handleChange('publicGanttChart', true)}
                  />
                  Enable
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="gantt"
                    checked={formData.publicGanttChart === false}
                    onChange={() => handleChange('publicGanttChart', false)}
                  />
                  Disable
                </label>
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Public Task Board
              </span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="taskboard"
                    checked={formData.publicTaskBoard === true}
                    onChange={() => handleChange('publicTaskBoard', true)}
                  />
                  Enable
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="taskboard"
                    checked={formData.publicTaskBoard === false}
                    onChange={() => handleChange('publicTaskBoard', false)}
                  />
                  Disable
                </label>
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Task needs approval by Admin
              </span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="approval"
                    checked={formData.taskApprovalRequired === true}
                    onChange={() => handleChange('taskApprovalRequired', true)}
                  />
                  Enable
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="approval"
                    checked={formData.taskApprovalRequired === false}
                    onChange={() => handleChange('taskApprovalRequired', false)}
                  />
                  Disable
                </label>
              </div>
            </div>
          </div>

          {/* Other Details Accordion (Matching Screenshot 1) */}
          <div>
            <button
              type="button"
              onClick={() => setShowOtherDetails(!showOtherDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              {showOtherDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Other Details (Members & Status)
            </button>

            {showOtherDetails && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Status & Budget */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Project Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => handleChange('status', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        outline: 'none'
                      }}
                    >
                      <option value="in_progress">In Progress</option>
                      <option value="not_started">Not Started</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="under_review">Under Review</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Budget (INR ₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 250000"
                      value={formData.budget}
                      onChange={e => handleChange('budget', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Assign Team Members (Dynamic from HR Employees) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Assign Team Members (Active CRM & HR Employees)
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '10px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#f8fafc'
                  }}>
                    {employees.map(emp => {
                      const selected = formData.selectedMembers.includes(emp._id);
                      return (
                        <div
                          key={emp._id}
                          onClick={() => toggleMember(emp._id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: selected ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {emp.role}
                            </div>
                          </div>
                          {selected && <Check size={14} color="#2563eb" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons (Matching Screenshot 1) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '16px',
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
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Check size={16} />
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
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
