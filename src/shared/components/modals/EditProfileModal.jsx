/**
 * @file EditProfileModal.jsx
 * @description Modal allowing employee to edit and update their profile details.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Briefcase,
  Phone,
  Building,
  Camera,
  Check,
  Sparkles
} from 'lucide-react';
import { useHR } from '../../../modules/hr/context/HRContext';
import { useCRM } from '../../context/CRMContext';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80'
];

export const EditProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, updateEmployee } = useHR();
  const { updateUserProfile } = useCRM();

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    dob: '',
    avatar: '',
    bio: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Sync form data whenever currentUser or modal open state changes
  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || 'Avinash',
        role: currentUser.role || 'Digital Marketing Strategic',
        department: currentUser.department || 'Marketing & Growth',
        email: currentUser.email || 'avinash@company.com',
        phone: currentUser.phone || '+91 98765 43210',
        dob: currentUser.dob || '1998-10-15',
        avatar: currentUser.avatar || PRESET_AVATARS[0],
        bio: currentUser.bio || 'Passionate about organic growth strategies, SEO optimization, and digital campaign execution.'
      });
      setCustomAvatarUrl(currentUser.avatar || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle local image file upload (Base64)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size exceeds 2MB limit. Please choose a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        handleChange('avatar', base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (currentUser?._id) {
        await updateEmployee(currentUser._id, formData);
      } else {
        await updateUserProfile(formData);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

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
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Edit Employee Profile
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              Update your photo, designation, and bio — updates immediately across all screens!
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Avatar selection */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              📸 Profile Picture & Avatar
            </label>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={formData.avatar || PRESET_AVATARS[0]}
                  alt="Selected Avatar"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    objectFit: 'cover',
                    border: '3px solid #2563eb',
                    boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                {/* File Upload Button */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <Camera size={14} color="#2563eb" />
                    Upload from Device
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {showUrlInput ? 'Hide URL' : 'Paste URL'}
                  </button>
                </div>

                {showUrlInput && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={customAvatarUrl}
                      onChange={(e) => setCustomAvatarUrl(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customAvatarUrl) handleChange('avatar', customAvatarUrl);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Preset Avatars */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Presets:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {PRESET_AVATARS.map((av, idx) => (
                      <img
                        key={idx}
                        src={av}
                        alt={`Avatar ${idx}`}
                        onClick={() => handleChange('avatar', av)}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          border: formData.avatar === av ? '2px solid #2563eb' : '1.5px solid transparent',
                          opacity: formData.avatar === av ? 1 : 0.65,
                          transform: formData.avatar === av ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.15s'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Name & Designation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Designation *
              </label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={e => handleChange('role', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Department & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={e => handleChange('department', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Phone Number & Date of Birth (Auto Birthday Events Engine) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                🎂 Date of Birth (Auto-creates Birthday Event)
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={e => handleChange('dob', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              About / Bio
            </label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={e => handleChange('bio', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Check size={16} />
              {submitting ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
