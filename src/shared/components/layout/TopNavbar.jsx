import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Plus,
  Power,
  Maximize2,
  Minimize2,
  ChevronDown,
  Play,
  Pause,
  Square,
  Sparkles,
  CheckCircle2,
  Settings,
  LayoutGrid,
  Video,
  X,
  LogOut,
  User,
  HelpCircle,
  Keyboard,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Edit3, Moon, Sun, Coffee, ListTodo, FolderGit2, Ticket, Palmtree, Check } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { useHR } from '../../../modules/hr/context/HRContext';
import { useCRM } from '../../context/CRMContext';
import { AddEmployeeModal } from '../../../modules/hr/components/employees/AddEmployeeModal';
import { EmployeeDirectoryModal } from '../../../modules/hr/components/employees/EmployeeDirectoryModal';
import { EditProfileModal } from '../modals/EditProfileModal';
import { BreakModal } from '../modals/BreakModal';
import { AddTaskModal } from '../../../modules/work/components/tasks/AddTaskModal';
import { AddProjectModal } from '../../../modules/work/components/projects/AddProjectModal';
import { RaiseTicketModal } from '../modals/RaiseTicketModal';
import { NewLeaveModal } from '../../../modules/hr/components/leaves/NewLeaveModal';
import { AddLeadModal } from '../../../modules/crm/components/leads/AddLeadModal';

export const TopNavbar = () => {
  const navigate = useNavigate();
  const { timeString, isRunning, isClockedIn, isOnBreak, breakType, togglePauseResume, handleClockOut } = useTimer();
  const { currentUser, leaves, employees, updateLeaveStatus } = useHR();
  const { darkMode, toggleDarkMode } = useCRM();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [isEmpDirectoryOpen, setIsEmpDirectoryOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);

  // Quick Action Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isRaiseTicketOpen, setIsRaiseTicketOpen] = useState(false);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

  const quickCreateRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const pendingLeavesCount = (leaves || []).filter(l => l?.status === 'pending').length;
  const totalNotifications = pendingLeavesCount + 1; // +1 for attendance notification

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target)) {
        setShowQuickCreate(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header style={{
      height: '64px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      gap: '16px'
    }}>

      {/* ───────── LEFT: Search Bar ───────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: searchFocused ? '#ffffff' : '#f1f5f9',
        borderRadius: '10px',
        padding: '0 14px',
        width: '300px',
        height: '38px',
        border: searchFocused ? '1.5px solid #2563eb' : '1.5px solid transparent',
        boxShadow: searchFocused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
        transition: 'all 0.2s ease',
        flexShrink: 0
      }}>
        <Search size={15} color={searchFocused ? '#2563eb' : '#94a3b8'} />
        <input
          type="text"
          placeholder="Search anything..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '13px',
            color: '#1e293b',
            width: '100%',
            fontFamily: 'inherit'
          }}
        />
        <kbd style={{
          display: searchFocused ? 'none' : 'flex',
          alignItems: 'center',
          gap: '2px',
          fontSize: '10px',
          color: '#94a3b8',
          background: '#e2e8f0',
          borderRadius: '4px',
          padding: '2px 5px',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap'
        }}>
          Ctrl K
        </kbd>
      </div>

      {/* ───────── RIGHT: All Controls ───────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

        {/* ── Work Timer Pill ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isClockedIn ? '#f0fdf4' : '#fef2f2',
          border: isClockedIn ? '1px solid #bbf7d0' : '1px solid #fecaca',
          borderRadius: '10px',
          padding: '6px 14px 6px 12px',
          marginRight: '4px'
        }}>
          {/* Status Dot */}
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isClockedIn && isRunning ? '#10b981' : (isClockedIn ? '#f59e0b' : '#ef4444'),
            boxShadow: isClockedIn && isRunning ? '0 0 6px #10b981' : 'none',
            flexShrink: 0
          }} />

          {/* Timer Display */}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '14px',
            fontWeight: '700',
            color: isClockedIn ? '#15803d' : '#94a3b8',
            letterSpacing: '0.04em',
            minWidth: '60px'
          }}>
            {timeString}
          </span>

          {/* Timer Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {/* Play / Pause */}
            <button
              onClick={togglePauseResume}
              title={isRunning ? 'Pause (Break)' : 'Resume Work'}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: isRunning ? '#2563eb' : '#64748b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isRunning
                ? <Pause size={13} fill="#fff" />
                : <Play size={13} fill="#fff" />
              }
            </button>

            {/* Clock Out / Clock In */}
            <button
              onClick={handleClockOut}
              title={isClockedIn ? 'Clock Out for Today' : 'Clock In'}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: isClockedIn ? '#ef4444' : '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isClockedIn ? <Square size={11} fill="#fff" /> : <Play size={13} fill="#fff" />}
            </button>
          </div>
        </div>

        {/* ── Real-Life Enterprise Quick Create Dropdown ── */}
        <div style={{ position: 'relative' }} ref={quickCreateRef}>
          <button
            onClick={() => setShowQuickCreate(!showQuickCreate)}
            style={{
              height: '36px',
              fontSize: '13px',
              fontWeight: '600',
              padding: '0 14px',
              gap: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>Create</span>
            <ChevronDown size={13} style={{ opacity: 0.8 }} />
          </button>

          {showQuickCreate && (
            <div style={{
              position: 'absolute',
              top: '44px',
              right: '0',
              width: '210px',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              zIndex: 250,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div
                onClick={() => { setShowQuickCreate(false); setIsAddLeadOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#1e293b'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Users2 size={16} color="#0284c7" />
                <span>New Lead Contact</span>
              </div>

              <div
                onClick={() => { setShowQuickCreate(false); setIsAddTaskOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#1e293b'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ListTodo size={16} color="#2563eb" />
                <span>New Task</span>
              </div>

              <div
                onClick={() => { setShowQuickCreate(false); setIsAddProjectOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#1e293b'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <FolderGit2 size={16} color="#0284c7" />
                <span>New Project</span>
              </div>

              <div
                onClick={() => { setShowQuickCreate(false); setIsRaiseTicketOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#1e293b'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Ticket size={16} color="#d97706" />
                <span>Raise Ticket</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              <div
                onClick={() => { setShowQuickCreate(false); setIsApplyLeaveOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#1e293b'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Palmtree size={16} color="#16a34a" />
                <span>Apply for Leave</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Separator ── */}
        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 4px' }} />

        {/* ── Grid / Dashboard Quick View ── */}
        <button
          className="navbar-icon-btn"
          title="Dashboard Overview"
          style={navBtnStyle}
        >
          <LayoutGrid size={18} color="#64748b" />
        </button>

        {/* ── Screen Recording Toggle ── */}
        <button
          className="navbar-icon-btn"
          title={isRecording ? 'Stop Recording' : 'Start Screen Recording'}
          onClick={() => setIsRecording(!isRecording)}
          style={{
            ...navBtnStyle,
            background: isRecording ? '#fef2f2' : 'transparent',
            border: isRecording ? '1px solid #fecaca' : '1px solid transparent'
          }}
        >
          <div style={{ position: 'relative' }}>
            <Video size={18} color={isRecording ? '#ef4444' : '#64748b'} />
            {isRecording && (
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                border: '1.5px solid #ffffff',
                animation: 'pulseGlow 1.2s infinite'
              }} />
            )}
          </div>
        </button>

        {/* ── Fullscreen Toggle ── */}
        <button
          className="navbar-icon-btn"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          onClick={toggleFullscreen}
          style={navBtnStyle}
        >
          {isFullscreen
            ? <Minimize2 size={18} color="#64748b" />
            : <Maximize2 size={18} color="#64748b" />
          }
        </button>

        {/* ── Notifications Bell ── */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            title="Notifications"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            style={{
              ...navBtnStyle,
              background: showNotifications ? '#eff6ff' : 'transparent',
              border: showNotifications ? '1px solid #bfdbfe' : '1px solid transparent',
              position: 'relative'
            }}
          >
            <Bell size={18} color={showNotifications ? '#2563eb' : '#64748b'} />
            {totalNotifications > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '16px',
                height: '16px',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: '800',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
                lineHeight: 1
              }}>
                {totalNotifications > 9 ? '9+' : totalNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              width: '340px',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              zIndex: 200,
              animation: 'fadeIn 0.18s ease'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: '1px solid #f1f5f9',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={15} color="#0f172a" />
                  <span style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                    Notifications
                  </span>
                  <span style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {totalNotifications}
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    padding: '2px'
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Notification Items */}
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {/* Real-time Dynamic Pending Leaves */}
                {(leaves || []).filter(l => l?.status === 'pending').length > 0 ? (
                  (leaves || []).filter(l => l?.status === 'pending').map((leave) => (
                    <div
                      key={leave._id}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#fffdf5',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {leave.employeeAvatar ? (
                          <img
                            src={leave.employeeAvatar}
                            alt={leave.employeeName}
                            style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #fed7aa' }}
                          />
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: '#fef3c7',
                            color: '#d97706',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px'
                          }}>
                            {leave.employeeName?.charAt(0) || 'L'}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '12.5px', color: '#0f172a' }}>
                            {leave.employeeName}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#fef3c7',
                            color: '#d97706'
                          }}>
                            Pending Review
                          </span>
                        </div>

                        <div style={{ color: '#475569', fontSize: '11.5px', marginTop: '2px' }}>
                          <strong>{leave.leaveType}</strong> ({leave.durationText})
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                          📅 {leave.startDate} {leave.endDate !== leave.startDate ? `to ${leave.endDate}` : ''}
                        </div>
                        {leave.reason && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={leave.reason}>
                            "{leave.reason}"
                          </div>
                        )}

                        {/* Quick 1-Click Approve / Reject Action Bar */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await updateLeaveStatus(leave._id, 'approved');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(22,163,74,0.25)'
                            }}
                            title="Approve immediately"
                          >
                            <Check size={12} />
                            Approve
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await updateLeaveStatus(leave._id, 'rejected');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                            title="Reject leave request"
                          >
                            <X size={12} />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    ✨ All leave requests have been reviewed!
                  </div>
                )}

                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '12.5px', color: '#1e293b' }}>
                      Attendance Clocked In
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '2px', lineHeight: '1.4' }}>
                      You arrived on time today at 09:12 AM. Great start!
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Today, 09:12 AM
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f1f5f9',
                textAlign: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/leaves');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2563eb',
                    cursor: 'pointer'
                  }}
                >
                  Go to Leave Management →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Settings Gear ── */}
        <button
          className="navbar-icon-btn"
          title="System Settings"
          style={navBtnStyle}
        >
          <Settings size={18} color="#64748b" />
        </button>

        {/* ── Separator ── */}
        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 4px' }} />

        {/* ── User Profile Pill ── */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px 5px 6px',
              background: showProfileMenu ? '#eff6ff' : '#f8fafc',
              border: showProfileMenu ? '1.5px solid #bfdbfe' : '1.5px solid #e2e8f0',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              userSelect: 'none'
            }}
            onMouseEnter={e => {
              if (!showProfileMenu) {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
            onMouseLeave={e => {
              if (!showProfileMenu) {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
          >
            {/* Avatar */}
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name || 'User'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1.5px solid #2563eb',
                  flexShrink: 0
                }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
              }}>
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
            )}

            {/* Label */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', lineHeight: 1 }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>
                {currentUser?.name || 'Avinash'}
              </span>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                Work
              </span>
            </div>

            <ChevronDown
              size={14}
              color="#64748b"
              style={{
                transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </div>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              width: '240px',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              zIndex: 200,
              animation: 'fadeIn 0.18s ease'
            }}>
              {/* Profile Header (Matching Screenshot 4) */}
              <div style={{
                padding: '16px',
                background: 'linear-gradient(135deg, #101b33, #1e293b)',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={currentUser?.name}
                      style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#ffffff' }}>
                        {currentUser?.name || 'Avinash'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                        {currentUser?.role || 'Digital Marketing Strategic'}
                      </div>
                    </div>
                  </div>

                  {/* Edit icon */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setIsEditProfileOpen(true);
                    }}
                    title="Edit Profile Information"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: 'none',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              </div>

              {/* Menu Items (Matching Screenshot 4) */}
              <div style={{ padding: '6px' }}>
                {/* Dark Mode toggle item */}
                <div
                  onClick={toggleDarkMode}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {darkMode ? <Moon size={15} color="#2563eb" /> : <Sun size={15} color="#d97706" />}
                    <span>Dark Mode</span>
                  </div>

                  {/* Toggle Switch */}
                  <div style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: darkMode ? '#2563eb' : '#cbd5e1',
                    position: 'relative',
                    transition: 'background-color 0.2s ease'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '2px',
                      left: darkMode ? '18px' : '2px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setShowProfileMenu(false);
                    setIsEditProfileOpen(true);
                  }}
                >
                  <ProfileMenuItem icon={<User size={14} />} label="Edit Profile" />
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

                <div
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleClockOut();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Power size={14} />
                  <span>Logout</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
      />

      <AddProjectModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
      />

      <RaiseTicketModal
        isOpen={isRaiseTicketOpen}
        onClose={() => setIsRaiseTicketOpen(false)}
      />

      <NewLeaveModal
        isOpen={isApplyLeaveOpen}
        onClose={() => setIsApplyLeaveOpen(false)}
      />

      <AddEmployeeModal
        isOpen={isAddEmpOpen}
        onClose={() => setIsAddEmpOpen(false)}
      />

      <EmployeeDirectoryModal
        isOpen={isEmpDirectoryOpen}
        onClose={() => setIsEmpDirectoryOpen(false)}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      <BreakModal
        isOpen={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
      />

      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
      />
    </header>
  );
};

// Reusable profile menu item
const ProfileMenuItem = ({ icon, label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 10px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      color: '#374151',
      cursor: 'pointer',
      transition: 'background 0.15s'
    }}
    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    <span style={{ color: '#64748b' }}>{icon}</span>
    <span>{label}</span>
  </div>
);

// Shared nav icon button style
const navBtnStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid transparent',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  position: 'relative',
  flexShrink: 0,
  onMouseEnter: undefined // handled inline
};
