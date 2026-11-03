import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Smartphone, QrCode, Monitor, Maximize2, Shield, ArrowRight, X } from 'lucide-react';

const DB_CANVAS = '#060814';
const DB_PANEL = '#0c1122';
const DB_BORDER = 'rgba(255, 255, 255, 0.08)';
const DB_TEXT_MAIN = '#f1f5f9';
const DB_TEXT_MUTED = '#94a3b8';
const DB_TEXT_FAINT = '#64748b';
const DB_FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DB_MONO = "'IBM Plex Mono', Consolas, monospace";

export default function DeviceCheck({ children }) {
  const location = useLocation();

  // 1. STRICT ROUTE ISOLATION: Admin routes are desktop-first and bypass mobile gatekeeper
  if (location.pathname.startsWith('/admin')) {
    return children;
  }

  // 2. Responsive viewport detection (Mobile breakpoint: 768px)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > 768;
  });

  // Simulator toggle for desktop reviewers/developers
  const [simulatorMode, setSimulatorMode] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth > 768;
      setIsDesktop(desktop);
      // Auto-exit simulator mode if viewport shrinks to native mobile
      if (!desktop) {
        setSimulatorMode(false);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // 3. If native mobile viewport or DevTools device mode (<= 768px), render app directly
  if (!isDesktop) {
    return children;
  }

  // 4. If reviewer toggled interactive mobile simulator frame on desktop
  if (simulatorMode) {
    return (
      <div style={{
        minHeight: '100vh',
        background: DB_CANVAS,
        fontFamily: DB_FONT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '16px 12px 32px 12px',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Top Control Bar for Simulator */}
        <div style={{
          width: '100%',
          maxWidth: '430px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(12, 17, 34, 0.9)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${DB_BORDER}`,
          borderRadius: '10px',
          padding: '8px 14px',
          marginBottom: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }} />
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: DB_TEXT_MAIN, fontFamily: DB_MONO }}>
              Mobile Simulator · 390×844
            </span>
          </div>

          <button
            onClick={() => setSimulatorMode(false)}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <X size={13} />
            <span>Exit Simulator</span>
          </button>
        </div>

        {/* Realistic Smartphone Frame Mockup */}
        <div style={{
          width: '390px',
          maxWidth: '100%',
          height: '844px',
          maxHeight: 'calc(100vh - 80px)',
          background: '#060814',
          borderRadius: '44px',
          border: '10px solid #1e2438',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 0 2px rgba(123, 91, 240, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Dynamic Island / Notch Mockup */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '110px',
            height: '24px',
            background: '#000',
            borderRadius: '16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0a1020', border: '1px solid #1a2035' }} />
          </div>

          {/* Render app inside device container */}
          <div style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // 5. Desktop Gatekeeper: "Tradopad is a Mobile-Only Experience"
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://tradopad.local';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(appOrigin + '/login')}`;

  return (
    <div style={{
      minHeight: '100vh',
      background: DB_CANVAS,
      color: DB_TEXT_MAIN,
      fontFamily: DB_FONT,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Cyber Mesh */}
      <div className="cyber-grid-canvas" style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.6,
        pointerEvents: 'none'
      }} />

      {/* Ambient Radial Glowing Orbs */}
      <div style={{
        position: 'absolute',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(123, 91, 240, 0.22) 0%, rgba(67, 56, 202, 0.10) 45%, transparent 65%)',
        top: '-150px',
        left: '-150px',
        pointerEvents: 'none',
        filter: 'blur(40px)'
      }} />

      <div style={{
        position: 'absolute',
        width: '750px',
        height: '750px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.16) 0%, rgba(123, 91, 240, 0.12) 45%, transparent 65%)',
        bottom: '-180px',
        right: '-150px',
        pointerEvents: 'none',
        filter: 'blur(40px)'
      }} />

      {/* Main Content Area */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        boxSizing: 'border-box'
      }}>
        {/* Brand Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '2rem'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(123, 91, 240, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(123, 91, 240, 0.3)',
            overflow: 'hidden'
          }}>
            <img 
              src="/logo.png" 
              alt="Tradopad" 
              style={{ width: '34px', height: '34px', objectFit: 'contain' }}
              onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.3px', color: '#fff' }}>
                TRADOPAD
              </span>
              <span style={{
                fontSize: '0.62rem',
                fontFamily: DB_MONO,
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(123, 91, 240, 0.18)',
                color: '#c4b5fd',
                border: '1px solid rgba(123, 91, 240, 0.4)',
                fontWeight: '700',
                letterSpacing: '0.5px'
              }}>
                MOBILE TERMINAL EXCLUSIVE
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED }}>
              Physical Hardware Keypad Companion & Fast Execution Hub
            </div>
          </div>
        </div>

        {/* Hero Headline */}
        <div style={{ textAlign: 'center', maxWidth: '640px', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontSize: '2.2rem',
            fontWeight: '800',
            letterSpacing: '-0.8px',
            margin: '0 0 12px 0',
            lineHeight: '1.2',
            background: 'linear-gradient(135deg, #ffffff 30%, #c4b5fd 75%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Tradopad is a Mobile-Only Trading Experience
          </h1>
          <p style={{
            fontSize: '0.94rem',
            color: DB_TEXT_MUTED,
            lineHeight: '1.6',
            margin: 0
          }}>
            Tradopad Trader Terminal is purpose-built for mobile smartphones. Engineered for rapid physical ESP32 console tethering, biometric lock, and ergonomic thumb-tap execution.
          </p>
        </div>

        {/* Two-Column Action Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 340px))',
          gap: '20px',
          width: '100%',
          maxWidth: '720px',
          marginBottom: '2.5rem'
        }}>
          {/* Card 1: Scan with Phone */}
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '16px',
            padding: '1.75rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              fontFamily: DB_MONO,
              color: '#38bdf8',
              marginBottom: '1rem',
              fontWeight: '600'
            }}>
              <QrCode size={15} />
              <span>SCAN TO OPEN ON PHONE</span>
            </div>

            <div style={{
              background: '#ffffff',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
              marginBottom: '1rem'
            }}>
              <img 
                src={qrUrl} 
                alt="Scan to open Tradopad on Mobile" 
                style={{ width: '150px', height: '150px', display: 'block' }} 
              />
            </div>

            <div style={{ fontSize: '0.82rem', color: DB_TEXT_MAIN, fontWeight: '600', marginBottom: '4px' }}>
              Instant Mobile Access
            </div>
            <div style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, lineHeight: '1.4' }}>
              Open your smartphone camera or QR scanner to launch the Tradopad PWA terminal directly.
            </div>
          </div>

          {/* Card 2: Developer / Testing Options */}
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '16px',
            padding: '1.75rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                fontFamily: DB_MONO,
                color: '#a78bfa',
                marginBottom: '1rem',
                fontWeight: '600'
              }}>
                <Monitor size={15} />
                <span>DESKTOP PREVIEW & TESTING</span>
              </div>

              <div style={{ fontSize: '0.88rem', color: DB_TEXT_MAIN, fontWeight: '700', marginBottom: '8px' }}>
                Testing on this Computer?
              </div>

              <div style={{ fontSize: '0.78rem', color: DB_TEXT_MUTED, lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Open Developer Tools (<strong>F12</strong>) and toggle <strong>Device Toolbar</strong> (<strong>Ctrl+Shift+M</strong>) to inspect the mobile viewport (iPhone / Android).
              </div>
            </div>

            {/* Launch Simulator Button */}
            <button
              onClick={() => setSimulatorMode(true)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #7B5BF0 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(123, 91, 240, 0.4)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Smartphone size={16} />
              <span>Simulate Mobile View (390px)</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Security & System Status Strip */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: DB_TEXT_FAINT,
          fontSize: '0.75rem',
          fontFamily: DB_MONO
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span>ESP32 Console Bridge: Ready</span>
          </div>
          <span>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7B5BF0' }} />
            <span>Multi-Broker Vault: Armed</span>
          </div>
          <span>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={12} color="#10b981" />
            <span>SEBI Risk Guarded</span>
          </div>
        </div>
      </div>
    </div>
  );
}