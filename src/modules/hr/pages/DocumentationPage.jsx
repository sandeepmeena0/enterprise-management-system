import React, { useState } from 'react';
import {
  FolderLock,
  Upload,
  Search,
  Filter,
  FileText,
  ShieldCheck,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useHR } from '../context/HRContext';
import { useToast } from '../../../shared/context/ToastContext';
import { UploadDocumentModal } from '../components/documents/UploadDocumentModal';

export const DocumentationPage = () => {
  const { employees } = useHR();
  const { addToast } = useToast();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [documents, setDocuments] = useState([
    {
      id: 'DOC-1',
      title: 'Aadhaar Card — Avinash',
      docType: 'Aadhaar Card',
      employeeName: 'Avinash',
      employeeCode: 'EMP-001',
      employeeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      department: 'Marketing & Growth',
      fileName: 'avinash_aadhaar_card_verified.pdf',
      fileSize: '1.8 MB',
      uploadDate: '2026-01-16',
      status: 'verified'
    },
    {
      id: 'DOC-2',
      title: 'Signed Offer Letter — Priya Sharma',
      docType: 'Offer Letter',
      employeeName: 'Priya Sharma',
      employeeCode: 'EMP-002',
      employeeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      department: 'Product Design',
      fileName: 'priya_offer_letter_signed.pdf',
      fileSize: '2.4 MB',
      uploadDate: '2026-03-02',
      status: 'verified'
    },
    {
      id: 'DOC-3',
      title: 'Experience & Relieving Letter — Rahul Verma',
      docType: 'Relieving / Experience Letter',
      employeeName: 'Rahul Verma',
      employeeCode: 'EMP-003',
      employeeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      department: 'Engineering',
      fileName: 'rahul_previous_company_relieving.pdf',
      fileSize: '3.1 MB',
      uploadDate: '2022-11-12',
      status: 'verified'
    },
    {
      id: 'DOC-4',
      title: 'PAN Card & Bank Cheque — Sneha Patel',
      docType: 'PAN Card',
      employeeName: 'Sneha Patel',
      employeeCode: 'EMP-004',
      employeeAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
      department: 'Human Resources',
      fileName: 'sneha_pan_card_copy.pdf',
      fileSize: '1.2 MB',
      uploadDate: '2023-05-22',
      status: 'verified'
    },
    {
      id: 'DOC-5',
      title: 'AWS Solutions Architect Certificate — Amit Kumar',
      docType: 'Educational Certificates',
      employeeName: 'Amit Kumar',
      employeeCode: 'EMP-005',
      employeeAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      department: 'Infrastructure',
      fileName: 'amit_aws_certified_certificate.pdf',
      fileSize: '2.9 MB',
      uploadDate: '2023-02-18',
      status: 'verified'
    }
  ]);

  const handleDocumentUploaded = (newDoc) => {
    setDocuments([newDoc, ...documents]);
  };

  const handleDownload = (doc) => {
    addToast({
      title: 'Download Started 📥',
      message: `Downloading ${doc.fileName} (${doc.fileSize})...`,
      type: 'info'
    });
  };

  const handleDelete = (docId) => {
    setDocuments(documents.filter(d => d.id !== docId));
    addToast({
      title: 'Document Removed 🗑️',
      message: 'Employee document removed from cloud storage.',
      type: 'success'
    });
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch =
      (doc.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.docType || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCat = selectedCategory === 'all' || doc.docType === selectedCategory;
    return matchesSearch && matchesCat;
  });

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
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Documentation & KYC Hub</span>
            <span>HR • Employee Records</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Secure repository for Aadhaar, PAN, Offer Letters, and onboarding compliance certificates.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
          }}
        >
          <Upload size={16} />
          Upload Document
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Total KYC Documents</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {documents.length} Files
          </div>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>100% Encrypted</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Verified Onboarding</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>
            {employees.length} / {employees.length} Complete
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Zero compliance backlog</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Storage Used</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
            11.4 MB
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>AWS S3 Cloud Active</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Filter / Search Bar */}
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
            width: '280px'
          }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search document or employee..."
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

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none'
            }}
          >
            <option value="all">All Document Types</option>
            <option value="Aadhaar Card">Aadhaar Card</option>
            <option value="PAN Card">PAN Card</option>
            <option value="Offer Letter">Offer Letter</option>
            <option value="Relieving / Experience Letter">Relieving Letter</option>
            <option value="Educational Certificates">Educational Certificates</option>
          </select>
        </div>

        {/* Documents Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '12px 18px' }}>Document Name</th>
                <th style={{ padding: '12px 18px' }}>Employee</th>
                <th style={{ padding: '12px 18px' }}>Type</th>
                <th style={{ padding: '12px 18px' }}>Size</th>
                <th style={{ padding: '12px 18px' }}>Upload Date</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr
                  key={doc.id}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{doc.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{doc.fileName}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={doc.employeeAvatar}
                        alt={doc.employeeName}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{doc.employeeName}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{doc.department}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#334155' }}>{doc.docType}</td>
                  <td style={{ padding: '14px 18px', color: '#64748b' }}>{doc.fileSize}</td>
                  <td style={{ padding: '14px 18px', color: '#64748b' }}>{doc.uploadDate}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontSize: '11.5px',
                      fontWeight: '700'
                    }}>
                      <CheckCircle size={13} />
                      Verified
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleDownload(doc)}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          color: '#2563eb',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Download Document"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          color: '#dc2626',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Delete Document"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDocumentUploaded={handleDocumentUploaded}
      />
    </div>
  );
};
