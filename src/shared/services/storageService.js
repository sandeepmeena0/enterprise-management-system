/**
 * @file storageService.js
 * @description LocalStorage database engine with reactive triggers.
 * 
 * WHY THIS IS HERE:
 * It simulates a real MongoDB database right inside the browser during frontend development.
 * It persists state across page reloads, supports standard CRUD queries, and emits
 * change events so that the entire app stays synchronized.
 * 
 * LOCATION: src/shared/services/storageService.js
 * USED BY:  src/modules/hr/services/hrService.js (and future module services)
 */

import {
  INITIAL_EMPLOYEES,
  INITIAL_LEAVES,
  generateInitialAttendance,
  INITIAL_HOLIDAYS,
  INITIAL_APPRECIATIONS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_TIMESHEETS,
  INITIAL_TICKETS,
  INITIAL_NOTICES,
  INITIAL_EVENTS,
  INITIAL_BIRTHDAYS,
  INITIAL_WFH_EMPLOYEES,
  INITIAL_WEEKLY_TIMELOGS,
  INITIAL_LEADS,
  INITIAL_EXPENSES,
  INITIAL_CONVERSATIONS
} from '../mock/initialData';

const KEYS = {
  EMPLOYEES: 'hrms_employees',
  LEAVES: 'hrms_leaves',
  ATTENDANCE: 'hrms_attendance',
  HOLIDAYS: 'hrms_holidays',
  APPRECIATIONS: 'hrms_appreciations',
  PROJECTS: 'ems_projects',
  TASKS: 'ems_tasks',
  TIMESHEETS: 'ems_timesheets',
  TICKETS: 'ems_tickets',
  NOTICES: 'ems_notices',
  EVENTS: 'ems_events',
  BIRTHDAYS: 'ems_birthdays',
  WFH: 'ems_wfh',
  WEEKLY_TIMELOGS: 'ems_weekly_timelogs',
  LEADS: 'ems_leads',
  EXPENSES: 'ems_expenses',
  CONVERSATIONS: 'ems_conversations',
  WORK_TIMER: 'hrms_work_timer',
  SETTINGS: 'hrms_settings'
};

export const initStorage = () => {
  if (!localStorage.getItem(KEYS.EMPLOYEES)) {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
  } else {
    // Backfill dob if missing in stored employees
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES));
      let modified = false;
      const updated = stored.map(emp => {
        if (!emp.dob) {
          const match = INITIAL_EMPLOYEES.find(e => e._id === emp._id);
          if (match && match.dob) {
            modified = true;
            return { ...emp, dob: match.dob };
          }
        }
        return emp;
      });
      if (modified) {
        localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Error backfilling employee DOB:', e);
    }
  }
  if (!localStorage.getItem(KEYS.LEAVES)) {
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
  }
  if (!localStorage.getItem(KEYS.ATTENDANCE)) {
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(generateInitialAttendance()));
  }
  if (!localStorage.getItem(KEYS.HOLIDAYS)) {
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(INITIAL_HOLIDAYS));
  }
  if (!localStorage.getItem(KEYS.APPRECIATIONS)) {
    localStorage.setItem(KEYS.APPRECIATIONS, JSON.stringify(INITIAL_APPRECIATIONS));
  }
  if (!localStorage.getItem(KEYS.PROJECTS)) {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
  }
  if (!localStorage.getItem(KEYS.TASKS)) {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
  }
  if (!localStorage.getItem(KEYS.TIMESHEETS)) {
    localStorage.setItem(KEYS.TIMESHEETS, JSON.stringify(INITIAL_TIMESHEETS));
  }
  if (!localStorage.getItem(KEYS.TICKETS)) {
    localStorage.setItem(KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
  }
  if (!localStorage.getItem(KEYS.NOTICES)) {
    localStorage.setItem(KEYS.NOTICES, JSON.stringify(INITIAL_NOTICES));
  }
  if (!localStorage.getItem(KEYS.EVENTS)) {
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(INITIAL_EVENTS));
  }
  if (!localStorage.getItem(KEYS.BIRTHDAYS)) {
    localStorage.setItem(KEYS.BIRTHDAYS, JSON.stringify(INITIAL_BIRTHDAYS));
  }
  if (!localStorage.getItem(KEYS.WFH)) {
    localStorage.setItem(KEYS.WFH, JSON.stringify(INITIAL_WFH_EMPLOYEES));
  }
  if (!localStorage.getItem(KEYS.WEEKLY_TIMELOGS)) {
    localStorage.setItem(KEYS.WEEKLY_TIMELOGS, JSON.stringify(INITIAL_WEEKLY_TIMELOGS));
  }
  if (!localStorage.getItem(KEYS.LEADS)) {
    localStorage.setItem(KEYS.LEADS, JSON.stringify(INITIAL_LEADS));
  }
  if (!localStorage.getItem(KEYS.EXPENSES)) {
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
  }
  if (!localStorage.getItem(KEYS.CONVERSATIONS)) {
    localStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(INITIAL_CONVERSATIONS));
  }
};

// Generic read
export const getCollection = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
    return [];
  }
};

// Generic write with broadcast
export const saveCollection = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key } }));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
};

export { KEYS };
