/**
 * @file TicketDetailModal.jsx
 * @description Interactive ticket details drawer/modal with instant Admin & Employee discussion thread, status switcher, internal notes, and team assignment.
 */

import React, { useState } from 'react';
import {
  X,
  Send,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldAlert,
  Lock,
  MessageSquare,
  FileText,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { useCRM } from '../../../../shared/context/CRMContext';
import { useHR } from '../../../hr/context/HRContext';

export const TicketDetailModal = ({ ticket, isOpen, onClose }) => {
  const { replyToTicket, updateTicketStatus, addTicketInternalNote, assignTicket, deleteTicket } = useCRM();
  const { currentUser, employees } = useHR();

  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation' | 'internal_notes'

  if (!isOpen || !ticket) return null;

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyToTicket(ticket._id, replyText);
    setReplyText('');
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;
    addTicketInternalNote(ticket._id, internalNoteText);
    setInternalNoteText('');
  };

  const handleStatusChange = (status) => {
    updateTicketStatus(ticket._id, status);
  };

  const handleAssign = (empId) => {
    assignTicket(ticket._id, empId);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
        maxWidth: '740px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                color: '#2563eb'
              }}>
                {ticket.ticketCode}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: ticket.priority === 'urgent' ? '#fee2e2' : ticket.priority === 'high' ? '#ffedd5' : '#f1f5f9',
                color: ticket.priority === 'urgent' ? '#b91c1c' : ticket.priority === 'high' ? '#c2410c' : '#475569',
                textTransform: 'uppercase'
              }}>
                {ticket.priority}
              </span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '6px 0 0' }}>
              {ticket.subject}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            backgroundColor: '#f8fafc',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            {/* Requester */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Requester</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <img
                  src={ticket.requestedByAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={ticket.requestedByName}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>
                  {ticket.requestedByName}
                </span>
              </div>
            </div>

            {/* Requested On */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Requested On</span>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', marginTop: '4px' }}>
                {ticket.requestedOn}
              </div>
            </div>

            {/* Category */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Category</span>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', marginTop: '4px' }}>
                {ticket.category || 'General Support'}
              </div>
            </div>

            {/* Status Switcher */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Status</span>
              <select
                value={ticket.status}
                onChange={e => handleStatusChange(e.target.value)}
                style={{
                  marginTop: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: ticket.status === 'resolved' || ticket.status === 'closed' ? '#16a34a' : '#2563eb',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Assigned Support</span>
              <select
                value={ticket.assignedToId || 'emp_005'}
                onChange={e => handleAssign(e.target.value)}
                style={{
                  marginTop: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '160px'
                }}
              >
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.role?.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description Card */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Ticket Problem Description</span>
            <div style={{
              marginTop: '6px',
              padding: '14px 16px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#1e293b',
              lineHeight: '1.6'
            }}>
              {ticket.description || 'No detailed description provided.'}
            </div>
          </div>

          {/* Discussion Tabs (Discussion Thread vs Admin Internal Notes) */}
          <div>
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('conversation')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: activeTab === 'conversation' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'conversation' ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={15} />
                Conversation Stream ({ticket.replies?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('internal_notes')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: activeTab === 'internal_notes' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'internal_notes' ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={14} />
                Admin Internal Notes ({ticket.internalNotes?.length || 0})
              </button>
            </div>

            {/* Conversation Tab Body */}
            {activeTab === 'conversation' && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  {(!ticket.replies || ticket.replies.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                      No replies yet. Admin can reply below to initiate conversation with employee.
                    </div>
                  ) : (
                    ticket.replies.map(rep => (
                      <div
                        key={rep.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignSelf: rep.isAdminReply ? 'flex-end' : 'flex-start',
                          maxWidth: '85%'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '3px',
                          alignSelf: rep.isAdminReply ? 'flex-end' : 'flex-start'
                        }}>
                          <img
                            src={rep.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={rep.senderName}
                            style={{ width: '18px', height: '18px', borderRadius: '50%' }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                            {rep.senderName}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            {new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: rep.isAdminReply ? '#2563eb' : '#ffffff',
                          color: rep.isAdminReply ? '#ffffff' : '#0f172a',
                          border: rep.isAdminReply ? 'none' : '1px solid #e2e8f0',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          {rep.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Input Bar */}
                <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type your response to the employee / admin..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Send size={15} />
                    Send Reply
                  </button>
                </form>
              </div>
            )}

            {/* Internal Notes Tab Body */}
            {activeTab === 'internal_notes' && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: '#fffbeb',
                  borderRadius: '10px',
                  border: '1px solid #fef3c7'
                }}>
                  {(!ticket.internalNotes || ticket.internalNotes.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '18px', color: '#b45309', fontSize: '12.5px' }}>
                      No internal notes recorded. Internal notes are only visible to Admins/Managers.
                    </div>
                  ) : (
                    ticket.internalNotes.map(n => (
                      <div key={n.id} style={{
                        backgroundColor: '#ffffff',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #fde68a'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#b45309', fontWeight: '700' }}>
                          <span>🔒 Note by {n.author}</span>
                          <span>{new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#78350f' }}>{n.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add private internal admin note..."
                    value={internalNoteText}
                    onChange={e => setInternalNoteText(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      backgroundColor: '#fffbeb',
                      fontSize: '13px',
                      outline: 'none',
                      color: '#78350f'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Attach Note
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
