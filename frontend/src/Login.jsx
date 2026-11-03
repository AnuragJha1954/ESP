import React, { useState } from 'react';
import { useAppState } from './StateContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import MarketTicker from './MarketTicker';
import { Lock, Mail, User, Shield, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff, KeyRound, Cpu, Activity } from 'lucide-react';

const DB_CANVAS = '#060814';
const DB_PANEL = 'rgba(12, 17, 34, 0.90)';
const DB_BORDER = 'rgba(255, 255, 255, 0.09)';
const DB_TEXT_MAIN = '#f8fafc';
const DB_TEXT_MUTED = '#94a3b8';
const DB_TEXT_FAINT = '#64748b';
const DB_INPUT_BG = 'rgba(15, 23, 42, 0.75)';
const DB_FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DB_MONO = "'IBM Plex Mono', Consolas, monospace";

export default function Login() {
  const [authMode, setAuthMode] = useState('password'); // 'password' or 'otp'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAppState();
  const navigate = useNavigate();

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        login(data.token, data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend server is reachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setOtpSent(true);
        setInfo('Verification code sent to ' + email);
      } else {
        setError(data.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!otpCode) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });
      const data = await res.json();
      if (data.status === 'success') {
        login(data.token, data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        setError(data.message || 'Invalid or expired verification code');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        login(data.token, data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        setError(data.message || 'Google SSO failed');
      }
    } catch (err) {
      setError('Network error during Google Sign-In.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was unsuccessful. Please use username & password.');
  };

  return (
    <div style={{
      height: '100dvh',
      maxHeight: '100dvh',
      width: '100%',
      background: DB_CANVAS,
      color: DB_TEXT_MAIN,
      fontFamily: DB_FONT,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* 1. Top Real-time Market Ticker */}
      <MarketTicker />

      {/* 2. Cyber Matrix Grid Background */}
      <div className="cyber-grid-canvas" style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.60,
        pointerEvents: 'none'
      }} />

      {/* 3. Ambient Obsidian Neon Mesh Orbs */}
      <div style={{
        position: 'absolute',
        width: '420px',
        height: '420px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(123, 91, 240, 0.20) 0%, rgba(67, 56, 202, 0.10) 45%, transparent 68%)',
        top: '-80px',
        left: '-80px',
        pointerEvents: 'none',
        filter: 'blur(35px)'
      }} />

      <div style={{
        position: 'absolute',
        width: '440px',
        height: '440px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.14) 0%, rgba(123, 91, 240, 0.12) 45%, transparent 68%)',
        bottom: '-80px',
        right: '-80px',
        pointerEvents: 'none',
        filter: 'blur(35px)'
      }} />

      {/* 4. Scroll-free Centered Mobile Viewport Container */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem 0.85rem',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 10,
        overflowY: 'auto'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: DB_PANEL,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${DB_BORDER}`,
          borderRadius: '16px',
          padding: '1.15rem 1.15rem 0.95rem 1.15rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.12)',
          position: 'relative',
          boxSizing: 'border-box',
          margin: 'auto'
        }}>
          {/* Subtle Top Glowing Hairline */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '18%',
            right: '18%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #7B5BF0, transparent)'
          }} />

          {/* Centered Big Logo & Brand Lockup */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '0.80rem'
          }}>
            <div style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1.5px solid rgba(123, 91, 240, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(123, 91, 240, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              overflow: 'hidden',
              marginBottom: '7px'
            }}>
              <img 
                src="/logo.png" 
                alt="Tradopad" 
                style={{ width: '42px', height: '42px', objectFit: 'contain' }} 
                onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }} 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.18rem', fontWeight: '800', color: DB_TEXT_MAIN, letterSpacing: '-0.3px' }}>
                Tradopad
              </span>
              <span style={{
                fontSize: '0.58rem',
                fontFamily: DB_MONO,
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(123, 91, 240, 0.20)',
                color: '#c4b5fd',
                border: '1px solid rgba(123, 91, 240, 0.40)',
                fontWeight: '700'
              }}>
                v1.0
              </span>
            </div>

            <div style={{ fontSize: '0.70rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Physical Console Rapid Trading Terminal
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* HARDWARE GRAPHIC: Physical Tradopad Console & Telemetry Bridge */}
          {/* ------------------------------------------------------------- */}
          <div style={{
            marginBottom: '0.75rem',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, rgba(18, 25, 46, 0.95) 0%, rgba(9, 13, 26, 0.98) 100%)',
            border: '1px solid rgba(123, 91, 240, 0.28)',
            padding: '7px 10px',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 14px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Ambient backlight glow */}
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '45%',
              width: '100px',
              height: '30px',
              background: 'radial-gradient(circle, rgba(123, 91, 240, 0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(8px)'
            }} />

            {/* Console Left: Micro OLED Screen Simulation */}
            <div style={{
              background: '#040711',
              border: '1px solid rgba(56, 189, 248, 0.32)',
              borderRadius: '6px',
              padding: '3px 7px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              boxShadow: 'inset 0 0 6px rgba(56, 189, 248, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                  display: 'inline-block'
                }} />
                <span style={{ fontSize: '0.58rem', fontFamily: DB_MONO, color: '#38bdf8', fontWeight: '700', letterSpacing: '0.4px' }}>
                  ESP32 OLED
                </span>
              </div>
              <div style={{ fontSize: '0.62rem', fontFamily: DB_MONO, color: '#f8fafc', fontWeight: '700' }}>
                NIFTY <span style={{ color: '#34d399', fontSize: '0.56rem' }}>▲ 24,858</span>
              </div>
            </div>

            {/* Console Center: Live Telemetry Oscilloscope Graphic */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '0 4px' }}>
              <svg width="44" height="18" viewBox="0 0 44 18" fill="none" style={{ display: 'block' }}>
                <path d="M0 9h6l3-5 5 11 4-8 3 4 4-2h13" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="38" cy="9" r="2" fill="#38bdf8" />
              </svg>
              <span style={{ fontSize: '0.52rem', fontFamily: DB_MONO, color: '#64748b', letterSpacing: '0.3px' }}>
                DIRECT ROUTE
              </span>
            </div>

            {/* Console Right: Physical Tactile Buttons (CE & PE) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* CE Button */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
                border: '1px solid #34d399',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontFamily: DB_MONO,
                fontWeight: '900',
                fontSize: '0.64rem',
                letterSpacing: '-0.3px',
                userSelect: 'none'
              }}>
                CE
              </div>

              {/* PE Button */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                border: '1px solid #f87171',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontFamily: DB_MONO,
                fontWeight: '900',
                fontSize: '0.64rem',
                letterSpacing: '-0.3px',
                userSelect: 'none'
              }}>
                PE
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '2px',
            marginBottom: '0.75rem',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                background: authMode === 'password' ? 'linear-gradient(135deg, rgba(123, 91, 240, 0.28) 0%, rgba(67, 56, 202, 0.28) 100%)' : 'transparent',
                color: authMode === 'password' ? '#e0e7ff' : DB_TEXT_MUTED,
                fontSize: '0.74rem',
                fontWeight: '600',
                border: authMode === 'password' ? '1px solid rgba(123, 91, 240, 0.45)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <KeyRound size={12} />
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={() => { setAuthMode('otp'); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                background: authMode === 'otp' ? 'linear-gradient(135deg, rgba(123, 91, 240, 0.28) 0%, rgba(67, 56, 202, 0.28) 100%)' : 'transparent',
                color: authMode === 'otp' ? '#e0e7ff' : DB_TEXT_MUTED,
                fontSize: '0.74rem',
                fontWeight: '600',
                border: authMode === 'otp' ? '1px solid rgba(123, 91, 240, 0.45)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Mail size={12} />
              <span>Email OTP</span>
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '7px 10px',
              borderRadius: '7px',
              marginBottom: '0.65rem',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, color: '#f87171' }} />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              padding: '7px 10px',
              borderRadius: '7px',
              marginBottom: '0.65rem',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0, color: '#34d399' }} />
              <span>{info}</span>
            </div>
          )}

          {/* Form 1: Username & Password Login */}
          {authMode === 'password' ? (
            <form onSubmit={handleLocalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Trader Username / Handle
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: DB_TEXT_FAINT }}>
                    <User size={14} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. device12" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 34px',
                      background: DB_INPUT_BG,
                      border: `1px solid ${DB_BORDER}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.84rem',
                      outline: 'none',
                      fontFamily: DB_FONT,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#7B5BF0';
                      e.target.style.boxShadow = '0 0 0 2px rgba(123, 91, 240, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = DB_BORDER;
                      e.target.style.boxShadow = 'none';
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Trader Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: DB_TEXT_FAINT }}>
                    <Lock size={14} />
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter your password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 34px 9px 34px',
                      background: DB_INPUT_BG,
                      border: `1px solid ${DB_BORDER}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.84rem',
                      outline: 'none',
                      fontFamily: DB_FONT,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#7B5BF0';
                      e.target.style.boxShadow = '0 0 0 2px rgba(123, 91, 240, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = DB_BORDER;
                      e.target.style.boxShadow = 'none';
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: DB_TEXT_MUTED,
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{
                  marginTop: '4px',
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #7B5BF0 0%, #4338ca 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 16px rgba(123, 91, 240, 0.35)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Terminal'}</span>
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          ) : (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Registered Trader Email
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: DB_TEXT_FAINT }}>
                        <Mail size={14} />
                      </div>
                      <input 
                        type="email" 
                        placeholder="e.g. trader@tradopad.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoCapitalize="none"
                        style={{
                          width: '100%',
                          padding: '9px 12px 9px 34px',
                          background: DB_INPUT_BG,
                          border: `1px solid ${DB_BORDER}`,
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.84rem',
                          outline: 'none',
                          fontFamily: DB_FONT,
                          boxSizing: 'border-box'
                        }}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    style={{
                      marginTop: '4px',
                      width: '100%',
                      padding: '10px',
                      background: 'linear-gradient(135deg, #7B5BF0 0%, #4338ca 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.86rem',
                      fontWeight: '700',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 16px rgba(123, 91, 240, 0.35)'
                    }}
                  >
                    <span>{loading ? 'Sending Code...' : 'Send Verification OTP'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      6-Digit Security Code
                    </label>
                    <input 
                      type="text" 
                      placeholder="••••••" 
                      maxLength="6"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: DB_INPUT_BG,
                        border: `1px solid ${DB_BORDER}`,
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '1.2rem',
                        fontWeight: '700',
                        textAlign: 'center',
                        letterSpacing: '7px',
                        fontFamily: DB_MONO,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'linear-gradient(135deg, #7B5BF0 0%, #4338ca 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.86rem',
                      fontWeight: '700',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 16px rgba(123, 91, 240, 0.35)'
                    }}
                  >
                    <span>{loading ? 'Verifying...' : 'Verify & Enter Terminal'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '3px' }}>
                    <button 
                      type="button" 
                      onClick={() => { setOtpSent(false); setOtpCode(''); setInfo(''); setError(''); }}
                      style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', fontSize: '0.74rem' }}
                    >
                      Change email address
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '0.70rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: DB_BORDER }}></div>
            <div style={{ padding: '0 8px', color: DB_TEXT_FAINT, fontSize: '0.64rem', fontWeight: '700', letterSpacing: '0.5px' }}>
              OR INSTANT SSO
            </div>
            <div style={{ flex: 1, height: '1px', background: DB_BORDER }}></div>
          </div>

          {/* Google SSO Button */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              shape="rectangular"
              text="continue_with"
              width="100%"
            />
          </div>

          {/* Security & Compliance Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '0.70rem',
            paddingTop: '0.55rem',
            borderTop: `1px solid ${DB_BORDER}`,
            color: DB_TEXT_FAINT,
            fontSize: '0.66rem',
            fontFamily: DB_MONO,
            textAlign: 'center'
          }}>
            <Shield size={11} color="#10b981" />
            <span>256-Bit TLS · SEBI Guarded · Direct Broker API</span>
          </div>

        </div>
      </div>
    </div>
  );
}