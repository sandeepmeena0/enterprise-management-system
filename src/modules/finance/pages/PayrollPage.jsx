import React, { useState, useEffect } from 'react';
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
  Plus,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { useHR } from '../../hr/context/HRContext';
import { useToast } from '../../../shared/context/ToastContext';
import { PayslipModal } from '../components/PayslipModal';
import { SalaryIncrementModal } from '../components/SalaryIncrementModal';

export const PayrollPage = () => {
  const { employees, currentUser } = useHR();
  const { addToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [activeEmployeeForPayslip, setActiveEmployeeForPayslip] = useState(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);

  const [activeEmployeeForRevision, setActiveEmployeeForRevision] = useState(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // Dynamic salary state with reactive updates & local persistence
  const [salaryMap, setSalaryMap] = useState(() => {
    const saved = localStorage.getItem('EMS_SALARY_MAP');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      'EMP-001': { basic: 52000, hra: 20800, allowances: 14000, bonus: 5000, pf: 4160, pt: 200, tds: 3500, lastRevisionPercentage: 15, lastRevisionDate: '2026-09-01', revisionType: 'hike' },
      'EMP-002': { basic: 48000, hra: 19200, allowances: 12000, bonus: 4000, pf: 3840, pt: 200, tds: 2800 },
      'EMP-003': { basic: 65000, hra: 26000, allowances: 18000, bonus: 7500, pf: 5200, pt: 200, tds: 5400, lastRevisionPercentage: 20, lastRevisionDate: '2026-08-15', revisionType: 'hike' },
      'EMP-004': { basic: 45000, hra: 18000, allowances: 10000, bonus: 3000, pf: 3600, pt: 200, tds: 2200 },
      'EMP-005': { basic: 58000, hra: 23200, allowances: 15000, bonus: 6000, pf: 4640, pt: 200, tds: 4200 }
    };
  });

  // Listen for global salary revision events across pages
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.detail && e.detail.employeeCode && e.detail.salary) {
        setSalaryMap(prev => {
          const updated = {
            ...prev,
            [e.detail.employeeCode]: { ...(prev[e.detail.employeeCode] || {}), ...e.detail.salary }
          };
          localStorage.setItem('EMS_SALARY_MAP', JSON.stringify(updated));
          return updated;
        });
      }
    };

    window.addEventListener('hrms_salary_update', handleStorageChange);
    return () => window.removeEventListener('hrms_salary_update', handleStorageChange);
  }, []);

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

  const handleOpenRevisionModal = (emp) => {
    setActiveEmployeeForRevision(emp);
    setIsRevisionModalOpen(true);
  };

  const departments = ['all', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const handleOpenPayslip = (emp) => {
    setActiveEmployeeForPayslip(emp);
    setIsPayslipOpen(true);
  };

  const handleDisburseAll = () => {
    addToast({
      title: 'Batch Payroll Processed 🚀',
      message: `Direct bank salary transfer successfully executed for ${filteredEmployees.length} employees for ${selectedMonth}.`,
      type: 'success'
    });
  };

  // Calculations for total statistics
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;

  employees.forEach(emp => {
    const s = salaryMap[emp.employeeCode] || { basic: 45000, hra: 18000, allowances: 12000, bonus: 0, pf: 3600, pt: 200, tds: 2500 };
    const gross = s.basic + s.hra + s.allowances + (s.bonus || 0);
    const deductions = (s.pf || 0) + (s.pt || 200) + (s.tds || 0);
    const net = gross - deductions;

    totalGross += gross;
    totalDeductions += deductions;
    totalNetPay += net;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%', paddingBottom: '30px' }}>
      
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '18px' }}>Payroll & Compensation Hub</span>
            <span>•</span>
            <span>Finance & Salary Administration</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Manage salary hikes 📈, downward adjustments 📉, statutory tax & PF deductions, and automated payslip dispatches.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '9px 14px',
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
              padding: '9px 18px',
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
            Disburse All Payroll
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* Total Payroll */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Payroll Expense</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            ₹{totalGross.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>Gross Monthly CTC for {selectedMonth}</span>
        </div>

        {/* Net Disbursed */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Net In-Hand Pay</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d', marginTop: '6px' }}>
            ₹{totalNetPay.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Direct Bank Transfers</span>
        </div>

        {/* Deductions & Taxes */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Deductions (PF/Tax)</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <ArrowUpDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#b91c1c', marginTop: '6px' }}>
            ₹{totalDeductions.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>PF, PT & TDS withheld</span>
        </div>

        {/* Workforce on Payroll */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Active Payees</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#9333ea', marginTop: '6px' }}>
            {employees.length} Members
          </div>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>100% attendance calculated</span>
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
        {/* Search & Filter Bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              width: '280px'
            }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search employee, ID or role..."
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="#64748b" />
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#334155'
                }}
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '12px 18px' }}>Employee</th>
                <th style={{ padding: '12px 18px' }}>Designation & Dept</th>
                <th style={{ padding: '12px 18px' }}>Monthly Gross</th>
                <th style={{ padding: '12px 18px' }}>Basic (50%)</th>
                <th style={{ padding: '12px 18px' }}>HRA & Allowances</th>
                <th style={{ padding: '12px 18px' }}>Deductions</th>
                <th style={{ padding: '12px 18px' }}>Net In-Hand</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Compensation Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => {
                const s = salaryMap[emp.employeeCode] || { basic: 45000, hra: 18000, allowances: 12000, bonus: 3000, pf: 3600, pt: 200, tds: 2500 };
                const gross = s.basic + s.hra + s.allowances + (s.bonus || 0);
                const deductions = (s.pf || 0) + (s.pt || 200) + (s.tds || 0);
                const net = gross - deductions;

                const hasRevision = s.lastRevisionPercentage !== undefined && s.lastRevisionPercentage !== null;
                const isPositiveHike = hasRevision ? s.lastRevisionPercentage > 0 : (s.lastHikePercentage ? true : false);
                const revisionPercent = hasRevision ? Math.abs(s.lastRevisionPercentage) : (s.lastHikePercentage || null);

                return (
                  <tr
                    key={emp._id || emp.employeeCode}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    {/* Employee info */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={emp.name}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{emp.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{emp.employeeCode}</span>
                            {revisionPercent && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                color: isPositiveHike ? '#15803d' : '#b91c1c',
                                fontWeight: '800',
                                backgroundColor: isPositiveHike ? '#dcfce7' : '#fee2e2',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: isPositiveHike ? '1px solid #bbf7d0' : '1px solid #fecaca'
                              }}>
                                {isPositiveHike ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {isPositiveHike ? `+${revisionPercent}%` : `-${revisionPercent}%`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Department */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{emp.role}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{emp.department}</div>
                    </td>

                    {/* Gross CTC */}
                    <td style={{ padding: '14px 18px', fontWeight: '800', color: '#0f172a' }}>
                      ₹{gross.toLocaleString()}
                    </td>

                    {/* Basic */}
                    <td style={{ padding: '14px 18px', fontWeight: '600', color: '#334155' }}>
                      ₹{s.basic.toLocaleString()}
                    </td>

                    {/* HRA & Allowances */}
                    <td style={{ padding: '14px 18px', color: '#16a34a' }}>
                      +₹{(s.hra + s.allowances + (s.bonus || 0)).toLocaleString()}
                    </td>

                    {/* Deductions */}
                    <td style={{ padding: '14px 18px', color: '#b91c1c', fontWeight: '600' }}>
                      -₹{deductions.toLocaleString()}
                    </td>

                    {/* Net Pay */}
                    <td style={{ padding: '14px 18px', fontWeight: '800', color: '#15803d', fontSize: '14.5px' }}>
                      ₹{net.toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        
                        {/* Revise Salary Button */}
                        <button
                          onClick={() => handleOpenRevisionModal(emp)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            backgroundColor: '#f8fafc',
                            color: '#1e40af',
                            border: '1.5px solid #bfdbfe',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Hike (Increase) or Deduct (Decrease) Employee Salary"
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        >
                          <ArrowUpDown size={13} color="#2563eb" />
                          Revise Salary
                        </button>

                        {/* Payslip Button */}
                        <button
                          onClick={() => handleOpenPayslip(emp)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '7px',
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

      {/* Salary Revision & Compensation Modal */}
      <SalaryIncrementModal
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        employee={activeEmployeeForRevision}
        currentSalaryData={activeEmployeeForRevision ? salaryMap[activeEmployeeForRevision.employeeCode] : null}
        onSalaryUpdated={handleSalaryUpdated}
      />
    </div>
  );
};
