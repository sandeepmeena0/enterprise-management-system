/**
 * @file workService.js
 * @description Hybrid Data Service for Projects, Tasks, and Timesheets.
 * Connects to backend API with fallback to reactive localStorage engine.
 */

import { getCollection, saveCollection, KEYS } from '../../../shared/services/storageService';
import { API_BASE as API_BASE_URL } from '../../../shared/config/apiConfig';

const isBackendAvailable = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
};

export const workService = {
  // ==========================================
  // 🏢 PROJECTS
  // ==========================================
  async getProjects(filters = {}) {
    if (await isBackendAvailable()) {
      try {
        const queryParams = new URLSearchParams();
        if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters.category && filters.category !== 'all') queryParams.append('category', filters.category);
        if (filters.department && filters.department !== 'all') queryParams.append('department', filters.department);
        if (filters.search) queryParams.append('search', filters.search);

        const res = await fetch(`${API_BASE_URL}/projects?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend unavailable for projects, using localStorage:', err);
      }
    }

    // LocalStorage Fallback
    let list = getCollection(KEYS.PROJECTS);
    if (filters.status && filters.status !== 'all') {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters.category && filters.category !== 'all') {
      list = list.filter(p => p.category?.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters.department && filters.department !== 'all') {
      list = list.filter(p => p.department?.toLowerCase() === filters.department.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.projectCode?.toLowerCase().includes(q) ||
        p.client?.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async createProject(projectData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend project creation failed, using local storage:', err);
      }
    }

    const projects = getCollection(KEYS.PROJECTS);
    const newProject = {
      _id: `prj_${Date.now()}`,
      ...projectData,
      createdAt: new Date().toISOString()
    };
    projects.unshift(newProject);
    saveCollection(KEYS.PROJECTS, projects);
    return newProject;
  },

  async updateProject(id, updateData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend project update failed, using local storage:', err);
      }
    }

    const projects = getCollection(KEYS.PROJECTS);
    const index = projects.findIndex(p => p._id === id);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...updateData };
      saveCollection(KEYS.PROJECTS, projects);
      return projects[index];
    }
    return null;
  },

  async deleteProject(id) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Backend project deletion failed, using local storage:', err);
      }
    }

    const projects = getCollection(KEYS.PROJECTS);
    const filtered = projects.filter(p => p._id !== id);
    saveCollection(KEYS.PROJECTS, filtered);
    return true;
  },

  // ==========================================
  // 📋 TASKS
  // ==========================================
  async getTasks(filters = {}) {
    if (await isBackendAvailable()) {
      try {
        const queryParams = new URLSearchParams();
        if (filters.projectId && filters.projectId !== 'all') queryParams.append('projectId', filters.projectId);
        if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters.priority && filters.priority !== 'all') queryParams.append('priority', filters.priority);
        if (filters.assignedTo && filters.assignedTo !== 'all') queryParams.append('assignedTo', filters.assignedTo);
        if (filters.hideCompleted) queryParams.append('hideCompleted', 'true');
        if (filters.search) queryParams.append('search', filters.search);

        const res = await fetch(`${API_BASE_URL}/tasks?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend unavailable for tasks, using localStorage:', err);
      }
    }

    // LocalStorage Fallback
    let list = getCollection(KEYS.TASKS);
    if (filters.projectId && filters.projectId !== 'all') {
      list = list.filter(t => t.projectId === filters.projectId || t.projectCode === filters.projectId);
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter(t => t.status === filters.status);
    } else if (filters.hideCompleted) {
      list = list.filter(t => t.status !== 'completed');
    }
    if (filters.priority && filters.priority !== 'all') {
      list = list.filter(t => t.priority === filters.priority);
    }
    if (filters.assignedTo && filters.assignedTo !== 'all') {
      list = list.filter(t => t.assignedToId === filters.assignedTo || t.assignedTo === filters.assignedTo);
    }
    if (filters.assignedBy && filters.assignedBy !== 'all') {
      list = list.filter(t => t.assignedById === filters.assignedBy || t.assignedBy === filters.assignedBy);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.taskCode?.toLowerCase().includes(q) ||
        t.projectName?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async createTask(taskData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend task creation failed, using local storage:', err);
      }
    }

    const tasks = getCollection(KEYS.TASKS);
    const code = taskData.taskCode || `${taskData.projectCode || 'TSK'}-${tasks.length + 1}`;
    const newTask = {
      _id: `tsk_${Date.now()}`,
      ...taskData,
      taskCode: code,
      hoursLogged: taskData.hoursLogged || 0,
      hoursLoggedText: taskData.hoursLoggedText || '0s',
      timerRunning: false,
      timerSeconds: 0,
      createdAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    saveCollection(KEYS.TASKS, tasks);
    return newTask;
  },

  async updateTask(id, updateData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend task update failed, using local storage:', err);
      }
    }

    const tasks = getCollection(KEYS.TASKS);
    const index = tasks.findIndex(t => t._id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updateData };
      saveCollection(KEYS.TASKS, tasks);
      return tasks[index];
    }
    return null;
  },

  async updateTaskStatus(id, status) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend task status update failed, using local storage:', err);
      }
    }

    const tasks = getCollection(KEYS.TASKS);
    const index = tasks.findIndex(t => t._id === id);
    if (index !== -1) {
      tasks[index].status = status;
      if (status === 'completed') {
        tasks[index].completedOn = new Date().toISOString().split('T')[0];
        tasks[index].timerRunning = false;
      }
      saveCollection(KEYS.TASKS, tasks);
      return tasks[index];
    }
    return null;
  },

  async deleteTask(id) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Backend task delete failed, using local storage:', err);
      }
    }

    const tasks = getCollection(KEYS.TASKS);
    const filtered = tasks.filter(t => t._id !== id);
    saveCollection(KEYS.TASKS, filtered);
    return true;
  },

  // ==========================================
  // ⏱️ TIMESHEET & TRACKING
  // ==========================================
  async getTimesheets(filters = {}) {
    if (await isBackendAvailable()) {
      try {
        const queryParams = new URLSearchParams();
        if (filters.employeeId && filters.employeeId !== 'all') queryParams.append('employeeId', filters.employeeId);
        if (filters.projectId && filters.projectId !== 'all') queryParams.append('projectId', filters.projectId);
        if (filters.taskId && filters.taskId !== 'all') queryParams.append('taskId', filters.taskId);
        if (filters.date) queryParams.append('date', filters.date);
        if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters.search) queryParams.append('search', filters.search);

        const res = await fetch(`${API_BASE_URL}/timesheet?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend timesheet fetch failed, using local storage:', err);
      }
    }

    // LocalStorage Fallback
    let list = getCollection(KEYS.TIMESHEETS);
    if (filters.employeeId && filters.employeeId !== 'all') {
      list = list.filter(ts => ts.employeeId === filters.employeeId || ts.employee === filters.employeeId);
    }
    if (filters.projectId && filters.projectId !== 'all') {
      list = list.filter(ts => ts.projectId === filters.projectId || ts.project === filters.projectId);
    }
    if (filters.taskId && filters.taskId !== 'all') {
      list = list.filter(ts => ts.taskId === filters.taskId || ts.task === filters.taskId);
    }
    if (filters.date) {
      list = list.filter(ts => ts.date === filters.date);
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter(ts => ts.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(ts =>
        ts.taskTitle?.toLowerCase().includes(q) ||
        ts.projectName?.toLowerCase().includes(q) ||
        ts.employeeName?.toLowerCase().includes(q) ||
        ts.memo?.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async createTimesheet(entryData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/timesheet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend timesheet log failed, using local storage:', err);
      }
    }

    const timesheets = getCollection(KEYS.TIMESHEETS);
    const newEntry = {
      _id: `time_${Date.now()}`,
      ...entryData,
      createdAt: new Date().toISOString()
    };
    timesheets.unshift(newEntry);
    saveCollection(KEYS.TIMESHEETS, timesheets);

    // Update task logged hours
    if (entryData.taskId) {
      const tasks = getCollection(KEYS.TASKS);
      const tIndex = tasks.findIndex(t => t._id === entryData.taskId);
      if (tIndex !== -1) {
        const durationHours = (entryData.totalDurationSeconds || 0) / 3600;
        tasks[tIndex].hoursLogged = Number(((tasks[tIndex].hoursLogged || 0) + durationHours).toFixed(2));
        const totalSecs = Math.round(tasks[tIndex].hoursLogged * 3600);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        tasks[tIndex].hoursLoggedText = `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
        saveCollection(KEYS.TASKS, tasks);
      }
    }

    return newEntry;
  },

  async stopTimer(stopData) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/timesheet/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopData)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Backend timer stop failed, using local storage:', err);
      }
    }

    // Local calculation & saving
    const { taskId, totalDurationSeconds, memo, startTime, endTime } = stopData;
    const tasks = getCollection(KEYS.TASKS);
    const task = tasks.find(t => t._id === taskId);
    if (task) {
      task.timerRunning = false;
      const hoursAdded = totalDurationSeconds / 3600;
      task.hoursLogged = Number(((task.hoursLogged || 0) + hoursAdded).toFixed(2));
      const totalSecs = Math.round(task.hoursLogged * 3600);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      task.hoursLoggedText = `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
      saveCollection(KEYS.TASKS, tasks);
    }

    const hrs = String(Math.floor(totalDurationSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalDurationSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalDurationSeconds % 60).padStart(2, '0');
    const durationText = `${hrs}:${mins}:${secs}`;

    const timesheets = getCollection(KEYS.TIMESHEETS);
    const newLog = {
      _id: `time_${Date.now()}`,
      taskId: task?._id || taskId,
      taskCode: task?.taskCode || '',
      taskTitle: task?.title || 'Tracked Session',
      projectId: task?.projectId || '',
      projectName: task?.projectName || 'General Work',
      employeeId: task?.assignedToId || 'emp_001',
      employeeName: task?.assignedToName || 'Avinash',
      employeeAvatar: task?.assignedToAvatar || '',
      employeeRole: task?.assignedToRole || '',
      date: new Date().toISOString().split('T')[0],
      startTime: startTime || new Date(Date.now() - totalDurationSeconds * 1000).toTimeString().split(' ')[0],
      endTime: endTime || new Date().toTimeString().split(' ')[0],
      totalDurationSeconds,
      totalDurationText: durationText,
      memo: memo || 'Live work session completed',
      status: 'stopped',
      createdAt: new Date().toISOString()
    };
    timesheets.unshift(newLog);
    saveCollection(KEYS.TIMESHEETS, timesheets);
    return newLog;
  },

  async deleteTimesheet(id) {
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(`${API_BASE_URL}/timesheet/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Backend timesheet delete failed, using local storage:', err);
      }
    }

    const timesheets = getCollection(KEYS.TIMESHEETS);
    const filtered = timesheets.filter(t => t._id !== id);
    saveCollection(KEYS.TIMESHEETS, filtered);
    return true;
  }
};
