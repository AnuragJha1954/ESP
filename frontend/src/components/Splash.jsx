import React from 'react';

export default function Splash({ isFading = false }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 40%, #0d1224 0%, #060814 65%, #030409 100%)',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        opacity: isFading ? 0 : 1,
        transform: isFading ? 'scale(1.03)' : 'scale(1)',
        pointerEvents: isFading ? 'none' : 'auto',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Subtle Ambient Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
          top: 'calc(50% - 160px)',
          left: 'calc(50% - 160px)',
          filter: 'blur(30px)',
          pointerEvents: 'none'
        }}
      />

      {/* Main Brand Content */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'splashEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both'
        }}
      >
        {/* Squircle App Icon Badge */}
        <div
          style={{
            width: '92px',
            height: '92px',
            borderRadius: '24px',
            background: 'linear-gradient(145deg, #141a2e 0%, #080c18 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.4rem',
            boxShadow: '0 0 35px rgba(99, 102, 241, 0.3), 0 20px 40px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
          }}
        >
          <img
            src="/logo-symbol.png"
            alt="Tradopad"
            style={{
              width: '64px',
              height: 'auto',
              maxHeight: '44px',
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 4px 14px rgba(99, 102, 241, 0.5))'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
        </div>

        {/* Brand Typography */}
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: '700',
            letterSpacing: '3px',
            color: '#f8fafc',
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
          }}
        >
          TRADOPAD
        </h1>
        <p
          style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            color: '#94a3b8',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: '0.45rem',
            marginBottom: '2rem'
          }}
        >
          Hardware Trading Console
        </p>

        {/* Minimalist Shimmer Loading Bar */}
        <div
          style={{
            width: '130px',
            height: '3px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: '45%',
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
              borderRadius: '999px',
              animation: 'shimmerSlide 1.3s ease-in-out infinite'
            }}
          />
        </div>
      </div>

      {/* Footer / Console Security Metadata */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          textAlign: 'center',
          color: '#475569',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.66rem',
          letterSpacing: '1px'
        }}
      >
        ESP32 MICRO-GATEWAY · AES-256 SECURED
      </div>

      <style>{`
        @keyframes splashEnter {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes shimmerSlide {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(180%);
          }
          100% {
            transform: translateX(180%);
          }
        }
      `}</style>
    </div>
  );
}
