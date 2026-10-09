import React, { useState } from 'react';
import {
  DollarSign,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  CreditCard,
  Send,
  Plus
} from 'lucide-react';
import { useHR } from '../../hr/context/HRContext';
import { useToast } from '../../../shared/context/ToastContext';
import { PayslipModal } from '../components/PayslipModal';
import { SalaryIncrementModal } from '../components/SalaryIncrementModal';
import { TrendingUp, UserPlus, Sparkles } from 'lucide-react';

export const PayrollPage = () => {
  const { employees, currentUser } = useHR();
  const { addToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEmployeeForPayslip, setActiveEmployeeForPayslip] = useState(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);

  const [activeEmployeeForHike, setActiveEmployeeForHike] = useState(null);
  const [isHikeModalOpen, setIsHikeModalOpen] = useState(false);

  // Dynamic salary state with reactive updates
  const [salaryMap, setSalaryMap] = useState(() => {
    const saved = localStorage.getItem('EMS_SALARY_MAP');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      'EMP-001': { basic: 52000, hra: 20800, allowances: 14000, bonus: 5000, pf: 4160, pt: 200, tds: 3500, lastHikePercentage: 15, lastHikeDate: '2026-09-01' },
      'EMP-002': { basic: 48000, hra: 19200, allowances: 12000, bonus: 4000, pf: 3840, pt: 200, tds: 2800 },
      'EMP-003': { basic: 65000, hra: 26000, allowances: 18000, bonus: 7500, pf: 5200, pt: 200, tds: 5400, lastHikePercentage: 20, lastHikeDate: '2026-08-15' },
      'EMP-004': { basic: 45000, hra: 18000, allowances: 10000, bonus: 3000, pf: 3600, pt: 200, tds: 2200 },
      'EMP-005': { basic: 58000, hra: 23200, allowances: 15000, bonus: 6000, pf: 4640, pt: 200, tds: 4200 }
    };
  });

  const handleSalaryUpdated = (empCode, updatedData) => {
    setSalaryMap(prev => {
      const updated = {
        ...prev,
        [empCode]: { ...(prev[empCode] || {}), ...updatedData }
      };
      localStorage.setItem('EMS_SALARY_MAP', JSON.stringify(updated));
      return updated;
    });
  };

  const handleOpenHikeModal = (emp) => {
    setActiveEmployeeForHike(emp);
    setIsHikeModalOpen(true);
  };

  const filteredEmployees = employees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenPayslip = (emp) => {
    setActiveEmployeeForPayslip(emp);
    setIsPayslipOpen(true);
  };

  const handleDisburseAll = () => {
    addToast({
      title: 'Batch Payroll Processed 🚀',
      message: `Direct bank salary transfer initiated for ${filteredEmployees.length} active employees for ${selectedMonth}.`,
      type: 'success'
    });
  };

  const totalPayrollCost = employees.reduce((acc, emp) => {
    const s = salaryMap[emp.employeeCode] || { basic: 40000, hra: 16000, allowances: 10000, bonus: 0 };
    return acc + (s.basic + s.hra + s.allowances + (s.bonus || 0));
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Payroll & Payslips</span>
            <span>Finance • Salary Management</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Automated salary calculations, tax deductions, and official payslip generation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              color: '#0f172a',
              cursor: 'pointer'
            }}
          >
            <option value="October 2026">October 2026</option>
            <option value="September 2026">September 2026</option>
            <option value="August 2026">August 2026</option>
            <option value="July 2026">July 2026</option>
          </select>

          <button
            onClick={handleDisburseAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
            }}
          >
            <CreditCard size={16} />
            Disburse Payroll
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Total Payroll Expense</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            ₹{totalPayrollCost.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>For {selectedMonth}</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Employees on Payroll</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>
            {employees.length} Members
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>100% attendance verified</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Statutory Tax & PF</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#7c3aed', marginTop: '6px' }}>
            ₹34,800
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>TDS, PF & PT Deductions</span>
        </div>
      </div>

      {/* Salary List Table Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Search Bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            width: '300px'
          }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search employee or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '12px 18px' }}>Employee</th>
                <th style={{ padding: '12px 18px' }}>Designation</th>
                <th style={{ padding: '12px 18px' }}>Basic Salary</th>
                <th style={{ padding: '12px 18px' }}>Allowances</th>
                <th style={{ padding: '12px 18px' }}>Deductions (PF/Tax)</th>
                <th style={{ padding: '12px 18px' }}>Net Pay</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => {
                const s = salaryMap[emp.employeeCode] || { basic: 45000, hra: 18000, allowances: 12000, bonus: 3000, pf: 3600, pt: 200, tds: 2500 };
                const gross = s.basic + s.hra + s.allowances + (s.bonus || 0);
                const deductions = s.pf + s.pt + s.tds;
                const net = gross - deductions;

                return (
                  <tr
                    key={emp._id || emp.employeeCode}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={emp.name}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{emp.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{emp.employeeCode}</span>
                            {s.lastHikePercentage && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                color: '#15803d',
                                fontWeight: '700',
                                backgroundColor: '#dcfce7',
                                padding: '1px 5px',
                                borderRadius: '4px'
                              }}>
                                <TrendingUp size={10} /> +{s.lastHikePercentage}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#334155' }}>{emp.role}</td>
                    <td style={{ padding: '14px 18px', fontWeight: '600' }}>₹{s.basic.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', color: '#16a34a' }}>+₹{(s.hra + s.allowances + (s.bonus || 0)).toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', color: '#b91c1c' }}>-₹{deductions.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                      ₹{net.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenHikeModal(emp)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '6px',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Increase / Revise Employee Salary"
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dcfce7'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                        >
                          <TrendingUp size={13} />
                          Hike Salary
                        </button>

                        <button
                          onClick={() => handleOpenPayslip(emp)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '6px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                          }}
                        >
                          <FileText size={13} />
                          Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      <PayslipModal
        isOpen={isPayslipOpen}
        onClose={() => setIsPayslipOpen(false)}
        employee={activeEmployeeForPayslip}
        month={selectedMonth}
        salaryData={activeEmployeeForPayslip ? salaryMap[activeEmployeeForPayslip.employeeCode] : null}
      />

      {/* Salary Increment & Appraisal Modal */}
      <SalaryIncrementModal
        isOpen={isHikeModalOpen}
        onClose={() => setIsHikeModalOpen(false)}
        employee={activeEmployeeForHike}
        currentSalaryData={activeEmployeeForHike ? salaryMap[activeEmployeeForHike.employeeCode] : null}
        onSalaryUpdated={handleSalaryUpdated}
      />
    </div>
  );
};
