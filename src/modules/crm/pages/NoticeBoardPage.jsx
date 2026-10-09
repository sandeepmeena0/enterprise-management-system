/**
 * @file NoticeBoardPage.jsx
 * @description Company-wide Notice Board module matching Screenshot 5 exactly.
 */

import React, { useState, useMemo } from 'react';
import {
  BellRing,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';
import { useCRM } from '../../../shared/context/CRMContext';
import { useToast } from '../../../shared/context/ToastContext';
import { AddNoticeModal } from '../../../shared/components/modals/AddNoticeModal';

export const NoticeBoardPage = () => {
  const { notices, deleteNotice } = useCRM();
  const { addToast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.description || '').toLowerCase().includes(q) ||
        (n.shortDescription || '').toLowerCase().includes(q) ||
        (n.to || '').toLowerCase().includes(q);

      let matchesDate = true;
      if (startDateFilter && n.date && n.date < startDateFilter) matchesDate = false;
      if (endDateFilter && n.date && n.date > endDateFilter) matchesDate = false;

      return matchesSearch && matchesDate;
    });
  }, [notices, search, startDateFilter, endDateFilter]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredNotices.map(item => item._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    if (filteredNotices.length === 0) {
      alert('No notices available to export');
      return;
    }

    const headers = ['Notice Title,Date,To,Priority,Posted By,Description'];
    const rows = filteredNotices.map(n =>
      `"${(n.title || '').replace(/"/g, '""')}","${n.date || ''}","${n.to || n.targetAudience || 'All Employees'}","${n.priority || 'Normal'}","${n.postedBy || n.createdBy || ''}","${(n.description || n.fullContent || '').replace(/"/g, '""')}"`
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `notice_board_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Notices exported successfully to CSV!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header Matching Screenshot 5 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Notice Board</span>
            <span>Home • Notice Board</span>
          </div>
        </div>

        {/* Live Work Clock */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          fontSize: '13px',
          fontWeight: '700',
          color: '#0f172a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
          <span>02:19:55</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span style={{ color: '#3b82f6' }}>●</span>
        </div>
      </div>

      {/* Filter and Top Navigation Bar Matching Screenshot 5 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span style={{ fontWeight: '600' }}>Duration</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '12.5px'
            }}>
              <input
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#334155' }}
              />
              <span>To</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#334155' }}
              />
            </div>
          </div>

          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            minWidth: '240px'
          }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Start typing to search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '12.5px',
                width: '100%',
                backgroundColor: 'transparent',
                color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Action Buttons: Export & + Add Notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
            }}
          >
            <Plus size={16} />
            Publish Notice
          </button>
        </div>
      </div>

      {/* Action Bar with Export Button Matching Screenshot 5 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleExport}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            color: '#2563eb',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Download size={15} />
          Export
        </button>
      </div>

      {/* Notice Board Table Matching Screenshot 5 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                color: '#64748b',
                fontWeight: '600',
                textAlign: 'left'
              }}>
                <th style={{ padding: '12px 14px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredNotices.length > 0 && selectedIds.length === filteredNotices.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px' }}>Notice</th>
                <th style={{ padding: '12px 14px', width: '140px' }}>Date</th>
                <th style={{ padding: '12px 14px', width: '180px' }}>To</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>No data available in table</div>
                  </td>
                </tr>
              ) : (
                filteredNotices.map(notice => (
                  <tr
                    key={notice._id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: selectedIds.includes(notice._id) ? 'rgba(37,99,235,0.04)' : '#ffffff',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '12px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notice._id)}
                        onChange={() => handleSelectOne(notice._id)}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </td>

                    {/* Notice Subject & Preview */}
                    <td style={{ padding: '12px 14px' }}>
                      <div
                        onClick={() => setSelectedNotice(notice)}
                        style={{ fontWeight: '700', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {notice.title}
                        {notice.isImportant && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c'
                          }}>
                            URGENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {notice.description || notice.shortDescription || notice.fullContent}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: '500' }}>
                      {notice.date}
                    </td>

                    {/* To */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {notice.to || notice.targetAudience || 'All Employees'}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedNotice(notice)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}
                      >
                        View Notice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Matching Screenshot 5 */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12.5px',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Show</span>
            <select style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '12px'
            }}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>entries</span>
          </div>

          <div>
            Showing 1 to {filteredNotices.length} of {notices.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Previous
            </button>
            <button
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              1
            </button>
            <button
              disabled
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'not-allowed'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddNoticeModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            maxWidth: '560px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb'
                }}>
                  {selectedNotice.category || 'Company Notice'}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Posted on {selectedNotice.date}
                </span>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
              {selectedNotice.title}
            </h3>

            <div style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              fontSize: '13.5px',
              color: '#1e293b',
              lineHeight: '1.6',
              border: '1px solid #e2e8f0',
              marginBottom: '18px',
              whiteSpace: 'pre-wrap'
            }}>
              {selectedNotice.description || selectedNotice.fullContent || selectedNotice.shortDescription}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
              <span>Target: <strong>{selectedNotice.to || 'All Employees'}</strong></span>
              <button
                onClick={() => {
                  deleteNotice(selectedNotice._id);
                  setSelectedNotice(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fee2e2',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                <Trash2 size={13} />
                Delete Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
