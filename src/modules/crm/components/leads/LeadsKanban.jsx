/**
 * @file LeadsKanban.jsx
 * @description Pipeline Kanban board for visual sales pipeline tracking with stages and quick actions.
 */

import React from 'react';
import {
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Plus,
  Eye,
  Edit2,
  DollarSign,
  User
} from 'lucide-react';
import { useCRM } from '../../../../shared/context/CRMContext';

const STAGES = [
  { id: 'new', title: 'New Inquiries', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
  { id: 'active', title: 'Active Contact', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  { id: 'in_progress', title: 'In Progress / Demo', color: '#8b5cf6', bg: '#ede9fe', border: '#ddd6fe' },
  { id: 'negotiation', title: 'In Negotiation', color: '#c026d3', bg: '#fae8ff', border: '#f5d0fe' },
  { id: 'converted', title: 'Won Deals (Converted)', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { id: 'lost', title: 'Lost / Dropped', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' }
];

export const LeadsKanban = ({
  leads = [],
  onViewLead,
  onEditLead,
  onAddNewLead
}) => {
  const { updateLeadStatus } = useCRM();

  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)} K`;
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      overflowX: 'auto',
      paddingBottom: '16px',
      alignItems: 'flex-start'
    }}>
      {STAGES.map((stage) => {
        const stageLeads = leads.filter(l => l.status === stage.id);
        const stageValue = stageLeads.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);

        return (
          <div
            key={stage.id}
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minWidth: '280px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            {/* Stage Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: stage.color
                }} />
                <h3 style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  {stage.title}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: stage.bg,
                  color: stage.color,
                  border: `1px solid ${stage.border}`
                }}>
                  {stageLeads.length}
                </span>
              </div>

              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b' }}>
                {formatCurrency(stageValue)}
              </span>
            </div>

            {/* Stage Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
              {stageLeads.length > 0 ? (
                stageLeads.map((lead) => (
                  <div
                    key={lead._id}
                    onClick={() => onViewLead(lead)}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      padding: '14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.07)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    }}
                  >
                    {/* Top Row: Lead Code & Priority */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {lead.leadCode || `#${lead.idNumber}`}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: lead.priority === 'urgent' ? '#fee2e2' : lead.priority === 'high' ? '#ffedd5' : '#f1f5f9',
                        color: lead.priority === 'urgent' ? '#dc2626' : lead.priority === 'high' ? '#ea580c' : '#64748b'
                      }}>
                        {lead.priority?.toUpperCase()}
                      </span>
                    </div>

                    {/* Name & Company */}
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                        {lead.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                        {lead.companyName || lead.client}
                      </div>
                    </div>

                    {/* Deal Value */}
                    {lead.dealValue > 0 && (
                      <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#16a34a' }}>
                        {formatCurrency(lead.dealValue)}
                      </div>
                    )}

                    {/* Footer: Owner Avatar & Quick Move Dropdown */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f5f9',
                      marginTop: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {lead.leadOwnerAvatar ? (
                          <img
                            src={lead.leadOwnerAvatar}
                            alt={lead.leadOwnerName}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                            {lead.leadOwnerName?.charAt(0) || 'O'}
                          </div>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          {lead.leadOwnerName?.split(' ')[0] || 'Owner'}
                        </span>
                      </div>

                      {/* Quick Move Selector */}
                      <select
                        value={lead.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateLeadStatus(lead._id, e.target.value)}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '600',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="new">Move: New</option>
                        <option value="active">Move: Active</option>
                        <option value="in_progress">Move: In Progress</option>
                        <option value="negotiation">Move: Negotiation</option>
                        <option value="converted">Move: Won</option>
                        <option value="lost">Move: Lost</option>
                      </select>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '12px',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: '8px'
                }}>
                  No leads in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
