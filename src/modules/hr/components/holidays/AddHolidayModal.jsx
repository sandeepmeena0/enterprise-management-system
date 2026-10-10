import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useHR } from '../../context/HRContext';
import { isHRorAdmin } from '../../../../shared/utils/permissionUtils';
import { ShieldCheck } from 'lucide-react';

export const AddHolidayModal = ({ isOpen, onClose, selectedDate = '' }) => {
  const { addHoliday, currentUser } = useHR();
  const canManageHolidays = isHRorAdmin(currentUser);

  const [formData, setFormData] = useState({
    name: '',
    date: selectedDate || new Date().toISOString().split('T')[0],
    type: 'National Holiday',
    description: '',
    isRecurringYearly: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageHolidays) {
      alert('🔒 Access Denied: Only HR and Admin administrators have authorization to publish company holidays.');
      return;
    }
    if (!formData.name.trim()) {
      alert('Please enter holiday name');
      return;
    }

    const d = new Date(formData.date);
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });

    await addHoliday({
      ...formData,
      dayOfWeek
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Declare Company Holiday"
      subtitle="Publish a new national, gazetted, or corporate holiday to the company-wide calendar."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
            Holiday Name / Occasion
          </label>
          <input
            type="text"
            placeholder="e.g. Gandhi Jayanti, Diwali, New Year Day"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="filter-input"
            style={{ width: '100%', height: '40px', paddingLeft: '12px' }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Holiday Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="filter-input"
              style={{ width: '100%', height: '40px', paddingLeft: '12px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Holiday Category
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="filter-select"
              style={{ width: '100%', height: '40px' }}
            >
              <option value="National Holiday">National Holiday</option>
              <option value="Gazetted Holiday">Gazetted Holiday</option>
              <option value="Restricted / Optional Holiday">Restricted / Optional</option>
              <option value="Company Holiday">Company Special Off</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
            Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Additional notes or celebration details..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="recurringHoliday"
            checked={formData.isRecurringYearly}
            onChange={(e) => setFormData({ ...formData, isRecurringYearly: e.target.checked })}
          />
          <label htmlFor="recurringHoliday" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
            Recurring every year on this date
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add Holiday
          </button>
        </div>
      </form>
    </Modal>
  );
};
