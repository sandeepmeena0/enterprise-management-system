/**
 * @file StickyNotesModal.jsx
 * @description Interactive Sticky Notes drawer & manager for quick personal work notes.
 */

import React, { useState } from 'react';
import {
  X,
  Plus,
  Pin,
  Trash2,
  CheckCircle2,
  Circle,
  Edit2,
  Sparkles,
  FileText
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

const NOTE_COLORS = [
  { name: 'Yellow', bg: '#fef08a', border: '#fde047' },
  { name: 'Blue', bg: '#bfdbfe', border: '#93c5fd' },
  { name: 'Green', bg: '#bbf7d0', border: '#86efac' },
  { name: 'Pink', bg: '#fbcfe8', border: '#f472b6' },
  { name: 'Purple', bg: '#e9d5ff', border: '#c084fc' },
  { name: 'Orange', bg: '#fed7aa', border: '#fb923c' }
];

export const StickyNotesModal = ({ isOpen, onClose }) => {
  const {
    stickyNotes,
    createStickyNote,
    updateStickyNote,
    deleteStickyNote,
    togglePinStickyNote,
    toggleCompleteStickyNote
  } = useCRM();

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState(NOTE_COLORS[0].bg);
  const [editingNoteId, setEditingNoteId] = useState(null);

  if (!isOpen) return null;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim()) return;
    createStickyNote({
      title: newTitle.trim() || 'Quick Note',
      content: newContent.trim(),
      color: newColor,
      isPinned: false
    });
    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  const sortedNotes = [...(stickyNotes || [])].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        height: '100vh',
        backgroundColor: '#ffffff',
        boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #e2e8f0'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📝</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Sticky Notes
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Your personal work notes, checklists, and reminders
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsCreating(!isCreating)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> {isCreating ? 'Cancel' : 'New Note'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleCreate} style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: newColor,
              border: '1px solid rgba(0,0,0,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <input
                type="text"
                placeholder="Note Title..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
              <textarea
                rows={3}
                placeholder="Take a note..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  color: '#334155',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />

              {/* Color selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {NOTE_COLORS.map(c => (
                    <div
                      key={c.name}
                      onClick={() => setNewColor(c.bg)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: c.bg,
                        border: newColor === c.bg ? '2px solid #0f172a' : `1px solid ${c.border}`,
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Add Note
                </button>
              </div>
            </form>
          )}

          {/* Notes Grid */}
          {sortedNotes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedNotes.map(note => (
                <div
                  key={note._id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: note.color || '#fef08a',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    opacity: note.isCompleted ? 0.65 : 1,
                    textDecoration: note.isCompleted ? 'line-through' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                      {note.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => togglePinStickyNote(note._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: note.isPinned ? '#d97706' : '#64748b',
                          padding: '2px'
                        }}
                        title={note.isPinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Pin size={14} fill={note.isPinned ? '#d97706' : 'none'} />
                      </button>
                      <button
                        onClick={() => toggleCompleteStickyNote(note._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: note.isCompleted ? '#16a34a' : '#64748b',
                          padding: '2px'
                        }}
                        title="Mark complete"
                      >
                        <CheckCircle2 size={15} fill={note.isCompleted ? '#16a34a' : 'none'} color={note.isCompleted ? '#ffffff' : '#64748b'} />
                      </button>
                      <button
                        onClick={() => deleteStickyNote(note._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
                          padding: '2px'
                        }}
                        title="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#334155',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.4'
                  }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <FileText size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: '600' }}>No Sticky Notes Yet</div>
              <p style={{ fontSize: '12.5px', marginTop: '4px' }}>Click "+ New Note" above to write quick reminders.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
