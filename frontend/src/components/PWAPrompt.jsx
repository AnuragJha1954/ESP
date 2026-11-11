import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ArrowDown, Share2, Check } from 'lucide-react';

const DB_BORDER = 'rgba(255, 255, 255, 0.12)';
const DB_BLUE = '#2563eb';
const DB_TEXT_MUTED = '#94a3b8';
const DB_FONT = "'GT America', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DB_MONO = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed & running in standalone mode
    const isStandalone = 
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && (navigator.standalone || document.referrer.includes('android-app://')));

    if (isStandalone) {
      return;
    }

    // 2. Check if user dismissed in this session
    if (sessionStorage.getItem('pwa_prompt_dismissed') === 'true') {
      return;
    }

    // 3. iOS Detection
    const isIosDevice = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
    setIsIOS(isIosDevice);

    // 4. Capture beforeinstallprompt on Android / Chrome
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt quickly after page settles
      setTimeout(() => setShowPrompt(true), 1200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If on iOS or mobile browser where beforeinstallprompt doesn't fire immediately, show prompt after 2s
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

    const handleAppInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // If deferredPrompt is unavailable (e.g. Chrome browser menu or iOS)
      alert("To install, open your browser menu (⋮) and tap 'Install app' or 'Add to Home Screen'.");
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || installed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'center',
      padding: '0 12px',
      zIndex: 9999,
      fontFamily: DB_FONT,
      pointerEvents: 'none'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: 'rgba(11, 16, 33, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${DB_BORDER}`,
        borderRadius: '14px',
        padding: '16px 16px 14px 16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(37, 99, 235, 0.25)',
        pointerEvents: 'auto',
        position: 'relative'
      }}>
        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: DB_TEXT_MUTED,
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Dismiss"
        >
          <X size={14} />
        </button>

        {/* Header Block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#0c1326',
            border: `1px solid ${DB_BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <img
              src="/logo.png"
              alt="Tradopad"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', letterSpacing: '-0.2px' }}>
                Install Tradopad PWA
              </span>
              <span style={{
                fontSize: '0.62rem',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(37, 99, 235, 0.2)',
                color: '#60a5fa',
                fontFamily: DB_MONO,
                fontWeight: '600'
              }}>
                STANDALONE
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Add to Home Screen for fast hardware sync & full-screen trading.
            </div>
          </div>
        </div>

        {/* iOS vs Android action instructions */}
        {isIOS ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.74rem',
            color: '#cbd5e1',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Share2 size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
            <span>
              Tap <strong>Share</strong> in Safari and select <strong>"Add to Home Screen"</strong>.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleInstallClick}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                borderRadius: '7px',
                background: DB_BLUE,
                border: 'none',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
              onMouseLeave={e => e.currentTarget.style.background = DB_BLUE}
            >
              <Download size={14} />
              <span>Install Tradopad App</span>
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '9px 12px',
                borderRadius: '7px',
                background: 'transparent',
                border: `1px solid ${DB_BORDER}`,
                color: DB_TEXT_MUTED,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
