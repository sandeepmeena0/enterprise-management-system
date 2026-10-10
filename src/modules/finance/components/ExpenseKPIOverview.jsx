/**
 * @file ExpenseKPIOverview.jsx
 * @description KPI summary cards for Expenses (Total, Approved, Pending, Rejected, Monthly).
 */

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  PieChart,
  ArrowUpRight
} from 'lucide-react';

export const ExpenseKPIOverview = ({ expenses = [] }) => {
  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.price || e.amount) || 0), 0);
  const approvedAmount = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (Number(e.price || e.amount) || 0), 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (Number(e.price || e.amount) || 0), 0);
  const rejectedAmount = expenses.filter(e => e.status === 'rejected').reduce((sum, e) => sum + (Number(e.price || e.amount) || 0), 0);

  const pendingCount = expenses.filter(e => e.status === 'pending').length;
  const approvedCount = expenses.filter(e => e.status === 'approved').length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '10px',
      marginBottom: '10px'
    }}>
      {/* Total Expenses */}
      <div style={cardStyle('#3b82f6', '#eff6ff')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Total Expenses</span>
          <div style={iconBadgeStyle('#2563eb', '#eff6ff')}><DollarSign size={15} /></div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px', lineHeight: '1.1' }}>
          ₹{totalAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
          {expenses.length} recorded items
        </div>
      </div>

      {/* Approved Expenses */}
      <div style={cardStyle('#10b981', '#f0fdf4')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Approved</span>
          <div style={iconBadgeStyle('#16a34a', '#dcfce7')}><CheckCircle2 size={15} /></div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', marginTop: '4px', lineHeight: '1.1' }}>
          ₹{approvedAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '10.5px', color: '#16a34a', marginTop: '2px', fontWeight: '500' }}>
          {approvedCount} items cleared
        </div>
      </div>

      {/* Pending Expenses */}
      <div style={cardStyle('#f59e0b', '#fef3c7')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Pending Review</span>
          <div style={iconBadgeStyle('#d97706', '#fef3c7')}><Clock size={15} /></div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706', marginTop: '4px', lineHeight: '1.1' }}>
          ₹{pendingAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '10.5px', color: '#d97706', marginTop: '2px', fontWeight: '500' }}>
          {pendingCount} items waiting
        </div>
      </div>

      {/* Rejected Expenses */}
      <div style={cardStyle('#ef4444', '#fee2e2')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Rejected</span>
          <div style={iconBadgeStyle('#dc2626', '#fee2e2')}><XCircle size={15} /></div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626', marginTop: '4px', lineHeight: '1.1' }}>
          ₹{rejectedAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
          Non-compliant requests
        </div>
      </div>
    </div>
  );
};

const cardStyle = (borderColor, hoverBg) => ({
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  borderLeft: `3px solid ${borderColor}`,
  padding: '10px 14px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
});

const iconBadgeStyle = (color, bg) => ({
  width: '26px',
  height: '26px',
  borderRadius: '6px',
  backgroundColor: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});
