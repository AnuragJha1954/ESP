import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import { useAppState } from './StateContext';
import { getRiskDisclosureStatus } from './services/complianceService';

export default function Profile() {
  const navigate = useNavigate();
  const { user, authToken, logout, theme, setTheme, toggleTheme, killSwitchScope, setKillSwitchScope, broker } = useAppState();

  // Password Update Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ type: '', msg: '' });

  // Compliance Status
  const [complianceStatus] = useState(getRiskDisclosureStatus());

  // Bound Device State
  const [boundDeviceId, setBoundDeviceId] = useState(user?.bound_device_id || null);

  useEffect(() => {
    if (!authToken) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/device/status', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.readiness) {
          if (data.readiness.checks?.device_bound && data.readiness.device_id) {
            setBoundDeviceId(data.readiness.device_id);
          } else {
            setBoundDeviceId(null);
          }
        }
      } catch (e) {}
    };
    fetchStatus();
  }, [authToken]);

  // DPDP Act 2023 Erasure Request State
  const [deletionRequest, setDeletionRequest] = useState(null);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('Account closure / no longer trading');
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);
  const [deletionStatusMsg, setDeletionStatusMsg] = useState({ type: '', text: '' });

  // Fetch active deletion request status
  useEffect(() => {
    if (!authToken) return;
    const fetchDeletionStatus = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/deletion-request', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.request && data.request.status === 'PENDING') {
          setDeletionRequest(data.request);
        } else {
          setDeletionRequest(null);
        }
      } catch (err) {}
    };
    fetchDeletionStatus();
  }, [authToken]);

  const handleSubmitDeletionRequest = async (e) => {
    e.preventDefault();
    if (!deletionConfirmed) {
      setDeletionStatusMsg({ type: 'error', text: 'Please check the box confirming you understand that data erasure is permanent.' });
      return;
    }
    setDeletionSubmitting(true);
    setDeletionStatusMsg({ type: '', text: '' });
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/deletion-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ reason: deletionReason })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeletionRequest(data.request || { status: 'PENDING', reason: deletionReason, requested_at: new Date().toISOString() });
        setDeletionModalOpen(false);
        setDeletionStatusMsg({ type: 'success', text: 'Deletion request submitted under DPDP Act. Awaiting Data Protection Officer approval.' });
      } else {
        setDeletionStatusMsg({ type: 'error', text: data.message || 'Failed to submit request' });
      }
    } catch (err) {
      setDeletionStatusMsg({ type: 'error', text: 'Network connection failed' });
    } finally {
      setDeletionSubmitting(false);
    }
  };

  const handleWithdrawDeletionRequest = async () => {
    if (!window.confirm('Withdraw your account deletion request? Your account and credentials will remain active.')) return;
    setDeletionSubmitting(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/deletion-request', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeletionRequest(null);
        setDeletionStatusMsg({ type: 'success', text: 'Deletion request successfully withdrawn.' });
      } else {
        setDeletionStatusMsg({ type: 'error', text: data.message || 'Failed to withdraw request' });
      }
    } catch (err) {
      setDeletionStatusMsg({ type: 'error', text: 'Network connection failed' });
    } finally {
      setDeletionSubmitting(false);
    }
  };

  // Password Change Handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', msg: '' });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', msg: 'Password must be at least 6 characters' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPasswordStatus({ type: 'success', msg: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', msg: data.message || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', msg: 'Network error occurred while updating password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="app">
      {/* 1. Header & Moving Market Ticker */}
      <NavBar />

      {/* 2. Page Heading */}
      <section className="page-head">
        <div>
          <span className="pill-linked" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'rgba(15, 157, 106, 0.22)' }}>
            <span className="live"></span>
            Profile Verified
          </span>
          <h1>Settings &amp; Account</h1>
          <p className="subtitle">
            Trader Profile, Paired Hardware Console &amp; Security
          </p>
        </div>

        <button 
          className="btn-danger" 
          onClick={() => {
            if (window.confirm('Sign out of your Tradopad console?')) {
              logout();
              navigate('/login');
            }
          }}
          aria-label="Sign out"
          style={{ height: '40px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </section>

      {/* 3. Main Stack */}
      <main className="stack">

        {/* CARD 1: Mobile User Profile Identity & Node Binding */}
        <section className="card">
          {/* User Profile Hero Header (Native Mobile App Style) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--line)'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7B5BF0 0%, #4338ca 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '700 18px/1 var(--font)',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(123, 91, 240, 0.4)',
              flexShrink: 0
            }}>
              {(user?.username || 'admin').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ font: '700 17px/1.2 var(--font)', color: 'var(--text)' }}>
                  @{user?.username || 'admin'}
                </span>
                <span className="pill-linked" style={{ background: 'var(--green-soft)', color: 'var(--green)', height: '22px', fontSize: '11px', padding: '0 8px' }}>
                  <span className="live"></span>
                  Active Operator
                </span>
              </div>
              <div style={{ font: '400 13px/1.4 var(--font)', color: 'var(--text-2)', marginTop: '2px', wordBreak: 'break-all' }}>
                {user?.email || 'admin@tradopad.local'}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '16px' }}>
            <div className="tile">
              <span className="tile-label">Trader Handle</span>
              <div className="tile-value">@{user?.username || 'admin'}</div>
              <div className="tile-meta">Primary Operator</div>
            </div>

            <div className="tile">
              <span className="tile-label">Bound Hardware Node</span>
              {boundDeviceId ? (
                <>
                  <div className="tile-value" style={{ color: 'var(--brand-ink)' }}>{boundDeviceId}</div>
                  <div className="tile-meta ok">AES-256 Paired</div>
                </>
              ) : (
                <>
                  <div className="tile-value" style={{ color: 'var(--text-3)' }}>None</div>
                  <div className="tile-meta" style={{ color: 'var(--amber, #f59e0b)' }}>No Console Linked</div>
                </>
              )}
            </div>

            <div className="tile">
              <span className="tile-label">Registered Account</span>
              <div className="tile-value word">{user?.email || 'admin@tradopad.local'}</div>
              <div className="tile-meta">Console License</div>
            </div>

            <div className="tile">
              <span className="tile-label">SEBI Compliance</span>
              <div className="tile-value word" style={{ color: 'var(--green)' }}>Compliant</div>
              <div className="tile-meta ok">Disclosures Acknowledged</div>
            </div>
          </div>

          {/* Quick Log Out Action */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn-danger" 
              onClick={() => {
                if (window.confirm('Sign out of your Tradopad console?')) {
                  logout();
                  navigate('/login');
                }
              }}
              style={{ height: '36px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out of Console</span>
            </button>
          </div>
        </section>

        {/* CARD: App Theme & Visual Appearance */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>Theme &amp; Appearance</h2>
                <p className="card-sub">Choose visual styling and contrast mode.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="pill-linked"
              style={{
                cursor: 'pointer',
                background: theme === 'dark' ? 'rgba(123, 91, 240, 0.18)' : 'var(--blue-soft)',
                color: theme === 'dark' ? '#c4b5fd' : 'var(--blue)',
                borderColor: theme === 'dark' ? 'rgba(123, 91, 240, 0.35)' : 'rgba(47, 102, 208, 0.25)',
                fontWeight: 600,
                fontSize: '11px',
                height: '26px',
                padding: '0 8px',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <span className="live" style={{ background: theme === 'dark' ? '#a78bfa' : '#2F66D0' }}></span>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>

          <div className="grid-2" style={{ marginTop: '16px' }}>
            {/* Option 1: Obsidian Dark (Splash Palette) */}
            <div
              onClick={() => setTheme('dark')}
              style={{
                cursor: 'pointer',
                padding: '14px',
                borderRadius: '16px',
                background: '#0c1020',
                border: theme === 'dark' ? '2px solid #7B5BF0' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: theme === 'dark' ? '0 0 20px rgba(123, 91, 240, 0.35)' : 'none',
                position: 'relative',
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#060814',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </div>
                  {theme === 'dark' && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      background: '#7B5BF0',
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      letterSpacing: '0.4px',
                      lineHeight: 1.2
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Dark Terminal
                </div>
                <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0, lineHeight: 1.35 }}>
                  Obsidian palette matching boot screen with neon violet &amp; cyan.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '12px' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#060814', border: '1px solid rgba(255,255,255,0.2)' }} title="#060814 Base"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#0c1020', border: '1px solid rgba(255,255,255,0.2)' }} title="#0c1020 Surface"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#7B5BF0' }} title="#7B5BF0 Violet Accent"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#2FA3F2' }} title="#2FA3F2 Cyan Accent"></span>
              </div>
            </div>

            {/* Option 2: Studio Light */}
            <div
              onClick={() => setTheme('light')}
              style={{
                cursor: 'pointer',
                padding: '14px',
                borderRadius: '16px',
                background: '#F5F6F8',
                border: theme === 'light' ? '2px solid #2F66D0' : '1px solid #E6E9EF',
                boxShadow: theme === 'light' ? '0 0 20px rgba(47, 102, 208, 0.25)' : 'none',
                position: 'relative',
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '1px solid #D5DAE3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                    </svg>
                  </div>
                  {theme === 'light' && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      background: '#2F66D0',
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      letterSpacing: '0.4px',
                      lineHeight: 1.2
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Studio Light
                </div>
                <p style={{ fontSize: '11.5px', color: '#4B5567', margin: 0, lineHeight: 1.35 }}>
                  High-clarity daylight theme engineered for clear outdoor visibility.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '12px' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#F5F6F8', border: '1px solid #D5DAE3' }} title="#F5F6F8 Base"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#FFFFFF', border: '1px solid #D5DAE3' }} title="#FFFFFF Surface"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#2F66D0' }} title="#2F66D0 Primary Blue"></span>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#0F9D6A' }} title="#0F9D6A Green Accent"></span>
              </div>
            </div>
          </div>
        </section>

        {/* CARD: Emergency Kill Switch Scope Configuration */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip" style={{ background: 'var(--red-soft)', color: 'var(--red)', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>Kill Switch Scope</h2>
                <p className="card-sub">Choose which accounts liquidate on panic halt.</p>
              </div>
            </div>
            <span
              className="pill-linked"
              style={{
                flexShrink: 0,
                background: killSwitchScope === 'current' ? 'var(--blue-soft)' : 'var(--amber-soft)',
                color: killSwitchScope === 'current' ? 'var(--blue)' : 'var(--amber)',
                borderColor: killSwitchScope === 'current' ? 'rgba(47, 102, 208, 0.25)' : 'rgba(184, 110, 0, 0.25)',
                fontWeight: 600,
                fontSize: '11px',
                height: '24px',
                padding: '0 8px',
                whiteSpace: 'nowrap'
              }}
            >
              <span className="live" style={{ background: killSwitchScope === 'current' ? 'var(--blue)' : 'var(--amber)' }}></span>
              {killSwitchScope === 'current' ? 'Current Broker' : 'All Brokers'}
            </span>
          </div>

          {/* Vertical Stack: Full Width Options with Zero Overflows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {/* Option 1: Current Selected Broker (Default & Targeted) */}
            <div
              onClick={() => setKillSwitchScope('current')}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '16px',
                background: killSwitchScope === 'current' 
                  ? (theme === 'dark' ? 'rgba(47, 163, 242, 0.08)' : '#F0F7FF') 
                  : 'var(--surface-2)',
                border: killSwitchScope === 'current' 
                  ? '2px solid var(--brand-blue)' 
                  : '1px solid var(--line)',
                boxShadow: killSwitchScope === 'current' ? '0 0 16px rgba(47, 163, 242, 0.18)' : 'none',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: killSwitchScope === 'current' ? 'var(--brand-blue)' : 'var(--surface)',
                    color: killSwitchScope === 'current' ? '#ffffff' : 'var(--text-2)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    Current Broker Only
                  </span>
                </div>
                {killSwitchScope === 'current' ? (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    background: 'var(--brand-blue)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    letterSpacing: '0.4px',
                    flexShrink: 0
                  }}>
                    ACTIVE
                  </span>
                ) : (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--line-2)', flexShrink: 0 }} />
                )}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '8px 0 0 0', lineHeight: 1.45 }}>
                Liquidates positions and cancels orders <strong>only on {broker || 'the active broker'}</strong>. Other connected broker accounts remain untouched.
              </p>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="pill-linked" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: '11px', height: '22px', padding: '0 8px', borderColor: 'transparent' }}>
                  Targeted Protection
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  Recommended
                </span>
              </div>
            </div>

            {/* Option 2: All Available / Connected Brokers (Global Panic) */}
            <div
              onClick={() => setKillSwitchScope('all')}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '16px',
                background: killSwitchScope === 'all' 
                  ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#FFF5F5') 
                  : 'var(--surface-2)',
                border: killSwitchScope === 'all' 
                  ? '2px solid var(--red)' 
                  : '1px solid var(--line)',
                boxShadow: killSwitchScope === 'all' ? '0 0 16px rgba(239, 68, 68, 0.2)' : 'none',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: killSwitchScope === 'all' ? 'var(--red)' : 'var(--surface)',
                    color: killSwitchScope === 'all' ? '#ffffff' : 'var(--text-2)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    All Available Brokers
                  </span>
                </div>
                {killSwitchScope === 'all' ? (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    background: 'var(--red)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    letterSpacing: '0.4px',
                    flexShrink: 0
                  }}>
                    ACTIVE
                  </span>
                ) : (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--line-2)', flexShrink: 0 }} />
                )}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '8px 0 0 0', lineHeight: 1.45 }}>
                Simultaneously fires emergency square-off across <strong>all connected brokers in parallel</strong> and halts console hardware.
              </p>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="pill-linked" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: '11px', height: '22px', padding: '0 8px', borderColor: 'transparent' }}>
                  Full Panic Halt
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  Multi-Broker Fanout
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CARD 2: Paired Hardware Node Details */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <div>
                <h2>Paired Hardware Console</h2>
                <p className="card-sub">Physical ESP32 micro-gateway paired with this trading account.</p>
              </div>
            </div>
            <span className="badge-ok">CONNECTED</span>
          </div>

          <div className="grid-2" style={{ marginTop: '16px' }}>
            <div className="tile">
              <span className="tile-label">Device Serial</span>
              <div className="tile-value">SN-TP-0012</div>
              <div className="tile-meta">Hardware Rev 1.0</div>
            </div>

            <div className="tile">
              <span className="tile-label">Firmware Build</span>
              <div className="tile-value">1.0.0-PROD</div>
              <div className="tile-meta ok">OTA Up to Date</div>
            </div>

            <div className="tile">
              <span className="tile-label">Local Connection</span>
              <div className="tile-value">WiFi RSSI -58 dBm</div>
              <div className="tile-meta ok">Ultra-low latency</div>
            </div>

            <div className="tile">
              <span className="tile-label">Order Routing Hub</span>
              <div className="tile-value word">Trading Setup Tab</div>
              <div className="tile-meta">Multi-Broker Hub</div>
            </div>
          </div>
        </section>

        {/* CARD 3: Account Security & Password */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2>Account Security</h2>
                <p className="card-sub">Update your account login password.</p>
              </div>
            </div>
          </div>

          {passwordStatus.msg && (
            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '14px',
              background: passwordStatus.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
              border: `1px solid ${passwordStatus.type === 'success' ? 'rgba(15, 157, 106, 0.25)' : 'rgba(224, 67, 78, 0.25)'}`,
              color: passwordStatus.type === 'success' ? 'var(--green)' : 'var(--red)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {passwordStatus.msg}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Current Password
              </label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                placeholder="Enter current password" 
                required 
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: '12px',
                  color: 'var(--text)',
                  fontSize: '13.5px',
                  outline: 'none'
                }} 
              />
            </div>

            <div className="grid-2">
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  New Password
                </label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Min 6 characters" 
                  required 
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-2)',
                    borderRadius: '12px',
                    color: 'var(--text)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Confirm New Password
                </label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Re-type new password" 
                  required 
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-2)',
                    borderRadius: '12px',
                    color: 'var(--text)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }} 
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-email"
              style={{
                marginTop: '6px',
                cursor: passwordLoading ? 'not-allowed' : 'pointer',
                border: 'none',
                height: '48px'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{passwordLoading ? 'Updating Password...' : 'Update Account Password'}</span>
            </button>
          </form>
        </section>

        {/* CARD 4: SEBI Risk Compliance & Disclosures */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2>SEBI Compliance &amp; Risk Disclosure</h2>
                <p className="card-sub">Regulatory acknowledgments for derivatives trading.</p>
              </div>
            </div>
            <span className="badge-ok">ACKNOWLEDGED</span>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            fontSize: '12.5px',
            color: 'var(--text-2)',
            lineHeight: 1.5
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>SEBI Study Disclosure:</strong> 9 out of 10 individual traders in equity Futures and Options Segment incurred net losses.
              Over and above net trading losses incurred, loss makers expended an additional 28% of net trading losses as transaction costs.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px dashed var(--line-2)',
              fontSize: '11.5px',
              color: 'var(--text-3)'
            }}>
              <span>Status: Acknowledged on Account Provisioning</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Active License</span>
            </div>
          </div>
        </section>

        {/* CARD 5: DPDP Act 2023 - Data Privacy & Account Erasure */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip" style={{ background: deletionRequest ? 'var(--amber-soft)' : 'var(--red-soft)', color: deletionRequest ? 'var(--amber)' : 'var(--red)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2>DPDP Data Privacy &amp; Erasure</h2>
                <p className="card-sub">Right to Erasure under Section 12, DPDP Act 2023.</p>
              </div>
            </div>
            {deletionRequest ? (
              <span className="badge-ok" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                ⏳ PENDING APPROVAL
              </span>
            ) : (
              <span className="badge-ok" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                DPDP COMPLIANT
              </span>
            )}
          </div>

          {deletionStatusMsg.text && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              background: deletionStatusMsg.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
              color: deletionStatusMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${deletionStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {deletionStatusMsg.text}
            </div>
          )}

          {deletionRequest ? (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.28)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>⏳</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>
                  Statutory Erasure Request Under Review
                </strong>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                Your request to permanently erase your profile, broker API credentials, trading logs, and paired hardware console records submitted on{' '}
                <strong>{new Date(deletionRequest.requested_at).toLocaleDateString('en-IN')}</strong> is currently pending review by the Data Protection Officer / Administrator.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '14px' }}>
                <strong>Registered Notification Email:</strong> {user?.email || 'admin@tradopad.local'}<br/>
                <strong>Reason:</strong> {deletionRequest.reason || 'Account closure / DPDP erasure'}
              </div>
              <button
                type="button"
                onClick={handleWithdrawDeletionRequest}
                disabled={deletionSubmitting}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: deletionSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{deletionSubmitting ? 'Withdrawing...' : 'Withdraw Deletion Request'}</span>
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.55 }}>
                In accordance with India's <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>, you have the statutory right to request complete and irreversible erasure of your personal data, linked broker credentials, trading logs, and physical console hardware bindings.
              </p>

              <button
                type="button"
                onClick={() => { setDeletionModalOpen(true); setDeletionConfirmed(false); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--red-soft)',
                  border: '1px solid rgba(224, 67, 78, 0.35)',
                  color: 'var(--red)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Request Account &amp; Data Deletion (DPDP Act)</span>
              </button>
            </div>
          )}
        </section>

        {/* DPDP Deletion Request Modal */}
        {deletionModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 6, 16, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 99999
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              borderRadius: '16px',
              padding: '22px 20px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--red-soft)',
                    color: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)', fontWeight: 700 }}>
                    Request Account Erasure
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletionModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '4px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                Under Section 12 of the DPDP Act 2023, submitting this request sends an official erasure order to the Data Protection Officer / Administrator. Upon approval, the following records will be permanently destroyed:
              </p>

              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12px',
                color: 'var(--text-2)',
                lineHeight: 1.6,
                marginBottom: '16px'
              }}>
                • Trader identity, username &amp; email<br/>
                • Linked Broker API keys, tokens &amp; TOTP secrets<br/>
                • Hardware node pairing (@{user?.username || 'admin'})<br/>
                • Order execution ledger &amp; console telemetry
              </div>

              <form onSubmit={handleSubmitDeletionRequest}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '6px' }}>
                  Reason for Account Deletion (Optional)
                </label>
                <select
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-2)',
                    color: 'var(--text)',
                    fontSize: '12.5px',
                    marginBottom: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="Account closure / no longer trading">Account closure / no longer trading</option>
                  <option value="Privacy concerns & DPDP rights">Privacy concerns &amp; DPDP rights</option>
                  <option value="Switching to another platform">Switching to another platform</option>
                  <option value="Hardware console decommissioned">Hardware console decommissioned</option>
                  <option value="Other reason">Other reason</option>
                </select>

                <div
                  onClick={() => setDeletionConfirmed(!deletionConfirmed)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: deletionConfirmed ? 'var(--red-soft)' : 'var(--surface-2)',
                    border: deletionConfirmed ? '1px solid rgba(224, 67, 78, 0.4)' : '1px solid var(--line)',
                    cursor: 'pointer',
                    marginBottom: '18px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={deletionConfirmed}
                    onChange={(e) => setDeletionConfirmed(e.target.checked)}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: 1.4, userSelect: 'none' }}>
                    I understand that once approved by the administrator, my account and records will be permanently purged and a confirmation email will be delivered to <strong>{user?.email || 'my registered email'}</strong>.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setDeletionModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: '1px solid var(--line-2)',
                      color: 'var(--text-2)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={deletionSubmitting || !deletionConfirmed}
                    style={{
                      flex: 1.5,
                      padding: '11px',
                      borderRadius: '8px',
                      background: deletionConfirmed ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: deletionConfirmed && !deletionSubmitting ? 'pointer' : 'not-allowed',
                      boxShadow: deletionConfirmed ? '0 4px 14px rgba(239, 68, 68, 0.35)' : 'none'
                    }}
                  >
                    {deletionSubmitting ? 'Submitting...' : 'Submit Erasure Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
