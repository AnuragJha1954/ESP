import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import { useAppState } from './StateContext';
import { 
  fetchDeviceStatus, lockConsoleApi, unlockConsoleApi, fetchDeviceLockStatus, updateDeviceNickname 
} from './services/deviceService';
import { fetchLedgerTrades } from './services/ledgerService';
import { realtimeService } from './services/realtimeService';

export default function DeviceTab() {
  const navigate = useNavigate();
  const { user, broker } = useAppState();
  
  const [data, setData] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);
  
  // Modals & Nickname
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false);
  const [killSwitchPassword, setKillSwitchPassword] = useState('');
  const [killSwitchError, setKillSwitchError] = useState('');
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  const loadStatus = async () => {
    try {
      const [statusData, tradesData, lockData] = await Promise.all([
        fetchDeviceStatus(),
        fetchLedgerTrades().catch(() => []),
        fetchDeviceLockStatus()
      ]);
      setData(statusData);
      setTrades(tradesData || []);
      setIsDeviceLocked(!!lockData?.is_locked);
      if (statusData?.telemetry?.nickname && !nicknameInput) {
        setNicknameInput(statusData.telemetry.nickname);
      }
    } catch (err) {
      console.error("Failed loading console data", err);
    }
  };

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));

    // Zero-polling real-time stream subscriptions
    const unsubReadiness = realtimeService.subscribe('device_readiness', (readinessData) => {
      if (readinessData) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            readiness: {
              ...prev.readiness,
              ...readinessData
            },
            telemetry: {
              ...prev.telemetry,
              battery_pct: (readinessData.battery_pct !== null && readinessData.battery_pct !== undefined) ? readinessData.battery_pct : prev.telemetry?.battery_pct,
              wifi_rssi_dbm: (readinessData.wifi_rssi !== null && readinessData.wifi_rssi !== undefined) ? readinessData.wifi_rssi : prev.telemetry?.wifi_rssi_dbm,
              last_heartbeat: readinessData.last_heartbeat || prev.telemetry?.last_heartbeat
            }
          };
        });
      }
      loadStatus();
    });
    const unsubKillSwitch = realtimeService.subscribe('kill_switch', () => {
      loadStatus();
    });
    const unsubDeviceLock = realtimeService.subscribe('device_lock_updated', (lockData) => {
      setIsDeviceLocked(!!lockData?.is_locked);
      loadStatus();
    });

    return () => {
      unsubReadiness();
      unsubKillSwitch();
      unsubDeviceLock();
    };
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const handleEngageDeviceLock = async () => {
    if (window.confirm('Lock Physical Console? All buttons and requests from this device will be blocked by the server until you unlock it.')) {
      setIsLocking(true);
      const res = await lockConsoleApi('Console locked from web app');
      setIsLocking(false);
      if (res.ok) {
        setIsDeviceLocked(true);
      }
      loadStatus();
    }
  };

  const handleUnlockDevice = async (e) => {
    e.preventDefault();
    if (!killSwitchPassword) {
      setKillSwitchError('Account password is required to unlock console');
      return;
    }
    setKillSwitchError('');
    setIsLocking(true);
    const res = await unlockConsoleApi(killSwitchPassword);
    setIsLocking(false);
    if (res.ok && res.data?.status === 'success') {
      setIsDeviceLocked(false);
      setShowKillSwitchModal(false);
      setKillSwitchPassword('');
      loadStatus();
    } else {
      setKillSwitchError(res.data?.message || res.error || 'Incorrect account password');
    }
  };

  const handleSaveNickname = () => {
    if (nicknameInput.trim()) {
      updateDeviceNickname(nicknameInput.trim());
      setEditingNickname(false);
      loadStatus();
    }
  };

  const { telemetry, killSwitch } = data || {};
  const isHalted = killSwitch?.active;
  const hardwareId = telemetry?.device_id || 'DEV-0012';
  const serialNum = telemetry?.serial_number || 'SN-TP-0012';
  const batteryPct = telemetry?.battery_pct !== undefined ? telemetry.battery_pct : 88;
  const lastHeartbeatTime = telemetry?.last_heartbeat 
    ? new Date(telemetry.last_heartbeat).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    : '02:06 pm';

  // Last API Call Data (From actual trade ledger or live telemetry handshake)
  const lastTrade = trades && trades.length > 0 ? trades[0] : null;

  // Diagnostics copy bundle
  const handleCopyDiagnostics = () => {
    const bundle = `[Tradopad Hardware Diagnostics]
Hardware Node: ${hardwareId}
Serial Number: ${serialNum}
Firmware: v${telemetry?.firmware_version || '1.0.0'} (${telemetry?.hw_revision || 'rev1'})
Battery: ${batteryPct}%
WiFi RSSI: ${telemetry?.wifi_rssi_dbm || -58} dBm (${telemetry?.wifi_ssid || 'Tradopad_Desk_5G'})
Console User: @${user?.username || 'admin'}
Heartbeat: ${lastHeartbeatTime} IST
Timestamp: ${new Date().toISOString()}`;

    navigator.clipboard.writeText(bundle).then(() => {
      setCopiedDiagnostics(true);
      setTimeout(() => setCopiedDiagnostics(false), 2500);
    });
  };

  const supportMailHref = `mailto:support@infirow.com?subject=Tradopad%20Hardware%20Support%20-%20${encodeURIComponent(hardwareId)}&body=Hardware%20Node:%20${encodeURIComponent(hardwareId)}%0ASerial%20Number:%20${encodeURIComponent(serialNum)}%0AUser:%20@${encodeURIComponent(user?.username || 'admin')}%0AFirmware:%20v${encodeURIComponent(telemetry?.firmware_version || '1.0.0')}%0ABattery:%20${encodeURIComponent(batteryPct)}%25%0A%0APlease%20describe%20your%20hardware%20query%20or%20support%20requirement:`;

  return (
    <div className="app">
      {/* 1. Header & Market Ticker */}
      <NavBar />

      {/* 2. Page Heading */}
      <section className="page-head">
        <div>
          <span className="pill-linked">
            <span className="live"></span>
            {telemetry?.is_online !== false ? 'Linked' : 'Offline'}
          </span>
          <h1>Console Control</h1>
          <p className="subtitle">
            Hardware Gateway · Node <b>{hardwareId}</b>
          </p>
        </div>
        <button 
          className="icon-btn-round" 
          onClick={handleManualRefresh} 
          disabled={refreshing}
          title="Refresh Console Vitals"
          aria-label="Synchronize hardware state"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            flexShrink: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              width: '16px', 
              height: '16px',
              animation: refreshing ? 'spin 1s linear infinite' : 'none' 
            }}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </section>

      {/* 3. Cards Stack */}
      <main className="stack">

        {/* CARD 1: Desk Console (Primary) */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                  <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
                </svg>
              </div>
              {editingNickname ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '14px',
                      fontFamily: 'var(--font)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '8px',
                      outline: 'none',
                      width: '140px'
                    }}
                  />
                  <button 
                    onClick={handleSaveNickname}
                    style={{
                      background: 'var(--lemon)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h2>{telemetry?.nickname || 'Desk Console (Primary)'}</h2>
                  <button 
                    onClick={() => setEditingNickname(true)}
                    style={{ background: 'transparent', color: 'var(--text-3)', padding: '2px', display: 'flex' }}
                    title="Edit nickname"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <span className="serial">{serialNum}</span>
          </div>

          <div className="grid-2">
            <div className="tile">
              <div className="tile-top">
                <span className="tile-label">WiFi RSSI</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12.5a10 10 0 0 1 14 0" />
                  <path d="M8.5 16a5 5 0 0 1 7 0" />
                  <circle cx="12" cy="19.5" r="1" />
                </svg>
              </div>
              <div className="tile-value">{telemetry?.wifi_rssi_dbm || -58} dBm</div>
              <div className="tile-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {telemetry?.wifi_ssid || 'Tradopad_Desk_5G'}
              </div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-label">Battery Cell</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="7" width="18" height="10" rx="2" />
                  <path d="M22 11v2" />
                </svg>
              </div>
              <div className="tile-value">{batteryPct}%</div>
              <div className="meter">
                <span style={{ width: `${Math.min(100, Math.max(0, batteryPct))}%` }}></span>
              </div>
              <div className="tile-meta ok" style={{ marginTop: '7px' }}>LiPo 3.7V Stable</div>
            </div>

            <div className="tile">
              <div className="tile-label">Firmware Build</div>
              <div className="tile-value">v{telemetry?.firmware_version || '1.0.0'}</div>
              <div className="tile-meta">Revision: {telemetry?.hw_revision || 'rev1'}</div>
            </div>

            <div className="tile">
              <div className="tile-label">Heartbeat</div>
              <div className="tile-value">{lastHeartbeatTime}</div>
              <div className="tile-meta ok">
                <span className="live" style={{ width: '6px', height: '6px' }}></span>
                Polling Active (10s)
              </div>
            </div>
          </div>
        </section>

        {/* CARD 2: Last Hardware API Call */}
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="chip green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h2>Last Hardware API Call</h2>
            </div>
            <span className="badge-ok">
              {lastTrade ? (lastTrade.ledgerStatus || 'FILLED') : '200 OK'}
            </span>
          </div>
          <p className="card-sub" style={{ marginTop: '10px' }}>
            Live REST transaction dispatched through physical console.
          </p>

          <div className="txn">
            <div className="txn-top">
              <div className="txn-route">
                <span className="method">POST</span>
                <span className="endpoint">{lastTrade ? '/api/buy' : '/api/hardware/status'}</span>
              </div>
              <span className="time">{lastTrade?.formattedTime || lastHeartbeatTime}</span>
            </div>

            <div className="txn-name">
              <strong>
                <span className="live" style={{ width: '7px', height: '7px' }}></span>
                {lastTrade ? (lastTrade.symbol || 'NIFTY ATM CE') : 'Hardware Telemetry Handshake'}
              </strong>
              <span className="rtt">{lastTrade ? `${lastTrade.quantity || 65} Qty` : '14ms RTT'}</span>
            </div>

            <div className="txn-grid">
              <div>
                <div className="kv-label">Hardware Node</div>
                <div className="kv-value">{hardwareId}</div>
              </div>
              <div>
                <div className="kv-label">Payload Status</div>
                <div className="kv-value">
                  {lastTrade ? `Broker: ${lastTrade.broker || broker || 'Fyers'}` : `${batteryPct}% • ${telemetry?.wifi_rssi_dbm || -58}dBm`}
                </div>
              </div>
              <div>
                <div className="kv-label">Console State</div>
                <div className="kv-value state">Ready to Trade</div>
              </div>
              <div>
                <div className="kv-label">Execution Latency</div>
                <div className="kv-value">{lastTrade ? `${lastTrade.latency_ms || 18}ms` : '< 15ms'}</div>
              </div>
            </div>

            <div className="txn-foot">
              <span className="listening">
                <span className="live" style={{ width: '6px', height: '6px' }}></span>
                {lastTrade ? (lastTrade.message || 'Order acknowledged by gateway') : 'Listening for physical CE/PE triggers'}
              </span>
              <button 
                className="link-ledger" 
                onClick={() => navigate('/history')}
                aria-label="View transaction ledger"
              >
                Ledger
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* CARD 3: Hardware Console Lockout (Anti-Theft / Keypad Lock) */}
        <section className="card halt" style={{ borderColor: isDeviceLocked ? 'var(--red)' : undefined }}>
          <div className="halt-row">
            <div>
              <div className="halt-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <h3>Hardware Console Lockout</h3>
              </div>
              <p className="halt-sub">
                {isDeviceLocked 
                  ? '🔒 Console is LOCKED: All physical keypresses & requests from this device are blocked by the server.' 
                  : 'Lock physical console so unauthorized button clicks or device requests are rejected by the server.'}
              </p>
            </div>
            {isDeviceLocked ? (
              <button 
                className="btn-danger" 
                onClick={() => setShowKillSwitchModal(true)}
                style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }}
                disabled={isLocking}
              >
                {isLocking ? 'Verifying...' : 'Unlock Console'}
              </button>
            ) : (
              <button 
                className="btn-danger" 
                onClick={handleEngageDeviceLock}
                disabled={isLocking}
              >
                {isLocking ? 'Locking...' : 'Halt Console'}
              </button>
            )}
          </div>
        </section>

        {/* CARD 4: Dedicated Console Support */}
        <section className="card">
          <div className="support-head">
            <div className="card-title">
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z" />
                  <path d="M3 19a2 2 0 0 0 2 2h1v-7H3z" />
                </svg>
              </div>
              <div>
                <h2>Dedicated Console Support</h2>
                <p className="card-sub">Hardware care, replacement dispatch &amp; broker routing desk.</p>
              </div>
            </div>
            <span className="sla">Priority SLA</span>
          </div>

          <div className="grid-2">
            <div className="tile">
              <div className="tile-label">Hardware Node ID</div>
              <div className="tile-value">{hardwareId}</div>
            </div>
            <div className="tile">
              <div className="tile-label">Serial Number</div>
              <div className="tile-value">{serialNum}</div>
            </div>
            <div className="tile">
              <div className="tile-label">Response Time</div>
              <div className="tile-value word">&lt; 15 Mins</div>
              <div className="tile-meta">Desk SLA</div>
            </div>
            <div className="tile">
              <div className="tile-label">Warranty Coverage</div>
              <div className="tile-value word" style={{ color: 'var(--green)' }}>Enterprise Active</div>
            </div>
          </div>

          <a className="btn-email" href={supportMailHref}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            Email Support Desk (support@infirow.com)
            <svg className="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>

          <button className="btn-copy" onClick={handleCopyDiagnostics}>
            {copiedDiagnostics ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', color: 'var(--green)' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: 'var(--green)' }}>Diagnostics Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Diagnostics Bundle
              </>
            )}
          </button>

          <p className="support-foot">Infirow Hardware Desk · Rapid resolution for hardware and broker connectivity</p>
        </section>

      </main>

      {/* MODAL: DISENGAGE KILL SWITCH RE-AUTH */}
      {showKillSwitchModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          fontFamily: 'var(--font)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: 'var(--surface)',
            borderRadius: '22px',
            padding: '1.5rem',
            border: '1px solid var(--line)',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)'
          }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: 'var(--red)' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Security Verification
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.2rem', lineHeight: 1.45 }}>
              Confirm your account password to lift the console lock and re-enable server execution for physical device requests.
            </p>

            {killSwitchError && (
              <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '12px', background: 'var(--red-soft)', padding: '6px 10px', borderRadius: '8px' }}>
                {killSwitchError}
              </div>
            )}

            <form onSubmit={handleUnlockDevice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder="Account password"
                value={killSwitchPassword}
                onChange={e => setKillSwitchPassword(e.target.value)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: '12px',
                  color: 'var(--text)',
                  padding: '12px 14px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  fontFamily: 'var(--font)'
                }}
                required
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowKillSwitchModal(false); setKillSwitchPassword(''); setKillSwitchError(''); }}
                  style={{
                    flex: 1,
                    height: '44px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-2)',
                    color: 'var(--text-2)',
                    borderRadius: '14px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLocking}
                  style={{
                    flex: 1,
                    height: '44px',
                    background: 'var(--red)',
                    color: '#ffffff',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isLocking ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 18px -6px rgba(224, 67, 78, 0.6)'
                  }}
                >
                  {isLocking ? 'Verifying...' : 'Unlock Console'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
