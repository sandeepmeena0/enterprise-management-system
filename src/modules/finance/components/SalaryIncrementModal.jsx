import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Percent,
  DollarSign,
  Calendar,
  Award,
  FileCheck,
  Printer,
  Mail,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2
} from 'lucide-react';
import { useToast } from '../../../shared/context/ToastContext';
import { getCompanySettings } from '../../../shared/services/companySettingsService';

export const SalaryIncrementModal = ({ isOpen, onClose, employee, currentSalaryData, onSalaryUpdated }) => {
  const { addToast } = useToast();

  const [companyInfo, setCompanyInfo] = useState(getCompanySettings());

  useEffect(() => {
    const updateInfo = () => setCompanyInfo(getCompanySettings());
    window.addEventListener('company-settings-updated', updateInfo);
    return () => window.removeEventListener('company-settings-updated', updateInfo);
  }, []);

  const [mode, setMode] = useState('fixed'); // 'fixed' | 'percentage'
  const [percentageValue, setPercentageValue] = useState(15);
  const [targetFixedSalary, setTargetFixedSalary] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Annual Performance Appraisal');
  const [remarks, setRemarks] = useState('');
  const [showLetterPreview, setShowLetterPreview] = useState(false);

  const oldBasic = currentSalaryData?.basic || 45000;
  const oldHra = currentSalaryData?.hra || 18000;
  const oldAllowances = currentSalaryData?.allowances || 12000;
  const oldBonus = currentSalaryData?.bonus || 0;
  const oldGrossMonthly = oldBasic + oldHra + oldAllowances + oldBonus;

  useEffect(() => {
    if (employee && currentSalaryData) {
      setTargetFixedSalary(oldGrossMonthly + 5000);
    }
  }, [employee, currentSalaryData, oldGrossMonthly]);

  if (!isOpen || !employee) return null;

  // Calculate new salary based on selected mode
  let newGrossMonthly = oldGrossMonthly;
  let hikeAmount = 0;
  let hikePercentage = 0;

  if (mode === 'percentage') {
    hikePercentage = Number(percentageValue) || 0;
    hikeAmount = Math.round((oldGrossMonthly * hikePercentage) / 100);
    newGrossMonthly = oldGrossMonthly + hikeAmount;
  } else {
    newGrossMonthly = Number(targetFixedSalary) || oldGrossMonthly;
    hikeAmount = Math.max(0, newGrossMonthly - oldGrossMonthly);
    hikePercentage = oldGrossMonthly > 0 ? Number(((hikeAmount / oldGrossMonthly) * 100).toFixed(1)) : 0;
  }

  // Auto split new salary breakdown
  const newBasic = Math.round(newGrossMonthly * 0.50);
  const newHra = Math.round(newBasic * 0.40);
  const newAllowances = Math.max(0, newGrossMonthly - newBasic - newHra);
  const newPf = Math.round(newBasic * 0.08);
  const newPt = 200;
  const newTds = newGrossMonthly > 50000 ? Math.round(newGrossMonthly * 0.05) : 0;

  const handleSubmitHike = (e) => {
    e.preventDefault();

    const updatedSalaryObject = {
      basic: newBasic,
      hra: newHra,
      allowances: newAllowances,
      bonus: 0,
      pf: newPf,
      pt: newPt,
      tds: newTds,
      lastHikeDate: effectiveDate,
      lastHikePercentage: hikePercentage,
      lastHikeAmount: hikeAmount,
      reason,
      remarks
    };

    onSalaryUpdated(employee.employeeCode, updatedSalaryObject);

    addToast({
      title: 'Salary Hike Applied Successfully! 📈',
      message: `${employee.name}'s salary revised from ₹${oldGrossMonthly.toLocaleString()} to ₹${newGrossMonthly.toLocaleString()} (+${hikePercentage}%).`,
      type: 'success'
    });

    onClose();
  };

  const handlePrintLetter = () => {
    window.print();
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
        maxWidth: '680px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Top Bar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Salary Increment & Appraisal Engine
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                Revise compensation via fixed amount or percentage hike with instant payslip recalculation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Employee Info Header */}
        <div style={{
          padding: '14px 24px',
          backgroundColor: '#eff6ff',
          borderBottom: '1px solid #dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={employee.name}
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>{employee.name}</div>
              <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                {employee.role} • {employee.employeeCode} • {employee.department}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Current Monthly CTC</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              ₹{oldGrossMonthly.toLocaleString()}
            </div>
          </div>
        </div>

        {!showLetterPreview ? (
          /* Main Configuration Form */
          <form onSubmit={handleSubmitHike} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Hike Mode Selector Tabs */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                Choose Increment Method
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                borderRadius: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setMode('fixed')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '9px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: mode === 'fixed' ? '#2563eb' : 'transparent',
                    color: mode === 'fixed' ? '#ffffff' : '#64748b',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <DollarSign size={16} /> Direct Amount (e.g. ₹15k ➔ ₹20k)
                </button>

                <button
                  type="button"
                  onClick={() => setMode('percentage')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '9px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: mode === 'percentage' ? '#2563eb' : 'transparent',
                    color: mode === 'percentage' ? '#ffffff' : '#64748b',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Percent size={15} /> Percentage Hike (%)
                </button>
              </div>
            </div>

            {/* Input Based on Mode */}
            {mode === 'fixed' ? (
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  New Monthly Gross Salary (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: '700', color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    value={targetFixedSalary}
                    onChange={e => setTargetFixedSalary(Number(e.target.value))}
                    min={oldGrossMonthly}
                    step="500"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 30px',
                      borderRadius: '8px',
                      border: '1.5px solid #3b82f6',
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#0f172a',
                      outline: 'none',
                      backgroundColor: '#f8fafc'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[2000, 5000, 10000, 15000].map(addAmt => (
                    <button
                      key={addAmt}
                      type="button"
                      onClick={() => setTargetFixedSalary(oldGrossMonthly + addAmt)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      +₹{addAmt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Hike Percentage (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={percentageValue}
                    onChange={e => setPercentageValue(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#2563eb' }}
                  />
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    fontWeight: '800',
                    fontSize: '16px',
                    minWidth: '65px',
                    textAlign: 'center'
                  }}>
                    {percentageValue}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[10, 15, 20, 25, 30, 40].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPercentageValue(p)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: percentageValue === p ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: percentageValue === p ? '#eff6ff' : '#ffffff',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: percentageValue === p ? '#2563eb' : '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Comparison Box */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                  Current Salary
                </span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#334155' }}>
                  ₹{oldGrossMonthly.toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                <ArrowRight size={20} />
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#dcfce7',
                  fontSize: '12px',
                  fontWeight: '800'
                }}>
                  +{hikePercentage}% (₹{hikeAmount.toLocaleString()})
                </span>
                <ArrowRight size={20} />
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                  Revised New Salary
                </span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#15803d' }}>
                  ₹{newGrossMonthly.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Revised Salary Breakdown Details */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12.5px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Basic Pay (50%):</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>₹{newBasic.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>HRA (40% Basic):</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>₹{newHra.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Special Allowances:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>₹{newAllowances.toLocaleString()}</div>
              </div>
            </div>

            {/* Appraisal Reason & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Appraisal Reason
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="Annual Performance Appraisal">Annual Performance Appraisal</option>
                  <option value="Promotion & Role Upgrade">Promotion & Role Upgrade</option>
                  <option value="Probation Confirmation">Probation Confirmation</option>
                  <option value="Market Benchmarking / Correction">Market Benchmarking / Correction</option>
                  <option value="Retention & Key Performer Bonus">Retention & Key Performer Bonus</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Effective Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            </div>

            {/* Management Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                HR / Leadership Remarks
              </label>
              <textarea
                placeholder="e.g. Promoted to Senior Lead based on exceptional Q3 campaign delivery and team mentorship."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            {/* Bottom Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '16px'
            }}>
              <button
                type="button"
                onClick={() => setShowLetterPreview(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <FileCheck size={16} />
                Preview Appraisal Letter
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 16px',
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <CheckCircle2 size={16} />
                  Apply Salary Hike
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Official Appraisal Letter Preview */
          <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              border: '2px solid #2563eb',
              borderRadius: '12px',
              padding: '24px 30px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
            }}>
              {/* Letter Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '2px solid #2563eb',
                paddingBottom: '14px',
                marginBottom: '18px'
              }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a8a', margin: 0, textTransform: 'uppercase' }}>
                    {companyInfo.companyName || 'INFORAG TECHNOLOGY PVT. LTD.'}
                  </h2>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                    {companyInfo.address} • {companyInfo.hrEmail || companyInfo.email}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Date: {new Date().toLocaleDateString()}</span>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>Ref: {companyInfo.shortName?.slice(0, 3).toUpperCase() || 'EMS'}/HR-APPRAISAL/{employee.employeeCode}</div>
                </div>
              </div>

              {/* Salutation */}
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' }}>
                Dear {employee.name},
              </p>

              <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px 0' }}>
                We take immense pleasure in informing you that in recognition of your dedicated contributions, professionalism, and performance, the Management has approved a salary increment effective from <strong>{effectiveDate}</strong>.
              </p>

              {/* Revised Salary Table */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '16px',
                fontSize: '12.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Previous Monthly CTC:</span>
                  <span style={{ fontWeight: '600' }}>₹{oldGrossMonthly.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#16a34a', fontWeight: '700' }}>
                  <span>Increment Percentage:</span>
                  <span>+{hikePercentage}% (+₹{hikeAmount.toLocaleString()})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', fontWeight: '800', color: '#1e3a8a', fontSize: '14px' }}>
                  <span>Revised Monthly CTC:</span>
                  <span>₹{newGrossMonthly.toLocaleString()} / month</span>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 18px 0' }}>
                {remarks || 'We look forward to your continued dedication, leadership, and success as we scale new milestones together.'}
              </p>

              {/* Signature */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{companyInfo.signatoryTitle || 'Authorized HR Directorate'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{companyInfo.companyName || 'Inforag Technology Pvt. Ltd.'}</div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  ✅ Digitally Verified
                </div>
              </div>
            </div>

            {/* Letter Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowLetterPreview(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ← Back to Config
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePrintLetter}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} /> Print Appraisal Letter
                </button>
                <button
                  type="button"
                  onClick={handleSubmitHike}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <CheckCircle2 size={15} /> Confirm & Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
