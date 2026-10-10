import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Zap,
  Users,
  Briefcase,
  User,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Building2
} from 'lucide-react';
import { useAuth, PRESET_USERS } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/context/ToastContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('admin@inforag.com');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const rolePresets = [
    {
      id: 'admin',
      title: 'Admin Portal',
      badge: '👑 Master Access',
      email: 'admin@inforag.com',
      desc: 'Full company oversight, project delegation, client pipeline, finance & global settings.',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.08)',
      border: '#3b82f6',
      icon: <ShieldCheck size={20} color="#2563eb" />
    },
    {
      id: 'hr',
      title: 'HR Operations',
      badge: '💼 Workforce Ops',
      email: 'hr@inforag.com',
      desc: 'Employee directory, attendance review, leave approvals, holidays & company announcements.',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.08)',
      border: '#0284c7',
      icon: <Briefcase size={20} color="#0284c7" />
    },
    {
      id: 'employee',
      title: 'Employee Portal',
      badge: '👤 Team Member',
      email: 'employee@inforag.com',
      desc: 'My tasks & live timer, daily shift attendance clocking, leave requests & timesheets.',
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.08)',
      border: '#16a34a',
      icon: <User size={20} color="#16a34a" />
    }
  ];

  const handleQuickPreset = (preset) => {
    setSelectedRole(preset.id);
    setEmail(preset.email);
    setPassword('••••••••');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      addToast('Please enter your work email', 'error');
      return;
    }

    setLoading(true);
    try {
      const user = await login({ email, password, role: selectedRole });
      addToast(`Welcome back, ${user.name}! Logged in as ${user.role || selectedRole.toUpperCase()}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      addToast('Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#0b132b',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.25) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.2) 0px, transparent 50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        overflow: 'hidden'
      }}>
        {/* Left Side: Enterprise Branding & 1-Click Role Selectors */}
        <div style={{
          backgroundColor: '#0f172a',
          padding: '40px 32px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            {/* Logo & Brand Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(37, 99, 235, 0.4)'
              }}>
                <Building2 size={24} color="#ffffff" />
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
                  INFORAG TECHNOLOGY
                </h1>
                <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '600' }}>
                  Enterprise Management System & CRM
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '28px' }}>
              Select a designated enterprise role below for rapid 1-click credential auto-fill or enter your custom account credentials.
            </p>

            {/* Quick 1-Click Role Preset Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rolePresets.map((preset) => {
                const isSelected = selectedRole === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleQuickPreset(preset)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? `2px solid ${preset.border}` : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {preset.icon}
                        <span style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                          {preset.title}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '700',
                        color: preset.color,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        padding: '2px 8px',
                        borderRadius: '20px'
                      }}>
                        {preset.badge}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                      {preset.desc}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#60a5fa' }}>
                      <code>{preset.email}</code>
                      {isSelected && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: '#38bdf8' }}>
                          <CheckCircle2 size={13} /> Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>© 2026 Inforag Management System</span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ● System Online
            </span>
          </div>
        </div>

        {/* Right Side: Clean Login Form */}
        <div style={{
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ marginBottom: '28px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '12px'
            }}>
              <Sparkles size={13} /> Secure Enterprise Authentication
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              Sign In to Your Workspace
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
              Access your role-specific dashboard, project tasks, and workforce records.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Work Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@inforag.com"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#f8fafc'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Password
                </label>
                <span style={{ fontSize: '12px', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }} onClick={() => addToast('Use any password or preset 1-click button', 'info')}>
                  Any password works
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#f8fafc'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Role Badge Indicator */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12.5px',
              color: '#475569'
            }}>
              <span>Target Role:</span>
              <strong style={{ color: '#2563eb', textTransform: 'capitalize' }}>
                {selectedRole === 'admin' ? '👑 Admin (Full Access)' : selectedRole === 'hr' ? '💼 HR Manager' : '👤 Employee (Self-Service)'}
              </strong>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '13px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as {selectedRole.toUpperCase()}</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
