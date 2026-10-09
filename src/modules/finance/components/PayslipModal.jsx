import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Printer, Mail, CheckCircle2, ShieldCheck, Building2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
import { getCompanySettings } from '../../../shared/services/companySettingsService';

export const PayslipModal = ({ isOpen, onClose, employee, month = 'September 2026', salaryData }) => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [companyInfo, setCompanyInfo] = useState(getCompanySettings());

  useEffect(() => {
    const updateInfo = () => setCompanyInfo(getCompanySettings());
    window.addEventListener('company-settings-updated', updateInfo);
    return () => window.removeEventListener('company-settings-updated', updateInfo);
  }, []);

  if (!isOpen || !employee) return null;

  const basicSalary = salaryData?.basic || 45000;
  const hra = salaryData?.hra || 18000;
  const allowances = salaryData?.allowances || 12000;
  const bonus = salaryData?.bonus || 5000;
  const grossEarnings = basicSalary + hra + allowances + bonus;

  const pfDeduction = salaryData?.pf || 3600;
  const professionalTax = salaryData?.pt || 200;
  const tdsTax = salaryData?.tds || 2500;
  const totalDeductions = pfDeduction + professionalTax + tdsTax;

  const netSalary = grossEarnings - totalDeductions;

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    addToast({
      title: 'Payslip Dispatched via Email 📧',
      message: `Official Salary Slip for ${month} sent to ${employee.email || employee.name.toLowerCase() + '@company.com'} from ${companyInfo.hrEmail || companyInfo.email}`,
      type: 'success'
    });
  };

  const handleNavigateToCompanySettings = () => {
    onClose();
    navigate('/settings');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} color="#2563eb" />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Employee Salary Slip — {month}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleNavigateToCompanySettings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Change Company Name, Address & Branding"
            >
              <Settings size={13} />
              Edit Company Info
            </button>

            <button
              onClick={handleSendEmail}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Mail size={14} /> Send to Mail
            </button>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div ref={printRef} style={{ padding: '32px 36px', color: '#0f172a' }}>
          {/* Dynamic Company Title */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #2563eb',
            paddingBottom: '16px',
            marginBottom: '20px'
          }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1e3a8a', margin: 0, textTransform: 'uppercase' }}>
                {companyInfo.companyName || 'INFORAG TECHNOLOGY PVT. LTD.'}
              </h1>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                {companyInfo.address} • {companyInfo.hrEmail || companyInfo.email}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                PAYSLIP: {month.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Employee & Bank Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px',
            fontSize: '13px'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Employee Name:</span>
                <span style={{ fontWeight: '700' }}>{employee.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Employee Code:</span>
                <span style={{ fontWeight: '600' }}>{employee.employeeCode || 'EMP-001'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Designation:</span>
                <span style={{ fontWeight: '600' }}>{employee.role}</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Department:</span>
                <span style={{ fontWeight: '600' }}>{employee.department || 'Technology'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Bank A/C No:</span>
                <span style={{ fontWeight: '600' }}>XXXX-XXXX-4892</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Working Days:</span>
                <span style={{ fontWeight: '700', color: '#16a34a' }}>30 / 30 Days</span>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '24px'
          }}>
            {/* Earnings Column */}
            <div style={{ borderRight: '1px solid #cbd5e1' }}>
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#f1f5f9',
                fontWeight: '700',
                fontSize: '13px',
                borderBottom: '1px solid #cbd5e1',
                color: '#1e293b'
              }}>
                Earnings
              </div>
              <div style={{ padding: '12px 14px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Basic Salary</span>
                  <span style={{ fontWeight: '600' }}>₹{basicSalary.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>House Rent Allowance (HRA)</span>
                  <span style={{ fontWeight: '600' }}>₹{hra.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Special Allowance</span>
                  <span style={{ fontWeight: '600' }}>₹{allowances.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Performance Incentive</span>
                  <span style={{ fontWeight: '600' }}>₹{bonus.toLocaleString()}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '8px',
                  fontWeight: '700',
                  color: '#15803d'
                }}>
                  <span>Total Gross Earnings</span>
                  <span>₹{grossEarnings.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Deductions Column */}
            <div>
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#f1f5f9',
                fontWeight: '700',
                fontSize: '13px',
                borderBottom: '1px solid #cbd5e1',
                color: '#1e293b'
              }}>
                Deductions
              </div>
              <div style={{ padding: '12px 14px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Provident Fund (PF)</span>
                  <span style={{ fontWeight: '600' }}>₹{pfDeduction.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Professional Tax</span>
                  <span style={{ fontWeight: '600' }}>₹{professionalTax.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Income Tax (TDS)</span>
                  <span style={{ fontWeight: '600' }}>₹{tdsTax.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Other Deductions</span>
                  <span style={{ fontWeight: '600' }}>₹0</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '8px',
                  fontWeight: '700',
                  color: '#b91c1c'
                }}>
                  <span>Total Deductions</span>
                  <span>₹{totalDeductions.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary Banner */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                Net Take-Home Salary
              </span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#14532d' }}>
                ₹{netSalary.toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
              <CheckCircle2 size={18} />
              <span>Direct Bank Deposit Credited</span>
            </div>
          </div>

          {/* Authorization Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '20px',
            borderTop: '1px solid #e2e8f0',
            fontSize: '11px',
            color: '#64748b'
          }}>
            <div>
              <p style={{ margin: 0 }}>{companyInfo.footerNote || '* This is a computer-generated salary slip and does not require a physical signature.'}</p>
              <p style={{ margin: '3px 0 0 0' }}>Security Verified by {companyInfo.shortName || companyInfo.companyName} HRMS Portal.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '130px', borderBottom: '1px solid #94a3b8', marginBottom: '4px' }}></div>
              <span style={{ fontWeight: '700', color: '#334155' }}>{companyInfo.signatoryTitle || 'Authorized Signatory'}</span>
              {companyInfo.signatoryName && (
                <div style={{ fontSize: '10px', color: '#64748b' }}>({companyInfo.signatoryName})</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
