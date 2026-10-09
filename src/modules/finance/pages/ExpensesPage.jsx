/**
 * @file ExpensesPage.jsx
 * @description Dedicated Finance & Expenses Management Page matching Screenshot 1 exactly.
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  DollarSign,
  ChevronDown,
  Calendar,
  Layers,
  Sparkles,
  Check
} from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { useToast } from '../../../shared/context/ToastContext';
import { ExpenseKPIOverview } from '../components/ExpenseKPIOverview';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { ExpenseDetailModal } from '../components/ExpenseDetailModal';
import { ImportExpensesModal } from '../components/ImportExpensesModal';

export const ExpensesPage = () => {
  const { expenses, updateExpenseStatus, deleteExpense } = useCRM();
  const { addToast } = useToast();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (exp.itemName || '').toLowerCase().includes(q) ||
        (exp.purchasedFrom || '').toLowerCase().includes(q) ||
        (exp.employeeName || '').toLowerCase().includes(q) ||
        (exp.category || '').toLowerCase().includes(q) ||
        (exp.expenseCode || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;

      let matchesDate = true;
      const expDate = exp.purchaseDate || exp.date;
      if (startDateFilter && expDate && expDate < startDateFilter) matchesDate = false;
      if (endDateFilter && expDate && expDate > endDateFilter) matchesDate = false;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [expenses, search, statusFilter, startDateFilter, endDateFilter]);

  // Select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredExpenses.map(item => item._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Export to CSV
  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense records available to export');
      return;
    }

    const headers = ['Id,Item Name,Price,Employees,Purchased From,Purchase Date,Status,Category,Description'];
    const rows = filteredExpenses.map(e =>
      `"${e.expenseCode || e.idNumber}","${e.itemName}","${e.price || e.amount}","${e.employeeName || e.paidBy}","${e.purchasedFrom || ''}","${e.purchaseDate || e.date}","${e.status}","${e.category || ''}","${(e.description || '').replace(/"/g, '""')}"`
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `company_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Expenses exported successfully to CSV!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Top Breadcrumb & Live Header Matching Screenshot 1 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Expenses</span>
            <span>Home • Expenses</span>
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
          <span>02:18:56</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span style={{ color: '#3b82f6' }}>●</span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <ExpenseKPIOverview expenses={expenses} />

      {/* Filter and Search Bar Matching Screenshot 1 */}
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
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
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

        {/* Filters Toggle Button */}
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

      {/* Action Bar Matching Screenshot 1 (+ Add Expense, Import, Export) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* + Add Expense Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Plus size={16} />
            Add Expense
          </button>

          {/* Import Button */}
          <button
            onClick={() => setIsImportOpen(true)}
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
            <Upload size={15} />
            Import
          </button>

          {/* Export Button */}
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
      </div>

      {/* Expenses Table Matching Screenshot 1 Layout */}
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
                    checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px', width: '70px' }}>Id</th>
                <th style={{ padding: '12px 14px' }}>Item Name</th>
                <th style={{ padding: '12px 14px' }}>Price</th>
                <th style={{ padding: '12px 14px' }}>Employees</th>
                <th style={{ padding: '12px 14px' }}>Purchased From</th>
                <th style={{ padding: '12px 14px' }}>Purchase Date</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>No data available in table</div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, idx) => (
                  <tr
                    key={exp._id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: selectedIds.includes(exp._id) ? 'rgba(37,99,235,0.04)' : '#ffffff',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '12px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(exp._id)}
                        onChange={() => handleSelectOne(exp._id)}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </td>

                    {/* Id */}
                    <td style={{ padding: '12px 14px', fontWeight: '600', color: '#64748b' }}>
                      {exp.idNumber || idx + 1}
                    </td>

                    {/* Item Name */}
                    <td style={{ padding: '12px 14px' }}>
                      <div
                        onClick={() => setSelectedExpense(exp)}
                        style={{ fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}
                      >
                        {exp.itemName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        {exp.category || 'Utilities & Office'}
                      </div>
                    </td>

                    {/* Price */}
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0f172a' }}>
                      ₹{(exp.price || exp.amount || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Employees / Paid By */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={exp.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={exp.employeeName || 'Employee'}
                          style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {exp.employeeName || exp.paidBy || 'Avinash'}
                        </span>
                      </div>
                    </td>

                    {/* Purchased From */}
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {exp.purchasedFrom || '—'}
                    </td>

                    {/* Purchase Date */}
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {exp.purchaseDate || exp.date || '25-09-2026'}
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
                        backgroundColor: exp.status === 'approved' ? '#dcfce7' : exp.status === 'pending' ? '#fef3c7' : '#fee2e2',
                        color: exp.status === 'approved' ? '#15803d' : exp.status === 'pending' ? '#b45309' : '#b91c1c',
                        textTransform: 'capitalize'
                      }}>
                        {exp.status === 'approved' && <CheckCircle2 size={13} />}
                        {exp.status === 'pending' && <Clock size={13} />}
                        {exp.status === 'rejected' && <XCircle size={13} />}
                        {exp.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', position: 'relative' }}>
                      <button
                        onClick={() => setSelectedExpense(exp)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination Matching Screenshot 1 */}
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
            Showing 1 to {filteredExpenses.length} of {expenses.length} entries
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
                backgroundColor: '#2563eb',
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
      <AddExpenseModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <ImportExpensesModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          isOpen={!!selectedExpense}
          onClose={() => setSelectedExpense(null)}
        />
      )}
    </div>
  );
};
