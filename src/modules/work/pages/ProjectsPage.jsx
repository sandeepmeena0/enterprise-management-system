/**
 * @file ProjectsPage.jsx
 * @description Main Projects Management Page with overview stats, filters, table view, and modals.
 */

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Layers,
  FolderGit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { useWork } from '../context/WorkContext';
import { ProjectsTable } from '../components/projects/ProjectsTable';
import { AddProjectModal } from '../components/projects/AddProjectModal';
import { ProjectDetailModal } from '../components/projects/ProjectDetailModal';

export const ProjectsPage = () => {
  const { projects, projectFilter, setProjectFilter, loading } = useWork();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Statistics
  const totalProjects = projects.length;
  const inProgressCount = projects.filter(p => p.status === 'in_progress').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const reviewCount = projects.filter(p => p.status === 'under_review' || p.status === 'on_hold').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
            <span>Work</span>
            <span>•</span>
            <span style={{ color: '#0f172a', fontWeight: '600' }}>Projects</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Projects Management
          </h1>
        </div>

        <button
          id="btn-add-project"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0369a1'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0284c7'}
        >
          <Plus size={16} />
          Add Project
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderGit2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Total Projects</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>
              {totalProjects}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>In Progress</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a', lineHeight: '1.2' }}>
              {inProgressCount}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#eff6ff',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Completed</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#2563eb', lineHeight: '1.2' }}>
              {completedCount}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Under Review / Hold</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#d97706', lineHeight: '1.2' }}>
              {reviewCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '8px 14px',
          minWidth: '280px',
          flex: '1'
        }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search projects by name, code, client..."
            value={projectFilter.search}
            onChange={e => setProjectFilter(prev => ({ ...prev, search: e.target.value }))}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '13.5px',
              width: '100%',
              color: '#0f172a'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            value={projectFilter.status}
            onChange={e => setProjectFilter(prev => ({ ...prev, status: e.target.value }))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#334155',
              outline: 'none'
            }}
          >
            <option value="all">All Status</option>
            <option value="in_progress">In Progress</option>
            <option value="not_started">Not Started</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="under_review">Under Review</option>
          </select>

          {/* Department Filter */}
          <select
            value={projectFilter.department}
            onChange={e => setProjectFilter(prev => ({ ...prev, department: e.target.value }))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#334155',
              outline: 'none'
            }}
          >
            <option value="all">All Departments</option>
            <option value="Marketing & Growth">Marketing & Growth</option>
            <option value="Product Design">Product Design</option>
            <option value="Engineering">Engineering</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Infrastructure">Infrastructure</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <ProjectsTable onSelectProject={(proj) => setSelectedProject(proj)} />

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
};
