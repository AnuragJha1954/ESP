import { useMemo, useEffect } from 'react';
import { useAppState } from './StateContext';
import NavBar from './NavBar';
import CustomSelect from './CustomSelect';

export default function Dashboard() {
  const { broker, setBroker, index, setIndex, expiry, setExpiry, autoExpiry, setAutoExpiry } = useAppState();

  const brokerOptions = [
    { label: 'Fyers', value: 'Fyers' },
    { label: 'Dhan', value: 'Dhan' }
  ];

  const indexOptions = [
    { label: 'NIFTY 50', value: 'NIFTY' },
    { label: 'BANK NIFTY', value: 'BANKNIFTY' },
    { label: 'FIN NIFTY', value: 'FINNIFTY' },
    { label: 'MIDCAP NIFTY', value: 'MIDCPNIFTY' },
    { label: 'SENSEX (BSE)', value: 'SENSEX' },
    { label: 'BANKEX (BSE)', value: 'BANKEX' }
  ];

  const getNextExpiries = (indexStr) => {
    // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    const cleanIndex = (indexStr || 'NIFTY')
      .replace(/\s*50\b/i, '')
      .replace(/\s*\(BSE\)/i, '')
      .replace(/\s+/g, '')
      .toUpperCase();

    // Custom schedule for NIFTY 50: 19th October (Current), then every Tuesday
    if (cleanIndex === 'NIFTY') {
      return [
        { label: '19 OCT 2026 (Current)', value: '19OCT26' },
        { label: '27 OCT 2026', value: '27OCT26' },
        { label: '03 NOV 2026', value: '03NOV26' },
        { label: '10 NOV 2026 (Monthly)', value: '10NOV26' }
      ];
    }

    const expiryDays = {
      'BANKNIFTY': 3,   // Wednesday
      'FINNIFTY': 2,    // Tuesday
      'MIDCPNIFTY': 1,  // Monday
      'SENSEX': 5,      // Friday
      'BANKEX': 1       // Monday
    };
    const targetDay = expiryDays[cleanIndex] !== undefined ? expiryDays[cleanIndex] : 2; // Default to Tuesday
    const options = [];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    let d = new Date();
    const now = new Date();
    // If today is targetDay and past 15:30 (market close), start from next week
    if (d.getDay() === targetDay && (now.getHours() > 15 || (now.getHours() === 15 && now.getMinutes() >= 30))) {
      d.setDate(d.getDate() + 7);
    } else {
      while (d.getDay() !== targetDay) {
        d.setDate(d.getDate() + 1);
      }
    }

    for (let i = 0; i < 4; i++) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mmm = months[d.getMonth()];
      const yy = String(d.getFullYear()).slice(-2);
      const yyyy = d.getFullYear();
      
      const labelStr = `${dd} ${mmm} ${yyyy}${i === 0 ? ' (Current)' : i === 3 ? ' (Monthly)' : ''}`;
      const valueStr = `${dd}${mmm}${yy}`;
      options.push({ label: labelStr, value: valueStr });
      
      d.setDate(d.getDate() + 7);
    }
    return options;
  };

  const expiryOptions = useMemo(() => getNextExpiries(index), [index]);

  // If autoExpiry is enabled and index changes, auto-update the expiry to the newly calculated current week
  useEffect(() => {
    if (autoExpiry && expiryOptions.length > 0) {
      setExpiry(expiryOptions[0].value);
    }
  }, [index, autoExpiry, expiryOptions, setExpiry]);

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
                   <input type="checkbox" checked={autoExpiry} onChange={e => {
                     setAutoExpiry(e.target.checked);
                     if (e.target.checked) setExpiry(expiryOptions[0].value);
                   }} />
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
