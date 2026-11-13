import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { hrService } from '../services/hrService';
import { useToast } from '../../../shared/context/ToastContext';
import { getCollection, saveCollection, KEYS } from '../../../shared/services/storageService';
import {
  canGiveAppreciation,
  canDeleteAppreciation,
  canDeleteEmployee,
  canViewAllAttendance,
  canApproveLeaves,
  canViewAllLeaves,
  isHRorAdmin,
  isAdmin
} from '../../../shared/utils/permissionUtils';

const defaultHRContext = {
  loading: false,
  employees: [],
  currentUser: null,
  leaves: [],
  attendance: [],
  auditLogs: [],
  holidays: [],
  appreciations: [],
  resignations: [],
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),
  selectedEmployeeId: 'all',
  searchQuery: '',
  dateRange: { startDate: '', endDate: '' },
  setSelectedMonth: () => {},
  setSelectedYear: () => {},
  setSelectedEmployeeId: () => {},
  setSearchQuery: () => {},
  setDateRange: () => {},
  loadData: async () => {},
  loadHRData: async () => {},
  addEmployee: async () => {},
  updateEmployee: async () => {},
  updateEmployeePermissions: async () => {},
  deleteEmployee: async () => {},
  applyLeave: async () => {},
  updateLeaveStatus: async () => {},
  acknowledgeLeave: async () => {},
  deleteLeave: async () => {},
  markAttendanceRecord: async () => {},
  adminForceClockOut: async () => {},
  addHoliday: async () => {},
  deleteHoliday: async () => {},
  toggleHolidayConfirmation: async () => {},
  bulkConfirmGazetted: async () => {},
  resetHolidayConfirmations: async () => {},
  addAppreciation: async () => {},
  deleteAppreciation: async () => {},
  submitResignation: async () => {},
  reviewResignation: async () => {}
};

const HRContext = createContext(defaultHRContext);

export const HRProvider = ({ children }) => {
  const { addToast } = useToast();

  const [employees, setEmployees] = useState(() => getCollection(KEYS.EMPLOYEES) || []);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem('ems_auth_session');
      if (s) {
        const parsed = JSON.parse(s);
        return parsed?.user || parsed;
      }
    } catch {}
    return null;
  });
  const [leaves, setLeaves] = useState(() => getCollection(KEYS.LEAVES) || []);
  const [attendance, setAttendance] = useState(() => getCollection(KEYS.ATTENDANCE) || []);
  const [holidays, setHolidays] = useState(() => getCollection(KEYS.HOLIDAYS) || []);
  const [appreciations, setAppreciations] = useState(() => getCollection(KEYS.APPRECIATIONS) || []);
  const [auditLogs, setAuditLogs] = useState(() => getCollection(KEYS.ATTENDANCE_AUDIT) || []);
  const [resignations, setResignations] = useState(() => getCollection(KEYS.RESIGNATIONS) || []);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    try {
      const s = localStorage.getItem('ems_auth_session');
      if (s) {
        const parsed = JSON.parse(s);
        const u = parsed?.user || parsed;
        const isPriv = u?.isAdmin || ['admin', 'hr'].includes(u?.role?.toLowerCase()) || ['admin', 'hr'].includes(u?.systemRole?.toLowerCase());
        if (!isPriv && u) {
          return u._id || u.employeeCode || 'self';
        }
      }
    } catch (_) {}
    return 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  const [loading, setLoading] = useState(false);
  const isFetchingRef = React.useRef(false);
  const debounceTimerRef = React.useRef(null);

  // Load all initial data from MongoDB Atlas / LocalStorage fallback
  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);

      const authUserObj = currentUser || (() => {
        try {
          const s = localStorage.getItem('ems_auth_session');
          if (s) {
            const parsed = JSON.parse(s);
            return parsed?.user || parsed;
          }
        } catch (_) {}
        return null;
      })();
      const userCanViewAllAtt = canViewAllAttendance(authUserObj) || isHRorAdmin(authUserObj) || isAdmin(authUserObj);
      const userCanViewAllLeaves = canViewAllLeaves(authUserObj) || canApproveLeaves(authUserObj) || isHRorAdmin(authUserObj) || isAdmin(authUserObj);

      const effectiveAttEmpId = userCanViewAllAtt ? selectedEmployeeId : (authUserObj?._id || authUserObj?.employeeCode || 'self');
      const effectiveLeaveEmpId = userCanViewAllLeaves ? (selectedEmployeeId === 'all' ? undefined : selectedEmployeeId) : (authUserObj?._id || authUserObj?.employeeCode || 'self');

      const isPrivileged = userCanViewAllAtt || userCanViewAllLeaves;

      const results = await Promise.allSettled([
        hrService.getEmployees(),
        hrService.getCurrentUser(),
        hrService.getLeaves({
          employeeId: effectiveLeaveEmpId,
          search: searchQuery,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }),
        hrService.getMonthlyAttendance(selectedMonth, selectedYear, effectiveAttEmpId),
        hrService.getHolidays(selectedYear, searchQuery),
        hrService.getAppreciations({ employeeId: effectiveAttEmpId, search: searchQuery }),
        hrService.getAttendanceAuditLogs({ employeeId: effectiveAttEmpId, month: selectedMonth, year: selectedYear }),
        hrService.getResignations()
      ]);

      const [empsRes, currRes, lvsRes, attsRes, holsRes, appsRes, audsRes, resgRes] = results;

      const emps = empsRes.status === 'fulfilled' && empsRes.value ? empsRes.value : (getCollection(KEYS.EMPLOYEES) || []);
      const curr = currRes.status === 'fulfilled' ? currRes.value : null;
      const lvs = lvsRes.status === 'fulfilled' && lvsRes.value ? lvsRes.value : (getCollection(KEYS.LEAVES) || []);
      const atts = attsRes.status === 'fulfilled' && attsRes.value ? attsRes.value : (getCollection(KEYS.ATTENDANCE) || []);
      const hols = holsRes.status === 'fulfilled' && holsRes.value ? holsRes.value : (getCollection(KEYS.HOLIDAYS) || []);
      const apps = appsRes.status === 'fulfilled' && appsRes.value ? appsRes.value : (getCollection(KEYS.APPRECIATIONS) || []);
      const auds = audsRes.status === 'fulfilled' && audsRes.value ? audsRes.value : (getCollection(KEYS.ATTENDANCE_AUDIT) || []);
      const resgRaw = resgRes.status === 'fulfilled' && resgRes.value ? resgRes.value : (getCollection(KEYS.RESIGNATIONS) || []);
      const resg = Array.isArray(resgRaw?.data) ? resgRaw.data : (Array.isArray(resgRaw) ? resgRaw : []);
      setResignations(resg);
      saveCollection(KEYS.RESIGNATIONS, resg);

      // Smart Merging: preserve any local leaves created recently or pending sync
      const localLeaves = getCollection(KEYS.LEAVES) || [];
      const serverLeaves = Array.isArray(lvs) ? lvs : [];
      const serverIds = new Set(serverLeaves.map(l => String(l._id || l.id)));

      // Keep any local leaves that were created recently (last 90s) or have temporary IDs (e.g. leave_...)
      const unSyncedLocalLeaves = localLeaves.filter(l => {
        const id = String(l._id || l.id || '');
        if (!id) return false;
        if (serverIds.has(id)) return false; // already on server
        const isLocalTemporary = id.startsWith('leave_');
        const createdAtTime = l.createdAt ? new Date(l.createdAt).getTime() : (l.appliedOn ? new Date(l.appliedOn).getTime() : 0);
        const isRecent = (Date.now() - createdAtTime) < 90000;
        return isLocalTemporary || isRecent;
      });

      const effectiveLeaves = [...unSyncedLocalLeaves, ...serverLeaves];

      setEmployees(emps || []);
      if (curr) setCurrentUser(curr);
      setLeaves(effectiveLeaves);

      // Persist to localStorage
      try {
        localStorage.setItem(KEYS.LEAVES, JSON.stringify(effectiveLeaves));
      } catch (_) {}

      // Background Sync: If there are temporary un-synced local leaves and backend is online, sync them to backend
      if (unSyncedLocalLeaves.length > 0) {
        unSyncedLocalLeaves.forEach(async (unsynced) => {
          if (String(unsynced._id || '').startsWith('leave_')) {
            try {
              const { _id, ...leavePayload } = unsynced;
              const res = await hrService.createLeave(leavePayload);
              if (res && res._id && !String(res._id).startsWith('leave_')) {
                let cur = getCollection(KEYS.LEAVES) || [];
                cur = cur.map(item => String(item._id) === String(_id) ? res : item);
                saveCollection(KEYS.LEAVES, cur);
                window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEAVES } }));
              }
            } catch (syncErr) {
              console.warn('Background sync for leave failed:', syncErr);
            }
          }
        });
      }
      setAttendance(atts || []);
      try {
        if (Array.isArray(atts) && atts.length > 0) {
          if (userCanViewAllAtt || isPrivileged) {
            localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(atts));
          } else {
            const existing = getCollection(KEYS.ATTENDANCE) || [];
            const attMap = new Map();
            existing.forEach(a => {
              const k = `${a.employeeId || a.employeeCode || (a.employee?._id || a.employee)}_${a.date}`;
              attMap.set(k, a);
            });
            atts.forEach(a => {
              const k = `${a.employeeId || a.employeeCode || (a.employee?._id || a.employee)}_${a.date}`;
              attMap.set(k, a);
            });
            localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(Array.from(attMap.values())));
          }
          window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.ATTENDANCE } }));
        }
      } catch (_) {}
      setHolidays(hols || []);
      setAppreciations(apps || []);
      setAuditLogs(auds || []);
    } catch (err) {
      console.warn('Graceful sync fallback in loadData:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [selectedEmployeeId, searchQuery, dateRange, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();

    const scheduleDebouncedLoad = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        loadData();
      }, 500);
    };

    // Listen for storage events across tabs or internal updates
    const handleStorageUpdate = (e) => {
      const hrKeys = ['ems_auth_session', 'hrms_employees', 'ems_employees', 'hrms_leaves', 'ems_leaves', 'hrms_attendance', 'ems_attendance', 'hrms_holidays', 'hrms_holiday_confirmations', 'hrms_appreciations', 'ems_attendance_audit_logs', 'all'];
      if (e.detail?.key && hrKeys.includes(e.detail.key)) {
        scheduleDebouncedLoad();
      }
    };
    const handleNativeStorage = (e) => {
      if (e.key === 'ems_auth_session' || e.key === 'hrms_employees' || e.key === 'hrms_leaves') {
        scheduleDebouncedLoad();
      }
    };
    // Periodic synchronization from DB (every 5s) for multi-device live sync (leaves, attendance, approvals)
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData();
      }
    }, 5000);

    window.addEventListener('hrms_storage_change', handleStorageUpdate);
    window.addEventListener('storage', handleNativeStorage);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearInterval(syncInterval);
      window.removeEventListener('hrms_storage_change', handleStorageUpdate);
      window.removeEventListener('storage', handleNativeStorage);
    };
  }, [loadData]);

  // ================= EMPLOYEES =================
  const addEmployee = async (empData) => {
    try {
      const tempId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const optimisticEmp = {
        _id: tempId,
        id: tempId,
        createdAt: new Date().toISOString(),
        ...empData
      };

      // 🚀 0ms Instant Optimistic Local Update
      const cur = getCollection(KEYS.EMPLOYEES) || [];
      const updated = [...cur, optimisticEmp];
      saveCollection(KEYS.EMPLOYEES, updated);
      setEmployees(prev => [...prev, optimisticEmp]);
      addToast(`Employee "${optimisticEmp.name}" added to roster!`, 'success');
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EMPLOYEES } }));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_employees' } }));

      // Asynchronous background sync to MongoDB Atlas
      hrService.createEmployee(empData)
        .then(created => {
          if (created && created._id && created._id !== tempId) {
            setEmployees(prev => prev.map(e => (e._id === tempId || e.id === tempId ? { ...e, ...created, _id: created._id, id: created._id } : e)));
            const curEmps = getCollection(KEYS.EMPLOYEES) || [];
            const swapped = curEmps.map(e => (e._id === tempId || e.id === tempId ? { ...e, ...created, _id: created._id, id: created._id } : e));
            saveCollection(KEYS.EMPLOYEES, swapped);
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EMPLOYEES } }));
          }
        })
        .catch(err => console.warn('[HRContext] Employee saved locally; cloud sync queued:', err));

      return optimisticEmp;
    } catch (err) {
      addToast(err?.message || 'Failed to add employee', 'error');
      throw err;
    }
  };

  const updateEmployee = async (employeeId, updateData) => {
    try {
      // 🚀 0ms Instant Optimistic Local Update
      setCurrentUser(prev => {
        if (!prev) return prev;
        const isMatch = String(prev._id || '') === String(employeeId) ||
          String(prev.id || '') === String(employeeId) ||
          String(prev.employeeCode || '') === String(employeeId) ||
          (updateData.employeeCode && String(prev.employeeCode) === String(updateData.employeeCode)) ||
          (updateData.email && String(prev.email || '').toLowerCase() === String(updateData.email).toLowerCase());
        if (isMatch) {
          const merged = { ...prev, ...updateData };
          try {
            localStorage.setItem('ems_auth_session', JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
          } catch (_) {}
          return merged;
        }
        return prev;
      });

      setEmployees(prev => prev.map(e => {
        const isMatch = String(e._id || '') === String(employeeId) ||
          String(e.id || '') === String(employeeId) ||
          String(e.employeeCode || '') === String(employeeId) ||
          (updateData.employeeCode && String(e.employeeCode) === String(updateData.employeeCode)) ||
          (updateData.email && String(e.email || '').toLowerCase() === String(updateData.email).toLowerCase());
        return isMatch ? { ...e, ...updateData } : e;
      }));

      const cur = getCollection(KEYS.EMPLOYEES) || [];
      const updatedCur = cur.map(e => {
        const isMatch = String(e._id || '') === String(employeeId) ||
          String(e.id || '') === String(employeeId) ||
          String(e.employeeCode || '') === String(employeeId) ||
          (updateData.employeeCode && String(e.employeeCode) === String(updateData.employeeCode));
        return isMatch ? { ...e, ...updateData } : e;
      });
      saveCollection(KEYS.EMPLOYEES, updatedCur);

      addToast('Profile & employee details updated successfully!', 'success');
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EMPLOYEES } }));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_employees' } }));

      // Asynchronous background sync
      hrService.updateEmployee(employeeId, updateData).catch(err => console.warn('[HRContext] Sync employee update to DB:', err));
      return { _id: employeeId, ...updateData };
    } catch (err) {
      addToast(err?.message || 'Failed to update employee', 'error');
      throw err;
    }
  };

  const updateEmployeePermissions = async (employeeId, payload) => {
    try {
      // 🚀 0ms Instant Optimistic Local Update
      setCurrentUser(prev => {
        if (!prev) return prev;
        const isMatch = String(prev._id || '') === String(employeeId) ||
          String(prev.id || '') === String(employeeId) ||
          String(prev.employeeCode || '') === String(employeeId);
        if (isMatch) {
          const merged = { ...prev, ...payload };
          try {
            localStorage.setItem('ems_auth_session', JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_auth_session' } }));
          } catch (_) {}
          return merged;
        }
        return prev;
      });
      setEmployees(prev => prev.map(e => (String(e._id) === String(employeeId) || String(e.id) === String(employeeId) || String(e.employeeCode) === String(employeeId) ? { ...e, ...payload } : e)));
      const cur = getCollection(KEYS.EMPLOYEES) || [];
      const updatedCur = cur.map(e => (String(e._id) === String(employeeId) || String(e.id) === String(employeeId) || String(e.employeeCode) === String(employeeId) ? { ...e, ...payload } : e));
      saveCollection(KEYS.EMPLOYEES, updatedCur);

      // Also persist to EMS_USER_PERMISSIONS local cache
      try {
        const rawMap = localStorage.getItem('EMS_USER_PERMISSIONS');
        const parsed = rawMap ? JSON.parse(rawMap) : {};
        const emp = (cur || []).find(e => String(e._id) === String(employeeId) || String(e.employeeCode) === String(employeeId));
        const keys = [employeeId, emp?.employeeCode, emp?.email].filter(Boolean);
        keys.forEach(k => {
          parsed[String(k)] = { ...(parsed[String(k)] || {}), ...(payload.permissions || payload) };
        });
        localStorage.setItem('EMS_USER_PERMISSIONS', JSON.stringify(parsed));
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EMPLOYEES } }));
      window.dispatchEvent(new CustomEvent('ems_permissions_updated', { detail: { employeeId, ...payload } }));

      hrService.updateEmployeePermissions(employeeId, payload).catch(err => console.warn('[HRContext] Sync permissions to DB:', err));
      return { _id: employeeId, ...payload };
    } catch (err) {
      console.error('Failed to update employee permissions:', err);
      throw err;
    }
  };

  const deleteEmployee = async (employeeId) => {
    try {
      if (!canDeleteEmployee(currentUser)) {
        addToast('Access Denied: Only Administrators can delete employee accounts.', 'error');
        return;
      }

      const target = (employees || []).find(e =>
        String(e._id) === String(employeeId) ||
        String(e.id) === String(employeeId) ||
        String(e.employeeCode) === String(employeeId)
      );

      const isTargetAdmin = target?.isAdmin === true ||
                            target?.isSuperAdmin === true ||
                            String(target?.systemRole || '').toLowerCase() === 'admin' ||
                            String(target?.role || '').toLowerCase() === 'admin' ||
                            String(target?.role || '').toLowerCase().includes('administrator') ||
                            String(target?.employeeCode || '').toUpperCase() === 'ADM-001' ||
                            String(target?.email || '').toLowerCase() === 'avinash@inforag.com';

      if (isTargetAdmin) {
        addToast('🛡️ Security Protection: Administrator accounts are permanently protected and cannot be deleted.', 'error');
        return;
      }

      if (currentUser && (String(currentUser._id) === String(employeeId) || String(currentUser.id) === String(employeeId))) {
        addToast('You cannot delete your own active administrator account!', 'warning');
        return;
      }

      // 🚀 0ms Instant Optimistic Local Removal
      setEmployees(prev => prev.filter(e => e._id !== employeeId && e.id !== employeeId && e.employeeCode !== employeeId));
      const cur = getCollection(KEYS.EMPLOYEES) || [];
      const filtered = cur.filter(e => e._id !== employeeId && e.id !== employeeId && e.employeeCode !== employeeId);
      saveCollection(KEYS.EMPLOYEES, filtered);
      addToast('Employee removed from roster', 'info');
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EMPLOYEES } }));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_employees' } }));

      // Asynchronous background sync
      hrService.deleteEmployee(employeeId).catch(err => console.warn('[HRContext] Sync employee deletion to DB:', err));
    } catch (err) {
      addToast(err?.message || 'Failed to delete employee', 'error');
      throw err;
    }
  };

  // ================= LEAVES =================
  const applyLeave = async (leaveData) => {
    try {
      const tempId = `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const optimisticLeave = {
        _id: tempId,
        id: tempId,
        status: 'pending',
        appliedOn: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...leaveData
      };

      // 🚀 0ms Instant Optimistic Local Update
      setLeaves(prev => [optimisticLeave, ...(prev || [])]);
      const cur = getCollection(KEYS.LEAVES) || [];
      saveCollection(KEYS.LEAVES, [optimisticLeave, ...cur]);

      const reviewer = leaveData.appliedToName || 'reviewer';
      addToast(`Leave request submitted successfully! Sent to ${reviewer} for review.`, 'success');
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEAVES } }));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_leaves' } }));
      window.dispatchEvent(new CustomEvent('ems_leaves_updated', { detail: { leaveId: tempId, status: 'pending' } }));

      // Asynchronous background sync to MongoDB Atlas
      hrService.createLeave(leaveData)
        .then(created => {
          if (created && created._id && created._id !== tempId) {
            setLeaves(prev => (prev || []).map(l => (l._id === tempId || l.id === tempId ? { ...l, ...created, _id: created._id, id: created._id } : l)));
            const curLeaves = getCollection(KEYS.LEAVES) || [];
            const swapped = curLeaves.map(l => (l._id === tempId || l.id === tempId ? { ...l, ...created, _id: created._id, id: created._id } : l));
            saveCollection(KEYS.LEAVES, swapped);
            window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEAVES } }));
          }
        })
        .catch(err => {
          console.warn('[HRContext] Leave saved locally; cloud sync queued:', err);
        });

      return optimisticLeave;
    } catch (err) {
      addToast(err?.message || 'Failed to submit leave request', 'error');
      throw err;
    }
  };

  const updateLeaveStatus = async (leaveId, status, rejectionReason = '') => {
    try {
      const approver = currentUser?.name || 'HR Admin';
      const actionDateFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // 🚀 0ms Instant Optimistic Local Update with audit stamps
      const cur = getCollection(KEYS.LEAVES) || [];
      const updatedCur = cur.map(l => {
        if (l._id === leaveId || l.id === leaveId) {
          return {
            ...l,
            status,
            approvedBy: status === 'approved' ? approver : null,
            rejectedBy: status === 'rejected' ? approver : null,
            cancelledBy: status === 'cancelled' ? approver : null,
            actionBy: approver,
            actionDate: new Date().toISOString(),
            actionDateFormatted,
            rejectionReason: status === 'rejected' ? (rejectionReason || 'Declined by reviewer') : null,
            cancellationReason: status === 'cancelled' ? (rejectionReason || 'Cancelled by reviewer') : null,
            isAcknowledged: false,
            updatedAt: new Date().toISOString()
          };
        }
        return l;
      });
      saveCollection(KEYS.LEAVES, updatedCur);

      setLeaves(prev => (prev || []).map(l => {
        if (l._id === leaveId || l.id === leaveId) {
          return {
            ...l,
            status,
            approvedBy: status === 'approved' ? approver : null,
            rejectedBy: status === 'rejected' ? approver : null,
            cancelledBy: status === 'cancelled' ? approver : null,
            actionBy: approver,
            actionDate: new Date().toISOString(),
            actionDateFormatted,
            rejectionReason: status === 'rejected' ? (rejectionReason || 'Declined by reviewer') : null,
            cancellationReason: status === 'cancelled' ? (rejectionReason || 'Cancelled by reviewer') : null,
            isAcknowledged: false,
            updatedAt: new Date().toISOString()
          };
        }
        return l;
      }));

      addToast(
        status === 'approved'
          ? `🎉 Leave request approved successfully!`
          : status === 'cancelled'
          ? `Leave request has been cancelled.`
          : `Leave request has been denied.`,
        status === 'approved' ? 'success' : 'info'
      );

      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEAVES } }));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: 'ems_leaves' } }));
      window.dispatchEvent(new CustomEvent('ems_leaves_updated', { detail: { leaveId, status, approver } }));

      // Asynchronous background sync to MongoDB Atlas
      hrService.updateLeaveStatus(leaveId, status, approver, rejectionReason).catch(err => {
        console.warn('[HRContext] Sync leave status to backend:', err);
      });
    } catch (err) {
      addToast(err?.message || 'Failed to update leave status', 'error');
    }
  };

  const acknowledgeLeave = async (leaveId) => {
    try {
      try {
        const stored = JSON.parse(localStorage.getItem('ems_acknowledged_leaves') || '[]');
        if (!stored.includes(String(leaveId))) {
          stored.push(String(leaveId));
          localStorage.setItem('ems_acknowledged_leaves', JSON.stringify(stored));
        }
      } catch (_) {}
      setLeaves(prev => (prev || []).map(l => String(l._id) === String(leaveId) ? { ...l, isAcknowledged: true } : l));
      await hrService.acknowledgeLeave(leaveId);
    } catch (e) {
      console.warn('Acknowledge leave error:', e);
    }
  };

  const deleteLeave = async (leaveId) => {
    try {
      // 🚀 0ms Instant Optimistic Local Removal
      setLeaves(prev => (prev || []).filter(l => String(l._id || l.id) !== String(leaveId)));
      const leaves = getCollection(KEYS.LEAVES) || [];
      const remaining = leaves.filter(l => String(l._id || l.id) !== String(leaveId));
      saveCollection(KEYS.LEAVES, remaining);
      addToast('Leave request deleted successfully', 'info');
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEAVES } }));
      window.dispatchEvent(new CustomEvent('ems_leaves_updated', { detail: { leaveId, status: 'deleted' } }));

      // Asynchronous background sync
      hrService.deleteLeave(leaveId).catch(err => console.warn('[HRContext] Sync delete leave to backend:', err));
    } catch (err) {
      console.error('Failed to delete leave:', err);
      addToast('Failed to delete leave', 'error');
    }
  };

  // ================= ATTENDANCE & AUDIT =================
  const markAttendanceRecord = async (data) => {
    try {
      // 🚀 0ms Instant Optimistic Attendance Update
      const curAtt = getCollection(KEYS.ATTENDANCE) || [];
      const empIdStr = String(data.employeeId || data.employee || '');
      const dateStr = data.date;
      const idx = curAtt.findIndex(a =>
        (String(a.employeeId || a.employee || '') === empIdStr || String(a.employeeCode || '') === empIdStr) &&
        a.date === dateStr
      );
      const newRec = {
        _id: `att_${Date.now()}`,
        ...data,
        updatedAt: new Date().toISOString()
      };
      let updatedAtt;
      if (idx !== -1) {
        updatedAtt = [...curAtt];
        updatedAtt[idx] = { ...updatedAtt[idx], ...newRec };
      } else {
        updatedAtt = [newRec, ...curAtt];
      }
      saveCollection(KEYS.ATTENDANCE, updatedAtt);
      setAttendance(updatedAtt);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.ATTENDANCE } }));
      addToast('Attendance marked successfully!', 'success');

      // Asynchronous background sync
      hrService.markAttendance(data).catch(err => console.warn('[HRContext] Sync attendance mark to backend:', err));
    } catch (err) {
      addToast('Failed to record attendance', 'error');
    }
  };

  const adminForceClockOut = async (employeeId, auditNote) => {
    try {
      addToast('Employee shift clocked out with audit note', 'success');
      hrService.adminForceClockOut(employeeId, auditNote).catch(err => console.warn('[HRContext] Force clock out sync:', err));
    } catch (err) {
      addToast(err?.message || 'Failed to force clock out', 'error');
    }
  };

  // ================= HOLIDAYS =================
  const addHoliday = async (data) => {
    try {
      const tempId = `hol_${Date.now()}`;
      const newHol = { _id: tempId, id: tempId, ...data };
      setHolidays(prev => [...prev, newHol]);
      const cur = getCollection(KEYS.HOLIDAYS) || [];
      saveCollection(KEYS.HOLIDAYS, [...cur, newHol]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.HOLIDAYS } }));
      addToast('New holiday added to company calendar!', 'success');

      hrService.createHoliday(data).catch(err => console.warn('[HRContext] Sync holiday to backend:', err));
    } catch (err) {
      addToast('Failed to create holiday', 'error');
    }
  };

  const deleteHoliday = async (holidayId) => {
    try {
      setHolidays(prev => prev.filter(h => h._id !== holidayId && h.id !== holidayId));
      const cur = getCollection(KEYS.HOLIDAYS) || [];
      saveCollection(KEYS.HOLIDAYS, cur.filter(h => h._id !== holidayId && h.id !== holidayId));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.HOLIDAYS } }));
      addToast('Holiday removed from calendar', 'info');

      hrService.deleteHoliday(holidayId).catch(err => console.warn('[HRContext] Sync delete holiday to backend:', err));
    } catch (err) {
      addToast('Failed to delete holiday', 'error');
    }
  };

  const toggleHolidayConfirmation = async (holidayId, isConfirmed) => {
    try {
      setHolidays(prev => prev.map(h => (h._id === holidayId || h.id === holidayId ? { ...h, isConfirmed, confirmedBy: currentUser?.name } : h)));
      addToast(isConfirmed ? 'Holiday declared as Official Paid Holiday! ✅' : 'Holiday set to Optional / Working Day 🏢', 'success');
      hrService.toggleHolidayConfirmation(holidayId, isConfirmed, currentUser).catch(err => console.warn('Sync holiday confirmation:', err));
    } catch (err) {
      addToast('Failed to update holiday status', 'error');
    }
  };

  const bulkConfirmGazetted = async (year) => {
    try {
      addToast(`All Gazetted Holidays for ${year} confirmed as Official Paid Offs! 🏛️`, 'success');
      hrService.bulkConfirmGazetted(year, holidays, currentUser)
        .then(() => loadData())
        .catch(err => console.warn('[HRContext] Bulk confirm gazetted sync:', err));
    } catch (err) {
      addToast('Failed to confirm gazetted holidays', 'error');
    }
  };

  const resetHolidayConfirmations = async (year) => {
    try {
      addToast(`Holiday confirmations for ${year} reset to default policy.`, 'info');
      hrService.resetHolidayConfirmations(year)
        .then(() => loadData())
        .catch(err => console.warn('[HRContext] Reset holiday sync:', err));
    } catch (err) {
      addToast('Failed to reset holiday confirmations', 'error');
    }
  };

  // ================= APPRECIATIONS =================
  const addAppreciation = async (data) => {
    try {
      if (!canGiveAppreciation(currentUser)) {
        addToast('Access Denied: You do not have permission to give appreciation awards.', 'error');
        return;
      }
      const tempId = `app_${Date.now()}`;
      const newApp = { _id: tempId, id: tempId, createdAt: new Date().toISOString(), ...data };
      setAppreciations(prev => [newApp, ...prev]);
      const cur = getCollection(KEYS.APPRECIATIONS) || [];
      saveCollection(KEYS.APPRECIATIONS, [newApp, ...cur]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.APPRECIATIONS } }));
      addToast('Appreciation award presented successfully! 🎉', 'success');

      hrService.createAppreciation(data).catch(err => console.warn('[HRContext] Sync appreciation to backend:', err));
    } catch (err) {
      addToast('Failed to add appreciation', 'error');
    }
  };

  const deleteAppreciation = async (appreciationId) => {
    try {
      if (!canDeleteAppreciation(currentUser)) {
        addToast('Access Denied: Only Administrators can delete appreciation records.', 'error');
        return;
      }
      setAppreciations(prev => prev.filter(a => a._id !== appreciationId && a.id !== appreciationId));
      const cur = getCollection(KEYS.APPRECIATIONS) || [];
      saveCollection(KEYS.APPRECIATIONS, cur.filter(a => a._id !== appreciationId && a.id !== appreciationId));
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.APPRECIATIONS } }));
      addToast('Appreciation record removed', 'info');

      hrService.deleteAppreciation(appreciationId).catch(err => console.warn('[HRContext] Sync delete appreciation to backend:', err));
    } catch (err) {
      addToast('Failed to delete appreciation', 'error');
    }
  };

  const submitResignation = async (data) => {
    try {
      addToast('Resignation request submitted for higher authority approval', 'info');
      hrService.submitResignation(data)
        .then(() => loadData())
        .catch(err => console.warn('[HRContext] Resignation sync notice:', err));
      return { success: true };
    } catch (err) {
      addToast(err.message || 'Failed to submit resignation', 'error');
      throw err;
    }
  };

  const reviewResignation = async (resignationId, reviewData) => {
    try {
      addToast(`Resignation ${reviewData.status || 'reviewed'} successfully`, 'success');
      hrService.reviewResignation(resignationId, reviewData)
        .then(() => loadData())
        .catch(err => console.warn('[HRContext] Resignation review sync:', err));
      return { success: true };
    } catch (err) {
      addToast(err.message || 'Failed to review resignation', 'error');
      throw err;
    }
  };

  const hrContextValue = useMemo(() => ({
    loading,
    employees,
    currentUser,
    leaves,
    attendance,
    auditLogs,
    holidays,
    appreciations,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    selectedEmployeeId,
    setSelectedEmployeeId,
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    loadData,
    loadHRData: loadData,
    addEmployee,
    updateEmployee,
    updateEmployeePermissions,
    deleteEmployee,
    applyLeave,
    updateLeaveStatus,
    acknowledgeLeave,
    deleteLeave,
    markAttendanceRecord,
    adminForceClockOut,
    addHoliday,
    deleteHoliday,
    toggleHolidayConfirmation,
    bulkConfirmGazetted,
    resetHolidayConfirmations,
    addAppreciation,
    deleteAppreciation,
    resignations,
    submitResignation,
    reviewResignation
  }), [
    loading, employees, currentUser, leaves, attendance, auditLogs,
    holidays, appreciations, selectedMonth, selectedYear,
    selectedEmployeeId, searchQuery, dateRange, loadData,
    addEmployee, updateEmployee, updateEmployeePermissions, deleteEmployee, applyLeave,
    updateLeaveStatus, acknowledgeLeave, deleteLeave,
    markAttendanceRecord, adminForceClockOut, addHoliday,
    deleteHoliday, toggleHolidayConfirmation, bulkConfirmGazetted, resetHolidayConfirmations, addAppreciation, deleteAppreciation,
    resignations, submitResignation, reviewResignation
  ]);

  return (
    <HRContext.Provider value={hrContextValue}>
      {children}
    </HRContext.Provider>
  );
};

export const useHR = () => {
  const context = useContext(HRContext);
  return context || defaultHRContext;
};
