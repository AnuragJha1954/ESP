export default function Splash() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#000000'
    }}>
      <div className="logo-glow animate-slide-up" style={{ position: 'relative', width: '320px', height: '220px', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.png" alt="Infirow" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.3)' }} onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }} />
      </div>
      <h2 className="animate-fade-in" style={{
        marginTop: '1.5rem',
        fontSize: '1.8rem',
        fontWeight: '600',
        letterSpacing: '1px',
        color: '#ffffff',
        animationDelay: '0.2s'
      }}>
        INFIROW
      </h2>
      <p className="animate-fade-in" style={{
        fontSize: '1rem',
        color: 'var(--accent-blue)',
        letterSpacing: '3px',
        animationDelay: '0.4s',
        marginTop: '0.5rem'
      }}>
        TRADOPAD
      </p>
    </div>
  );
}
