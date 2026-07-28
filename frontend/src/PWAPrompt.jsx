import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIosDevice = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
    setIsIOS(isIosDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isStandalone) {
      return; // Already installed, do nothing
    }

    if (isIosDevice) {
      // Show iOS prompt after a slight delay
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // Android/Chrome logic
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '110px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      <div className="animate-slide-up" style={{
        width: '90%',
        maxWidth: '400px',
        background: 'rgba(25, 25, 25, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(124, 58, 237, 0.4)',
        borderRadius: '24px',
        padding: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        pointerEvents: 'auto',
        position: 'relative'
      }}>
        <button onClick={() => setShowPrompt(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src="/logo.png" alt="App Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }} />
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff', letterSpacing: '-0.5px' }}>Install Infirow Tradopad</div>
            <div style={{ fontSize: '0.9rem', color: '#aaa', lineHeight: '1.3' }}>Add to your home screen for full PWA features.</div>
          </div>
        </div>
        
        {isIOS ? (
          <div style={{ fontSize: '0.9rem', color: '#ccc', textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
            Tap the <strong>Share</strong> button in Safari and select <strong>"Add to Home Screen"</strong>.
          </div>
        ) : (
          <button onClick={handleInstallClick} className="futuristic-pill" style={{ width: '100%', padding: '14px', background: '#7c3aed', color: '#fff', border: 'none', justifyContent: 'center' }}>
            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Install Now</span>
          </button>
        )}
      </div>
    </div>
  );
}
