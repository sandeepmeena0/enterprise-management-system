/**
 * @file AddTaskModal.jsx
 * @description Modal form for creating and assigning tasks matching Screenshots 3, 4, 5.
 */

import React, { useState } from 'react';
import {
  X,
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
  UploadCloud,
  FileText
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

const TASK_CATEGORIES = [
  'Digital Marketing',
  'UI/UX Design',
  'Web Development',
  'Content Writing',
  'SEO & Growth',
  'DevOps & Cloud',
  'Client Servicing',
  'QA & Testing'
];

export const AddTaskModal = ({ isOpen, onClose }) => {
  const { createTask, projects, employees, currentUser } = useWork();

  const [formData, setFormData] = useState({
    title: '',
    category: 'Digital Marketing',
    projectId: projects[0]?._id || '',
    startDate: '2026-09-25',
    dueDate: '2026-09-25',
    hasNoDueDate: false,
    assignedToId: currentUser?._id || employees[0]?._id || '',
    description: '',
    // Other Details accordion
    label: '',
    milestone: '',
    status: 'incomplete',
    priority: 'medium',
    isPrivate: false,
    isBillable: true,
    hasTimeEstimate: false,
    estimatedHours: 4,
    isRepeat: false,
    isDependent: false,
    fileName: ''
  });

  const [showOtherDetails, setShowOtherDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.role?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  const handleSave = async (andAddMore = false) => {
    if (!formData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setSubmitting(true);
    try {
      const selectedProject = projects.find(p => p._id === formData.projectId) || projects[0];
      const selectedAssignee = employees.find(e => e._id === formData.assignedToId) || employees[0];

      await createTask({
        ...formData,
        projectId: selectedProject?._id || '',
        projectName: selectedProject?.name || 'General Work',
        projectCode: selectedProject?.projectCode || 'TSK',
        assignedTo: selectedAssignee?._id || null,
        assignedToId: selectedAssignee?._id || '',
        assignedToName: selectedAssignee?.name || 'Unassigned',
        assignedToAvatar: selectedAssignee?.avatar || '',
        assignedToRole: selectedAssignee?.role || '',
        assignedBy: currentUser?.name || 'Avinash',
        assignedById: currentUser?._id || 'emp_001',
        assignedByAvatar: currentUser?.avatar || '',
        assignedByRole: currentUser?.role || 'Team Member',
        estimatedHours: formData.hasTimeEstimate ? Number(formData.estimatedHours) || 0 : 0
      });

      if (andAddMore) {
        setFormData(prev => ({
          ...prev,
          title: '',
          description: ''
        }));
      } else {
        onClose();
      }
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
        maxWidth: '880px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
              Add Task
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Create and assign task to active CRM team members
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
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Section: Task Info (Matching Screenshot 5) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
              Task Info
            </h3>

            {/* Title & Task Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter a task title (e.g. Bookmarking 20)"
                  value={formData.title}
                  onChange={e => handleChange('title', e.target.value)}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Task Category
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
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {TASK_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Project
              </label>
              <select
                value={formData.projectId}
                onChange={e => handleChange('projectId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>
                    [{p.projectCode}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date & Due Date */}
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
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                    Due Date *
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.hasNoDueDate}
                      onChange={e => handleChange('hasNoDueDate', e.target.checked)}
                    />
                    Without Due Date
                  </label>
                </div>
                <input
                  type="date"
                  disabled={formData.hasNoDueDate}
                  value={formData.hasNoDueDate ? '' : formData.dueDate}
                  onChange={e => handleChange('dueDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    backgroundColor: formData.hasNoDueDate ? '#f1f5f9' : '#ffffff',
                    cursor: formData.hasNoDueDate ? 'not-allowed' : 'auto'
                  }}
                />
              </div>
            </div>

            {/* Assigned To (Any Team Member Across Organization) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Assign To (Any Team Member) *
                </label>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Assigning as: <strong style={{ color: '#0f172a' }}>{currentUser?.name || 'Avinash'}</strong>
                </span>
              </div>

              {/* Quick Search for Employee */}
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search employee by name, designation, or department..."
                  value={employeeSearch}
                  onChange={e => setEmployeeSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                maxHeight: '170px',
                overflowY: 'auto'
              }}>
                {filteredEmployees.map(emp => {
                  const isSelected = formData.assignedToId === emp._id;
                  const isSelf = emp._id === currentUser?._id || emp.isCurrentUser;
                  return (
                    <div
                      key={emp._id}
                      onClick={() => handleChange('assignedToId', emp._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp.name}
                          </span>
                          {isSelf && (
                            <span style={{ fontSize: '10px', color: '#2563eb', backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                              You
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.role}
                        </div>
                      </div>
                      {isSelected && <Check size={16} color="#2563eb" />}
                    </div>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                    No employees matching "{employeeSearch}"
                  </div>
                )}
              </div>
            </div>

            {/* Description Editor Toolbar */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Description
              </label>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
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
                    <option>Heading</option>
                  </select>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><List size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ListOrdered size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Bold size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Italic size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Underline size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Strikethrough size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Image size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Link size={14} color="#64748b" /></button>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Table size={14} color="#64748b" /></button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Enter detailed task instructions, URLs, deliverables, and acceptance criteria..."
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13.5px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section: Other Details Accordion (Matching Screenshots 3 & 4) */}
          <div>
            <button
              type="button"
              onClick={() => setShowOtherDetails(!showOtherDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                color: '#0f172a',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              {showOtherDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              Other Details
            </button>

            {showOtherDetails && (
              <div style={{
                marginTop: '14px',
                padding: '20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                {/* Row: Label, Milestones, Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Marketing, SEO, UI"
                      value={formData.label}
                      onChange={e => handleChange('label', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Milestones
                    </label>
                    <select
                      value={formData.milestone}
                      onChange={e => handleChange('milestone', e.target.value)}
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
                      <option value="">-- None --</option>
                      <option value="Milestone 1">Milestone 1 (Initial Setup)</option>
                      <option value="Milestone 2">Milestone 2 (Execution Phase)</option>
                      <option value="Milestone 3">Milestone 3 (Final Review & Delivery)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => handleChange('status', e.target.value)}
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
                      <option value="incomplete">🔴 Incomplete</option>
                      <option value="in_progress">🔵 In Progress</option>
                      <option value="under_review">🟣 Under Review</option>
                      <option value="completed">🟢 Completed</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => handleChange('priority', e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: '240px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                    <option value="urgent">🔥 Urgent</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>

                {/* Checkboxes Grid (Matching Screenshot 4) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isPrivate}
                      onChange={e => handleChange('isPrivate', e.target.checked)}
                    />
                    Make Private ❔
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isBillable}
                      onChange={e => handleChange('isBillable', e.target.checked)}
                    />
                    Billable ❔
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.hasTimeEstimate}
                      onChange={e => handleChange('hasTimeEstimate', e.target.checked)}
                    />
                    Time estimate
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isRepeat}
                      onChange={e => handleChange('isRepeat', e.target.checked)}
                    />
                    Repeat
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isDependent}
                      onChange={e => handleChange('isDependent', e.target.checked)}
                    />
                    Task is dependent on another task
                  </label>
                </div>

                {/* Estimated hours input if enabled */}
                {formData.hasTimeEstimate && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Estimated Time (Hours)
                    </label>
                    <input
                      type="number"
                      value={formData.estimatedHours}
                      onChange={e => handleChange('estimatedHours', e.target.value)}
                      placeholder="e.g. 4"
                      style={{
                        width: '160px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}

                {/* Add File / Choose a file (Matching Screenshot 4) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Add File
                  </label>
                  <div style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <UploadCloud size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '13.5px', color: '#64748b' }}>
                      <span style={{ color: '#2563eb', fontWeight: '600' }}>Choose a file</span> or drag and drop here
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                      PDF, DOCX, PNG, JPG, ZIP up to 25MB
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons (Matching Screenshot 4: Save, Save & Add More, Cancel) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(false)}
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
              {submitting ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(true)}
              style={{
                backgroundColor: '#ffffff',
                color: '#0284c7',
                border: '1px solid #0284c7',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Save & Add More
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
        </div>
      </div>
    </div>
  );
};
