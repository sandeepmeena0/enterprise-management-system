/**
 * @file roleManagementService.js
 * @description Enterprise Role-Based Access Control (RBAC), Custom Roles & Employee Promotion Engine.
 * 
 * SECURITY RULES:
 * 1. Super Admin: Has full authority to assign ANY role, including creating New Admins, HRs, Team Leads, or Custom Roles.
 * 2. HR Manager: Can assign/promote Team Leads, Seniors, Juniors, Executives, or Custom Roles, but CANNOT create or assign Admin.
 * 3. Custom Roles: Supports dynamic creation of new roles with customized permission matrices.
 * 4. Post / Designation Upgrades: Tracks complete promotion history (Junior -> Senior, etc.) with official letters.
 */

const STORAGE_KEY_ROLES = 'EMS_CUSTOM_ROLES';
const STORAGE_KEY_PROMOTIONS = 'EMS_PROMOTION_HISTORY';

export const SYSTEM_ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    badge: '👑 Admin',
    category: 'Executive Management',
    level: 1,
    isSystem: true,
    canBeAssignedBy: ['admin', 'super_admin'],
    permissions: {
      createAdmins: true,
      manageRoles: true,
      manageEmployees: true,
      manageSalaries: true,
      approveLeaves: true,
      manageHolidays: true,
      manageProjects: true,
      manageLeads: true,
      manageTickets: true,
      postNotices: true,
      viewFinancials: true
    },
    description: 'Master unrestricted authority over entire system, RBAC role assignments, and company configuration.'
  },
  {
    id: 'hr',
    name: 'HR',
    badge: '💼 HR',
    category: 'Human Resources',
    level: 2,
    isSystem: true,
    canBeAssignedBy: ['admin', 'super_admin'],
    permissions: {
      createAdmins: false, // Strict Rule: HR cannot create Admins
      manageRoles: false,
      manageEmployees: true,
      manageSalaries: true,
      approveLeaves: true,
      manageHolidays: true,
      manageProjects: false,
      manageLeads: false,
      manageTickets: true,
      postNotices: true,
      viewFinancials: true
    },
    description: 'Workforce onboarding, leave approvals, monthly attendance management, company holidays & payroll reporting.'
  },
  {
    id: 'team_leader',
    name: 'Team Leader',
    badge: '🚀 Team Leader',
    category: 'Project Management',
    level: 3,
    isSystem: true,
    canBeAssignedBy: ['admin', 'super_admin', 'hr'],
    permissions: {
      createAdmins: false,
      manageRoles: false,
      manageEmployees: false,
      manageSalaries: false,
      approveLeaves: true,
      manageHolidays: false,
      manageProjects: true,
      manageLeads: true,
      manageTickets: true,
      postNotices: true,
      viewFinancials: false
    },
    description: 'Sprint planning, project creation, task delegation, team timesheet oversight & squad leave approvals.'
  },
  {
    id: 'team_member',
    name: 'Team Member',
    badge: '👤 Team Member (Under TL)',
    category: 'Core Workforce (Reports to TL)',
    level: 4,
    isSystem: true,
    canBeAssignedBy: ['admin', 'super_admin', 'hr'],
    permissions: {
      createAdmins: false,
      manageRoles: false,
      manageEmployees: false,
      manageSalaries: false,
      approveLeaves: false,
      manageHolidays: false,
      manageProjects: false,
      manageLeads: false,
      manageTickets: false,
      postNotices: false,
      viewFinancials: false
    },
    description: 'TL (Team Leader) ke under regular employee: Assigned tasks execution, daily 8h 30m shift tracking, leave applications & personal payslips.'
  }
];

export const getRoles = () => {
  try {
    const custom = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '[]');
    return [...SYSTEM_ROLES, ...custom];
  } catch {
    return SYSTEM_ROLES;
  }
};

export const createCustomRole = (roleData) => {
  try {
    const custom = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '[]');
    const newRole = {
      id: 'custom_' + Date.now(),
      name: roleData.name,
      category: roleData.category || 'Custom Operations',
      level: Number(roleData.level) || 4,
      isSystem: false,
      canBeAssignedBy: ['super_admin', 'admin', 'hr_manager'],
      permissions: {
        createAdmins: false, // Custom roles can never create Admins
        manageEmployees: !!roleData.permissions?.manageEmployees,
        manageSalaries: !!roleData.permissions?.manageSalaries,
        approveLeaves: !!roleData.permissions?.approveLeaves,
        manageProjects: !!roleData.permissions?.manageProjects,
        postNotices: !!roleData.permissions?.postNotices,
        viewFinancials: !!roleData.permissions?.viewFinancials
      },
      description: roleData.description || 'Custom company designation with customized security privileges.'
    };

    custom.push(newRole);
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(custom));
    window.dispatchEvent(new Event('ems_roles_updated'));
    return newRole;
  } catch (err) {
    console.error('Error creating custom role:', err);
    throw err;
  }
};

export const deleteCustomRole = (roleId) => {
  try {
    let custom = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '[]');
    custom = custom.filter(r => r.id !== roleId);
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(custom));
    window.dispatchEvent(new Event('ems_roles_updated'));
  } catch (err) {
    console.error('Error deleting role:', err);
  }
};

export const canUserAssignRole = (actorRole = 'super_admin', targetRoleId = '') => {
  const normalizedActor = (actorRole || '').toLowerCase();
  const isAdminActor = normalizedActor.includes('admin');

  // If target role is Admin, only Super Admin can assign
  if (targetRoleId === 'super_admin' || targetRoleId === 'admin' || targetRoleId.toLowerCase().includes('admin')) {
    return isAdminActor;
  }

  // HR can assign any other role
  if (normalizedActor.includes('hr') || normalizedActor.includes('human resources')) {
    return true;
  }

  return isAdminActor;
};

export const recordPromotion = (promotionData) => {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY_PROMOTIONS) || '[]');
    const newRecord = {
      id: 'PROM-' + Date.now(),
      employeeId: promotionData.employeeId,
      employeeName: promotionData.employeeName,
      employeeCode: promotionData.employeeCode,
      employeeAvatar: promotionData.employeeAvatar,
      previousRole: promotionData.previousRole,
      newRole: promotionData.newRole,
      previousDepartment: promotionData.previousDepartment,
      newDepartment: promotionData.newDepartment,
      effectiveDate: promotionData.effectiveDate || new Date().toISOString().split('T')[0],
      promotedBy: promotionData.promotedBy || 'Super Admin',
      reason: promotionData.reason || 'Outstanding Performance & Leadership',
      remarks: promotionData.remarks || '',
      salaryHikeAmount: promotionData.salaryHikeAmount || 0,
      timestamp: new Date().toISOString()
    };

    history.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_PROMOTIONS, JSON.stringify(history));
    window.dispatchEvent(new Event('ems_promotions_updated'));
    return newRecord;
  } catch (err) {
    console.error('Error recording promotion:', err);
    throw err;
  }
};

export const getPromotionHistory = (employeeId = null) => {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY_PROMOTIONS) || '[]');
    if (employeeId) {
      return history.filter(p => p.employeeId === employeeId || p.employeeCode === employeeId);
    }
    return history;
  } catch {
    return [];
  }
};
