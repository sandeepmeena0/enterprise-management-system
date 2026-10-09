/**
 * @file CRMContext.jsx
 * @description State Management for CRM modules: Expenses/Finance, Tickets with discussion threads,
 * Events with Automatic Birthday Generation from employee DOB, Team Chat/Messages, Notices, and Dark Mode.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getCollection, saveCollection, KEYS } from '../services/storageService';
import { useToast } from './ToastContext';
import { useHR } from '../../modules/hr/context/HRContext';

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  const { addToast } = useToast();
  const { currentUser, updateEmployee, employees } = useHR();

  // Core Storage States
  const [expenses, setExpenses] = useState(() => getCollection(KEYS.EXPENSES));
  const [tickets, setTickets] = useState(() => getCollection(KEYS.TICKETS));
  const [notices, setNotices] = useState(() => getCollection(KEYS.NOTICES));
  const [events, setEvents] = useState(() => getCollection(KEYS.EVENTS));
  const [conversations, setConversations] = useState(() => getCollection(KEYS.CONVERSATIONS));
  const [activeConversationId, setActiveConversationId] = useState('conv_1');
  const [wfhEmployees, setWfhEmployees] = useState(() => getCollection(KEYS.WFH));
  const [weeklyTimeLogs, setWeeklyTimeLogs] = useState(() => getCollection(KEYS.WEEKLY_TIMELOGS));
  const [leads, setLeads] = useState(() => getCollection(KEYS.LEADS));

  const [leadsFilter, setLeadsFilter] = useState({
    search: '',
    status: 'all',
    leadType: 'all',
    leadOwnerId: 'all',
    priority: 'all',
    client: 'all',
    startDate: '',
    endDate: ''
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('ems_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ems_dark_mode', darkMode.toString());
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      addToast(next ? 'Dark Mode Enabled 🌙' : 'Light Mode Enabled ☀️', 'info');
      return next;
    });
  };

  // Sync state with storage
  const syncWithStorage = () => {
    setExpenses(getCollection(KEYS.EXPENSES));
    setTickets(getCollection(KEYS.TICKETS));
    setNotices(getCollection(KEYS.NOTICES));
    setEvents(getCollection(KEYS.EVENTS));
    setConversations(getCollection(KEYS.CONVERSATIONS));
    setWfhEmployees(getCollection(KEYS.WFH));
    setWeeklyTimeLogs(getCollection(KEYS.WEEKLY_TIMELOGS));
    setLeads(getCollection(KEYS.LEADS));
  };

  useEffect(() => {
    const handleStorageUpdate = (e) => {
      if (['ems_expenses', 'ems_tickets', 'ems_notices', 'ems_events', 'ems_conversations', 'ems_wfh', 'ems_leads'].includes(e.detail?.key)) {
        syncWithStorage();
      }
    };
    window.addEventListener('hrms_storage_change', handleStorageUpdate);
    return () => window.removeEventListener('hrms_storage_change', handleStorageUpdate);
  }, []);

  // =========================================================================
  // 🎂 AUTOMATIC BIRTHDAY ENGINE (Calculates directly from Employee DOB)
  // =========================================================================
  const computedBirthdays = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const today = new Date();
    const currentYear = today.getFullYear();

    return employees
      .filter(emp => emp.dob || emp.birthdayDate)
      .map(emp => {
        let birthMonth = 9; // 0-indexed default
        let birthDay = 15;
        let dobStr = emp.dob;

        if (dobStr) {
          // Parse YYYY-MM-DD or DD-MM-YYYY
          const parts = dobStr.split(/[-/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD
              birthMonth = parseInt(parts[1], 10) - 1;
              birthDay = parseInt(parts[2], 10);
            } else {
              // DD-MM-YYYY
              birthDay = parseInt(parts[0], 10);
              birthMonth = parseInt(parts[1], 10) - 1;
            }
          }
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const birthdayThisYear = new Date(currentYear, birthMonth, birthDay);
        const birthdayFormattedDate = `${birthDay.toString().padStart(2, '0')} ${monthNames[birthMonth]}`;
        const birthdayEventDate = `${currentYear}-${(birthMonth + 1).toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;

        // Calculate days remaining
        const diffTime = birthdayThisYear.getTime() - today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let daysRemainingText = '';
        if (diffDays === 0) {
          daysRemainingText = "Today! 🎉 Happy Birthday!";
        } else if (diffDays === 1) {
          daysRemainingText = 'Tomorrow 🎂';
        } else if (diffDays > 1 && diffDays <= 30) {
          daysRemainingText = `${diffDays} days remaining`;
        } else if (diffDays > 30) {
          const monthsAhead = Math.round(diffDays / 30);
          daysRemainingText = `${monthsAhead} month${monthsAhead > 1 ? 's' : ''} after`;
        } else {
          daysRemainingText = 'Celebrated earlier this year';
        }

        return {
          _id: `bday_auto_${emp._id}`,
          employeeId: emp._id,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          avatar: emp.avatar,
          dob: emp.dob,
          birthdayDate: birthdayFormattedDate,
          eventDate: birthdayEventDate,
          daysRemainingText,
          diffDays,
          fullMonth: fullMonthNames[birthMonth],
          dayOfMonth: birthDay
        };
      })
      .sort((a, b) => {
        // Sort upcoming birthdays first
        const aVal = a.diffDays >= 0 ? a.diffDays : a.diffDays + 365;
        const bVal = b.diffDays >= 0 ? b.diffDays : b.diffDays + 365;
        return aVal - bVal;
      });
  }, [employees]);

  // =========================================================================
  // 💰 FINANCE / EXPENSES MODULE
  // =========================================================================
  const createExpense = async (expenseData) => {
    const currentList = getCollection(KEYS.EXPENSES);
    const nextNum = currentList.length > 0 ? Math.max(...currentList.map(e => e.idNumber || 0)) + 1 : 1;
    const now = new Date();

    const selectedEmployee = employees.find(emp => emp._id === expenseData.employeeId) || currentUser;

    const newExpense = {
      _id: `exp_${Date.now()}`,
      idNumber: nextNum,
      expenseCode: `EXP-${100 + nextNum}`,
      itemName: expenseData.itemName || expenseData.title || 'Office Expense',
      price: Number(expenseData.price || expenseData.amount) || 0,
      amount: Number(expenseData.price || expenseData.amount) || 0,
      category: expenseData.category || 'Utilities & Office',
      purchasedFrom: expenseData.purchasedFrom || 'Vendor Partner',
      purchaseDate: expenseData.purchaseDate || expenseData.date || now.toISOString().split('T')[0],
      date: expenseData.purchaseDate || expenseData.date || now.toISOString().split('T')[0],
      employeeId: selectedEmployee?._id || 'emp_001',
      employeeName: selectedEmployee?.name || 'Avinash',
      employeeAvatar: selectedEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      paidBy: selectedEmployee?.name || 'Avinash',
      status: expenseData.status || 'pending',
      description: expenseData.description || '',
      billAttachment: expenseData.billAttachment || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
      createdById: currentUser?._id || 'emp_001',
      createdByName: currentUser?.name || 'Avinash',
      createdAt: now.toISOString(),
      ...expenseData
    };

    currentList.unshift(newExpense);
    saveCollection(KEYS.EXPENSES, currentList);
    setExpenses([...currentList]);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EXPENSES } }));
    addToast(`Expense "${newExpense.itemName}" recorded successfully!`, 'success');
    return newExpense;
  };

  const updateExpense = async (expenseId, updateData) => {
    const currentList = getCollection(KEYS.EXPENSES);
    const idx = currentList.findIndex(e => e._id === expenseId);
    if (idx !== -1) {
      currentList[idx] = {
        ...currentList[idx],
        ...updateData,
        price: Number(updateData.price || updateData.amount || currentList[idx].price),
        amount: Number(updateData.price || updateData.amount || currentList[idx].amount),
        updatedAt: new Date().toISOString()
      };
      saveCollection(KEYS.EXPENSES, currentList);
      setExpenses([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EXPENSES } }));
      addToast('Expense record updated successfully!', 'success');
      return currentList[idx];
    }
  };

  const updateExpenseStatus = async (expenseId, status) => {
    const currentList = getCollection(KEYS.EXPENSES);
    const idx = currentList.findIndex(e => e._id === expenseId);
    if (idx !== -1) {
      currentList[idx].status = status;
      currentList[idx].updatedAt = new Date().toISOString();
      saveCollection(KEYS.EXPENSES, currentList);
      setExpenses([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EXPENSES } }));
      addToast(`Expense status marked as ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'info');
    }
  };

  const deleteExpense = async (expenseId) => {
    const currentList = getCollection(KEYS.EXPENSES);
    const filtered = currentList.filter(e => e._id !== expenseId);
    saveCollection(KEYS.EXPENSES, filtered);
    setExpenses(filtered);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EXPENSES } }));
    addToast('Expense record removed', 'info');
  };

  const importExpensesBatch = async (importedList) => {
    const currentList = getCollection(KEYS.EXPENSES);
    let maxNum = currentList.length > 0 ? Math.max(...currentList.map(e => e.idNumber || 0)) : 0;
    const now = new Date();

    const formatted = importedList.map((item, idx) => {
      maxNum++;
      return {
        _id: `exp_${Date.now()}_${idx}`,
        idNumber: maxNum,
        expenseCode: `EXP-${100 + maxNum}`,
        itemName: item.itemName || item.title || 'Imported Expense Item',
        price: Number(item.price || item.amount) || 1000,
        amount: Number(item.price || item.amount) || 1000,
        category: item.category || 'Utilities & Office',
        purchasedFrom: item.purchasedFrom || 'Vendor',
        purchaseDate: item.purchaseDate || item.date || now.toISOString().split('T')[0],
        date: item.purchaseDate || item.date || now.toISOString().split('T')[0],
        employeeId: currentUser?._id || 'emp_001',
        employeeName: item.employeeName || item.paidBy || currentUser?.name || 'Avinash',
        employeeAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        paidBy: item.paidBy || currentUser?.name || 'Avinash',
        status: item.status || 'pending',
        description: item.description || 'Imported via CSV template',
        billAttachment: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
        createdById: currentUser?._id || 'emp_001',
        createdByName: currentUser?.name || 'Avinash',
        createdAt: now.toISOString()
      };
    });

    const updated = [...formatted, ...currentList];
    saveCollection(KEYS.EXPENSES, updated);
    setExpenses(updated);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EXPENSES } }));
    addToast(`Successfully imported ${formatted.length} expense items!`, 'success');
  };

  // =========================================================================
  // 🎫 TICKETS MODULE (Immediate Admin & Employee Synchronization)
  // =========================================================================
  const createTicket = async (ticketData) => {
    const currentList = getCollection(KEYS.TICKETS);
    const nextNum = currentList.length > 0 ? Math.max(...currentList.map(t => parseInt(t.ticketCode?.replace('TKT-', '') || '1040', 10))) + 1 : 1041;
    const now = new Date();

    const newTicket = {
      _id: `tkt_${Date.now()}`,
      ticketCode: `TKT-${nextNum}`,
      subject: ticketData.subject || 'Helpdesk Support Request',
      category: ticketData.category || 'General Issue',
      priority: ticketData.priority || 'medium',
      description: ticketData.description || '',
      attachment: ticketData.attachment || '',
      status: 'open',
      requestedById: currentUser?._id || 'emp_001',
      requestedByName: currentUser?.name || 'Avinash',
      requestedByAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      assignedToId: ticketData.assignedToId || 'emp_005',
      assignedToName: ticketData.assignedToName || 'Amit Kumar (Admin / Support)',
      requestedOn: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      replies: [],
      internalNotes: [],
      ...ticketData
    };

    currentList.unshift(newTicket);
    saveCollection(KEYS.TICKETS, currentList);
    setTickets([...currentList]);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
    addToast(`Ticket "${newTicket.ticketCode}" raised! Admin has been notified immediately.`, 'success');
    return newTicket;
  };

  const updateTicketStatus = async (ticketId, status) => {
    const currentList = getCollection(KEYS.TICKETS);
    const idx = currentList.findIndex(t => t._id === ticketId);
    if (idx !== -1) {
      currentList[idx].status = status;
      currentList[idx].updatedAt = new Date().toISOString();
      saveCollection(KEYS.TICKETS, currentList);
      setTickets([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
      addToast(`Ticket status updated to ${status.replace('_', ' ').toUpperCase()}`, 'success');
    }
  };

  const replyToTicket = async (ticketId, messageText) => {
    if (!messageText.trim()) return;
    const currentList = getCollection(KEYS.TICKETS);
    const idx = currentList.findIndex(t => t._id === ticketId);
    if (idx !== -1) {
      const isUserAdmin = currentUser?.role?.toLowerCase().includes('lead') || currentUser?.role?.toLowerCase().includes('director') || currentUser?.role?.toLowerCase().includes('manager');
      const newReply = {
        id: `rep_${Date.now()}`,
        senderId: currentUser?._id || 'emp_001',
        senderName: currentUser?.name || 'Avinash',
        senderAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        message: messageText,
        timestamp: new Date().toISOString(),
        isAdminReply: isUserAdmin
      };

      currentList[idx].replies = [...(currentList[idx].replies || []), newReply];
      // Automatically advance status to in_progress if currently open
      if (currentList[idx].status === 'open' && isUserAdmin) {
        currentList[idx].status = 'in_progress';
      }

      saveCollection(KEYS.TICKETS, currentList);
      setTickets([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
      addToast('Reply sent successfully!', 'success');
    }
  };

  const addTicketInternalNote = async (ticketId, noteText) => {
    if (!noteText.trim()) return;
    const currentList = getCollection(KEYS.TICKETS);
    const idx = currentList.findIndex(t => t._id === ticketId);
    if (idx !== -1) {
      const newNote = {
        id: `note_${Date.now()}`,
        author: currentUser?.name || 'Admin',
        text: noteText,
        date: new Date().toISOString()
      };
      currentList[idx].internalNotes = [...(currentList[idx].internalNotes || []), newNote];
      saveCollection(KEYS.TICKETS, currentList);
      setTickets([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
      addToast('Internal admin note attached to ticket', 'info');
    }
  };

  const assignTicket = async (ticketId, employeeId) => {
    const currentList = getCollection(KEYS.TICKETS);
    const idx = currentList.findIndex(t => t._id === ticketId);
    const emp = employees.find(e => e._id === employeeId);
    if (idx !== -1 && emp) {
      currentList[idx].assignedToId = emp._id;
      currentList[idx].assignedToName = emp.name;
      saveCollection(KEYS.TICKETS, currentList);
      setTickets([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
      addToast(`Ticket reassigned to ${emp.name}`, 'info');
    }
  };

  const deleteTicket = async (ticketId) => {
    const currentList = getCollection(KEYS.TICKETS);
    const filtered = currentList.filter(t => t._id !== ticketId);
    saveCollection(KEYS.TICKETS, filtered);
    setTickets(filtered);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.TICKETS } }));
    addToast('Ticket removed', 'info');
  };

  // =========================================================================
  // 📅 EVENTS & COMPANY CALENDAR
  // =========================================================================
  const createEvent = async (eventData) => {
    const currentList = getCollection(KEYS.EVENTS);
    const newEvent = {
      _id: `ev_${Date.now()}`,
      eventName: eventData.eventName || eventData.title || 'Company Event',
      title: eventData.eventName || eventData.title || 'Company Event',
      eventType: eventData.eventType || 'Company Event',
      type: (eventData.eventType || 'meeting').toLowerCase().replace(/\s+/g, '_'),
      startDate: eventData.startDate || new Date().toISOString().split('T')[0],
      endDate: eventData.endDate || eventData.startDate || new Date().toISOString().split('T')[0],
      date: eventData.startDate || new Date().toISOString().split('T')[0],
      startTime: eventData.startTime || '10:00 AM',
      time: eventData.startTime || '10:00 AM',
      location: eventData.location || 'Headquarters & Video Link',
      description: eventData.description || '',
      isRecurring: !!eventData.isRecurring,
      color: eventData.color || '#2563eb',
      bgColor: eventData.bgColor || '#eff6ff',
      createdById: currentUser?._id || 'emp_001',
      createdAt: new Date().toISOString(),
      ...eventData
    };

    currentList.unshift(newEvent);
    saveCollection(KEYS.EVENTS, currentList);
    setEvents([...currentList]);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EVENTS } }));
    addToast(`Event "${newEvent.eventName}" scheduled on company calendar!`, 'success');
    return newEvent;
  };

  const updateEvent = async (eventId, updateData) => {
    const currentList = getCollection(KEYS.EVENTS);
    const idx = currentList.findIndex(e => e._id === eventId);
    if (idx !== -1) {
      currentList[idx] = {
        ...currentList[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      saveCollection(KEYS.EVENTS, currentList);
      setEvents([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EVENTS } }));
      addToast('Calendar event updated!', 'success');
    }
  };

  const deleteEvent = async (eventId) => {
    const currentList = getCollection(KEYS.EVENTS);
    const filtered = currentList.filter(e => e._id !== eventId);
    saveCollection(KEYS.EVENTS, filtered);
    setEvents(filtered);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.EVENTS } }));
    addToast('Event removed from calendar', 'info');
  };

  // =========================================================================
  // 💬 MESSAGES & TEAM CHAT
  // =========================================================================
  const sendMessage = (conversationId, text) => {
    if (!text.trim()) return;
    const currentConvs = getCollection(KEYS.CONVERSATIONS);
    const idx = currentConvs.findIndex(c => c.id === conversationId);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderId: currentUser?._id || 'emp_001',
      senderName: currentUser?.name || 'Avinash',
      text: text.trim(),
      timestamp: timeStr,
      isOutgoing: true
    };

    if (idx !== -1) {
      currentConvs[idx].messages.push(newMsg);
      currentConvs[idx].lastMessage = text.trim();
      currentConvs[idx].lastMessageTime = timeStr;
      saveCollection(KEYS.CONVERSATIONS, currentConvs);
      setConversations([...currentConvs]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.CONVERSATIONS } }));

      // Simulate a smart automatic friendly response after 2 seconds!
      setTimeout(() => {
        const contactName = currentConvs[idx].participantName || 'Colleague';
        const simulatedReply = {
          id: `msg_reply_${Date.now()}`,
          senderId: currentConvs[idx].participantId,
          senderName: contactName,
          text: `Got it, thanks for sharing! I am on it right away.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOutgoing: false
        };
        const latestConvs = getCollection(KEYS.CONVERSATIONS);
        const lIdx = latestConvs.findIndex(c => c.id === conversationId);
        if (lIdx !== -1) {
          latestConvs[lIdx].messages.push(simulatedReply);
          latestConvs[lIdx].lastMessage = simulatedReply.text;
          latestConvs[lIdx].lastMessageTime = simulatedReply.timestamp;
          saveCollection(KEYS.CONVERSATIONS, latestConvs);
          setConversations([...latestConvs]);
          window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.CONVERSATIONS } }));
        }
      }, 1500);
    }
  };

  const startConversation = (employeeId) => {
    const emp = employees.find(e => e._id === employeeId);
    if (!emp) return;

    const currentConvs = getCollection(KEYS.CONVERSATIONS);
    const existing = currentConvs.find(c => c.participantId === employeeId);

    if (existing) {
      setActiveConversationId(existing.id);
      addToast(`Chat opened with ${emp.name}`, 'info');
      return existing.id;
    }

    const newConv = {
      id: `conv_${Date.now()}`,
      participantId: emp._id,
      participantName: emp.name,
      participantRole: emp.role,
      participantAvatar: emp.avatar,
      isOnline: true,
      lastMessage: 'Started new direct conversation.',
      lastMessageTime: 'Just now',
      unreadCount: 0,
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          senderId: currentUser?._id || 'emp_001',
          senderName: currentUser?.name || 'Avinash',
          text: `Hi ${emp.name.split(' ')[0]}! Starting a new conversation.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOutgoing: true
        }
      ]
    };

    currentConvs.unshift(newConv);
    saveCollection(KEYS.CONVERSATIONS, currentConvs);
    setConversations([...currentConvs]);
    setActiveConversationId(newConv.id);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.CONVERSATIONS } }));
    addToast(`New conversation started with ${emp.name}!`, 'success');
    return newConv.id;
  };

  // =========================================================================
  // 📢 NOTICE BOARD MODULE
  // =========================================================================
  const createNotice = async (noticeData) => {
    const currentList = getCollection(KEYS.NOTICES);
    const now = new Date();
    const newNotice = {
      _id: `not_${Date.now()}`,
      title: noticeData.title || 'Company Notice',
      description: noticeData.description || noticeData.shortDescription || '',
      shortDescription: noticeData.shortDescription || noticeData.description || '',
      category: noticeData.category || 'Company Announcement',
      priority: noticeData.priority || 'medium',
      targetAudience: noticeData.targetAudience || noticeData.to || 'All Employees',
      to: noticeData.targetAudience || noticeData.to || 'All Employees',
      postedBy: currentUser?.name || 'HR Operations',
      createdBy: currentUser?.name || 'HR Operations',
      date: noticeData.date || now.toISOString().split('T')[0],
      expiryDate: noticeData.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      attachment: noticeData.attachment || '',
      isImportant: noticeData.priority === 'urgent' || noticeData.priority === 'high',
      fullContent: noticeData.description || '',
      createdAt: now.toISOString(),
      ...noticeData
    };

    currentList.unshift(newNotice);
    saveCollection(KEYS.NOTICES, currentList);
    setNotices([...currentList]);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.NOTICES } }));
    addToast('Company announcement published to Notice Board & Dashboards!', 'success');
    return newNotice;
  };

  const updateNotice = async (noticeId, updateData) => {
    const currentList = getCollection(KEYS.NOTICES);
    const idx = currentList.findIndex(n => n._id === noticeId);
    if (idx !== -1) {
      currentList[idx] = {
        ...currentList[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      saveCollection(KEYS.NOTICES, currentList);
      setNotices([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.NOTICES } }));
      addToast('Notice updated successfully!', 'success');
    }
  };

  const deleteNotice = async (noticeId) => {
    const currentList = getCollection(KEYS.NOTICES);
    const filtered = currentList.filter(n => n._id !== noticeId);
    saveCollection(KEYS.NOTICES, filtered);
    setNotices(filtered);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.NOTICES } }));
    addToast('Notice removed from board', 'info');
  };

  // =========================================================================
  // 👤 PROFILE UPDATE
  // =========================================================================
  const updateUserProfile = async (profileData) => {
    if (currentUser?._id) {
      await updateEmployee(currentUser._id, profileData);
      addToast('Profile updated successfully!', 'success');
    }
  };

  // =========================================================================
  // 👥 LEADS MANAGEMENT
  // =========================================================================
  const createLead = async (leadData) => {
    const currentList = getCollection(KEYS.LEADS);
    const nextNum = (currentList.length > 0 ? Math.max(...currentList.map(l => l.idNumber || 0)) + 1 : 1);
    const now = new Date();

    const newLead = {
      _id: `lead_${Date.now()}`,
      idNumber: nextNum,
      leadCode: `LEAD-${1000 + nextNum}`,
      name: leadData.name || leadData.contactPerson,
      contactPerson: leadData.contactPerson || leadData.name,
      companyName: leadData.companyName || leadData.client || 'Enterprise Client',
      client: leadData.client || leadData.companyName || 'Enterprise Client',
      email: leadData.email || '',
      phone: leadData.phone || '',
      leadType: leadData.leadType || 'Inbound Web',
      leadOwnerId: leadData.leadOwnerId || currentUser?._id || 'emp_001',
      leadOwnerName: leadData.leadOwnerName || currentUser?.name || 'Avinash',
      leadOwnerRole: leadData.leadOwnerRole || currentUser?.role || 'Digital Marketing Strategic',
      leadOwnerAvatar: leadData.leadOwnerAvatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      createdById: currentUser?._id || 'emp_001',
      createdByName: currentUser?.name || 'Avinash',
      createdByRole: currentUser?.role || 'Senior',
      createdByAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      startDate: leadData.startDate || now.toISOString().split('T')[0],
      endDate: leadData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdDate: now.toLocaleDateString('en-GB').replace(/\//g, '-'),
      createdAt: now.toISOString(),
      status: leadData.status || 'new',
      priority: leadData.priority || 'medium',
      dealValue: Number(leadData.dealValue) || 0,
      leadSource: leadData.leadSource || 'Website Inquiry',
      notes: leadData.notes || '',
      ...leadData
    };

    currentList.unshift(newLead);
    saveCollection(KEYS.LEADS, currentList);
    setLeads([...currentList]);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
    addToast(`Lead "${newLead.name}" added successfully!`, 'success');
    return newLead;
  };

  const updateLead = async (leadId, updateData) => {
    const currentList = getCollection(KEYS.LEADS);
    const idx = currentList.findIndex(l => l._id === leadId);
    if (idx !== -1) {
      currentList[idx] = {
        ...currentList[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      saveCollection(KEYS.LEADS, currentList);
      setLeads([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
      addToast('Lead updated successfully!', 'success');
      return currentList[idx];
    }
  };

  const updateLeadStatus = async (leadId, status) => {
    const currentList = getCollection(KEYS.LEADS);
    const idx = currentList.findIndex(l => l._id === leadId);
    if (idx !== -1) {
      const prevStatus = currentList[idx].status;
      currentList[idx].status = status;
      currentList[idx].updatedAt = new Date().toISOString();
      saveCollection(KEYS.LEADS, currentList);
      setLeads([...currentList]);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
      
      if (status === 'converted' && prevStatus !== 'converted') {
        addToast(`🎉 Awesome! Lead marked as Converted (Won Deal)!`, 'success');
      } else {
        addToast(`Lead status updated to ${status.replace('_', ' ')}`, 'info');
      }
    }
  };

  const deleteLead = async (leadId) => {
    const currentList = getCollection(KEYS.LEADS);
    const filtered = currentList.filter(l => l._id !== leadId);
    saveCollection(KEYS.LEADS, filtered);
    setLeads(filtered);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
    addToast('Lead deleted from database', 'info');
  };

  const importLeadsBatch = async (importedList) => {
    const currentList = getCollection(KEYS.LEADS);
    let maxNum = currentList.length > 0 ? Math.max(...currentList.map(l => l.idNumber || 0)) : 0;
    const now = new Date();

    const formattedList = importedList.map((item, idx) => {
      maxNum++;
      return {
        _id: `lead_${Date.now()}_${idx}`,
        idNumber: maxNum,
        leadCode: `LEAD-${1000 + maxNum}`,
        name: item.name || item.contactPerson || 'Untitled Lead',
        contactPerson: item.contactPerson || item.name || 'Contact Person',
        companyName: item.companyName || item.client || 'Enterprise Client',
        client: item.client || item.companyName || 'Enterprise Client',
        email: item.email || '',
        phone: item.phone || item.phoneNumber || '',
        leadType: item.leadType || item.category || 'Inbound Web',
        leadOwnerId: item.leadOwnerId || currentUser?._id || 'emp_001',
        leadOwnerName: item.leadOwnerName || currentUser?.name || 'Avinash',
        leadOwnerRole: item.leadOwnerRole || currentUser?.role || 'Digital Marketing Strategic',
        leadOwnerAvatar: item.leadOwnerAvatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        createdById: currentUser?._id || 'emp_001',
        createdByName: currentUser?.name || 'Avinash',
        createdByRole: currentUser?.role || 'Senior',
        createdByAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        startDate: item.startDate || now.toISOString().split('T')[0],
        endDate: item.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdDate: now.toLocaleDateString('en-GB').replace(/\//g, '-'),
        createdAt: now.toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        dealValue: Number(item.dealValue) || 0,
        leadSource: item.leadSource || 'CSV Import',
        notes: item.notes || item.description || 'Imported via CSV/Excel template.'
      };
    });

    const updated = [...formattedList, ...currentList];
    saveCollection(KEYS.LEADS, updated);
    setLeads(updated);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
    addToast(`Successfully imported ${formattedList.length} leads!`, 'success');
    return formattedList;
  };

  return (
    <CRMContext.Provider value={{
      expenses,
      createExpense,
      updateExpense,
      updateExpenseStatus,
      deleteExpense,
      importExpensesBatch,

      tickets,
      createTicket,
      updateTicketStatus,
      replyToTicket,
      addTicketInternalNote,
      assignTicket,
      deleteTicket,

      events,
      createEvent,
      updateEvent,
      deleteEvent,
      computedBirthdays,
      birthdays: computedBirthdays, // Auto-computed dynamic birthdays from employee DOB

      conversations,
      activeConversationId,
      setActiveConversationId,
      sendMessage,
      startConversation,

      notices,
      createNotice,
      updateNotice,
      deleteNotice,

      leads,
      leadsFilter,
      setLeadsFilter,
      createLead,
      updateLead,
      updateLeadStatus,
      deleteLead,
      importLeadsBatch,

      wfhEmployees,
      weeklyTimeLogs,
      darkMode,
      toggleDarkMode,
      updateUserProfile
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);
