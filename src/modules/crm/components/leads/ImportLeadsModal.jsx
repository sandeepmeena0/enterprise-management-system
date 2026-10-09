/**
 * @file ImportLeadsModal.jsx
 * @description Modal allowing users to import leads from CSV/Excel files with live table preview and row validation.
 */

import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Trash2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useCRM } from '../../../../shared/context/CRMContext';
import { useToast } from '../../../../shared/context/ToastContext';

export const ImportLeadsModal = ({ isOpen, onClose }) => {
  const { importLeadsBatch } = useCRM();
  const { addToast } = useToast();

  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  // Sample CSV Template Download
  const handleDownloadSample = () => {
    const headers = ['Contact Name', 'Company Name', 'Work Email', 'Phone Number', 'Lead Type', 'Priority', 'Deal Value', 'Notes'];
    const sampleRows = [
      ['Alexander Wright', 'Wright Technologies Ltd', 'a.wright@wright-tech.com', '+44 20 7946 0888', 'Enterprise', 'high', '650000', 'Inquiry for 100 employee licenses'],
      ['Deepa Nair', 'Nair Cloud Innovations', 'deepa.nair@naircloud.in', '+91 98450 11223', 'Inbound Web', 'medium', '420000', 'Requested demo of payroll & task board'],
      ['Marcus Vance', 'Vance Capital Partners', 'marcus@vancecapital.com', '+1 (415) 555-0143', 'Referral', 'urgent', '1250000', 'Enterprise contract negotiation']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Sample_Leads_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Sample Leads CSV downloaded', 'info');
  };

  // Parse CSV text into array of lead objects
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);

        if (lines.length < 2) {
          alert('CSV file is empty or does not contain header and data rows.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
        const dataRows = [];

        for (let i = 1; i < lines.length; i++) {
          // Simple CSV line splitter accounting for quotes
          const rawRow = lines[i];
          const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
          const matches = [];
          let match;
          while ((match = regex.exec(rawRow)) !== null) {
            let val = match[1] || '';
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            matches.push(val.trim());
            if (regex.lastIndex === match.index) regex.lastIndex++;
          }

          // Fallback simple split if regex produced empty array
          const cells = matches.length > 1 ? matches.filter((_, idx) => idx < headers.length) : rawRow.split(',').map(c => c.replace(/["']/g, '').trim());

          const rowObj = {};
          headers.forEach((header, idx) => {
            rowObj[header] = cells[idx] || '';
          });

          // Map headers to CRM Lead properties
          const name = rowObj['contact name'] || rowObj['name'] || rowObj['lead name'] || rowObj['contact'] || '';
          const companyName = rowObj['company name'] || rowObj['company'] || rowObj['client'] || '';
          const email = rowObj['work email'] || rowObj['email'] || rowObj['email address'] || '';
          const phone = rowObj['phone number'] || rowObj['phone'] || rowObj['mobile'] || '';
          const leadType = rowObj['lead type'] || rowObj['category'] || rowObj['type'] || 'Inbound Web';
          const priority = (rowObj['priority'] || 'medium').toLowerCase();
          const dealValue = Number(rowObj['deal value'] || rowObj['value'] || rowObj['amount'] || 0);
          const notes = rowObj['notes'] || rowObj['description'] || '';

          // Validation
          const errors = [];
          if (!name) errors.push('Missing Lead / Contact Name');
          if (!email) errors.push('Missing Work Email');
          else if (!email.includes('@')) errors.push('Invalid Email format');

          dataRows.push({
            id: i,
            name,
            contactPerson: name,
            companyName: companyName || name,
            client: companyName || name,
            email,
            phone,
            leadType,
            priority: ['urgent', 'high', 'medium', 'low'].includes(priority) ? priority : 'medium',
            dealValue,
            notes,
            isValid: errors.length === 0,
            errors
          });
        }

        setParsedRows(dataRows);
      } catch (err) {
        console.error('Error parsing CSV:', err);
        alert('Failed to parse file. Please verify CSV format.');
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid lead rows to import. Please check validation errors in the preview table.');
      return;
    }

    try {
      setImporting(true);
      await importLeadsBatch(validRows);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

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
        maxWidth: '780px',
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
                <FileSpreadsheet size={18} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Import Leads from CSV / Excel
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 40px' }}>
              Upload your spreadsheet file to batch import prospect records with preview & validation
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

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Upload Area & Sample Downloader */}
          <div style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={24} />
            </div>

            <div>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
              }}>
                <Upload size={15} />
                Select CSV or Excel File
                <input
                  type="file"
                  accept=".csv, text/csv, .txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Supports standard comma-separated `.csv` and text files
              </div>
            </div>

            <div style={{ height: '1px', width: '100%', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                Don't have a file ready? Download our official format:
              </span>
              <button
                type="button"
                onClick={handleDownloadSample}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#2563eb',
                  cursor: 'pointer'
                }}
              >
                <Download size={13} />
                Download Sample CSV Template
              </button>
            </div>
          </div>

          {/* Uploaded File Stats & Validation Summary */}
          {parsedRows.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f1f5f9',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  📄 File: {fileName}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                  ({parsedRows.length} total rows parsed)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#16a34a',
                  backgroundColor: '#dcfce7',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  <CheckCircle2 size={13} />
                  {validCount} Ready to Import
                </span>

                {invalidCount > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#dc2626',
                    backgroundColor: '#fee2e2',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    <AlertTriangle size={13} />
                    {invalidCount} Needs Fix
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Live Data Preview & Row Validation:
              </div>
              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', width: '30px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Contact Name</th>
                      <th style={{ padding: '8px 10px' }}>Company</th>
                      <th style={{ padding: '8px 10px' }}>Work Email</th>
                      <th style={{ padding: '8px 10px' }}>Phone</th>
                      <th style={{ padding: '8px 10px' }}>Category</th>
                      <th style={{ padding: '8px 10px' }}>Deal Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: row.isValid ? '#ffffff' : '#fff5f5'
                        }}
                      >
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {row.isValid ? (
                            <CheckCircle2 size={14} color="#16a34a" />
                          ) : (
                            <span title={row.errors.join(', ')} style={{ cursor: 'help' }}>
                              <AlertTriangle size={14} color="#dc2626" />
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '600', color: row.name ? '#0f172a' : '#dc2626' }}>
                          {row.name || '⚠️ Missing'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {row.companyName || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: row.email ? '#2563eb' : '#dc2626' }}>
                          {row.email || '⚠️ Missing'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {row.phone || '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '1px 6px', background: '#f1f5f9', borderRadius: '4px', fontSize: '10.5px' }}>
                            {row.leadType}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '600', color: '#16a34a' }}>
                          ₹{row.dealValue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
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
              disabled={importing}
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
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || validCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: validCount > 0 ? '#16a34a' : '#94a3b8',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: validCount > 0 ? 'pointer' : 'not-allowed',
                boxShadow: validCount > 0 ? '0 2px 6px rgba(22,163,74,0.3)' : 'none'
              }}
            >
              <CheckCircle2 size={16} />
              {importing ? 'Importing Leads...' : `Confirm Import (${validCount} Leads)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
