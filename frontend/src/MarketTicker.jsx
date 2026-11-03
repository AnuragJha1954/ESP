import React, { useState, useEffect } from 'react';
import { realtimeService } from './services/realtimeService';

const INITIAL_TICKER = [
  { symbol: 'NSE/BSE', price: '22,702.40', change: '-47.35 (-0.21%)', up: false },
  { symbol: 'BANKNIFTY', price: '54,302.10', change: '+158.30 (+0.31%)', up: true },
  { symbol: 'FINNIFTY', price: '23,890.60', change: '-28.40 (-0.12%)', up: false },
  { symbol: 'INDIA VIX', price: '13.84', change: '-0.30 (-2.12%)', up: false },
  { symbol: 'NIFTY 24200 CE', price: '142.50', change: '+18.20 (+14.6%)', up: true },
  { symbol: 'NIFTY 24150 PE', price: '98.20', change: '-14.30 (-12.7%)', up: false },
  { symbol: 'NODE ESP32', price: 'DEV-0012', change: 'AES-256 Active', up: true }
];

export default function MarketTicker() {
  const [tickerItems, setTickerItems] = useState(INITIAL_TICKER);

  const formatQuotes = (data) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    return data.map(d => ({
      symbol: d.symbol === 'NIFTY 50' ? 'NSE/BSE' : d.symbol,
      price: typeof d.price === 'number' ? d.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(d.price),
      change: typeof d.change === 'number'
        ? `${d.change > 0 ? '+' : ''}${d.change.toFixed(2)} (${d.pct > 0 ? '+' : ''}${d.pct}%)`
        : String(d.change || ''),
      up: d.up !== false && (typeof d.change === 'number' ? d.change >= 0 : !String(d.change).startsWith('-'))
    }));
  };

  useEffect(() => {
    let mounted = true;

    // Fetch initial market quotes ONCE on mount
    const fetchInitial = async () => {
      try {
        const ep = (import.meta.env.VITE_API_URL || '') + '/api/market/quotes';
        const res = await fetch(ep);
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.data) {
            const formatted = formatQuotes(json.data);
            if (formatted) setTickerItems(formatted);
          }
        }
      } catch (e) {}
    };

    fetchInitial();

    // Zero-Polling: Subscribe to Real-Time SSE pushes for market quotes
    const unsubQuotes = realtimeService.subscribe('market_quotes', (data) => {
      if (mounted && data) {
        const formatted = formatQuotes(data);
        if (formatted) setTickerItems(formatted);
      }
    });

    // If user returns to tab after a long time, refresh once on visibility change
    const handleVisibility = () => {
      if (!document.hidden && mounted) {
        fetchInitial();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      unsubQuotes();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="ticker" aria-label="Market ticker">
      <div className="ticker-viewport">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, idx) => (
            <React.Fragment key={idx}>
              <span className="tick">
                {item.symbol.includes('NSE') && (
                  <span className="live" style={{ width: '6px', height: '6px' }} />
                )}
                <span>{item.symbol}</span>
                <span className="val">{item.price}</span>
                {item.change && (
                  <span className={item.up ? 'chg-up' : 'chg'}>{item.change}</span>
                )}
              </span>
              <span className="tick-sep" />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
