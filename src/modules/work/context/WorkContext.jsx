/**
 * @file WorkContext.jsx
 * @description Central state management for Work Module (Projects, Tasks, Timesheets)
 * with live ticking timers and seamless HR module cross-connection.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { workService } from '../services/workService';
import { useHR } from '../../hr/context/HRContext';
import { useToast } from '../../../shared/context/ToastContext';

const WorkContext = createContext();

export const WorkProvider = ({ children }) => {
  const { addToast } = useToast();
  const { employees, leaves, currentUser } = useHR();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active filter states
  const [projectFilter, setProjectFilter] = useState({ status: 'all', category: 'all', department: 'all', search: '' });
  const [taskFilter, setTaskFilter] = useState({ projectId: 'all', status: 'all', priority: 'all', assignedTo: 'all', hideCompleted: false, search: '' });
  const [timesheetFilter, setTimesheetFilter] = useState({ employeeId: 'all', projectId: 'all', taskId: 'all', date: '', status: 'all', search: '' });

  // Load all Work module data
  const loadWorkData = useCallback(async () => {
    try {
      setLoading(true);
      const [prjs, tsks, times] = await Promise.all([
        workService.getProjects(projectFilter),
        workService.getTasks(taskFilter),
        workService.getTimesheets(timesheetFilter)
      ]);
      setProjects(prjs || []);
      setTasks(tsks || []);
      setTimesheets(times || []);
    } catch (err) {
      console.error('Error loading Work module data:', err);
      addToast('Failed to sync Work module data', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, taskFilter, timesheetFilter, addToast]);

  useEffect(() => {
    loadWorkData();

    const handleStorageUpdate = (e) => {
      if (['ems_projects', 'ems_tasks', 'ems_timesheets'].includes(e.detail?.key)) {
        loadWorkData();
      }
    };
    window.addEventListener('hrms_storage_change', handleStorageUpdate);
    return () => window.removeEventListener('hrms_storage_change', handleStorageUpdate);
  }, [loadWorkData]);

  // =========================================================================
  // ⏱️ LIVE TICKING TASK TIMER ENGINE (Coordinates with top-bar work timer)
  // =========================================================================
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTasks((prevTasks) => {
        let changed = false;
        const updated = prevTasks.map((t) => {
          if (t.timerRunning) {
            changed = true;
            const newSecs = (t.timerSeconds || 0) + 1;
            const hrs = String(Math.floor(newSecs / 3600)).padStart(2, '0');
            const mins = String(Math.floor((newSecs % 3600) / 60)).padStart(2, '0');
            const secs = String(newSecs % 60).padStart(2, '0');
            return {
              ...t,
              timerSeconds: newSecs,
              hoursLoggedText: `${hrs}:${mins}:${secs}`
            };
          }
          return t;
        });
        return changed ? updated : prevTasks;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Format seconds to HH:MM:SS
  const formatSeconds = (totalSecs) => {
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // =========================================================================
  // 🏢 PROJECT ACTIONS
  // =========================================================================
  const createProject = async (projectData) => {
    try {
      const created = await workService.createProject(projectData);
      addToast(`Project "${created.name}" created successfully!`, 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to create project', 'error');
      throw err;
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      const updated = await workService.updateProject(id, projectData);
      addToast(`Project "${updated.name}" updated`, 'success');
      await loadWorkData();
      return updated;
    } catch (err) {
      addToast('Failed to update project', 'error');
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      await workService.deleteProject(id);
      addToast('Project removed successfully', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete project', 'error');
      throw err;
    }
  };

  // =========================================================================
  // 📋 TASK ACTIONS & TIMERS
  // =========================================================================
  const createTask = async (taskData) => {
    try {
      const created = await workService.createTask(taskData);
      addToast(`Task "${created.title}" assigned successfully!`, 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to create task', 'error');
      throw err;
    }
  };

  const updateTask = async (id, taskData) => {
    try {
      const updated = await workService.updateTask(id, taskData);
      addToast(`Task "${updated.title}" updated`, 'success');
      await loadWorkData();
      return updated;
    } catch (err) {
      addToast('Failed to update task', 'error');
      throw err;
    }
  };

  const changeTaskStatus = async (id, status) => {
    try {
      await workService.updateTaskStatus(id, status);
      addToast(`Task status changed to ${status}`, 'success');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to change task status', 'error');
    }
  };

  const deleteTask = async (id) => {
    try {
      await workService.deleteTask(id);
      addToast('Task deleted successfully', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete task', 'error');
    }
  };

  // Start Task Timer
  const startTaskTimer = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        return { ...t, timerRunning: true, status: t.status === 'incomplete' ? 'in_progress' : t.status };
      }
      return t;
    }));
    addToast('Task timer started! ⏱️ Tracking active work.', 'info');
  };

  // Pause Task Timer
  const pauseTaskTimer = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        return { ...t, timerRunning: false };
      }
      return t;
    }));
    addToast('Task timer paused', 'info');
  };

  // Stop Task Timer & Log to Timesheet
  const stopTaskTimer = async (taskId, memo = 'Completed session') => {
    const targetTask = tasks.find(t => t._id === taskId);
    if (!targetTask) return;

    const totalSecs = targetTask.timerSeconds || 8241;
    try {
      await workService.stopTimer({
        taskId: targetTask._id,
        totalDurationSeconds: totalSecs,
        memo: memo || `Work on ${targetTask.title}`
      });

      setTasks(prev => prev.map(t => {
        if (t._id === taskId) {
          return { ...t, timerRunning: false, timerSeconds: 0 };
        }
        return t;
      }));

      addToast(`Timer stopped! ${formatSeconds(totalSecs)} logged to Timesheet.`, 'success');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to save timer session', 'error');
    }
  };

  // =========================================================================
  // ⏱️ TIMESHEET ACTIONS
  // =========================================================================
  const logTimesheet = async (entryData) => {
    try {
      const created = await workService.createTimesheet(entryData);
      addToast('Time logged successfully to Timesheet!', 'success');
      await loadWorkData();
      return created;
    } catch (err) {
      addToast('Failed to log time', 'error');
      throw err;
    }
  };

  const deleteTimesheet = async (id) => {
    try {
      await workService.deleteTimesheet(id);
      addToast('Timesheet entry removed', 'info');
      await loadWorkData();
    } catch (err) {
      addToast('Failed to delete timesheet entry', 'error');
    }
  };

  // =========================================================================
  // 🔗 HR & CRM CROSS-CONNECTION INTELLIGENCE
  // =========================================================================
  // Check if an employee is currently on approved leave for a specific date
  const isEmployeeOnLeave = (empId, checkDate = new Date().toISOString().split('T')[0]) => {
    if (!leaves || !leaves.length) return false;
    return leaves.some(l => {
      if (l.employeeId !== empId && l.employee !== empId) return false;
      if (l.status !== 'approved') return false;
      return checkDate >= l.startDate && checkDate <= l.endDate;
    });
  };

  // Active running task if any
  const activeRunningTask = tasks.find(t => t.timerRunning);

  return (
    <WorkContext.Provider value={{
      loading,
      projects,
      tasks,
      timesheets,
      activeRunningTask,
      // Filters
      projectFilter,
      setProjectFilter,
      taskFilter,
      setTaskFilter,
      timesheetFilter,
      setTimesheetFilter,
      // Refetch
      loadWorkData,
      formatSeconds,
      // Project Methods
      createProject,
      updateProject,
      deleteProject,
      // Task Methods
      createTask,
      updateTask,
      changeTaskStatus,
      deleteTask,
      startTaskTimer,
      pauseTaskTimer,
      stopTaskTimer,
      // Timesheet Methods
      logTimesheet,
      deleteTimesheet,
      // HR cross connection
      employees,
      currentUser,
      isEmployeeOnLeave
    }}>
      {children}
    </WorkContext.Provider>
  );
};

export const useWork = () => useContext(WorkContext);
