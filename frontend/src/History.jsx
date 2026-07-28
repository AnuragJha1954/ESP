import { useState } from 'react';
import NavBar from './NavBar';

export default function History() {
  const [history] = useState([
    { id: 1, symbol: 'NIFTY', strike: '24050', type: 'CE', qty: '65', status: 'COMPLETED' },
    { id: 2, symbol: 'NIFTY', strike: '24050', type: 'PE', qty: '65', status: 'REJECTED' }
  ]);

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem' }}>
      
      {/* Header */}
      <div className="animate-slide-up" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '400', lineHeight: '1.1', letterSpacing: '-1px' }}>
          Trade<br/>
          <span style={{ fontWeight: '600', color: 'white' }}>History</span>
        </h1>
      </div>

      {/* Abstract Pulse Graphic */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s', marginBottom: '2rem', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(124,58,237,0.1))', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 40" style={{ width: '100%', height: '100%' }}>
          <path d="M0 20 L40 20 L50 5 L60 35 L70 20 L200 20" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="300" strokeDashoffset="300">
            <animate attributeName="stroke-dashoffset" values="300;0" dur="2s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>

      {/* History List */}
      <div className="animate-slide-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '120px' }}>
        {history.map(trade => (
          <div key={trade.id} className="futuristic-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
              {trade.symbol} {trade.strike} {trade.type}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
               <div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '4px' }}>Quantity</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{trade.qty}</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-inverse)', fontWeight: '600', marginBottom: '4px' }}>Status</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: '600', color: trade.status === 'COMPLETED' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{trade.status}</div>
               </div>
            </div>
          </div>
        ))}
      </div>
      
      <NavBar />
    </div>
  );
}
