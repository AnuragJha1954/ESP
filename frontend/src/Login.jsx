import React, { useState } from 'react';
import { useAppState } from './StateContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const [authMode, setAuthMode] = useState('password'); // 'password' or 'otp'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        login(data.token, data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
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
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/auth/otp/send', {
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
      setError('Network error. Please try again.');
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
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });
      const data = await res.json();
      if (data.status === 'success') {
        login(data.token, data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        setError(data.message || 'Invalid or expired code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/auth/google', {
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
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was unsuccessful. Try again later.');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      paddingBottom: '4rem'
    }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <img src="/logo.png" alt="Infirow Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px', margin: 0 }}>
            Infirow<br/>
            <span style={{ fontWeight: '600', color: '#60a5fa' }}>Tradopad</span>
          </h1>
        </div>

        {/* Login Card */}
        <div className="futuristic-card" style={{ width: '100%', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1.2rem', color: '#fff', textAlign: 'center' }}>Welcome Back</h2>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                background: authMode === 'password' ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                color: authMode === 'password' ? '#60a5fa' : '#888'
              }}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('otp'); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                background: authMode === 'otp' ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                color: authMode === 'otp' ? '#60a5fa' : '#888'
              }}
            >
              Email Code (OTP)
            </button>
          </div>
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '12px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {info && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '12px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {info}
            </div>
          )}

          {authMode === 'password' ? (
            <form onSubmit={handleLocalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="futuristic-input-container">
                <input 
                  type="text" 
                  placeholder="Username" 
                  className="futuristic-input" 
                  style={{ textAlign: 'left', padding: '10px' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="futuristic-input-container">
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="futuristic-input" 
                  style={{ textAlign: 'left', padding: '10px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="futuristic-pill" 
                disabled={loading}
                style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', border: 'none', justifyContent: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{loading ? 'Authenticating...' : 'Log In'}</span>
              </button>
            </form>
          ) : (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div className="futuristic-input-container">
                    <input 
                      type="email" 
                      placeholder="Enter registered email" 
                      className="futuristic-input" 
                      style={{ textAlign: 'left', padding: '10px' }}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="futuristic-pill" 
                    disabled={loading}
                    style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', border: 'none', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{loading ? 'Sending Code...' : 'Send Login Code'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div className="futuristic-input-container">
                    <input 
                      type="text" 
                      placeholder="Enter 6-digit OTP" 
                      maxLength="6"
                      className="futuristic-input" 
                      style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '1.3rem', fontWeight: 'bold', padding: '10px' }}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="futuristic-pill" 
                    disabled={loading}
                    style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', border: 'none', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{loading ? 'Verifying...' : 'Verify & Log In'}</span>
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => { setOtpSent(false); setOtpCode(''); setInfo(''); setError(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Change email / Resend code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.8rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ padding: '0 15px', color: '#888', fontSize: '0.85rem' }}>OR</div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              shape="pill"
              text="continue_with"
              width="100%"
            />
          </div>
          
        </div>
        
        <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.85rem' }}>
          Secured by Infirow Enterprise Auth
        </p>
      </div>
    </div>
  );
}
