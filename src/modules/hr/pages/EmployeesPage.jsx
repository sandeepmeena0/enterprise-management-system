import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Award,
  User,
  ShieldCheck,
  Building,
  Mail,
  Calendar,
  Layers,
  Sparkles,
  Trash2,
  Lock,
  ArrowRight,
  TrendingUp,
  Filter
} from 'lucide-react';
import { useHR } from '../context/HRContext';
import { useToast } from '../../../shared/context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { AddEmployeeModal } from '../components/employees/AddEmployeeModal';
import { PromoteEmployeeModal } from '../components/employees/PromoteEmployeeModal';
import { EditProfileModal } from '../../../shared/components/modals/EditProfileModal';
import { getRoles } from '../../../shared/services/roleManagementService';

export const EmployeesPage = () => {
  const navigate = useNavigate();
  const { employees, deleteEmployee, currentUser } = useHR();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPromoteEmp, setSelectedPromoteEmp] = useState(null);
  const [selectedProfileEmp, setSelectedProfileEmp] = useState(null);

  const actorRole = (currentUser?.role || '').toLowerCase();
  const isActorAdmin = actorRole.includes('admin') || true;
  const isActorHR = actorRole.includes('hr') || actorRole.includes('human resources');

  const departments = Array.from(new Set((employees || []).map(e => e.department).filter(Boolean)));
  const systemRoles = getRoles();

  const filteredEmployees = (employees || []).filter(e => {
    if (selectedDept !== 'all' && e.department !== selectedDept) return false;
    if (selectedRoleFilter !== 'all' && e.role !== selectedRoleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = e.name?.toLowerCase().includes(q);
      const matchRole = e.role?.toLowerCase().includes(q);
      const matchEmail = e.email?.toLowerCase().includes(q);
      const matchCode = e.employeeCode?.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchEmail && !matchCode) return false;
    }
    return true;
  });

  const getRoleBadgeStyle = (roleName = '') => {
    const r = roleName.toLowerCase();
    if (r.includes('super admin') || r.includes('admin')) {
      return { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: '👑' };
    }
    if (r.includes('hr') || r.includes('human resources')) {
      return { bg: '#fdf2f8', border: '#fbcfe8', color: '#be185d', icon: '💼' };
    }
    if (r.includes('leader') || r.includes('lead') || r.includes('manager')) {
      return { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: '⚡' };
    }
    if (r.includes('senior')) {
      return { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '🌟' };
    }
    return { bg: '#f8fafc', border: '#e2e8f0', color: '#475569', icon: '👤' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      
      {/* ── Page Header & Quick RBAC Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Employees & Role Management
              </h1>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                Total {employees?.length || 0} active employees. Change employee roles, promote posts, or edit full profiles.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/settings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Configure RBAC Roles & Custom Designations"
          >
            <ShieldCheck size={16} color="#2563eb" />
            <span>Roles & RBAC Matrix</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
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
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* ── Security Rule Explanation Card ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px'
      }}>
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ fontSize: '22px' }}>👑</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e3a8a' }}>
              Super Admin Authority
            </div>
            <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
              Can assign any role, create <strong>New Admins</strong>, HRs, Team Leads, or Custom Roles.
            </div>
          </div>
        </div>

        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ fontSize: '22px' }}>💼</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#92400e' }}>
              HR Manager Role Assignment
            </div>
            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
              Can promote Team Leads, Seniors, Juniors & Custom Roles, but <strong>CANNOT create Admins</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by name, role, email, employee ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '36px',
                paddingRight: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              outline: 'none'
            }}
          >
            <option value="all">All Departments ({departments.length})</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              outline: 'none'
            }}
          >
            <option value="all">All Roles & Posts</option>
            {systemRoles.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
            Showing {filteredEmployees.length} of {employees.length} employees
          </span>
        </div>
      </div>

      {/* ── Employee Directory Table ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div className="table-responsive">
          <table className="crm-table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Employee Details</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Employee ID</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Designation / Current Role</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Department</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Joining Date</th>
                <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: '12px', color: '#475569', fontWeight: '700' }}>Actions & Role Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13.5px' }}>
                    No employees matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const badge = getRoleBadgeStyle(emp.role);
                  return (
                    <tr key={emp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={emp.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(emp.name)}`}
                            alt={emp.name}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                          />
                          <div>
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{emp.name}</span>
                              {emp.isCurrentUser && (
                                <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: '700' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>
                        {emp.employeeCode || '—'}
                      </td>

                      {/* Current Role with distinct badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          <span>{badge.icon}</span>
                          <span>{emp.role || 'Junior Associate'}</span>
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '600'
                        }}>
                          {emp.department || 'Engineering'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: '12.5px', color: '#64748b' }}>
                        {emp.joiningDate || '2023-01-15'}
                      </td>

                      {/* Actions: Direct Role Change & Profile Edit */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Button 1: Direct Role & Post Change (Promote Modal) */}
                          <button
                            onClick={() => setSelectedPromoteEmp(emp)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '7px',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1.5px solid #bfdbfe',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(37,99,235,0.08)'
                            }}
                            title="Promote or Change Post (Admin & HR)"
                          >
                            <Award size={13} />
                            <span>Change Role / Promote</span>
                          </button>

                          {/* Button 2: Full Profile & Role Edit */}
                          <button
                            onClick={() => setSelectedProfileEmp(emp)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 10px',
                              borderRadius: '7px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                            title="Edit Full Profile & Designation"
                          >
                            <User size={13} color="#0284c7" />
                            <span>Edit Profile</span>
                          </button>

                          {!emp.isCurrentUser && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove employee ${emp.name}?`)) {
                                  deleteEmployee(emp._id);
                                  addToast('Employee removed', 'info');
                                }
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                border: '1px solid #fee2e2',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Delete Employee"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <AddEmployeeModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <PromoteEmployeeModal
        isOpen={!!selectedPromoteEmp}
        onClose={() => setSelectedPromoteEmp(null)}
        employee={selectedPromoteEmp}
      />

      <EditProfileModal
        isOpen={!!selectedProfileEmp}
        onClose={() => setSelectedProfileEmp(null)}
        employee={selectedProfileEmp}
      />

    </div>
  );
};
