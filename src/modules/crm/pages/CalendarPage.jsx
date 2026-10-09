/**
 * @file CalendarPage.jsx
 * @description Interactive Company Events & Calendar page matching Screenshot 3 with automatic birthday generation.
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Search,
  Calendar as CalendarIcon,
  Sparkles,
  Trash2,
  Tag,
  CheckCircle2,
  X,
  Repeat,
  Bell
} from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { useHR } from '../../hr/context/HRContext';
import { useWork } from '../../work/context/WorkContext';
import { AddEventModal } from '../../../shared/components/modals/AddEventModal';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarPage = () => {
  const { events, deleteEvent, computedBirthdays } = useCRM();
  const { holidays, currentUser, employees } = useHR();
  const { tasks } = useWork();

  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 25)); // September 2026 as per design
  const [currentView, setCurrentView] = useState('month'); // 'month' | 'week' | 'day' | 'list'
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser?._id || 'emp_001');
  const [clientFilter, setClientFilter] = useState('all');
  const [search, setSearch] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // =========================================================================
  // COMBINE ALL EVENTS + AUTOMATIC BIRTHDAYS + HOLIDAYS + MEETINGS
  // =========================================================================
  const allEvents = useMemo(() => {
    // 1. Base User & Company Events
    const baseEvents = (events || []).map(e => ({
      _id: e._id || `ev_${Math.random()}`,
      title: e.eventName || e.title || 'Company Event',
      date: e.startDate || e.date || new Date().toISOString().split('T')[0],
      endDate: e.endDate || e.startDate || e.date || new Date().toISOString().split('T')[0],
      time: e.startTime || e.time || 'All Day',
      type: e.eventType || e.type || 'Company Event',
      location: e.location || 'Headquarters / Main Office',
      description: e.description || 'Company scheduled event and meeting.',
      isRecurring: !!e.isRecurring,
      color: e.color || '#2563eb',
      bgColor: e.bgColor || '#eff6ff'
    }));

    // 2. Dynamic Automatic Birthdays calculated from Employee Profiles (DOB)
    const dynamicBirthdayEvents = (computedBirthdays || []).map(b => ({
      _id: `bday_cal_${b.employeeId || Math.random()}`,
      title: `🎂 Birthday: ${b.name || 'Team Member'}`,
      date: b.eventDate || new Date().toISOString().split('T')[0],
      endDate: b.eventDate || new Date().toISOString().split('T')[0],
      time: 'All Day',
      type: 'Birthday',
      location: 'Company Wide Celebration',
      description: `${b.name || 'Team Member'} (${b.role || 'Colleague'}) celebrates their birthday! 🎂🎉`,
      isRecurring: true,
      color: '#d97706',
      bgColor: '#fef3c7'
    }));

    // 3. Official Public Holidays
    const holidayEvents = (holidays || []).map(h => ({
      _id: `hol_cal_${h._id || Math.random()}`,
      title: `🏖️ ${h.holidayName || 'Public Holiday'}`,
      date: h.date || new Date().toISOString().split('T')[0],
      endDate: h.date || new Date().toISOString().split('T')[0],
      time: 'All Day',
      type: 'Holiday',
      location: 'All Offices Closed',
      description: h.occasion || 'Mandatory Public Holiday',
      color: '#16a34a',
      bgColor: '#f0fdf4'
    }));

    // 4. Tasks Due Dates
    const taskEvents = (tasks || []).filter(t => t?.dueDate).map(t => ({
      _id: `tsk_cal_${t._id || Math.random()}`,
      title: `📌 Due: ${t.title || 'Assigned Task'}`,
      date: t.dueDate,
      endDate: t.dueDate,
      time: '06:00 PM',
      type: 'Task Deadline',
      location: t.projectName || 'Work Module',
      description: `Task assigned to ${t.assignedToName || 'team'}`,
      color: '#0891b2',
      bgColor: '#ecfeff'
    }));

    return [...baseEvents, ...dynamicBirthdayEvents, ...holidayEvents, ...taskEvents];
  }, [events, computedBirthdays, holidays, tasks]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (ev.title || '').toLowerCase().includes(q) ||
        (ev.description || '').toLowerCase().includes(q) ||
        (ev.type || '').toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [allEvents, search]);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // 0 is Mon

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month overflow
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => e.date === dateStr)
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const curDate = new Date(year, month, i);
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: true,
        events: filteredEvents.filter(e => e.date === dateStr)
      });
    }

    // Next month overflow
    const totalSlots = Math.ceil(days.length / 7) * 7;
    let nextDay = 1;
    while (days.length < totalSlots) {
      const nextDate = new Date(year, month + 1, nextDay);
      const dateStr = nextDate.toISOString().split('T')[0];
      days.push({
        dayNum: nextDay,
        dateStr,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => e.date === dateStr)
      });
      nextDay++;
    }

    return days;
  }, [year, month, filteredEvents]);

  const selectedEmployee = employees.find(e => e._id === selectedEmployeeId) || currentUser;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header Matching Screenshot 3 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Events</span>
            <span>Home • Events</span>
          </div>
        </div>

        {/* Live Work Clock */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          fontSize: '13px',
          fontWeight: '700',
          color: '#0f172a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
          <span>02:19:35</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span style={{ color: '#3b82f6' }}>●</span>
        </div>
      </div>

      {/* Filter and Top Navigation Bar Matching Screenshot 3 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Employee Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span style={{ fontWeight: '600' }}>Employee</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc'
            }}>
              <img
                src={selectedEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={selectedEmployee?.name}
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} {emp._id === currentUser?._id ? "[It's You]" : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span style={{ fontWeight: '600' }}>Client</span>
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '12.5px',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All</option>
              <option value="enterprise">Enterprise Clients</option>
              <option value="internal">Internal Team</option>
            </select>
          </div>

          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            minWidth: '220px'
          }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Start typing to search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '12.5px',
                width: '100%',
                backgroundColor: 'transparent',
                color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Add Event Button */}
        <button
          onClick={() => setIsAddEventOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
          }}
        >
          <Plus size={16} />
          Create Event
        </button>
      </div>

      {/* Calendar Viewport Matching Screenshot 3 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        
        {/* Calendar Nav Bar (< > today, Month Year, month/week/day/list switcher) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button
                onClick={handlePrevMonth}
                style={{
                  padding: '6px 12px',
                  background: '#ffffff',
                  border: 'none',
                  borderRight: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                style={{
                  padding: '6px 12px',
                  background: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={handleToday}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              today
            </button>
          </div>

          {/* Current Month & Year Display */}
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            {monthNames[month]} {year}
          </div>

          {/* View Switcher (month, week, day, list) */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            {['month', 'week', 'day', 'list'].map(view => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: currentView === view ? '#0f172a' : 'transparent',
                  color: currentView === view ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize'
                }}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Days of Week Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '8px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '700',
          color: '#475569'
        }}>
          {DAYS_OF_WEEK.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Month Calendar Grid */}
        {currentView === 'month' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderLeft: '1px solid #f1f5f9',
            borderTop: '1px solid #f1f5f9'
          }}>
            {calendarDays.map((day, idx) => (
              <div
                key={idx}
                style={{
                  minHeight: '100px',
                  borderRight: '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9',
                  padding: '6px 8px',
                  backgroundColor: day.isCurrentMonth ? '#ffffff' : '#fafafa',
                  position: 'relative'
                }}
              >
                {/* Day Number */}
                <div style={{
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: day.isCurrentMonth ? '#0f172a' : '#cbd5e1',
                  textAlign: 'right',
                  marginBottom: '4px'
                }}>
                  {day.dayNum}
                </div>

                {/* Event Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {day.events.map(ev => (
                    <div
                      key={ev._id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        padding: '3px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: ev.bgColor || '#eff6ff',
                        color: ev.color || '#2563eb',
                        borderLeft: `3px solid ${ev.color || '#2563eb'}`,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                      title={`${ev.title} (${ev.time})`}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Week View */}
        {currentView === 'week' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderLeft: '1px solid #f1f5f9',
            borderTop: '1px solid #f1f5f9',
            marginTop: '12px'
          }}>
            {calendarDays.slice(0, 7).map((day, idx) => (
              <div
                key={idx}
                style={{
                  minHeight: '260px',
                  borderRight: '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9',
                  padding: '10px',
                  backgroundColor: '#ffffff'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  {DAYS_OF_WEEK[idx]} ({day.dateStr})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {day.events.map(ev => (
                    <div
                      key={ev._id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        backgroundColor: ev.bgColor,
                        color: ev.color,
                        borderLeft: `3px solid ${ev.color}`,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div>{ev.title}</div>
                      <div style={{ fontSize: '10.5px', opacity: 0.8, marginTop: '2px' }}>{ev.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Day View */}
        {currentView === 'day' && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontWeight: '700',
              fontSize: '14px',
              color: '#0f172a'
            }}>
              Events for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {filteredEvents.filter(e => e.date === currentDate.toISOString().split('T')[0] || e.isRecurring).length > 0 ? (
              filteredEvents.filter(e => e.date === currentDate.toISOString().split('T')[0] || e.isRecurring).map(ev => (
                <div
                  key={ev._id}
                  onClick={() => setSelectedEvent(ev)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: ev.bgColor,
                      color: ev.color,
                      fontWeight: '800',
                      fontSize: '13px'
                    }}>
                      {ev.time}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{ev.title}</div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                        {ev.type} • {ev.location}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: ev.bgColor,
                    color: ev.color
                  }}>
                    {ev.type}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <CalendarIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: '13.5px' }}>No events scheduled for this day</div>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {currentView === 'list' && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredEvents.map(ev => (
              <div
                key={ev._id}
                onClick={() => setSelectedEvent(ev)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: ev.bgColor,
                    color: ev.color,
                    fontWeight: '800',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    {ev.date}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {ev.time} • {ev.type} • {ev.location}
                    </div>
                  </div>
                </div>

                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  backgroundColor: ev.bgColor,
                  color: ev.color
                }}>
                  {ev.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                backgroundColor: selectedEvent.bgColor,
                color: selectedEvent.color
              }}>
                {selectedEvent.type}
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
              {selectedEvent.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={16} color="#2563eb" />
                <span>Date: <strong>{selectedEvent.date}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#2563eb" />
                <span>Time: {selectedEvent.time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#2563eb" />
                <span>Location: {selectedEvent.location}</span>
              </div>
              {selectedEvent.isRecurring && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '600' }}>
                  <Repeat size={15} />
                  <span>Yearly Recurring Event (Appears every year automatically)</span>
                </div>
              )}
            </div>

            {selectedEvent.description && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                fontSize: '13px',
                color: '#334155',
                lineHeight: '1.5',
                marginBottom: '18px'
              }}>
                {selectedEvent.description}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
