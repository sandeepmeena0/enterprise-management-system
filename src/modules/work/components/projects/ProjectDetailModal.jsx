/**
 * @file ProjectDetailModal.jsx
 * @description Modal showing full details, tasks, and members of a selected project.
 */

import React from 'react';
import {
  X,
  Calendar,
  Building,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  ListTodo,
  TrendingUp,
  Tag
} from 'lucide-react';
import { useWork } from '../../context/WorkContext';

export const ProjectDetailModal = ({ project, onClose, onAddTaskForProject }) => {
  const { tasks } = useWork();
  if (!project) return null;

  const projectTasks = tasks.filter(t => t.projectId === project._id || t.projectCode === project.projectCode);

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
        maxWidth: '780px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #bfdbfe'
              }}>
                {project.projectCode}
              </span>
              <span style={{
                padding: '3px 8px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                fontWeight: '500'
              }}>
                {project.category}
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              {project.name}
            </h2>
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
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary / Description */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0' }}>
              Project Summary
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {project.summary || 'No detailed summary provided for this project.'}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                <Building size={14} /> Client
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{project.client}</div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                <Calendar size={14} /> Timeline
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                {project.startDate} → {project.hasNoDeadline ? 'Ongoing' : project.deadline}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                <TrendingUp size={14} /> Progress
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb' }}>{project.progress || 0}% Completed</div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                <DollarSign size={14} /> Budget
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                {project.budget ? `₹${project.budget.toLocaleString('en-IN')}` : 'Internal / N/A'}
              </div>
            </div>
          </div>

          {/* Assigned Members */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px 0' }}>
              Assigned Team Members ({project.membersList?.length || 0})
            </h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {project.membersList && project.membersList.length > 0 ? (
                project.membersList.map((m, idx) => (
                  <div
                    key={m._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <img
                      src={m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={m.name}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{m.name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{m.role}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>No members assigned to this project yet.</div>
              )}
            </div>
          </div>

          {/* Attached Tasks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Tasks Linked to this Project ({projectTasks.length})
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projectTasks.length > 0 ? (
                projectTasks.map(t => (
                  <div
                    key={t._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', padding: '2px 6px', backgroundColor: '#eff6ff', borderRadius: '4px' }}>
                        {t.taskCode}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#0f172a' }}>
                        {t.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        👤 {t.assignedToName}
                      </span>
                      <span style={{
                        fontSize: '11.5px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: t.status === 'completed' ? '#f0fdf4' : '#eff6ff',
                        color: t.status === 'completed' ? '#16a34a' : '#2563eb',
                        fontWeight: '600'
                      }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No tasks created yet for this project.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '500',
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
