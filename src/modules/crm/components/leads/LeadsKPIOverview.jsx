/**
 * @file LeadsKPIOverview.jsx
 * @description Top KPI Summary Cards for the Leads Module (Total Leads, New, Active, Converted, Lost, Overdue).
 */

import React from 'react';
import {
  Users,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  PieChart
} from 'lucide-react';

export const LeadsKPIOverview = ({ leads = [] }) => {
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const activeLeads = leads.filter(l => l.status === 'active' || l.status === 'in_progress').length;
  const negotiationLeads = leads.filter(l => l.status === 'negotiation').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const lostLeads = leads.filter(l => l.status === 'lost').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost' && l.endDate && l.endDate < todayStr).length;

  const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);
  const convertedValue = leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)} K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const kpis = [
    {
      title: 'Total Leads',
      value: totalLeads,
      subtext: `Pipeline: ${formatCurrency(totalPipelineValue)}`,
      icon: Users,
      color: '#2563eb',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe'
    },
    {
      title: 'New Inquiries',
      value: newLeads,
      subtext: 'Awaiting outreach',
      icon: Sparkles,
      color: '#0284c7',
      bgColor: '#e0f2fe',
      borderColor: '#bae6fd'
    },
    {
      title: 'Active Pipeline',
      value: activeLeads + negotiationLeads,
      subtext: `${negotiationLeads} in negotiation`,
      icon: Flame,
      color: '#d97706',
      bgColor: '#fef3c7',
      borderColor: '#fde68a'
    },
    {
      title: 'Converted (Won)',
      value: convertedLeads,
      subtext: `${conversionRate}% win rate • ${formatCurrency(convertedValue)}`,
      icon: CheckCircle2,
      color: '#16a34a',
      bgColor: '#dcfce7',
      borderColor: '#bbf7d0'
    },
    {
      title: 'Lost Leads',
      value: lostLeads,
      subtext: 'Budget / Dropped',
      icon: XCircle,
      color: '#64748b',
      bgColor: '#f1f5f9',
      borderColor: '#e2e8f0'
    },
    {
      title: 'Follow-up Overdue',
      value: overdueLeads,
      subtext: overdueLeads > 0 ? 'Requires attention' : 'All up to date',
      icon: Clock,
      color: overdueLeads > 0 ? '#dc2626' : '#16a34a',
      bgColor: overdueLeads > 0 ? '#fee2e2' : '#f0fdf4',
      borderColor: overdueLeads > 0 ? '#fecaca' : '#bbf7d0'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '14px',
      marginBottom: '20px'
    }}>
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '16px 18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b' }}>
                {kpi.title}
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: kpi.bgColor,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={16} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', fontWeight: '500' }}>
                {kpi.subtext}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
