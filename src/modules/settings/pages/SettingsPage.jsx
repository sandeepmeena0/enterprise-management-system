/**
 * @file SettingsPage.jsx
 * @description Master Settings section replicating Screenshots 6, 7, 8, 9.
 */

import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Phone,
  KeyRound,
  Bell
} from 'lucide-react';
import { ProfileTab } from '../components/ProfileTab';
import { EmergencyContactsTab } from '../components/EmergencyContactsTab';
import { SecuritySettingsTab } from '../components/SecuritySettingsTab';
import { useTimer } from '../../../shared/context/TimerContext';

export const SettingsPage = () => {
  const { timeString, isClockedIn, isOnBreak } = useTimer();
  const [activeSection, setActiveSection] = useState('profile'); // 'profile' | 'security'
  const [profileSubTab, setProfileSubTab] = useState('profile'); // 'profile' | 'emergency_contacts'
  const [searchMenu, setSearchMenu] = useState('');

  const menuItems = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'security', label: 'Security Settings', icon: ShieldCheck }
  ];

  const filteredMenuItems = menuItems.filter(item =>
    item.label.toLowerCase().includes(searchMenu.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* ── Top Header & Live Clock Matching Screenshots 6, 7, 8, 9 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>
              {activeSection === 'profile' ? 'Profile Settings' : 'Security Settings'}
            </span>
            <span>Home • Settings • {activeSection === 'profile' ? 'Profile Settings' : 'Security Settings'}</span>
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
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: !isClockedIn ? '#94a3b8' : isOnBreak ? '#f59e0b' : '#22c55e'
          }}></span>
          <span>{timeString || '00:00:00'}</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span style={{ color: '#3b82f6' }}>●</span>
        </div>
      </div>

      {/* ── Two-Column Settings Layout (Matching Screenshots 6 & 9) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '24px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        minHeight: '680px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        
        {/* ── Left Sidebar Menu ── */}
        <div style={{
          borderRight: '1px solid #f1f5f9',
          paddingRight: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Search Menu */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff'
          }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search"
              value={searchMenu}
              onChange={e => setSearchMenu(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '12.5px',
                width: '100%',
                backgroundColor: 'transparent'
              }}
            />
          </div>

          {/* Navigation Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#f1f5f9' : 'transparent',
                    color: isActive ? '#0f172a' : '#64748b',
                    fontSize: '13.5px',
                    fontWeight: isActive ? '700' : '500',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent'
                  }}
                >
                  <Icon size={16} color={isActive ? '#2563eb' : '#64748b'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Content Area ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* Section: Profile Settings */}
          {activeSection === 'profile' && (
            <div>
              {/* Profile Sub-tabs (Profile | Emergency Contacts) Matching Screenshot 8 & 9 */}
              <div style={{
                display: 'flex',
                gap: '28px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '2px'
              }}>
                <button
                  onClick={() => setProfileSubTab('profile')}
                  style={{
                    background: 'none',
                    border: 'none',
                    paddingBottom: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: profileSubTab === 'profile' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    borderBottom: profileSubTab === 'profile' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Profile
                </button>

                <button
                  onClick={() => setProfileSubTab('emergency_contacts')}
                  style={{
                    background: 'none',
                    border: 'none',
                    paddingBottom: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: profileSubTab === 'emergency_contacts' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    borderBottom: profileSubTab === 'emergency_contacts' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Emergency Contacts
                </button>
              </div>

              {/* Sub-tab Contents */}
              {profileSubTab === 'profile' ? (
                <ProfileTab />
              ) : (
                <EmergencyContactsTab />
              )}
            </div>
          )}

          {/* Section: Security Settings */}
          {activeSection === 'security' && (
            <div>
              <SecuritySettingsTab />
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
