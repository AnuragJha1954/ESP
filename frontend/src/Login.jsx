import React, { useState } from 'react';
import { useAppState } from './StateContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAppState();
  const navigate = useNavigate();

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
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
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
          <img src="/logo.png" alt="Infirow Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px', margin: 0 }}>
            Infirow<br/>
            <span style={{ fontWeight: '600', color: '#60a5fa' }}>Tradopad</span>
          </h1>
        </div>

        {/* Login Card */}
        <div className="futuristic-card" style={{ width: '100%', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#fff', textAlign: 'center' }}>Welcome Back</h2>
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '12px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

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

          <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ padding: '0 15px', color: '#888', fontSize: '0.9rem' }}>OR</div>
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
