import { useState, useEffect } from 'react';
import './index.css';

export default function DeviceCheck({ children }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (isDesktop) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000000',
        textAlign: 'center',
        padding: '2rem',
        color: '#ffffff'
      }}>
        <div className="animate-fade-in" style={{ padding: '3rem', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Logo and Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
            <img src="/logo.png" alt="Infirow Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }} />
            <h1 style={{ fontSize: '2.2rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px', textAlign: 'left', margin: 0 }}>
              Infirow<br/>
              <span style={{ fontWeight: '600', color: '#60a5fa' }}>Tradopad</span>
            </h1>
          </div>

          <h1 style={{ fontSize: '4.5rem', fontWeight: '500', lineHeight: '1', letterSpacing: '-2px', marginBottom: '1.5rem', margin: 0 }}>
            Mobile<br/>
            <span style={{ fontWeight: '300' }}>Optimized</span>
          </h1>
          
          {/* Abstract Data Stream Trading Graphic */}
          <div style={{ display: 'flex', height: '80px', width: '100%', marginTop: '2rem', marginBottom: '2.5rem', borderRadius: '16px', background: '#111111', border: '1px solid #222', alignItems: 'center', padding: '0 15px', gap: '6px', overflow: 'hidden' }}>
            {[30, 60, 40, 80, 50, 90, 70, 40, 85, 30, 60, 75, 45, 95, 55, 80, 40, 65, 35, 90, 50, 40, 60, 30, 80, 95, 50, 75].map((h, i) => (
              <div key={i} style={{ flex: '1', background: i % 4 === 0 ? '#7c3aed' : i % 3 === 0 ? '#2563eb' : '#333', height: `${h}%`, borderRadius: '4px', opacity: 0.8, animation: `pulse-opacity ${1 + (i % 3)}s infinite alternate` }}></div>
            ))}
          </div>

          <p style={{ color: '#8e8e93', fontSize: '1.2rem', lineHeight: '1.5', marginBottom: '3rem', fontWeight: '300' }}>
            Infirow Tradopad is a highly optimized PWA engineered strictly for handheld devices. 
            Open this URL on your smartphone for the full futuristic trading experience.
          </p>

          <div className="futuristic-pill" style={{ width: 'auto', padding: '1rem 2.5rem', border: '1px solid #333', background: 'transparent', color: '#fff' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: '400', letterSpacing: '1px' }}>Open on Mobile</span>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
