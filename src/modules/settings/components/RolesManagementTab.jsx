import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Lock,
  Users,
  Award,
  AlertCircle,
  Sparkles,
  Layers,
  Calendar,
  X,
  Zap,
  Check,
  Briefcase,
  UserCheck,
  ArrowRight,
  Shield,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import {
  getRoles,
  createCustomRole,
  deleteCustomRole,
  getPromotionHistory,
  SYSTEM_ROLES
} from '../../../shared/services/roleManagementService';
import { useToast } from '../../../shared/context/ToastContext';
import { useHR } from '../../hr/context/HRContext';
import { ROLES, ROLE_CONFIGS, getUserRole } from '../../../shared/utils/permissionUtils';

export const RolesManagementTab = () => {
  const { addToast } = useToast();
  const { employees, currentUser, updateEmployee } = useHR();

  const [roles, setRoles] = useState(getRoles());
  const [promotions, setPromotions] = useState(getPromotionHistory());
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'cards' | 'history'

  // New Custom Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCategory, setNewRoleCategory] = useState('Engineering');
  const [newRoleLevel, setNewRoleLevel] = useState(3);
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState({
    manageEmployees: false,
    manageSalaries: false,
    approveLeaves: true,
    manageProjects: true,
    postNotices: false,
    viewFinancials: false
  });

  useEffect(() => {
    const handleUpdate = () => {
      setRoles(getRoles());
      setPromotions(getPromotionHistory());
    };
    window.addEventListener('ems_roles_updated', handleUpdate);
    window.addEventListener('ems_promotions_updated', handleUpdate);
    return () => {
      window.removeEventListener('ems_roles_updated', handleUpdate);
      window.removeEventListener('ems_promotions_updated', handleUpdate);
    };
  }, []);

  const activeUserRole = getUserRole(currentUser);

  // Quick Role Simulator Switcher for testing
  const handleSimulateRole = async (targetRoleId) => {
    if (!currentUser) return;
    const config = ROLE_CONFIGS[targetRoleId];
    if (!config) return;

    try {
      await updateEmployee(currentUser._id || 'emp_1', {
        role: config.name,
        systemRole: targetRoleId,
        designation: config.name
      });
      addToast({
        title: `Switched to ${config.badge} 🎭`,
        message: `Active session now operating with ${config.name} permissions across all CRM modules.`,
        type: 'success'
      });
    } catch (err) {
      addToast('Failed to switch role simulation', 'error');
    }
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    createCustomRole({
      name: newRoleName.trim(),
      category: newRoleCategory,
      level: newRoleLevel,
      description: newRoleDescription,
      permissions: newRolePermissions
    });

    addToast({
      title: 'Custom Role Created 🎖️',
      message: `Role "${newRoleName}" added with customized permissions. Ready for employee assignment.`,
      type: 'success'
    });

    setNewRoleName('');
    setNewRoleDescription('');
    setIsCreateRoleOpen(false);
  };

  const handleDeleteRole = (roleId, roleName) => {
    deleteCustomRole(roleId);
    addToast({
      title: 'Custom Role Removed 🗑️',
      message: `Role "${roleName}" has been removed.`,
      type: 'info'
    });
  };

  // Detailed 11-Module RBAC Matrix Data
  const rbacMatrix = [
    {
      module: 'System & Security Settings',
      category: 'Administration',
      admin: { allowed: true, text: 'Full Master Access & Branding' },
      hr: { allowed: false, text: 'No Access' },
      teamLeader: { allowed: false, text: 'No Access' },
      teamMember: { allowed: false, text: 'No Access' }
    },
    {
      module: 'Role & RBAC Management',
      category: 'Administration',
      admin: { allowed: true, text: 'Assign & Create Roles' },
      hr: { allowed: false, text: 'No Access' },
      teamLeader: { allowed: false, text: 'No Access' },
      teamMember: { allowed: false, text: 'No Access' }
    },
    {
      module: 'Employee Directory & Onboarding',
      category: 'Workforce',
      admin: { allowed: true, text: 'Add, Edit, Delete & Promote' },
      hr: { allowed: true, text: 'Onboard & Edit Documents' },
      teamLeader: { allowed: 'partial', text: 'Team Directory View' },
      teamMember: { allowed: 'partial', text: 'Public Directory View' }
    },
    {
      module: 'Leave Approvals & Policy',
      category: 'Workforce',
      admin: { allowed: true, text: 'Universal Approve / Reject' },
      hr: { allowed: true, text: 'Full HR Leave Approvals' },
      teamLeader: { allowed: true, text: 'Approve Squad Members' },
      teamMember: { allowed: false, text: 'Apply Personal Leaves Only' }
    },
    {
      module: 'Official Company Holidays',
      category: 'Workforce',
      admin: { allowed: true, text: 'Declare, Edit & Delete' },
      hr: { allowed: true, text: 'Declare, Edit & Delete' },
      teamLeader: { allowed: 'partial', text: 'View Holiday Calendar' },
      teamMember: { allowed: 'partial', text: 'View Holiday Calendar' }
    },
    {
      module: 'Shift Attendance & Timer Breaks',
      category: 'Workforce',
      admin: { allowed: true, text: 'Full Company Shift Matrix' },
      hr: { allowed: true, text: 'Monthly Attendance Reports' },
      teamLeader: { allowed: 'partial', text: 'Squad Timesheet Oversight' },
      teamMember: { allowed: true, text: '8h 30m Clock In/Out & 1-Click Breaks' }
    },
    {
      module: 'Projects, Sprints & Tasks',
      category: 'Operations',
      admin: { allowed: true, text: 'Manage All Projects & Sprints' },
      hr: { allowed: 'partial', text: 'Resource & Allocation View' },
      teamLeader: { allowed: true, text: 'Create Projects & Assign Tasks' },
      teamMember: { allowed: 'partial', text: 'Execute Assigned Tasks' }
    },
    {
      module: 'CRM Leads & Deals Pipeline',
      category: 'Operations',
      admin: { allowed: true, text: 'Full CRM Leads & Pipeline' },
      hr: { allowed: 'partial', text: 'View Pipeline Overview' },
      teamLeader: { allowed: true, text: 'Manage Team Deals & Leads' },
      teamMember: { allowed: 'partial', text: 'Assigned Leads Only' }
    },
    {
      module: 'Payroll, Salary Slips & Claims',
      category: 'Finance',
      admin: { allowed: true, text: 'Full Payroll & Salary Hikes' },
      hr: { allowed: true, text: 'Generate Payslips & Review Claims' },
      teamLeader: { allowed: 'partial', text: 'Submit Project Expenses' },
      teamMember: { allowed: 'partial', text: 'Download My Payslips & Claims' }
    },
    {
      module: 'Support Tickets & Resolution',
      category: 'Helpdesk',
      admin: { allowed: true, text: 'Manage All System Tickets' },
      hr: { allowed: true, text: 'Internal HR/Employee Tickets' },
      teamLeader: { allowed: true, text: 'Client & Project Tickets' },
      teamMember: { allowed: 'partial', text: 'Raise Support Tickets' }
    },
    {
      module: 'Company Notices & Announcements',
      category: 'Communication',
      admin: { allowed: true, text: 'Publish, Pin & Delete All' },
      hr: { allowed: true, text: 'Publish HR & Company Notices' },
      teamLeader: { allowed: true, text: 'Post Squad Announcements' },
      teamMember: { allowed: 'partial', text: 'Read-only & Acknowledge' }
    }
  ];

  const renderMatrixBadge = (perm) => {
    if (perm.allowed === true) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            color: '#16a34a',
            fontSize: '11px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            ✓
          </span>
          <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>{perm.text}</span>
        </div>
      );
    }
    if (perm.allowed === 'partial') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontSize: '11px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            👁️
          </span>
          <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>{perm.text}</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          color: '#94a3b8',
          fontSize: '11px',
          fontWeight: 'bold',
          flexShrink: 0
        }}>
          ✕
        </span>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{perm.text}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0 32px 0' }}>
      
      {/* ── Top Header & Active User Role Live Simulator ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Role-Based Access Control (RBAC) Matrix
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                Standard 4-tier hierarchy: <strong>Admin</strong> ➔ <strong>HR</strong> ➔ <strong>Team Leader (TL)</strong> ➔ <strong>Team Member (Employee under TL)</strong>.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsCreateRoleOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1.5px solid #bfdbfe',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Plus size={15} />
              <span>Add Custom Role</span>
            </button>
          </div>
        </div>

        {/* Live Role Switcher / Simulator Bar */}
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
              🎭 Live Role Simulator:
            </span>
            <span style={{
              padding: '3px 10px',
              borderRadius: '20px',
              backgroundColor: ROLE_CONFIGS[activeUserRole]?.bg || '#eff6ff',
              color: ROLE_CONFIGS[activeUserRole]?.color || '#2563eb',
              border: `1px solid ${ROLE_CONFIGS[activeUserRole]?.border || '#bfdbfe'}`,
              fontSize: '12px',
              fontWeight: '700'
            }}>
              Active: {ROLE_CONFIGS[activeUserRole]?.badge || '👑 Admin'} ({currentUser?.name || 'User'})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>Test permissions as:</span>
            {Object.values(ROLES).map(rId => {
              const cfg = ROLE_CONFIGS[rId];
              const isActive = activeUserRole === rId;
              return (
                <button
                  key={rId}
                  onClick={() => handleSimulateRole(rId)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: isActive ? `1.5px solid ${cfg.color}` : '1px solid #cbd5e1',
                    backgroundColor: isActive ? cfg.bg : '#ffffff',
                    color: isActive ? cfg.color : '#475569',
                    fontSize: '12px',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Switch active session to ${cfg.name}`}
                >
                  <span>{cfg.badge}</span>
                  {isActive && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4 Standard Roles Cards Overview ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '14px'
      }}>
        {Object.values(ROLES).map(rId => {
          const cfg = ROLE_CONFIGS[rId];
          const isCurrentActive = activeUserRole === rId;
          const assignedCount = employees.filter(e => getUserRole(e) === rId).length;

          return (
            <div
              key={rId}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: isCurrentActive ? `2px solid ${cfg.color}` : '1px solid #e2e8f0',
                padding: '18px',
                boxShadow: isCurrentActive ? `0 4px 12px ${cfg.color}25` : '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.border}`
                  }}>
                    Level {cfg.level} • {cfg.badge}
                  </span>
                  {isCurrentActive && (
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={12} /> Active
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '4px 0 6px 0' }}>
                  {cfg.name}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.45', margin: '0 0 12px 0' }}>
                  {cfg.description}
                </p>

                {/* Key Privilege Tags */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  {cfg.permissions.slice(0, 3).map((p, idx) => (
                    <div key={idx} style={{ fontSize: '11.5px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: cfg.color, fontWeight: 'bold' }}>•</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: '#64748b'
              }}>
                <span>Assigned: <strong>{assignedCount} members</strong></span>
                <button
                  onClick={() => handleSimulateRole(rId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cfg.color,
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '11.5px'
                  }}
                >
                  {isCurrentActive ? 'Current Role' : 'Switch ➔'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tab Switcher: Matrix Comparison vs Promotion History ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'matrix' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'matrix' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Layers size={15} />
          <span>Full RBAC Permissions Matrix</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'history' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'history' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Award size={15} />
          <span>Promotion & Role Upgrade Log ({promotions.length})</span>
        </button>
      </div>

      {/* ── Tab 1: Detailed RBAC Matrix Table ── */}
      {activeTab === 'matrix' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Module-by-Module Permission Comparison (All 4 Roles)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Clear breakdown of exact rights granted to Admin, HR, Team Leader, and Team Member across the 11 system modules.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '800', color: '#1e293b', width: '240px' }}>
                    CRM Module / Feature
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: '800', color: '#1d4ed8', width: '220px' }}>
                    👑 Admin (Level 1)
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: '800', color: '#0369a1', width: '220px' }}>
                    💼 HR (Level 2)
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: '800', color: '#6d28d9', width: '220px' }}>
                    🚀 Team Leader (Level 3)
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: '800', color: '#15803d', width: '220px' }}>
                    <div>👤 Team Member (Level 4)</div>
                    <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#16a34a', marginTop: '2px' }}>
                      (Employee under TL)
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rbacMatrix.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>
                        {row.module}
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                        {row.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {renderMatrixBadge(row.admin)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {renderMatrixBadge(row.hr)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {renderMatrixBadge(row.teamLeader)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {renderMatrixBadge(row.teamMember)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Promotion & Role Upgrade Log ── */}
      {activeTab === 'history' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Official Promotion & Post Upgrade History
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Complete audit trail of designation changes and role elevations across departments.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
              {promotions.length} Total Records
            </span>
          </div>

          {promotions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              ✨ No promotion records found yet. Use the "Promote / Change Role" action on employee profiles to elevate team members.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {promotions.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={item.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={item.employeeName}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.employeeName}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        <span style={{ textDecoration: 'line-through' }}>{item.previousRole}</span>
                        {' ➔ '}
                        <strong style={{ color: '#16a34a' }}>{item.newRole}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      Promoted on {item.effectiveDate}
                    </span>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      By {item.promotedBy} • {item.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Custom Role Modal ── */}
      {isCreateRoleOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Create New Custom Role / Designation
              </h3>
              <button
                onClick={() => setIsCreateRoleOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Role Title / Designation Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Solution Architect / Principal QA Engineer"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #3b82f6',
                    fontSize: '13px',
                    outline: 'none',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={newRoleCategory}
                    onChange={e => setNewRoleCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product Design">Product Design</option>
                    <option value="Marketing & Growth">Marketing & Growth</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Hierarchy Seniority Level
                  </label>
                  <select
                    value={newRoleLevel}
                    onChange={e => setNewRoleLevel(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value={2}>Level 2 — Senior Leadership / Partner</option>
                    <option value={3}>Level 3 — Team Leader / Squad Lead</option>
                    <option value={4}>Level 4 — Senior Specialist / Lead</option>
                    <option value={5}>Level 5 — Associate / Junior</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Description / Responsibilities
                </label>
                <textarea
                  placeholder="Summarize key responsibilities for this role..."
                  value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                  Assigned Security Privileges:
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRolePermissions.approveLeaves}
                      onChange={e => setNewRolePermissions(p => ({ ...p, approveLeaves: e.target.checked }))}
                    />
                    Approve Team Leaves
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRolePermissions.manageProjects}
                      onChange={e => setNewRolePermissions(p => ({ ...p, manageProjects: e.target.checked }))}
                    />
                    Manage Tasks & Projects
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRolePermissions.manageEmployees}
                      onChange={e => setNewRolePermissions(p => ({ ...p, manageEmployees: e.target.checked }))}
                    />
                    Onboard Employees
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRolePermissions.manageSalaries}
                      onChange={e => setNewRolePermissions(p => ({ ...p, manageSalaries: e.target.checked }))}
                    />
                    View & Appraise Salaries
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.25)' }}
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
