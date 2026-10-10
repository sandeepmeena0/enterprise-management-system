/**
 * @file EditLeadModal.jsx
 * @description Modal for editing all properties of an existing lead.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  Check,
  Flame,
  UserCheck
} from 'lucide-react';
import { useCRM } from '../../../../shared/context/CRMContext';
import { useHR } from '../../../hr/context/HRContext';

export const EditLeadModal = ({ lead, isOpen, onClose }) => {
  const { updateLead } = useCRM();
  const { employees, currentUser } = useHR();

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    leadType: 'Enterprise',
    client: '',
    leadOwnerId: '',
    startDate: '',
    endDate: '',
    status: 'new',
    priority: 'medium',
    leadSource: 'Website Inquiry',
    dealValue: '',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        companyName: lead.companyName || lead.client || '',
        contactPerson: lead.contactPerson || lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        leadType: lead.leadType || 'Enterprise',
        client: lead.client || lead.companyName || '',
        leadOwnerId: lead.leadOwnerId || employees[0]?._id || 'emp_001',
        startDate: lead.startDate || '',
        endDate: lead.endDate || '',
        status: lead.status || 'new',
        priority: lead.priority || 'medium',
        leadSource: lead.leadSource || 'Website Inquiry',
        dealValue: lead.dealValue || '',
        notes: lead.notes || ''
      });
    }
  }, [lead, isOpen, employees]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Please provide at least a Lead Name and Work Email');
      return;
    }

    try {
      setSubmitting(true);
      const selectedOwner = employees.find(e => e._id === formData.leadOwnerId) || currentUser;

      await updateLead(lead._id, {
        ...formData,
        contactPerson: formData.contactPerson || formData.name,
        companyName: formData.companyName || formData.client || 'Enterprise Client',
        client: formData.client || formData.companyName || 'Enterprise Client',
        leadOwnerId: selectedOwner?._id || currentUser?._id || 'emp_001',
        leadOwnerName: selectedOwner?.name || currentUser?.name || 'Lead Owner',
        leadOwnerRole: selectedOwner?.role || 'Senior Director',
        leadOwnerAvatar: selectedOwner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        dealValue: Number(formData.dealValue) || 0
      });

      onClose();
    } catch (err) {
      console.error('Error updating lead:', err);
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
        maxWidth: '680px',
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
                <Sparkles size={18} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Edit Lead: {lead.leadCode || `#${lead.idNumber}`}
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 40px' }}>
              Update prospect contact info, stage status, and owner assignment
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Row 1: Lead Name & Company Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Lead / Deal Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Company / Client Name *
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => {
                  handleChange('companyName', e.target.value);
                  handleChange('client', e.target.value);
                }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Contact Person, Work Email & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={e => handleChange('contactPerson', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Work Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3: Lead Owner & Created By */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Lead Owner (Assigned Team Member) *
              </label>
              <select
                value={formData.leadOwnerId}
                onChange={e => handleChange('leadOwnerId', e.target.value)}
                style={selectStyle}
              >
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} — {emp.role} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Originally Created By
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <UserCheck size={16} color="#16a34a" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  {lead.createdByName || 'Team Member'}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  on {lead.createdDate || '09-12-2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Lead Type, Status, Priority, Deal Value */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Lead Type / Category
              </label>
              <select
                value={formData.leadType}
                onChange={e => handleChange('leadType', e.target.value)}
                style={selectStyle}
              >
                <option value="Enterprise">Enterprise</option>
                <option value="Inbound Web">Inbound Web</option>
                <option value="Referral">Referral</option>
                <option value="Outbound Sales">Outbound Sales</option>
                <option value="Partner">Partner</option>
                <option value="Cold Campaign">Cold Campaign</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Lead Status
              </label>
              <select
                value={formData.status}
                onChange={e => handleChange('status', e.target.value)}
                style={selectStyle}
              >
                <option value="new">New Inquiry</option>
                <option value="active">Active Contact</option>
                <option value="in_progress">In Progress</option>
                <option value="negotiation">In Negotiation</option>
                <option value="converted">Converted (Won)</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={e => handleChange('priority', e.target.value)}
                style={selectStyle}
              >
                <option value="urgent">⚡ Urgent</option>
                <option value="high">🔥 High</option>
                <option value="medium">⚖️ Medium</option>
                <option value="low">💤 Low</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Deal Value (₹)
              </label>
              <input
                type="number"
                value={formData.dealValue}
                onChange={e => handleChange('dealValue', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 5: Start Date, Target End Date & Lead Source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Start / Inquiry Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => handleChange('startDate', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Target Close / Deadline
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={e => handleChange('endDate', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Lead Source
              </label>
              <select
                value={formData.leadSource}
                onChange={e => handleChange('leadSource', e.target.value)}
                style={selectStyle}
              >
                <option value="Website Inquiry">Website Inquiry</option>
                <option value="LinkedIn Campaign">LinkedIn Campaign</option>
                <option value="Executive Referral">Executive Referral</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Trade Show / Conference">Trade Show / Conference</option>
                <option value="Google Search Ads">Google Search Ads</option>
                <option value="Strategic Partnership">Strategic Partnership</option>
              </select>
            </div>
          </div>

          {/* Row 6: Description & Requirements */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Notes & Deal Requirements
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={e => handleChange('notes', e.target.value)}
              style={{
                ...inputStyle,
                height: 'auto',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            marginTop: '4px'
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
              {submitting ? 'Updating Lead...' : 'Save Changes'}
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
