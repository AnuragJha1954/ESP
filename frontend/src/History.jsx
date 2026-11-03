import React, { useState, useEffect, useMemo } from 'react';
import NavBar from './NavBar';
import { useAppState } from './StateContext';
import { fetchLedgerTrades, exportTradesCSV } from './services/ledgerService';

export default function History() {
  const { authToken } = useAppState();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTrades = async () => {
    try {
      const data = await fetchLedgerTrades();
      setTrades(data || []);
    } catch (err) {
      console.error("Failed to fetch ledger trades", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      loadTrades();
    }
  }, [authToken]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTrades();
  };

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchesStatus = 
        filterStatus === 'ALL' ? true :
        filterStatus === 'FILLED' ? (t.ledgerStatus === 'FILLED' || t.status === 'SUCCESS') :
        filterStatus === 'REJECTED' ? (t.ledgerStatus === 'REJECTED' || t.status === 'REJECTED' || t.status === 'FAILED') :
        filterStatus === 'BLOCKED' ? (t.ledgerStatus === 'BLOCKED ON DEVICE') :
        true;

      const matchesSearch = searchQuery === '' || 
        (t.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.broker_order_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.orderRef || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [trades, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const filledCount = trades.filter(t => t.ledgerStatus === 'FILLED' || t.status === 'SUCCESS').length;
    const rejectedCount = trades.filter(t => t.ledgerStatus === 'REJECTED' || t.status === 'REJECTED' || t.status === 'FAILED').length;
    const blockedCount = trades.filter(t => t.ledgerStatus === 'BLOCKED ON DEVICE').length;
    return {
      total: trades.length,
      filled: filledCount,
      rejected: rejectedCount,
      blocked: blockedCount
    };
  }, [trades]);

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'FILLED' || s === 'SUCCESS') {
      return (
        <span className="badge-ok">
          FILLED
        </span>
      );
    }
    if (s === 'REJECTED' || s === 'FAILED') {
      return (
        <span style={{
          font: '700 11px/1 var(--mono)',
          padding: '7px 10px',
          borderRadius: '999px',
          color: 'var(--red)',
          background: 'var(--red-soft)',
          border: '1px solid rgba(224, 67, 78, 0.22)',
          whiteSpace: 'nowrap'
        }}>
          REJECTED
        </span>
      );
    }
    if (s.includes('BLOCKED')) {
      return (
        <span className="sla">
          BLOCKED
        </span>
      );
    }
    return (
      <span style={{
        font: '700 11px/1 var(--mono)',
        padding: '7px 10px',
        borderRadius: '999px',
        color: 'var(--text-2)',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        whiteSpace: 'nowrap'
      }}>
        {status || 'LOGGED'}
      </span>
    );
  };

  return (
    <div className="app">
      {/* 1. Header & Moving Market Ticker */}
      <NavBar />

      {/* 2. Page Heading */}
      <section className="page-head">
        <div>
          <span className="pill-linked" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', borderColor: 'rgba(47, 102, 208, 0.22)' }}>
            <span className="live" style={{ background: 'var(--blue)', boxShadow: '0 0 0 0 rgba(47, 102, 208, 0.5)' }}></span>
            Hardware Audit
          </span>
          <h1>Trade Ledger</h1>
          <p className="subtitle">
            Direct Audit Log of Console Keypresses &amp; Execution Results
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title="Refresh Ledger"
            aria-label="Refresh ledger"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ width: '16px', height: '16px', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>

          <button
            onClick={() => exportTradesCSV(trades)}
            disabled={!trades.length}
            className="btn-sync"
            style={{ 
              height: '40px', 
              padding: '0 14px',
              opacity: trades.length ? 1 : 0.55, 
              cursor: trades.length ? 'pointer' : 'not-allowed' 
            }}
            aria-label="Export ledger CSV"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>CSV</span>
          </button>
        </div>
      </section>

      {/* 3. Main Stack */}
      <main className="stack">

        {/* KPI Counter Tiles (2x2 Grid) */}
        <div className="grid-2" style={{ marginTop: 0 }}>
          <div className="tile" style={{ background: 'var(--surface)' }}>
            <div className="tile-top">
              <span className="tile-label">TOTAL PRESSES</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', color: 'var(--text-3)' }}>
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </div>
            <div className="tile-value">{stats.total}</div>
            <div className="tile-meta">Physical Triggers</div>
          </div>

          <div className="tile" style={{ background: 'var(--surface)' }}>
            <div className="tile-top">
              <span className="tile-label" style={{ color: 'var(--green)' }}>FILLED</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', color: 'var(--green)' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="tile-value" style={{ color: 'var(--green)' }}>{stats.filled}</div>
            <div className="tile-meta ok">Broker Executed</div>
          </div>

          <div className="tile" style={{ background: 'var(--surface)' }}>
            <div className="tile-top">
              <span className="tile-label" style={{ color: 'var(--red)' }}>REJECTED</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', color: 'var(--red)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="tile-value" style={{ color: 'var(--red)' }}>{stats.rejected}</div>
            <div className="tile-meta" style={{ color: 'var(--red)' }}>Exchange / Margin</div>
          </div>

          <div className="tile" style={{ background: 'var(--surface)' }}>
            <div className="tile-top">
              <span className="tile-label" style={{ color: 'var(--amber)' }}>BLOCKED ON MCU</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', color: 'var(--amber)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="tile-value" style={{ color: 'var(--amber)' }}>{stats.blocked}</div>
            <div className="tile-meta" style={{ color: 'var(--amber)' }}>Halt Switch Engaged</div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {[
            { id: 'ALL', label: 'All Orders', count: stats.total },
            { id: 'FILLED', label: 'Filled', count: stats.filled },
            { id: 'REJECTED', label: 'Rejected', count: stats.rejected },
            { id: 'BLOCKED', label: 'Blocked', count: stats.blocked }
          ].map(tab => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '999px',
                  border: active ? 'none' : '1px solid var(--line)',
                  background: active ? 'var(--brand-gradient)' : 'var(--surface)',
                  color: active ? '#ffffff' : 'var(--text-2)',
                  fontSize: '12.5px',
                  fontWeight: active ? 700 : 600,
                  fontFamily: 'var(--font)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: active ? '0 6px 14px -6px rgba(92,110,240,.8)' : '0 1px 2px rgba(15,23,42,.04)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: active ? 'rgba(255,255,255,0.22)' : 'var(--surface-2)',
                  color: active ? '#ffffff' : 'var(--text-3)',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  fontWeight: 600
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orders Stream / Empty State */}
        {loading ? (
          <section className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div className="chip" style={{ margin: '0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Syncing Hardware Stream...</h2>
            <p className="card-sub" style={{ marginTop: '4px' }}>Querying verified execution telemetry from hardware gateway.</p>
          </section>
        ) : filteredTrades.length === 0 ? (
          <section className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div className="chip" style={{ margin: '0 auto 14px', width: '48px', height: '48px', borderRadius: '16px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
              </svg>
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>No Trade Orders Logged</h2>
            <p className="card-sub" style={{ maxWidth: '320px', margin: '6px auto 16px' }}>
              Press the CE or PE button on your physical Tradopad console to trigger orders.
            </p>
            <span className="pill-linked">
              <span className="live"></span>
              Listening for physical CE/PE triggers
            </span>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredTrades.map((t, idx) => {
              const isCall = (t.symbol || '').includes('CE') || (t.type || '').includes('CE');
              const timeStr = t.timestamp 
                ? new Date(t.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase() 
                : (t.created_at || '—');
              const isFilled = t.ledgerStatus === 'FILLED' || t.status === 'SUCCESS';
              const isRejected = t.ledgerStatus === 'REJECTED' || t.status === 'REJECTED' || t.status === 'FAILED';

              return (
                <section key={idx} className="card" style={{ padding: '16px 18px' }}>
                  <div className="card-head">
                    <div className="card-title">
                      <div className={`chip ${isCall ? 'green' : ''}`} style={!isCall ? { background: 'var(--red-soft)', color: 'var(--red)' } : {}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <div>
                        <h2 style={{ fontSize: '15px' }}>{t.symbol || 'NIFTY ATM CONTRACT'}</h2>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'var(--mono)',
                          color: isCall ? 'var(--green)' : 'var(--red)',
                          letterSpacing: '0.04em'
                        }}>
                          {isCall ? 'BUY CALL (CE)' : 'BUY PUT (PE)'}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(t.ledgerStatus || t.status)}
                  </div>

                  <div className="txn" style={{ marginTop: '12px', padding: '14px' }}>
                    <div className="txn-top">
                      <div className="txn-route">
                        <span className="method">POST</span>
                        <span className="endpoint">{t.endpoint || '/api/buy'}</span>
                      </div>
                      <span className="time">{timeStr}</span>
                    </div>

                    <div className="txn-grid" style={{ marginTop: '12px', paddingTop: '12px' }}>
                      <div>
                        <div className="kv-label">Volume / Qty</div>
                        <div className="kv-value">{t.quantity || t.qty || 65} Units</div>
                      </div>
                      <div>
                        <div className="kv-label">Gateway Latency</div>
                        <div className="kv-value">{t.latency_ms || 18}ms RTT</div>
                      </div>
                      <div>
                        <div className="kv-label">Execution Broker</div>
                        <div className="kv-value state" style={{ color: 'var(--text)' }}>{t.broker || 'Fyers API v3'}</div>
                      </div>
                      <div>
                        <div className="kv-label">Broker Order ID</div>
                        <div className="kv-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.broker_order_id || t.orderRef || 'EXEC-CONSOLE-DIRECT'}
                        </div>
                      </div>
                    </div>

                    <div className="txn-foot" style={{ marginTop: '12px', paddingTop: '10px' }}>
                      <span style={{ color: isRejected ? 'var(--red)' : 'var(--text-2)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.message || 'Dispatched through physical MCU trigger button'}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', flexShrink: 0 }}>
                        {t.device_id ? `Node ${t.device_id}` : (user?.bound_device_id ? `Node ${user.bound_device_id}` : 'Terminal Direct')}
                      </span>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
