import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCollection, saveCollection, KEYS } from '../services/storageService';
import { ROLES, ROLE_CONFIGS, getUserRole, isAdmin, isHR, isTeamMember, isHRorAdmin, isLeaderOrAbove, getRoleConfig } from '../utils/permissionUtils';

const AuthContext = createContext();

export const PRESET_USERS = {
  admin: {
    _id: 'emp_admin',
    employeeCode: 'EMP-ADM-01',
    name: 'Avinash Sharma',
    email: 'admin@inforag.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    role: 'Administrator',
    systemRole: ROLES.ADMIN,
    department: 'Executive Management',
    status: 'active',
    joiningDate: '2022-01-01',
    isCurrentUser: true,
    isAdmin: true,
    isSuperAdmin: true,
    leaveBalance: { casual: 12, sick: 10, earned: 18, maternity: 0 }
  },
  hr: {
    _id: 'emp_hr',
    employeeCode: 'EMP-HR-02',
    name: 'Pooja Sharma',
    email: 'hr@inforag.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    role: 'HR Manager & Talent Lead',
    systemRole: ROLES.HR,
    department: 'Human Resources',
    status: 'active',
    joiningDate: '2022-06-15',
    isCurrentUser: true,
    leaveBalance: { casual: 10, sick: 8, earned: 15, maternity: 0 }
  },
  employee: {
    _id: 'emp_employee',
    employeeCode: 'EMP-DEV-03',
    name: 'Rahul Verma',
    email: 'employee@inforag.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    role: 'Software Engineer',
    systemRole: ROLES.TEAM_MEMBER,
    department: 'Engineering',
    status: 'active',
    joiningDate: '2023-02-10',
    isCurrentUser: true,
    leaveBalance: { casual: 8, sick: 6, earned: 12, maternity: 0 }
  }
};

const AUTH_STORAGE_KEY = 'ems_auth_session';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading saved auth session:', e);
    }
    return PRESET_USERS.admin;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem(AUTH_STORAGE_KEY) || true;
  });

  // Sync with localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      // Update in employees list
      try {
        const employees = getCollection(KEYS.EMPLOYEES) || [];
        const exists = employees.some(e => e._id === currentUser._id || e.email === currentUser.email);
        if (!exists) {
          employees.unshift(currentUser);
          saveCollection(KEYS.EMPLOYEES, employees);
        } else {
          const updated = employees.map(e => 
            (e._id === currentUser._id || e.email === currentUser.email) ? { ...e, ...currentUser, isCurrentUser: true } : { ...e, isCurrentUser: false }
          );
          saveCollection(KEYS.EMPLOYEES, updated);
        }
      } catch (err) {
        console.error('Error syncing auth user to employees collection:', err);
      }
    }
  }, [currentUser]);

  // Login handler
  const login = useCallback(async ({ email, password, role }) => {
    let matchedUser = null;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (role === 'admin' || cleanEmail.includes('admin')) {
      matchedUser = PRESET_USERS.admin;
    } else if (role === 'hr' || cleanEmail.includes('hr')) {
      matchedUser = PRESET_USERS.hr;
    } else if (role === 'employee' || role === 'team_member' || cleanEmail.includes('employee') || cleanEmail.includes('rahul')) {
      matchedUser = PRESET_USERS.employee;
    } else {
      // Find from employees list
      const employees = getCollection(KEYS.EMPLOYEES) || [];
      const found = employees.find(e => e.email?.toLowerCase() === cleanEmail);
      if (found) {
        matchedUser = { ...found, isCurrentUser: true };
      } else {
        // Fallback create or use employee
        matchedUser = {
          _id: `emp_${Date.now()}`,
          name: cleanEmail.split('@')[0] || 'Team User',
          email: cleanEmail || 'user@inforag.com',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
          role: 'Team Member',
          systemRole: ROLES.TEAM_MEMBER,
          department: 'General',
          isCurrentUser: true,
          leaveBalance: { casual: 8, sick: 6, earned: 12, maternity: 0 }
        };
      }
    }

    setCurrentUser(matchedUser);
    setIsAuthenticated(true);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matchedUser));
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
    return matchedUser;
  }, []);

  // Quick switch role
  const switchRole = useCallback((roleId) => {
    let targetUser = PRESET_USERS[roleId] || PRESET_USERS.admin;
    if (roleId === 'admin') targetUser = PRESET_USERS.admin;
    if (roleId === 'hr') targetUser = PRESET_USERS.hr;
    if (roleId === 'employee' || roleId === 'team_member') targetUser = PRESET_USERS.employee;

    setCurrentUser(targetUser);
    setIsAuthenticated(true);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetUser));
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
  }, []);

  // Quick switch to any specific employee or user object
  const switchUser = useCallback((userOrId) => {
    let targetUser = null;
    if (typeof userOrId === 'object' && userOrId !== null) {
      targetUser = { ...userOrId, isCurrentUser: true };
    } else if (PRESET_USERS[userOrId]) {
      targetUser = PRESET_USERS[userOrId];
    } else {
      const employees = getCollection(KEYS.EMPLOYEES) || [];
      const found = employees.find(e => e._id === userOrId || e.id === userOrId || e.employeeCode === userOrId || e.email === userOrId);
      if (found) {
        targetUser = { ...found, isCurrentUser: true };
      }
    }
    if (targetUser) {
      setCurrentUser(targetUser);
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetUser));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
    }
    return targetUser;
  }, []);

  // Logout handler
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
  }, []);

  const role = getUserRole(currentUser);
  const roleConfig = getRoleConfig(currentUser);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        role,
        roleConfig,
        isAdmin: isAdmin(currentUser),
        isHR: isHR(currentUser),
        isTeamMember: isTeamMember(currentUser),
        isHRorAdmin: isHRorAdmin(currentUser),
        isLeaderOrAbove: isLeaderOrAbove(currentUser),
        login,
        logout,
        switchRole,
        switchUser,
        PRESET_USERS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
