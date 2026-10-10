/**
 * @file hrService.js
 * @description Centralized Enterprise Data Layer for HRMS & Employee Management.
 * 
 * ARCHITECTURAL DESIGN:
 * 1. Hybrid Backend Engine: Calls real Express/MongoDB `/api/*` endpoints when server is online.
 * 2. High-Availability Fallback: Automatically falls back to LocalStorage engine if backend is offline.
 * 3. Dynamic Scalability: Adding new employees or modifying records instantly updates all HR modules
 *    (Dashboard, Leaves, Attendance Matrix, Holidays, Appreciations) via reactive state.
 */

import { getCollection, saveCollection, KEYS, initStorage } from '../../../shared/services/storageService';
import { API_BASE } from '../../../shared/config/apiConfig';

// Ensure storage is initialized
initStorage();

/**
 * Safe fetch helper that attempts backend API first, falling back to local storage
 */
async function fetchWithFallback(url, options, fallbackFn) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s timeout for fast offline fallback

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    }
  } catch (err) {
    // Backend offline or unreachable — silently fall back to local storage
  }

  return await fallbackFn();
}

export const hrService = {
  // =========================================================================
  // 👥 EMPLOYEES & WORKFORCE MANAGEMENT
  // =========================================================================
  
  async getEmployees(params = {}) {
    return fetchWithFallback(`${API_BASE}/employees`, { method: 'GET' }, async () => {
      let employees = getCollection(KEYS.EMPLOYEES);
      if (params.department && params.department !== 'all') {
        employees = employees.filter(e => e.department === params.department);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        employees = employees.filter(e =>
          e.name?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.role?.toLowerCase().includes(q) ||
          e.employeeCode?.toLowerCase().includes(q)
        );
      }
      return employees;
    });
  },

  async getCurrentUser() {
    return fetchWithFallback(`${API_BASE}/employees/current`, { method: 'GET' }, async () => {
      try {
        const savedAuth = localStorage.getItem('ems_auth_session');
        if (savedAuth) {
          const authUser = JSON.parse(savedAuth);
          const employees = getCollection(KEYS.EMPLOYEES) || [];
          const matched = employees.find(e => e._id === authUser._id || e.id === authUser._id || e.email?.toLowerCase() === authUser.email?.toLowerCase());
          if (matched) return { ...authUser, ...matched, isCurrentUser: true };
          return authUser;
        }
      } catch (e) {}
      const employees = getCollection(KEYS.EMPLOYEES);
      return employees.find(e => e.isCurrentUser) || employees[0];
    });
  },

  async createEmployee(employeeData) {
    return fetchWithFallback(`${API_BASE}/employees`, {
      method: 'POST',
      body: JSON.stringify(employeeData)
    }, async () => {
      const employees = getCollection(KEYS.EMPLOYEES);

      // Duplicate check in fallback
      const codeToTest = (employeeData.employeeCode || '').trim().toLowerCase();
      const existing = employees.find(e => (e.employeeCode || '').toLowerCase() === codeToTest || e._id === codeToTest);
      if (existing) {
        throw new Error(`Employee ID "${employeeData.employeeCode}" already exists for ${existing.name}`);
      }

      const emailToTest = (employeeData.email || '').trim().toLowerCase();
      const existingEmail = employees.find(e => (e.email || '').toLowerCase() === emailToTest);
      if (existingEmail) {
        throw new Error(`Email "${employeeData.email}" is already registered with ${existingEmail.name}`);
      }

      const newEmployee = {
        _id: `emp_${Date.now()}`,
        employeeCode: (employeeData.employeeCode || `EMP-${String(employees.length + 1).padStart(3, '0')}`).toUpperCase(),
        name: employeeData.name,
        email: employeeData.email,
        avatar: employeeData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(employeeData.name)}`,
        role: employeeData.role || 'Team Member',
        department: employeeData.department || 'General',
        status: 'active',
        joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
        isCurrentUser: false,
        leaveBalance: employeeData.leaveBalance || { casual: 10, sick: 8, earned: 15, maternity: 0 },
        createdAt: new Date().toISOString()
      };

      employees.push(newEmployee);
      saveCollection(KEYS.EMPLOYEES, employees);
      return newEmployee;
    });
  },

  async updateEmployee(employeeId, updateData) {
    return fetchWithFallback(`${API_BASE}/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    }, async () => {
      const employees = getCollection(KEYS.EMPLOYEES);
      const index = employees.findIndex(e => e._id === employeeId || (e.isCurrentUser && updateData.isCurrentUser));
      if (index === -1) {
        // If updating current user specifically
        const currIdx = employees.findIndex(e => e.isCurrentUser);
        if (currIdx !== -1) {
          employees[currIdx] = { ...employees[currIdx], ...updateData, updatedAt: new Date().toISOString() };
          saveCollection(KEYS.EMPLOYEES, employees);
          return employees[currIdx];
        }
        throw new Error('Employee not found');
      }

      employees[index] = { ...employees[index], ...updateData, updatedAt: new Date().toISOString() };
      saveCollection(KEYS.EMPLOYEES, employees);
      return employees[index];
    });
  },

  async deleteEmployee(employeeId) {
    return fetchWithFallback(`${API_BASE}/employees/${employeeId}`, {
      method: 'DELETE'
    }, async () => {
      let employees = getCollection(KEYS.EMPLOYEES);
      employees = employees.filter(e => e._id !== employeeId);
      saveCollection(KEYS.EMPLOYEES, employees);
      return { success: true };
    });
  },

  // =========================================================================
  // 🌴 LEAVES MANAGEMENT
  // =========================================================================

  async getLeaves(filters = {}) {
    const query = new URLSearchParams();
    if (filters.employeeId && filters.employeeId !== 'all') query.append('employeeId', filters.employeeId);
    if (filters.status && filters.status !== 'all') query.append('status', filters.status);
    if (filters.leaveType && filters.leaveType !== 'all') query.append('leaveType', filters.leaveType);
    if (filters.search) query.append('search', filters.search);

    return fetchWithFallback(`${API_BASE}/leaves?${query.toString()}`, { method: 'GET' }, async () => {
      let leaves = getCollection(KEYS.LEAVES);

      if (filters.employeeId && filters.employeeId !== 'all') {
        leaves = leaves.filter(l => l.employeeId === filters.employeeId);
      }
      if (filters.status && filters.status !== 'all') {
        leaves = leaves.filter(l => l.status.toLowerCase() === filters.status.toLowerCase());
      }
      if (filters.leaveType && filters.leaveType !== 'all') {
        leaves = leaves.filter(l => l.leaveType === filters.leaveType);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        leaves = leaves.filter(l => 
          l.employeeName?.toLowerCase().includes(q) ||
          l.leaveType?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q)
        );
      }
      if (filters.startDate && filters.endDate) {
        leaves = leaves.filter(l => l.startDate >= filters.startDate && l.endDate <= filters.endDate);
      }

      return leaves;
    });
  },

  async createLeave(leaveData) {
    return fetchWithFallback(`${API_BASE}/leaves`, {
      method: 'POST',
      body: JSON.stringify(leaveData)
    }, async () => {
      const leaves = getCollection(KEYS.LEAVES);
      const newLeave = {
        _id: `lv_${Date.now()}`,
        appliedOn: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        approvedBy: null,
        ...leaveData
      };
      leaves.unshift(newLeave);
      saveCollection(KEYS.LEAVES, leaves);
      return newLeave;
    });
  },

  async updateLeaveStatus(leaveId, status, approverName = 'HR Admin', rejectionReason = '') {
    return fetchWithFallback(`${API_BASE}/leaves/${leaveId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, approvedBy: approverName, rejectionReason })
    }, async () => {
      const leaves = getCollection(KEYS.LEAVES);
      const index = leaves.findIndex(l => l._id === leaveId);
      if (index === -1) throw new Error('Leave request not found');

      const targetLeave = leaves[index];
      const prevStatus = targetLeave.status;

      targetLeave.status = status;
      targetLeave.approvedBy = status === 'approved' ? approverName : null;
      targetLeave.rejectedBy = status === 'rejected' ? approverName : null;
      targetLeave.rejectionReason = status === 'rejected' ? (rejectionReason || 'Declined by reviewer') : null;
      targetLeave.updatedAt = new Date().toISOString();

      leaves[index] = targetLeave;
      saveCollection(KEYS.LEAVES, leaves);

      // Exact mathematical adjustment of employee leave balance
      if (prevStatus !== status) {
        let employees = getCollection(KEYS.EMPLOYEES);
        const empIdx = employees.findIndex(e => e._id === targetLeave.employeeId);
        if (empIdx >= 0) {
          const emp = employees[empIdx];
          const balance = { ...(emp.leaveBalance || { casual: 8, sick: 6, earned: 12, maternity: 0 }) };
          const typeKeyMap = {
            'Casual Leave': 'casual',
            'Sick Leave': 'sick',
            'Earned Leave': 'earned',
            'Maternity/Paternity': 'maternity'
          };
          const key = typeKeyMap[targetLeave.leaveType] || 'casual';
          const days = Number(targetLeave.durationDays) || 1;

          if (status === 'approved' && prevStatus !== 'approved') {
            balance[key] = Math.max(0, (balance[key] || 0) - days);
          } else if (prevStatus === 'approved' && status !== 'approved') {
            balance[key] = (balance[key] || 0) + days;
          }
          emp.leaveBalance = balance;
          employees[empIdx] = emp;
          saveCollection(KEYS.EMPLOYEES, employees);
        }
      }

      return targetLeave;
    });
  },

  async deleteLeave(leaveId) {
    return fetchWithFallback(`${API_BASE}/leaves/${leaveId}`, {
      method: 'DELETE'
    }, async () => {
      let leaves = getCollection(KEYS.LEAVES);
      leaves = leaves.filter(l => l._id !== leaveId);
      saveCollection(KEYS.LEAVES, leaves);
      return { success: true };
    });
  },

  // =========================================================================
  // 📅 ATTENDANCE MATRIX & TIME LOGS
  // =========================================================================

  async getMonthlyAttendance(month = 9, year = 2026, employeeId = 'all') {
    const query = new URLSearchParams({ month: String(month), year: String(year) });
    if (employeeId && employeeId !== 'all') query.append('employeeId', employeeId);

    return fetchWithFallback(`${API_BASE}/attendance/monthly?${query.toString()}`, { method: 'GET' }, async () => {
      let attendance = getCollection(KEYS.ATTENDANCE);
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      attendance = attendance.filter(a => a.date.startsWith(monthStr));
      if (employeeId && employeeId !== 'all') {
        attendance = attendance.filter(a => a.employeeId === employeeId);
      }

      return attendance;
    });
  },

  async markAttendance(attendanceData) {
    return fetchWithFallback(`${API_BASE}/attendance/mark`, {
      method: 'POST',
      body: JSON.stringify(attendanceData)
    }, async () => {
      let attendance = getCollection(KEYS.ATTENDANCE);
      const { employeeId, date, status, clockInTime, clockOutTime, notes } = attendanceData;

      const existingIndex = attendance.findIndex(a => a.employeeId === employeeId && a.date === date);

      // Exact mathematical calculation for totalWorkingHours and late detection
      let computedHours = 0;
      let isLateCalc = status === 'late';
      let lateByMinutes = 0;

      if (['present', 'late', 'half_day'].includes(status) && clockInTime && clockOutTime) {
        const [inH, inM, inS = 0] = clockInTime.split(':').map(Number);
        const [outH, outM, outS = 0] = clockOutTime.split(':').map(Number);
        const inTotalSecs = inH * 3600 + inM * 60 + inS;
        const outTotalSecs = outH * 3600 + outM * 60 + outS;
        const diffSecs = Math.max(0, outTotalSecs - inTotalSecs);
        computedHours = +(diffSecs / 3600).toFixed(2);

        // Standard 09:30:00 AM shift grace limit
        const shiftGraceSecs = 9 * 3600 + 30 * 60;
        if (inTotalSecs > shiftGraceSecs) {
          isLateCalc = true;
          lateByMinutes = Math.floor((inTotalSecs - shiftGraceSecs) / 60);
        }
      } else if (status === 'half_day') {
        computedHours = 4.0;
      }

      const record = {
        _id: existingIndex >= 0 ? attendance[existingIndex]._id : `att_${Date.now()}`,
        employeeId,
        date,
        status: status || 'present',
        clockInTime: ['present', 'late', 'half_day'].includes(status) ? (clockInTime || '09:15:00') : null,
        clockOutTime: ['present', 'late', 'half_day'].includes(status) ? (clockOutTime || '18:30:00') : null,
        totalWorkingHours: computedHours,
        isLate: isLateCalc,
        lateByMinutes,
        notes: notes || '',
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        attendance[existingIndex] = { ...attendance[existingIndex], ...record };
      } else {
        attendance.push(record);
      }

      saveCollection(KEYS.ATTENDANCE, attendance);
      return record;
    });
  },

  // =========================================================================
  // 🗓️ COMPANY HOLIDAYS
  // =========================================================================

  async getHolidays(year = 2026, search = '') {
    const query = new URLSearchParams();
    if (year) query.append('year', String(year));
    if (search) query.append('search', search);

    return fetchWithFallback(`${API_BASE}/holidays?${query.toString()}`, { method: 'GET' }, async () => {
      let holidays = getCollection(KEYS.HOLIDAYS);
      if (year) {
        holidays = holidays.filter(h => h.date.startsWith(String(year)));
      }
      if (search) {
        const q = search.toLowerCase();
        holidays = holidays.filter(h => 
          h.name.toLowerCase().includes(q) ||
          h.type.toLowerCase().includes(q) ||
          h.description?.toLowerCase().includes(q)
        );
      }
      return holidays.sort((a, b) => a.date.localeCompare(b.date));
    });
  },

  async createHoliday(holidayData) {
    return fetchWithFallback(`${API_BASE}/holidays`, {
      method: 'POST',
      body: JSON.stringify(holidayData)
    }, async () => {
      const holidays = getCollection(KEYS.HOLIDAYS);
      const newHoliday = {
        _id: `hol_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...holidayData
      };
      holidays.push(newHoliday);
      saveCollection(KEYS.HOLIDAYS, holidays);
      return newHoliday;
    });
  },

  async deleteHoliday(holidayId) {
    return fetchWithFallback(`${API_BASE}/holidays/${holidayId}`, {
      method: 'DELETE'
    }, async () => {
      let holidays = getCollection(KEYS.HOLIDAYS);
      holidays = holidays.filter(h => h._id !== holidayId);
      saveCollection(KEYS.HOLIDAYS, holidays);
      return { success: true };
    });
  },

  // =========================================================================
  // 🏆 EMPLOYEE APPRECIATIONS & AWARDS
  // =========================================================================

  async getAppreciations(filters = {}) {
    const query = new URLSearchParams();
    if (filters.employeeId && filters.employeeId !== 'all') query.append('employeeId', filters.employeeId);
    if (filters.search) query.append('search', filters.search);

    return fetchWithFallback(`${API_BASE}/appreciations?${query.toString()}`, { method: 'GET' }, async () => {
      let appreciations = getCollection(KEYS.APPRECIATIONS);

      if (filters.search) {
        const q = filters.search.toLowerCase();
        appreciations = appreciations.filter(a => 
          a.givenToName?.toLowerCase().includes(q) ||
          a.awardName?.toLowerCase().includes(q) ||
          a.appreciationNote?.toLowerCase().includes(q)
        );
      }
      if (filters.employeeId && filters.employeeId !== 'all') {
        appreciations = appreciations.filter(a => a.givenToId === filters.employeeId);
      }

      return appreciations.sort((a, b) => (b.givenOn || '').localeCompare(a.givenOn || ''));
    });
  },

  async createAppreciation(appreciationData) {
    return fetchWithFallback(`${API_BASE}/appreciations`, {
      method: 'POST',
      body: JSON.stringify(appreciationData)
    }, async () => {
      const appreciations = getCollection(KEYS.APPRECIATIONS);
      const newAppreciation = {
        _id: `app_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...appreciationData
      };
      appreciations.unshift(newAppreciation);
      saveCollection(KEYS.APPRECIATIONS, appreciations);
      return newAppreciation;
    });
  },

  async deleteAppreciation(appreciationId) {
    return fetchWithFallback(`${API_BASE}/appreciations/${appreciationId}`, {
      method: 'DELETE'
    }, async () => {
      let appreciations = getCollection(KEYS.APPRECIATIONS);
      appreciations = appreciations.filter(a => a._id !== appreciationId);
      saveCollection(KEYS.APPRECIATIONS, appreciations);
      return { success: true };
    });
  }
};
