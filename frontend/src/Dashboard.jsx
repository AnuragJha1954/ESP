import { useAppState } from './StateContext';
import NavBar from './NavBar';
import CustomSelect from './CustomSelect';

export default function Dashboard() {
  const { broker, setBroker, index, setIndex, expiry, setExpiry, autoExpiry, setAutoExpiry } = useAppState();

  const brokerOptions = [
    { label: 'Fyers', value: 'Fyers' },
    { label: 'Zerodha (Coming Soon)', value: 'Zerodha', disabled: true }
  ];

  const indexOptions = [
    { label: 'NIFTY 50', value: 'NIFTY' },
    { label: 'BANKNIFTY', value: 'BANKNIFTY' }
  ];

  const expiryOptions = [
    { label: '26 JUL (Current)', value: '26JUL26' },
    { label: '02 AUG', value: '02AUG26' },
    { label: '09 AUG', value: '09AUG26' }
  ];

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem' }}>
      
      {/* Header */}
      <div className="animate-slide-up" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src="/logo.png" alt="Infirow Logo" style={{ width: '120px', height: '120px', objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.src = '/logo.jpg'; }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px' }}>
          Infirow<br/>
          <span style={{ fontWeight: '600', color: 'var(--accent-blue)' }}>Tradopad</span>
        </h1>
      </div>

      {/* Abstract Data Stream Graphic */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s', marginBottom: '2rem', height: '60px', borderRadius: '16px', background: '#111111', border: '1px solid #222', display: 'flex', alignItems: 'center', padding: '0 15px', gap: '6px', overflow: 'hidden' }}>
        {[30, 60, 40, 80, 50, 90, 70, 40, 85, 30, 60, 75, 45, 95, 55, 80, 40, 65, 35, 90, 50].map((h, i) => (
          <div key={i} style={{ flex: '1', background: i % 4 === 0 ? '#7c3aed' : i % 3 === 0 ? '#2563eb' : '#333', height: `${h}%`, borderRadius: '4px', opacity: 0.8, animation: `pulse-opacity ${1 + (i % 3)}s infinite alternate` }}></div>
        ))}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '120px' }}>
        
        {/* Main Settings Card */}
        <div className="futuristic-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#ffffff', fontWeight: '600' }}>Terminal Settings</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             
             {/* Broker Selector */}
             <div style={{ zIndex: 102 }}>
               <div style={{ fontSize: '0.9rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '6px' }}>Broker</div>
               <CustomSelect value={broker} onChange={setBroker} options={brokerOptions} />
             </div>

             {/* Index Selector */}
             <div style={{ zIndex: 101 }}>
               <div style={{ fontSize: '0.9rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '6px' }}>Instrument</div>
               <CustomSelect value={index} onChange={setIndex} options={indexOptions} />
             </div>

             {/* Expiry Selector */}
             <div style={{ zIndex: 100 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-muted-inverse)', fontWeight: '600' }}>Expiry Date</div>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: '600' }}>
                   <input type="checkbox" checked={autoExpiry} onChange={e => setAutoExpiry(e.target.checked)} />
                   Auto-select latest
                 </label>
               </div>
               <CustomSelect value={expiry} onChange={setExpiry} options={expiryOptions} disabled={autoExpiry} />
             </div>
             
          </div>
        </div>

      </div>
      
      <NavBar />
    </div>
  );
}
