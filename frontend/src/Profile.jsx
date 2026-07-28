import { Settings, User, Activity, Maximize2, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';

export default function Profile() {
  const navigate = useNavigate();

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem' }}>
      <div className="animate-slide-up" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px' }}>
          User<br/>
          <span style={{ fontWeight: '600', color: 'var(--accent-purple)' }}>Profile</span>
        </h1>
      </div>
      
      <div className="futuristic-card animate-slide-up" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={40} color="white" />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: '600', letterSpacing: '-0.5px' }}>Trader_01</div>
          <div style={{ color: 'var(--text-muted-inverse)', fontSize: '1rem', fontWeight: '500' }}>Active Fyers Session</div>
        </div>
      </div>

      {/* Network Radar Graphic */}
      <div className="animate-slide-up" style={{ animationDelay: '0.15s', marginBottom: '2rem', height: '140px', borderRadius: '24px', background: '#111111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', border: '1px solid rgba(59,130,246,0.3)', animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
        <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', border: '1px solid rgba(124,58,237,0.4)', animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite 1s' }}></div>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 0 20px rgba(59,130,246,0.6)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <Activity color="white" size={28} />
        </div>
      </div>

      <div className="futuristic-card animate-slide-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '120px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>Account ID</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>FY10293</span>
         </div>
         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>API Status</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--accent-green)' }}>Connected</span>
         </div>
         <button style={{ width: '100%', padding: '1rem', marginTop: '1rem', background: '#f3f4f6', border: 'none', borderRadius: '16px', color: '#ff3b30', fontWeight: '600', fontSize: '1.1rem' }}>
            Logout Device
         </button>
      </div>

      <NavBar />
    </div>
  );
}
