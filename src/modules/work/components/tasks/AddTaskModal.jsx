/**
 * @file AddTaskModal.jsx
 * @description Flexible, responsive, and easy-to-use task creation modal.
 * Supports:
 * 1. 📌 Basic / General Task (Standalone - no project needed)
 * 2. 🏢 Existing Project selection
 * 3. ✨ On-the-fly Custom Project Name creation
 * 4. ⚡ 1-Click Task Title & Category Presets
 * 5. ⏱️ Quick Duration Pills (30m, 1h, 2h, 4h, 8h)
 * 6. 📅 Quick Due Date Presets (Today, Tomorrow, 3 Days, Next Week)
 * 7. 👤 Quick "Assign to Me" button
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Calendar,
  Clock,
  User,
  FolderGit2,
  Tag,
  CheckCircle2,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
  Briefcase,
  Zap
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';
import { useToast } from '../../../../shared/context/ToastContext';

const TASK_CATEGORIES = [
  'General',
  'Web Development',
  'UI/UX Design',
  'Digital Marketing',
  'SEO & Growth',
  'DevOps & Cloud',
  'Client Servicing',
  'QA & Testing'
];

const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#64748b', bg: '#f1f5f9' },
  { id: 'medium', label: 'Medium', color: '#2563eb', bg: '#eff6ff' },
  { id: 'high', label: 'High', color: '#ea580c', bg: '#fff7ed' },
  { id: 'urgent', label: 'Urgent 🔥', color: '#dc2626', bg: '#fef2f2' }
];

const QUICK_TASK_PRESETS = [
  { title: 'Bug Fixing & Debugging', category: 'Web Development', hours: 2, icon: '🐞' },
  { title: 'Client Meeting / Discussion', category: 'Client Servicing', hours: 1, icon: '📞' },
  { title: 'UI / UX Design & Assets', category: 'UI/UX Design', hours: 4, icon: '🎨' },
  { title: 'New Feature Implementation', category: 'Web Development', hours: 4, icon: '🚀' },
  { title: 'Documentation & Notes', category: 'General', hours: 1, icon: '📝' },
  { title: 'QA & Testing Verification', category: 'QA & Testing', hours: 2, icon: '🔍' },
  { title: 'Weekly Progress & Reporting', category: 'General', hours: 1, icon: '📊' },
  { title: 'Deployment & Server Setup', category: 'DevOps & Cloud', hours: 2, icon: '⚡' }
];

const HOUR_PRESETS = [0.5, 1, 2, 4, 6, 8];

export const AddTaskModal = ({ isOpen, onClose, initialProjectId = null }) => {
  const { createTask, projects, employees, currentUser, createProject } = useWork();
  const { addToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to format date offset
  const getDateOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Modes: 'basic' (Standalone General Task) | 'existing_project' | 'custom_project'
  const [projectMode, setProjectMode] = useState(
    initialProjectId ? 'existing_project' : (projects.length > 0 ? 'existing_project' : 'basic')
  );

  const [formData, setFormData] = useState({
    title: '',
    category: 'General',
    projectId: initialProjectId || projects[0]?._id || '',
    customProjectName: '',
    startDate: todayStr,
    dueDate: todayStr,
    assignedToId: currentUser?._id || employees[0]?._id || '',
    priority: 'medium',
    estimatedHours: 4,
    description: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialProjectId) {
      setProjectMode('existing_project');
      setFormData(prev => ({ ...prev, projectId: initialProjectId }));
    }
  }, [initialProjectId]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      title: preset.title,
      category: preset.category,
      estimatedHours: preset.hours
    }));
  };

  const handleSave = async (andAddMore = false) => {
    if (!formData.title.trim()) {
      addToast('Please enter a task title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let finalProjectId = '';
      let finalProjectName = 'General Work';
      let finalProjectCode = 'GEN';

      if (projectMode === 'existing_project') {
        const selectedProject = projects.find(p => p._id === formData.projectId) || projects[0];
        if (selectedProject) {
          finalProjectId = selectedProject._id;
          finalProjectName = selectedProject.name;
          finalProjectCode = selectedProject.projectCode || 'PRJ';
        }
      } else if (projectMode === 'custom_project') {
        const customName = formData.customProjectName.trim() || 'Custom Project';
        finalProjectName = customName;
        finalProjectCode = customName.substring(0, 3).toUpperCase();
        // Create the custom project in the background so it's reusable
        try {
          const newProj = await createProject({
            name: customName,
            projectCode: `PRJ-${finalProjectCode}`,
            client: 'Internal / Direct',
            category: formData.category,
            department: 'Engineering',
            startDate: formData.startDate,
            deadline: formData.dueDate,
            budget: 0,
            summary: `Created on the fly with task: ${formData.title.trim()}`,
            status: 'in_progress',
            members: []
          });
          if (newProj && newProj._id) {
            finalProjectId = newProj._id;
            finalProjectCode = newProj.projectCode;
          }
        } catch (e) {
          console.warn('Could not auto-create project record, continuing with task metadata:', e);
        }
      } else {
        // Basic / Standalone Task
        finalProjectId = '';
        finalProjectName = 'General / Basic Task';
        finalProjectCode = 'GEN';
      }

      const selectedAssignee = employees.find(e => e._id === formData.assignedToId) || currentUser || employees[0];

      await createTask({
        title: formData.title.trim(),
        category: formData.category,
        projectId: finalProjectId,
        projectName: finalProjectName,
        projectCode: finalProjectCode,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        priority: formData.priority,
        estimatedHours: Number(formData.estimatedHours) || 0,
        description: formData.description.trim(),
        assignedTo: selectedAssignee?._id || null,
        assignedToId: selectedAssignee?._id || '',
        assignedToName: selectedAssignee?.name || 'Unassigned',
        assignedToEmail: selectedAssignee?.email || '',
        assignedToAvatar: selectedAssignee?.avatar || '',
        assignedToRole: selectedAssignee?.role || '',
        assignedBy: currentUser?.name || 'Admin',
        assignedById: currentUser?._id || 'emp_admin',
        assignedByAvatar: currentUser?.avatar || '',
        assignedByRole: currentUser?.role || 'Administrator',
        status: 'incomplete',
        progress: 0
      });

      addToast(`Task "${formData.title}" created successfully!`, 'success');

      if (andAddMore) {
        setFormData(prev => ({
          ...prev,
          title: '',
          description: '',
          estimatedHours: 4
        }));
      } else {
        onClose();
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to create task', 'error');
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
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '740px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe'
            }}>
              <Plus size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Create New Task
              </h2>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                Quick basic task or assign work under a project
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. PROJECT / BASIC TASK SELECTOR (Custom vs Existing vs Basic) */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '10px' }}>
              <Layers size={16} color="#2563eb" />
              Task Type & Project Assignment:
            </label>

            {/* 3-Way Mode Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setProjectMode('basic')}
                style={{
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: projectMode === 'basic' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: projectMode === 'basic' ? '#eff6ff' : '#ffffff',
                  color: projectMode === 'basic' ? '#1d4ed8' : '#64748b',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>📌</span> Basic Task (No Project)
              </button>

              <button
                type="button"
                onClick={() => setProjectMode('existing_project')}
                style={{
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: projectMode === 'existing_project' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: projectMode === 'existing_project' ? '#eff6ff' : '#ffffff',
                  color: projectMode === 'existing_project' ? '#1d4ed8' : '#64748b',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>🏢</span> Existing Project ({projects.length})
              </button>

              <button
                type="button"
                onClick={() => setProjectMode('custom_project')}
                style={{
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: projectMode === 'custom_project' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: projectMode === 'custom_project' ? '#eff6ff' : '#ffffff',
                  color: projectMode === 'custom_project' ? '#1d4ed8' : '#64748b',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>✨</span> + Custom Project
              </button>
            </div>

            {/* Mode-specific input container */}
            {projectMode === 'existing_project' && (
              <div>
                <select
                  value={formData.projectId}
                  onChange={(e) => handleChange('projectId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #2563eb',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0f172a',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {projects.length > 0 ? (
                    projects.map(p => (
                      <option key={p._id} value={p._id}>
                        [{p.projectCode || 'PRJ'}] {p.name} {p.client ? `— ${p.client}` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No projects added yet — Will create as standalone</option>
                  )}
                </select>
              </div>
            )}

            {projectMode === 'custom_project' && (
              <div>
                <input
                  type="text"
                  value={formData.customProjectName}
                  onChange={(e) => handleChange('customProjectName', e.target.value)}
                  placeholder="Type Custom Project Name (e.g., Mobile App 2.0, Brand Revamp)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #2563eb',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  ✨ This custom project will be created automatically and linked to this task.
                </span>
              </div>
            )}

            {projectMode === 'basic' && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                fontSize: '12.5px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Zap size={15} color="#2563eb" />
                <span>Basic / General standalone task — directly assigned without project dependency.</span>
              </div>
            )}
          </div>

          {/* 2. TASK TITLE & 1-CLICK QUICK PRESET CHIPS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                Task Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Tip: Click quick chips below to auto-fill
              </span>
            </div>

            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Design Landing Page Hero Section or Fix API Latency"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14.5px',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: '#ffffff'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />

            {/* Quick 1-Click Preset Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {QUICK_TASK_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '7px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: formData.title === preset.title ? '#eff6ff' : '#f8fafc',
                    color: formData.title === preset.title ? '#2563eb' : '#475569',
                    borderColor: formData.title === preset.title ? '#bfdbfe' : '#e2e8f0',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.12s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = formData.title === preset.title ? '#eff6ff' : '#f8fafc'}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. ASSIGNEE & CATEGORY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Assignee */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                  Assign To Member
                </label>
                {currentUser && formData.assignedToId !== currentUser._id && (
                  <button
                    type="button"
                    onClick={() => handleChange('assignedToId', currentUser._id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    + Assign to Me
                  </button>
                )}
              </div>
              <select
                value={formData.assignedToId}
                onChange={(e) => handleChange('assignedToId', e.target.value)}
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
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} — {emp.role || 'Team Member'} {emp._id === currentUser?._id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
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
                {TASK_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. PRIORITY & ESTIMATED HOURS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Priority Selector Pills */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Priority Level
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PRIORITIES.map(pri => (
                  <button
                    key={pri.id}
                    type="button"
                    onClick={() => handleChange('priority', pri.id)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: formData.priority === pri.id ? `2px solid ${pri.color}` : '1px solid #e2e8f0',
                      backgroundColor: formData.priority === pri.id ? pri.bg : '#ffffff',
                      color: formData.priority === pri.id ? pri.color : '#64748b',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {pri.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Duration (Hours Pills + Input) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Estimated Duration (Hours)
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {HOUR_PRESETS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleChange('estimatedHours', h)}
                    style={{
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: Number(formData.estimatedHours) === h ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: Number(formData.estimatedHours) === h ? '#eff6ff' : '#ffffff',
                      color: Number(formData.estimatedHours) === h ? '#2563eb' : '#64748b',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {h < 1 ? `${h * 60}m` : `${h}h`}
                  </button>
                ))}
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={formData.estimatedHours}
                  onChange={(e) => handleChange('estimatedHours', e.target.value)}
                  style={{
                    width: '64px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#0f172a',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 5. DATES (Start & Due Date with Quick Presets) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Start Date */}
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

            {/* Due Date + Quick Presets */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                  Due Date
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleChange('dueDate', todayStr)}
                    style={{
                      background: formData.dueDate === todayStr ? '#eff6ff' : '#f1f5f9',
                      color: formData.dueDate === todayStr ? '#2563eb' : '#64748b',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('dueDate', getDateOffset(1))}
                    style={{
                      background: formData.dueDate === getDateOffset(1) ? '#eff6ff' : '#f1f5f9',
                      color: formData.dueDate === getDateOffset(1) ? '#2563eb' : '#64748b',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('dueDate', getDateOffset(3))}
                    style={{
                      background: formData.dueDate === getDateOffset(3) ? '#eff6ff' : '#f1f5f9',
                      color: formData.dueDate === getDateOffset(3) ? '#2563eb' : '#64748b',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    +3 Days
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
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

          {/* 6. DESCRIPTION / INSTRUCTIONS */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Description & Work Notes
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Write task details, key deliverables, guidelines, or links here..."
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
                transition: 'border-color 0.2s',
                fontFamily: 'inherit'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
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

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(true)}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1.5px solid #bfdbfe',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Save & Add Another
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(false)}
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
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTaskModal;
