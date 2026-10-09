import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useHR } from '../../context/HRContext';
import { User, Mail, Briefcase, Building, Calendar, Clock, Sparkles } from 'lucide-react';

export const AddEmployeeModal = ({ isOpen, onClose }) => {
  const { addEmployee, employees } = useHR();

  // Smart calculation of next available employee code
  const getNextAvailableCode = () => {
    const existingCodes = (employees || []).map(e => e.employeeCode || e.employeeId || '');
    let maxNum = 0;
    existingCodes.forEach(code => {
      const match = String(code).match(/\d+/g);
      if (match) {
        const num = parseInt(match[match.length - 1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const candidate = maxNum > 0 ? maxNum + 1 : (employees?.length || 0) + 1;
    let nextCode = `EMP-${String(candidate).padStart(3, '0')}`;
    
    // Ensure uniqueness
    let counter = candidate;
    while (existingCodes.some(c => c.toLowerCase() === nextCode.toLowerCase())) {
      counter++;
      nextCode = `EMP-${String(counter).padStart(3, '0')}`;
    }
    return nextCode;
  };

  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    email: '',
    role: '',
    department: 'Engineering',
    joiningDate: new Date().toISOString().split('T')[0],
    leaveBalance: {
      casual: 10,
      sick: 8,
      earned: 15,
      maternity: 0
    },
    avatar: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default unique code when modal opens or employees change
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        employeeCode: prev.employeeCode || getNextAvailableCode()
      }));
    }
  }, [isOpen, employees]);

  // Check for duplicate code in real-time
  const duplicateEmployee = (employees || []).find(e => 
    e.employeeCode?.toLowerCase() === formData.employeeCode?.trim().toLowerCase() ||
    e._id === formData.employeeCode?.trim() ||
    e.employeeId?.toLowerCase() === formData.employeeCode?.trim().toLowerCase()
  );

  const duplicateEmail = (employees || []).find(e =>
    e.email?.toLowerCase() === formData.email?.trim().toLowerCase()
  );

  const isCodeDuplicate = !!duplicateEmployee;
  const isEmailDuplicate = !!duplicateEmail;

  const departments = [
    'Engineering',
    'Product Design',
    'Marketing & Growth',
    'Human Resources',
    'Infrastructure & DevOps',
    'Finance & Operations',
    'Sales & Accounts'
  ];

  const handleAutoGenerate = () => {
    setFormData(prev => ({
      ...prev,
      employeeCode: getNextAvailableCode()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      alert('Please fill in Name, Email, and Role');
      return;
    }

    if (isCodeDuplicate) {
      alert(`Employee ID "${formData.employeeCode}" is already taken by ${duplicateEmployee.name}. Please enter a unique ID.`);
      return;
    }

    if (isEmailDuplicate) {
      alert(`Email "${formData.email}" is already registered with ${duplicateEmail.name}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await addEmployee({
        ...formData,
        employeeCode: formData.employeeCode.trim().toUpperCase(),
        avatar: formData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name)}`
      });
      // Reset form
      setFormData({
        name: '',
        employeeCode: '',
        email: '',
        role: '',
        department: 'Engineering',
        joiningDate: new Date().toISOString().split('T')[0],
        leaveBalance: { casual: 10, sick: 8, earned: 15, maternity: 0 },
        avatar: ''
      });
      onClose();
    } catch (err) {
      console.error('Error adding employee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      subtitle="Register new team member. They will instantly appear across HR, Leaves, and Attendance."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Row 1: Full Name & Employee ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="e.g. Aditi Rao"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="filter-input"
                style={{ width: '100%', height: '40px', paddingLeft: '12px' }}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '600', color: isCodeDuplicate ? '#dc2626' : '#334155' }}>
                Employee ID *
              </label>
              <button
                type="button"
                onClick={handleAutoGenerate}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
                title="Auto-generate next free ID"
              >
                ⚡ Auto-ID
              </button>
            </div>
            <input
              type="text"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              className="filter-input"
              style={{
                width: '100%',
                height: '40px',
                paddingLeft: '12px',
                background: isCodeDuplicate ? '#fef2f2' : '#f8fafc',
                border: isCodeDuplicate ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                fontWeight: '600',
                color: isCodeDuplicate ? '#dc2626' : '#0f172a'
              }}
              required
            />
            {isCodeDuplicate ? (
              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                ⚠️ Already assigned to <strong>{duplicateEmployee.name}</strong>
              </div>
            ) : formData.employeeCode ? (
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', fontWeight: '500' }}>
                ✓ Employee ID is available
              </div>
            ) : null}
          </div>
        </div>

        {/* Row 2: Work Email & Role */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: isEmailDuplicate ? '#dc2626' : '#334155', marginBottom: '6px' }}>
              Work Email *
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="filter-input"
              style={{
                width: '100%',
                height: '40px',
                paddingLeft: '12px',
                border: isEmailDuplicate ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                background: isEmailDuplicate ? '#fef2f2' : '#ffffff'
              }}
              required
            />
            {isEmailDuplicate && (
              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                ⚠️ Email already registered with <strong>{duplicateEmail.name}</strong>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Role / Designation *
            </label>
            <input
              type="text"
              placeholder="e.g. Frontend Engineer"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="filter-input"
              style={{ width: '100%', height: '40px', paddingLeft: '12px' }}
              required
            />
          </div>
        </div>

        {/* Row 3: Department & Joining Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Department
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="filter-select"
              style={{ width: '100%', height: '40px' }}
            >
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Joining Date
            </label>
            <input
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              className="filter-input"
              style={{ width: '100%', height: '40px', paddingLeft: '12px' }}
            />
          </div>
        </div>

        {/* Row 4: Initial Leave Quota Setup */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px',
          marginTop: '4px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '10px' }}>
            📅 Annual Leave Balance Allotment (Days):
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Casual Leave (CL)</label>
              <input
                type="number"
                min="0"
                value={formData.leaveBalance.casual}
                onChange={(e) => setFormData({
                  ...formData,
                  leaveBalance: { ...formData.leaveBalance, casual: Number(e.target.value) }
                })}
                className="filter-input"
                style={{ width: '100%', height: '36px', paddingLeft: '10px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Sick Leave (SL)</label>
              <input
                type="number"
                min="0"
                value={formData.leaveBalance.sick}
                onChange={(e) => setFormData({
                  ...formData,
                  leaveBalance: { ...formData.leaveBalance, sick: Number(e.target.value) }
                })}
                className="filter-input"
                style={{ width: '100%', height: '36px', paddingLeft: '10px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Earned Leave (EL)</label>
              <input
                type="number"
                min="0"
                value={formData.leaveBalance.earned}
                onChange={(e) => setFormData({
                  ...formData,
                  leaveBalance: { ...formData.leaveBalance, earned: Number(e.target.value) }
                })}
                className="filter-input"
                style={{ width: '100%', height: '36px', paddingLeft: '10px' }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button type="button" onClick={onClose} className="btn btn-outline" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || isCodeDuplicate || isEmailDuplicate}
            style={{
              opacity: isCodeDuplicate || isEmailDuplicate ? 0.6 : 1,
              cursor: isCodeDuplicate || isEmailDuplicate ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Saving Employee...' : 'Register Employee'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
