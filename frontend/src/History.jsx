import { useState, useEffect } from 'react';
import NavBar from './NavBar';
import { useAppState } from './StateContext';

export default function History() {
  const { authToken } = useAppState();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/user/trade-history', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setHistory(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch history");
      } finally {
        setLoading(false);
      }
    };
    if (authToken) {
      fetchHistory();
    }
  }, [authToken]);

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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No trades found.</div>
        ) : history.map(trade => (
          <div key={trade.id} className="futuristic-card" style={{ padding: '1.5rem', borderLeft: `4px solid ${trade.status === 'SUCCESS' ? 'var(--accent-green)' : trade.status === 'REJECTED' || trade.status === 'FAILED' ? 'var(--accent-red)' : 'var(--accent-blue)'}` }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.5rem', letterSpacing: '-0.5px', color: '#fff' }}>
              {trade.symbol} {trade.type}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1rem' }}>
              {new Date(trade.created_at).toLocaleString()} &bull; {trade.broker}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
               <div>
                 <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Side / Qty</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: '600', color: trade.side === 'BUY' ? '#60a5fa' : '#f87171' }}>{trade.side} {trade.quantity}</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Status</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: '600', color: trade.status === 'SUCCESS' ? 'var(--accent-green)' : trade.status === 'REJECTED' || trade.status === 'FAILED' ? 'var(--accent-red)' : '#fff' }}>{trade.status}</div>
               </div>
            </div>
            {trade.message && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px' }}>
                {trade.message}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <NavBar />
    </div>
  );
}
