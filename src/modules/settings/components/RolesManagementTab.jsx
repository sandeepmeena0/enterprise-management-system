import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Users,
  Award,
  AlertCircle,
  Sparkles,
  Layers,
  Calendar,
  X
} from 'lucide-react';
import {
  getRoles,
  createCustomRole,
  deleteCustomRole,
  getPromotionHistory
} from '../../../shared/services/roleManagementService';
import { useToast } from '../../../shared/context/ToastContext';
import { useHR } from '../../hr/context/HRContext';

export const RolesManagementTab = () => {
  const { addToast } = useToast();
  const { employees, currentUser } = useHR();

  const [roles, setRoles] = useState(getRoles());
  const [promotions, setPromotions] = useState(getPromotionHistory());
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px 0' }}>
      
      {/* Top Title & Quick Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
            Roles, Hierarchy & RBAC Permissions
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Configure standard roles, create customized designations, and review the organization promotion history.
          </p>
        </div>

        <button
          onClick={() => setIsCreateRoleOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
          }}
        >
          <Plus size={16} />
          Create Custom Role
        </button>
      </div>

      {/* Security Rule Highlight Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
      }}>
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e3a8a' }}>
              Super Admin Authority
            </div>
            <div style={{ fontSize: '12px', color: '#3b82f6', lineHeight: '1.5', marginTop: '3px' }}>
              Super Admin has master rights to create <strong>New Admins</strong>, assign HR permissions, delete roles, and oversee all company accounts.
            </div>
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#fef3c7',
          border: '1.5px solid #fde68a',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#92400e' }}>
              HR Manager Authority & Boundaries
            </div>
            <div style={{ fontSize: '12px', color: '#b45309', lineHeight: '1.5', marginTop: '3px' }}>
              HR can promote Team Leads, Seniors, Juniors & Custom Roles, but <strong>CANNOT</strong> create or assign Admin accounts.
            </div>
          </div>
        </div>
      </div>

      {/* Roles & Permissions Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
          System & Custom Designation Matrix ({roles.length} Roles)
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {roles.map(role => (
            <div
              key={role.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      {role.category} • Level {role.level}
                    </span>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>
                      {role.name}
                    </h4>
                  </div>
                  {role.isSystem ? (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      fontSize: '10.5px',
                      fontWeight: '700'
                    }}>
                      System
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      style={{
                        background: '#fee2e2',
                        border: 'none',
                        color: '#dc2626',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      title="Delete Custom Role"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: '1.4' }}>
                  {role.description}
                </p>

                {/* Permissions Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {role.permissions.createAdmins && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: '700' }}>
                      👑 Can Create Admins
                    </span>
                  )}
                  {role.permissions.manageEmployees && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: '600' }}>
                      ✓ Manage Workforce
                    </span>
                  )}
                  {role.permissions.manageSalaries && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#faf5ff', color: '#7e22ce', fontWeight: '600' }}>
                      ✓ Appraise & Salary
                    </span>
                  )}
                  {role.permissions.approveLeaves && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: '600' }}>
                      ✓ Approve Leaves
                    </span>
                  )}
                  {role.permissions.manageProjects && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#b45309', fontWeight: '600' }}>
                      ✓ Work & Sprints
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '11px',
                color: '#64748b',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Assigned to: <strong>{employees.filter(e => e.role === role.name).length} employees</strong></span>
                <span style={{ color: '#2563eb', fontWeight: '600' }}>Active in System</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promotion History Audit Log */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        marginTop: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Official Promotion & Post Upgrade History
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Realtime log of all designation changes (Junior ➔ Senior, Executive ➔ Lead) across departments.
            </p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
            {promotions.length} Total Promotions
          </span>
        </div>

        {promotions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            ✨ No promotion history recorded yet. Use the "Promote" action on employee profiles to elevate team members.
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
                  fontSize: '13px'
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

      {/* Create Custom Role Modal */}
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
                Create New Custom Designation / Role
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
                  Role Designation Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Cloud Architect / Quality Analyst Lead"
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
                    Department Category
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
                  Role Description / Responsibilities
                </label>
                <textarea
                  placeholder="Summarize key responsibilities for this designation..."
                  value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', outline: 'none' }}
                />
              </div>

              {/* Permission Checkbox Matrix */}
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

              {/* Submit Buttons */}
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
                  Create Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
