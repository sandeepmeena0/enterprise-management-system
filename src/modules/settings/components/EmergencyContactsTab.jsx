/**
 * @file EmergencyContactsTab.jsx
 * @description Emergency Contacts list matching Screenshot 8.
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Phone, Mail, UserCheck, List } from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { AddEmergencyContactModal } from './AddEmergencyContactModal';

export const EmergencyContactsTab = () => {
  const { emergencyContacts, deleteEmergencyContact } = useCRM();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState(null);

  const handleEdit = (contact) => {
    setContactToEdit(contact);
    setIsAddModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to remove this emergency contact?')) {
      deleteEmergencyContact(id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 0' }}>
      
      {/* Top Action Button (Matching Screenshot 8) */}
      <div>
        <button
          onClick={() => {
            setContactToEdit(null);
            setIsAddModalOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 18px',
            borderRadius: '8px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
          }}
        >
          <Plus size={16} />
          Create New
        </button>
      </div>

      {/* Table Container Matching Screenshot 8 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Name</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Email</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Mobile</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Relationship</th>
              <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {(emergencyContacts || []).length > 0 ? (
              emergencyContacts.map(contact => (
                <tr
                  key={contact._id}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '14px 18px', fontWeight: '600', color: '#0f172a' }}>
                    {contact.name}
                  </td>
                  <td style={{ padding: '14px 18px', color: '#64748b' }}>
                    {contact.email || '—'}
                  </td>
                  <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: '500' }}>
                    {contact.mobile}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb'
                    }}>
                      {contact.relationship}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(contact)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          color: '#475569'
                        }}
                        title="Edit Contact"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact._id)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          color: '#dc2626'
                        }}
                        title="Delete Contact"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '48px 18px', color: '#94a3b8' }}>
                  <List size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div style={{ fontSize: '13.5px' }}>- No record found. -</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      <AddEmergencyContactModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setContactToEdit(null);
        }}
        contactToEdit={contactToEdit}
      />
    </div>
  );
};
