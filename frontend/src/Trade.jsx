import { useState } from 'react';
import { Plus, Minus, Zap } from 'lucide-react';
import NavBar from './NavBar';
import { useAppState } from './StateContext';

export default function Trade() {
  const { index, strike, setStrike, qty, setQty } = useAppState();
  const [status, setStatus] = useState(null);

  const executeTrade = async (type) => {
    setStatus('processing');
    try {
      const endpoint = import.meta.env.VITE_API_URL + '/api/buy'; // Using buy endpoint for both CE and PE test as requested previously
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, strike, type })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('success');
        setTimeout(() => setStatus(null), 2000);
      } else {
        setStatus('error');
        alert(data.message);
      }
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem' }}>
      
      {/* Header */}
      <div className="animate-slide-up" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.8rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px' }}>
          Execute<br/>
          <span style={{ fontWeight: '600', color: 'var(--accent-purple)' }}>Trade</span>
        </h1>
      </div>

      {/* Stock Market Candlestick Graphic */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s', display: 'flex', height: '110px', marginBottom: '2rem', background: '#111111', borderRadius: '24px', padding: '1rem', border: '1px solid #222' }}>
        <svg viewBox="0 0 400 100" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="bullGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="bearGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Grid Lines */}
          <line x1="0" y1="25" x2="400" y2="25" stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="50" x2="400" y2="50" stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="75" x2="400" y2="75" stroke="#333" strokeWidth="1" strokeDasharray="4 4" />

          <g filter="url(#glow)">
            {/* Candle 1 */}
            <line x1="30" y1="60" x2="30" y2="90" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="22" y="70" width="16" height="15" fill="url(#bullGrad)" rx="3" />
            
            {/* Candle 2 */}
            <line x1="80" y1="50" x2="80" y2="80" stroke="#3b82f6" strokeWidth="2" />
            <rect x="72" y="60" width="16" height="20" fill="url(#bearGrad)" rx="3" />
            
            {/* Candle 3 */}
            <line x1="130" y1="40" x2="130" y2="70" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="122" y="45" width="16" height="20" fill="url(#bullGrad)" rx="3" />
            
            {/* Candle 4 */}
            <line x1="180" y1="20" x2="180" y2="60" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="172" y="30" width="16" height="25" fill="url(#bullGrad)" rx="3" />
            
            {/* Candle 5 */}
            <line x1="230" y1="15" x2="230" y2="45" stroke="#3b82f6" strokeWidth="2" />
            <rect x="222" y="25" width="16" height="15" fill="url(#bearGrad)" rx="3" />
            
            {/* Candle 6 */}
            <line x1="280" y1="10" x2="280" y2="40" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="272" y="15" width="16" height="20" fill="url(#bullGrad)" rx="3" />
            
            {/* Candle 7 */}
            <line x1="330" y1="5" x2="330" y2="30" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="322" y="10" width="16" height="15" fill="url(#bullGrad)" rx="3" />
            
            {/* Candle 8 */}
            <line x1="380" y1="2" x2="380" y2="25" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="372" y="5" width="16" height="15" fill="url(#bullGrad)" rx="3" />
          </g>
        </svg>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '120px' }}>
        
        {/* Trading Card */}
        <div className="futuristic-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '600', lineHeight: '1', letterSpacing: '-1px', marginBottom: '1.5rem', textAlign: 'center' }}>
            {index}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
             {/* Strike Control */}
             <div>
               <div style={{ fontSize: '0.9rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '6px' }}>Strike Price</div>
               <div className="futuristic-input-container">
                 <button onClick={() => setStrike(s => String(Number(s) - 50))} style={{ padding: '12px', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}><Minus size={20}/></button>
                 <input type="number" className="futuristic-input" value={strike} onChange={e => setStrike(e.target.value)} />
                 <button onClick={() => setStrike(s => String(Number(s) + 50))} style={{ padding: '12px', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}><Plus size={20}/></button>
               </div>
             </div>

             {/* Qty Control */}
             <div>
               <div style={{ fontSize: '0.9rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '6px' }}>Quantity</div>
               <div className="futuristic-input-container">
                 <button onClick={() => setQty(q => String(Math.max(0, Number(q) - 65)))} style={{ padding: '12px', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}><Minus size={20}/></button>
                 <input type="number" className="futuristic-input" value={qty} onChange={e => setQty(e.target.value)} />
                 <button onClick={() => setQty(q => String(Number(q) + 65))} style={{ padding: '12px', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}><Plus size={20}/></button>
               </div>
             </div>
          </div>
        </div>

        {/* Action Pills - Modern Flat iOS Style */}
        <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.8rem' }}>
          <button className="futuristic-pill" onClick={() => executeTrade('CE')} disabled={status === 'processing'} 
                  style={{ flex: '1', background: '#8b5cf6', border: 'none', color: 'white', padding: '1.6rem', justifyContent: 'center', borderRadius: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Zap color="white" size={24} />
               <span style={{ fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.5px' }}>BUY CE</span>
             </div>
          </button>

          <button className="futuristic-pill" onClick={() => executeTrade('PE')} disabled={status === 'processing'} 
                  style={{ flex: '1', background: '#3b82f6', border: 'none', color: 'white', padding: '1.6rem', justifyContent: 'center', borderRadius: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Zap color="white" size={24} />
               <span style={{ fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.5px' }}>BUY PE</span>
             </div>
          </button>
        </div>
      </div>
      
      <NavBar />
    </div>
  );
}
