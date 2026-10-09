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
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '14px',
      marginBottom: '10px'
    }}>
      {/* Total Expenses */}
      <div style={cardStyle('#3b82f6', '#eff6ff')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Total Company Expenses</span>
          <div style={iconBadgeStyle('#2563eb', '#eff6ff')}><DollarSign size={16} /></div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
          ₹{totalAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          Across {expenses.length} recorded items
        </div>
      </div>

      {/* Approved Expenses */}
      <div style={cardStyle('#10b981', '#f0fdf4')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Approved Expenses</span>
          <div style={iconBadgeStyle('#16a34a', '#dcfce7')}><CheckCircle2 size={16} /></div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '6px' }}>
          ₹{approvedAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px', fontWeight: '500' }}>
          {approvedCount} items cleared
        </div>
      </div>

      {/* Pending Expenses */}
      <div style={cardStyle('#f59e0b', '#fef3c7')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Pending Review</span>
          <div style={iconBadgeStyle('#d97706', '#fef3c7')}><Clock size={16} /></div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '6px' }}>
          ₹{pendingAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px', fontWeight: '500' }}>
          {pendingCount} items waiting approval
        </div>
      </div>

      {/* Rejected Expenses */}
      <div style={cardStyle('#ef4444', '#fee2e2')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Rejected / Declined</span>
          <div style={iconBadgeStyle('#dc2626', '#fee2e2')}><XCircle size={16} /></div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>
          ₹{rejectedAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          Non-compliant requests
        </div>
      </div>
    </div>
  );
};

const cardStyle = (borderColor, hoverBg) => ({
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  borderLeft: `4px solid ${borderColor}`,
  padding: '14px 18px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
});

const iconBadgeStyle = (color, bg) => ({
  width: '28px',
  height: '28px',
  borderRadius: '8px',
  backgroundColor: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});
