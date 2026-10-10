/**
 * @file AddExpenseModal.jsx
 * @description Modal form for submitting or recording company expenses with receipts, category, and paidBy metadata.
 */

import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Building,
  Calendar,
  User,
  FileText,
  Upload,
  Sparkles,
  Check,
  Tag
} from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { useHR } from '../../hr/context/HRContext';

export const AddExpenseModal = ({ isOpen, onClose }) => {
  const { createExpense } = useCRM();
  const { employees, currentUser } = useHR();

  const now = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    itemName: '',
    price: '',
    category: 'Utilities & Office',
    purchasedFrom: '',
    purchaseDate: now,
    employeeId: currentUser?._id || employees[0]?._id || 'emp_001',
    status: 'approved',
    description: '',
    billAttachment: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500'
  });

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemName.trim() || !formData.price) {
      alert('Please enter an Expense Item Name and Price');
      return;
    }

    try {
      setSubmitting(true);
      const selectedEmployee = employees.find(emp => emp._id === formData.employeeId) || currentUser;

      await createExpense({
        ...formData,
        price: Number(formData.price),
        amount: Number(formData.price),
        employeeName: selectedEmployee?.name || currentUser?.name || 'Employee',
        paidBy: selectedEmployee?.name || currentUser?.name || 'Employee',
        employeeAvatar: selectedEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
      });

      // Reset
      setFormData({
        itemName: '',
        price: '',
        category: 'Utilities & Office',
        purchasedFrom: '',
        purchaseDate: now,
        employeeId: currentUser?._id || 'emp_001',
        status: 'approved',
        description: '',
        billAttachment: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500'
      });
      onClose();
    } catch (err) {
      console.error('Error creating expense:', err);
    } finally {
      setSubmitting(false);
    }
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
        maxWidth: '620px',
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
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DollarSign size={18} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Add New Company Expense
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 40px' }}>
              Record company purchase, assign paying employee, and upload receipt proof
            </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Row 1: Item Name & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Item Name / Expense Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. AWS Cloud Hosting, Office Fiber Broadband"
                value={formData.itemName}
                onChange={e => handleChange('itemName', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Price (₹) *
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 25000"
                value={formData.price}
                onChange={e => handleChange('price', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Category & Purchased From */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Expense Category
              </label>
              <select
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                style={selectStyle}
              >
                <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                <option value="Software & Tools">Software & Tools</option>
                <option value="Hardware & Devices">Hardware & Devices</option>
                <option value="Utilities & Office">Utilities & Office</option>
                <option value="Team & Events">Team & Events</option>
                <option value="Marketing & Ads">Marketing & Ads</option>
                <option value="Travel & Lodging">Travel & Lodging</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Purchased From / Vendor
              </label>
              <input
                type="text"
                placeholder="e.g. Amazon Web Services, Apple, Airtel"
                value={formData.purchasedFrom}
                onChange={e => handleChange('purchasedFrom', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3: Employee / Paid By & Purchase Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Employee / Paid By
              </label>
              <select
                value={formData.employeeId}
                onChange={e => handleChange('employeeId', e.target.value)}
                style={selectStyle}
              >
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} — {emp.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={e => handleChange('purchaseDate', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 4: Status (Admin Controlled) */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Approval Status
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['approved', 'pending', 'rejected'].map(st => (
                <label
                  key={st}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: formData.status === st ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    backgroundColor: formData.status === st ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    color: st === 'approved' ? '#16a34a' : st === 'pending' ? '#d97706' : '#dc2626'
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    checked={formData.status === st}
                    onChange={() => handleChange('status', st)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  {st}
                </label>
              ))}
            </div>
          </div>

          {/* Row 5: Description */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Description & Business Justification
            </label>
            <textarea
              rows={3}
              placeholder="Provide reason for purchase, project attribution or invoice details..."
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              style={{
                ...inputStyle,
                height: 'auto',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Footer Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.35)'
              }}
            >
              <Check size={16} />
              {submitting ? 'Recording...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  height: '38px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  outline: 'none',
  backgroundColor: '#ffffff',
  color: '#0f172a'
};

const selectStyle = {
  width: '100%',
  height: '38px',
  padding: '0 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  outline: 'none',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer'
};
