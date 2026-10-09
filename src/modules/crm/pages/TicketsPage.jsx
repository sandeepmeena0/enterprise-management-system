/**
 * @file TicketsPage.jsx
 * @description Helpdesk & Support Tickets module matching Screenshot 2 exactly.
 */

import React, { useState, useMemo } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Download,
  MoreVertical,
  Trash2,
  Eye,
  MessageSquare,
  Sparkles,
  Ticket as TicketIcon
} from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { useToast } from '../../../shared/context/ToastContext';
import { RaiseTicketModal } from '../../../shared/components/modals/RaiseTicketModal';
import { TicketDetailModal } from '../components/tickets/TicketDetailModal';

export const TicketsPage = () => {
  const { tickets, updateTicketStatus, deleteTicket } = useCRM();
  const { addToast } = useToast();

  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // KPIs
  const totalCount = tickets.length;
  const closedCount = tickets.filter(t => t.status === 'closed').length;
  const openCount = tickets.filter(t => t.status === 'open').length;
  const pendingCount = tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.ticketCode || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.requestedByName || '').toLowerCase().includes(q);

      let matchesStatus = true;
      if (statusFilter === 'open') matchesStatus = t.status === 'open';
      else if (statusFilter === 'closed') matchesStatus = t.status === 'closed';
      else if (statusFilter === 'pending') matchesStatus = t.status === 'pending' || t.status === 'in_progress';
      else if (statusFilter === 'resolved') matchesStatus = t.status === 'resolved';

      let matchesDate = true;
      if (startDateFilter && t.requestedOn && t.requestedOn < startDateFilter) matchesDate = false;
      if (endDateFilter && t.requestedOn && t.requestedOn > endDateFilter) matchesDate = false;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [tickets, search, statusFilter, startDateFilter, endDateFilter]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredTickets.map(item => item._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    if (filteredTickets.length === 0) {
      alert('No tickets available to export');
      return;
    }

    const headers = ['Ticket #,Ticket Subject,Requester Name,Requested On,Category,Priority,Assigned To,Status'];
    const rows = filteredTickets.map(t =>
      `"${t.ticketCode}","${(t.subject || '').replace(/"/g, '""')}","${t.requestedByName || ''}","${t.requestedOn || ''}","${t.category || ''}","${t.priority || ''}","${t.assignedToName || ''}","${t.status}"`
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `support_tickets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Tickets exported successfully to CSV!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header Matching Screenshot 2 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Tickets</span>
            <span>Home • Tickets</span>
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
          <span>02:19:07</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span style={{ color: '#3b82f6' }}>●</span>
        </div>
      </div>

      {/* Filter and Search Bar Matching Screenshot 2 */}
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
          
          {/* Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span style={{ fontWeight: '600' }}>Duration</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '12.5px'
            }}>
              <input
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#334155' }}
              />
              <span>To</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#334155' }}
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span style={{ fontWeight: '600' }}>Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '12.5px',
                color: '#0f172a',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Tickets</option>
              <option value="open">Open Tickets</option>
              <option value="pending">Pending Tickets</option>
              <option value="resolved">Resolved Tickets</option>
              <option value="closed">Closed Tickets</option>
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

        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: '#475569',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Filter size={15} />
          Filters
        </button>
      </div>

      {/* KPI Cards Row Matching Screenshot 2 Exactly */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px'
      }}>
        {/* Total Tickets */}
        <div style={kpiBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Total Tickets</span>
            <TicketIcon size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '10px' }}>
            {totalCount}
          </div>
        </div>

        {/* Closed Tickets */}
        <div style={kpiBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Closed Tickets</span>
            <TicketIcon size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '10px' }}>
            {closedCount}
          </div>
        </div>

        {/* Open Tickets */}
        <div style={kpiBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Open Tickets</span>
            <TicketIcon size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '10px' }}>
            {openCount}
          </div>
        </div>

        {/* Pending Tickets */}
        <div style={kpiBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Pending Tickets</span>
            <TicketIcon size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '10px' }}>
            {pendingCount}
          </div>
        </div>

        {/* Resolved Tickets */}
        <div style={kpiBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Resolved Tickets</span>
            <TicketIcon size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '10px' }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* Action Bar Matching Screenshot 2 (+ Create Ticket, Export) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setIsRaiseModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(2,132,199,0.3)'
          }}
        >
          <Plus size={16} />
          Create Ticket
        </button>

        <button
          onClick={handleExport}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            color: '#2563eb',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Download size={15} />
          Export
        </button>
      </div>

      {/* Tickets Table Matching Screenshot 2 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                color: '#64748b',
                fontWeight: '600',
                textAlign: 'left'
              }}>
                <th style={{ padding: '12px 14px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredTickets.length > 0 && selectedIds.length === filteredTickets.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px', width: '100px' }}>Ticket #</th>
                <th style={{ padding: '12px 14px' }}>Ticket Subject</th>
                <th style={{ padding: '12px 14px' }}>Requester Name</th>
                <th style={{ padding: '12px 14px' }}>Requested On</th>
                <th style={{ padding: '12px 14px' }}>Others</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>No data available in table</div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => (
                  <tr
                    key={ticket._id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: selectedIds.includes(ticket._id) ? 'rgba(37,99,235,0.04)' : '#ffffff',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '12px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(ticket._id)}
                        onChange={() => handleSelectOne(ticket._id)}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </td>

                    {/* Ticket # */}
                    <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0284c7' }}>
                      {ticket.ticketCode}
                    </td>

                    {/* Ticket Subject */}
                    <td style={{ padding: '12px 14px' }}>
                      <div
                        onClick={() => setSelectedTicket(ticket)}
                        style={{ fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}
                      >
                        {ticket.subject}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        {ticket.category || 'General'} • {ticket.replies?.length || 0} messages
                      </div>
                    </td>

                    {/* Requester Name */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={ticket.requestedByAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={ticket.requestedByName}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {ticket.requestedByName}
                        </span>
                      </div>
                    </td>

                    {/* Requested On */}
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {ticket.requestedOn}
                    </td>

                    {/* Others (Priority & Assigned) */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: ticket.priority === 'urgent' ? '#fee2e2' : ticket.priority === 'high' ? '#ffedd5' : '#f1f5f9',
                          color: ticket.priority === 'urgent' ? '#b91c1c' : ticket.priority === 'high' ? '#c2410c' : '#475569',
                          textTransform: 'capitalize'
                        }}>
                          {ticket.priority}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          • {ticket.assignedToName?.split(' ')[0] || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor:
                          ticket.status === 'resolved' ? '#dcfce7' :
                          ticket.status === 'open' ? '#e0f2fe' :
                          ticket.status === 'in_progress' ? '#ede9fe' :
                          ticket.status === 'pending' ? '#fef3c7' : '#f1f5f9',
                        color:
                          ticket.status === 'resolved' ? '#15803d' :
                          ticket.status === 'open' ? '#0369a1' :
                          ticket.status === 'in_progress' ? '#6d28d9' :
                          ticket.status === 'pending' ? '#b45309' : '#475569',
                        textTransform: 'capitalize'
                      }}>
                        {ticket.status === 'resolved' && <CheckCircle2 size={13} />}
                        {ticket.status === 'open' && <AlertCircle size={13} />}
                        {ticket.status === 'pending' && <Clock size={13} />}
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          color: '#0284c7',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}
                      >
                        Reply / View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Matching Screenshot 2 */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12.5px',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Show</span>
            <select style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '12px'
            }}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>entries</span>
          </div>

          <div>
            Showing 1 to {filteredTickets.length} of {tickets.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Previous
            </button>
            <button
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              1
            </button>
            <button
              disabled
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RaiseTicketModal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
      />

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
};

const kpiBoxStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
};
