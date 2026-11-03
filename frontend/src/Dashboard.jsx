import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from './StateContext';
import NavBar from './NavBar';
import CustomSelect from './CustomSelect';
import { fetchExpiries, getLotMultiplier, getRiskSettings, saveRiskSettings } from './services/setupService';
import { 
  fetchTokenState, 
  generateTokenNow, 
  revokeToken,
  fetchTokensStatus,
  refreshAllTokensNow,
  formatTimeRemaining,
  formatISTTime
} from './services/tokenService';
import { triggerKillSwitchApi, fetchKillSwitchApi } from './services/deviceService';
import { realtimeService } from './services/realtimeService';

// Master Catalog of Supported Brokers
const ALL_AVAILABLE_BROKERS = [
  { 
    id: 'Fyers', 
    name: 'Fyers Securities', 
    apiLabel: 'Fyers API v3', 
    tag: '100% Free', 
    desc: 'Official REST API v3 for high-speed equity & options trading.',
    shortLabel: 'Fyers'
  },
  { 
    id: 'Dhan', 
    name: 'DhanHQ', 
    apiLabel: 'DhanHQ v2 API', 
    tag: '100% Free', 
    desc: 'Developer-friendly v2 API with ultra-fast order placement.',
    shortLabel: 'DhanHQ'
  },
  { 
    id: 'Upstox', 
    name: 'Upstox', 
    apiLabel: 'Upstox API v2', 
    tag: 'Free Retail', 
    desc: 'Modern REST API v2 with direct market orders & options routing.',
    shortLabel: 'Upstox'
  },
  { 
    id: 'Angel One', 
    name: 'Angel One', 
    apiLabel: 'SmartAPI', 
    tag: '100% Free', 
    desc: 'Institutional-grade SmartAPI with automated TOTP authentication.',
    shortLabel: 'Angel One'
  },
  { 
    id: 'Kotak Neo', 
    name: 'Kotak Neo', 
    apiLabel: 'Neo Trade API', 
    tag: 'Free for Neo', 
    desc: 'Ultra-low latency execution router for Kotak Neo accounts.',
    shortLabel: 'Kotak Neo'
  },
  { 
    id: 'Zerodha', 
    name: 'Zerodha Kite Connect', 
    apiLabel: 'Kite Connect API', 
    tag: 'Free API', 
    desc: 'Official Kite Connect API with daily request-token exchange.',
    shortLabel: 'Zerodha Kite'
  }
];

export default function Dashboard() {
  const { 
    user,
    authToken,
    broker, setBroker, 
    addedBrokers = ['Fyers'],
    addBroker,
    removeBroker,
    index, setIndex, 
    expiry, setExpiry, 
    autoExpiry, setAutoExpiry,
    killSwitchScope = 'current',
    theme
  } = useAppState();

  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [saveToast, setSaveToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingHeader, setIsRefreshingHeader] = useState(false);

  // Emergency Kill Switch State
  const [killSwitchInfo, setKillSwitchInfo] = useState({ active: false });
  const [isKillSwitchTriggering, setIsKillSwitchTriggering] = useState(false);
  const [killSwitchFeedback, setKillSwitchFeedback] = useState(null);

  // Active tab in Vault (must be one of addedBrokers, or defaults to active broker)
  const [activeBrokerTab, setActiveBrokerTab] = useState(broker || 'Fyers');
  const [addBrokerModalOpen, setAddBrokerModalOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [reAuthModalOpen, setReAuthModalOpen] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthError, setReAuthError] = useState('');

  // 1. Fyers
  const [fyersId, setFyersId] = useState('');
  const [fyersAppId, setFyersAppId] = useState('');
  const [fyersSecretKey, setFyersSecretKey] = useState('');
  const [fyersTotpSecret, setFyersTotpSecret] = useState('');
  const [fyersPin, setFyersPin] = useState('');
  const [fyersAccessToken, setFyersAccessToken] = useState('');

  // 2. Dhan
  const [dhanClientId, setDhanClientId] = useState('');
  const [dhanApiKey, setDhanApiKey] = useState('');
  const [dhanApiSecret, setDhanApiSecret] = useState('');
  const [dhanPassword, setDhanPassword] = useState('');
  const [dhanTotpSecret, setDhanTotpSecret] = useState('');
  const [dhanAccessToken, setDhanAccessToken] = useState('');

  // 3. Upstox
  const [upstoxApiKey, setUpstoxApiKey] = useState('');
  const [upstoxApiSecret, setUpstoxApiSecret] = useState('');
  const [upstoxRedirectUrl, setUpstoxRedirectUrl] = useState('');
  const [upstoxAccessToken, setUpstoxAccessToken] = useState('');

  // 4. Angel One
  const [angelClientCode, setAngelClientCode] = useState('');
  const [angelPassword, setAngelPassword] = useState('');
  const [angelApiKey, setAngelApiKey] = useState('');
  const [angelTotpSecret, setAngelTotpSecret] = useState('');
  const [angelAccessToken, setAngelAccessToken] = useState('');

  // 5. Kotak Neo
  const [kotakConsumerKey, setKotakConsumerKey] = useState('');
  const [kotakConsumerSecret, setKotakConsumerSecret] = useState('');
  const [kotakMobile, setKotakMobile] = useState('');
  const [kotakPassword, setKotakPassword] = useState('');
  const [kotakMpin, setKotakMpin] = useState('');
  const [kotakAccessToken, setKotakAccessToken] = useState('');

  // 6. Zerodha Kite
  const [zerodhaApiKey, setZerodhaApiKey] = useState('');
  const [zerodhaApiSecret, setZerodhaApiSecret] = useState('');
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState('');
  const [zerodhaAccessToken, setZerodhaAccessToken] = useState('');

  // Vault UI & Token State
  const [vaultStatus, setVaultStatus] = useState({ type: '', msg: '' });
  const [vaultLoading, setVaultLoading] = useState(false);
  const [tokenState, setTokenState] = useState({
    tokenValidToday: false,
    tokenGeneratedAt: null,
    activeBroker: broker || 'Fyers'
  });
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenCooldown, setTokenCooldown] = useState(0);
  const [tokenFeedback, setTokenFeedback] = useState(null);

  // Multi-broker live tokens status & automated sync
  const [tokensStatusData, setTokensStatusData] = useState(null);
  const [refreshingAllTokens, setRefreshingAllTokens] = useState(false);
  const [refreshAllFeedback, setRefreshAllFeedback] = useState(null);

  // Sync activeBrokerTab when addedBrokers change
  useEffect(() => {
    if (addedBrokers.length > 0 && !addedBrokers.includes(activeBrokerTab)) {
      setActiveBrokerTab(addedBrokers[0]);
    }
  }, [addedBrokers, activeBrokerTab]);

  // Options for Contract Routing: ONLY list user's added brokers!
  const brokerOptions = useMemo(() => {
    return addedBrokers.map(bId => {
      const match = ALL_AVAILABLE_BROKERS.find(b => b.id === bId);
      return {
        label: match ? `${match.name} (${match.apiLabel})` : bId,
        value: bId
      };
    });
  }, [addedBrokers]);

  // Unadded brokers available to connect
  const unaddedBrokers = useMemo(() => {
    return ALL_AVAILABLE_BROKERS.filter(b => !addedBrokers.includes(b.id));
  }, [addedBrokers]);

  const indexOptions = [
    { label: 'NIFTY 50 (NSE)', value: 'NIFTY' },
    { label: 'BANK NIFTY (NSE)', value: 'BANKNIFTY' },
    { label: 'FIN NIFTY (NSE)', value: 'FINNIFTY' },
    { label: 'MIDCAP NIFTY (NSE)', value: 'MIDCPNIFTY' },
    { label: 'SENSEX (BSE)', value: 'SENSEX' },
    { label: 'BANKEX (BSE)', value: 'BANKEX' }
  ];

  const lotMultiplier = useMemo(() => getLotMultiplier(index), [index]);

  // Load versioned expiries from backend calendar with fallback
  useEffect(() => {
    let mounted = true;
    fetchExpiries(index).then(opts => {
      if (!mounted) return;
      setAvailableExpiries(opts);
      if (opts.length > 0) {
        // Auto-select latest upcoming Tuesday expiry if autoExpiry is active OR if current expiry is empty or in the past
        if (autoExpiry || !expiry || !opts.some(o => o.value === expiry)) {
          setExpiry(opts[0].value);
        }
      }
    });
    return () => { mounted = false; };
  }, [index, autoExpiry]);

  // Expiry Day check (matches today's active Tuesday contract)
  const isExpiryDay = useMemo(() => {
    if (!expiry) return false;
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    if (ist.getDay() !== 2) return false; // Expiries are strictly on Tuesdays
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dd = String(ist.getDate()).padStart(2, '0');
    const mmm = months[ist.getMonth()];
    const yy = String(ist.getFullYear()).slice(-2);
    const todayCode = `${dd}${mmm}${yy}`;
    return expiry === todayCode;
  }, [expiry]);

  // Load broker credentials & token status
  const loadCredentialsAndStatus = async () => {
    if (!authToken) return;
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/credentials', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const c = data.data;
        // Fyers
        if (c.fyers_id) setFyersId(c.fyers_id);
        if (c.fyers_app_id) setFyersAppId(c.fyers_app_id);
        if (c.fyers_secret_key) setFyersSecretKey(c.fyers_secret_key);
        if (c.fyers_totp_secret) setFyersTotpSecret(c.fyers_totp_secret);
        if (c.fyers_pin) setFyersPin(c.fyers_pin);
        if (c.fyers_access_token) setFyersAccessToken(c.fyers_access_token);

        // Dhan
        if (c.dhan_client_id) setDhanClientId(c.dhan_client_id);
        if (c.dhan_api_key) setDhanApiKey(c.dhan_api_key);
        if (c.dhan_api_secret) setDhanApiSecret(c.dhan_api_secret);
        if (c.dhan_password) setDhanPassword(c.dhan_password);
        if (c.dhan_totp_secret) setDhanTotpSecret(c.dhan_totp_secret);
        if (c.dhan_access_token) setDhanAccessToken(c.dhan_access_token);

        // Upstox
        if (c.upstox_api_key) setUpstoxApiKey(c.upstox_api_key);
        if (c.upstox_api_secret) setUpstoxApiSecret(c.upstox_api_secret);
        if (c.upstox_redirect_url) setUpstoxRedirectUrl(c.upstox_redirect_url);
        if (c.upstox_access_token) setUpstoxAccessToken(c.upstox_access_token);

        // Angel One
        if (c.angel_client_code) setAngelClientCode(c.angel_client_code);
        if (c.angel_password) setAngelPassword(c.angel_password);
        if (c.angel_api_key) setAngelApiKey(c.angel_api_key);
        if (c.angel_totp_secret) setAngelTotpSecret(c.angel_totp_secret);
        if (c.angel_access_token) setAngelAccessToken(c.angel_access_token);

        // Kotak Neo
        if (c.kotak_consumer_key) setKotakConsumerKey(c.kotak_consumer_key);
        if (c.kotak_consumer_secret) setKotakConsumerSecret(c.kotak_consumer_secret);
        if (c.kotak_mobile) setKotakMobile(c.kotak_mobile);
        if (c.kotak_password) setKotakPassword(c.kotak_password);
        if (c.kotak_mpin) setKotakMpin(c.kotak_mpin);
        if (c.kotak_access_token) setKotakAccessToken(c.kotak_access_token);

        // Zerodha Kite
        if (c.zerodha_api_key) setZerodhaApiKey(c.zerodha_api_key);
        if (c.zerodha_api_secret) setZerodhaApiSecret(c.zerodha_api_secret);
        if (c.zerodha_request_token) setZerodhaRequestToken(c.zerodha_request_token);
        if (c.zerodha_access_token) setZerodhaAccessToken(c.zerodha_access_token);
      }

      if (activeBrokerTab) {
        const tState = await fetchTokenState(activeBrokerTab);
        setTokenState(tState);
      }
      // Also sync multi-broker live tokens status
      await loadTokensStatus();
    } catch (err) {
      console.error("Failed to load broker credentials or status:", err);
    }
  };

  // Fetch live token status & countdown from server
  const loadTokensStatus = async () => {
    try {
      const data = await fetchTokensStatus();
      if (data && data.status === 'success') {
        setTokensStatusData(data);
      }
    } catch (err) {
      console.error("Failed to load tokens status:", err);
    }
  };

  useEffect(() => {
    loadCredentialsAndStatus();
  }, [authToken, activeBrokerTab, broker]);

  // Real-time Event Stream: Connect & subscribe to zero-polling token status broadcasts
  useEffect(() => {
    if (!authToken) return;
    realtimeService.connect(authToken);

    const unsubTokens = realtimeService.subscribe('tokens_status', (data) => {
      if (data && data.status === 'success') {
        setTokensStatusData(data);
      }
    });

    return () => {
      unsubTokens();
    };
  }, [authToken]);

  // Live countdown ticker: decrements remaining_seconds every second for all brokers
  useEffect(() => {
    const timer = setInterval(() => {
      setTokensStatusData(prev => {
        if (!prev || !prev.tokens) return prev;
        let changed = false;
        const nextTokens = prev.tokens.map(t => {
          if (t.remaining_seconds && t.remaining_seconds > 0) {
            changed = true;
            const rem = t.remaining_seconds - 1;
            return {
              ...t,
              remaining_seconds: rem,
              token_valid_today: rem > 0 ? t.token_valid_today : false,
              session_active: rem > 0 ? t.session_active : false
            };
          }
          return t;
        });
        return changed ? { ...prev, tokens: nextTokens } : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to extract token info for any specific broker
  const getBrokerTokenInfo = (bId) => {
    if (!tokensStatusData?.tokens) return null;
    return tokensStatusData.tokens.find(t => t.broker.toLowerCase() === bId.toLowerCase()) || null;
  };

  const activeBrokerTabTokenInfo = useMemo(() => {
    return getBrokerTokenInfo(activeBrokerTab);
  }, [tokensStatusData, activeBrokerTab]);

  const activeBrokerTokenInfo = useMemo(() => {
    return getBrokerTokenInfo(broker);
  }, [tokensStatusData, broker]);

  // Cooldown timer tick
  useEffect(() => {
    if (tokenCooldown > 0) {
      const timer = setTimeout(() => setTokenCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [tokenCooldown]);

  // Save all setup controls to console
  const handleSaveRisk = () => {
    setIsSaving(true);
    saveRiskSettings({
      ...getRiskSettings(),
      broker,
      index,
      expiry
    });
    setTimeout(() => {
      setIsSaving(false);
      setSaveToast('Console setup saved and synced successfully.');
      setTimeout(() => setSaveToast(null), 3500);
    }, 300);
  };

  // Save Broker Credentials
  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setVaultLoading(true);
    setVaultStatus({ type: '', msg: '' });
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fyers_id: fyersId,
          fyers_totp_secret: fyersTotpSecret,
          fyers_pin: fyersPin,
          fyers_app_id: fyersAppId,
          fyers_secret_key: fyersSecretKey,
          fyers_access_token: fyersAccessToken,

          dhan_client_id: dhanClientId,
          dhan_password: dhanPassword,
          dhan_totp_secret: dhanTotpSecret,
          dhan_api_key: dhanApiKey,
          dhan_api_secret: dhanApiSecret,
          dhan_access_token: dhanAccessToken,

          upstox_api_key: upstoxApiKey,
          upstox_api_secret: upstoxApiSecret,
          upstox_redirect_url: upstoxRedirectUrl,
          upstox_access_token: upstoxAccessToken,

          angel_client_code: angelClientCode,
          angel_password: angelPassword,
          angel_api_key: angelApiKey,
          angel_totp_secret: angelTotpSecret,
          angel_access_token: angelAccessToken,

          kotak_consumer_key: kotakConsumerKey,
          kotak_consumer_secret: kotakConsumerSecret,
          kotak_mobile: kotakMobile,
          kotak_password: kotakPassword,
          kotak_mpin: kotakMpin,
          kotak_access_token: kotakAccessToken,

          zerodha_api_key: zerodhaApiKey,
          zerodha_api_secret: zerodhaApiSecret,
          zerodha_request_token: zerodhaRequestToken,
          zerodha_access_token: zerodhaAccessToken
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setVaultStatus({ type: 'success', msg: `${activeBrokerTab} credentials saved securely in vault!` });
        const tState = await fetchTokenState(activeBrokerTab);
        setTokenState(tState);
        await loadTokensStatus();
      } else {
        setVaultStatus({ type: 'error', msg: data.message || 'Failed to save credentials' });
      }
    } catch (err) {
      setVaultStatus({ type: 'error', msg: 'Network error occurred while saving' });
    } finally {
      setVaultLoading(false);
    }
  };

  // Add a new broker from catalog
  const handleSelectNewBroker = (brokerId) => {
    addBroker(brokerId);
    setActiveBrokerTab(brokerId);
    setAddBrokerModalOpen(false);
    setSaveToast(`Added ${brokerId} to your connected brokers. Enter your API credentials below.`);
    setTimeout(() => setSaveToast(null), 4000);
  };

  // Disconnect / Remove a broker
  const handleDisconnectBroker = (brokerId) => {
    if (!window.confirm(`Disconnect ${brokerId} from your console? Its active routing and session will be removed.`)) {
      return;
    }
    const nextList = removeBroker(brokerId);
    if (nextList.length > 0) {
      setActiveBrokerTab(nextList[0]);
    }
    setSaveToast(`Disconnected ${brokerId} successfully.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Refresh Daily Session Tokens for all added brokers (manual button)
  const handleRefreshAllTokens = async () => {
    if (refreshingAllTokens) return;
    setRefreshingAllTokens(true);
    setRefreshAllFeedback(null);
    try {
      const res = await refreshAllTokensNow();
      if (res.ok && res.data?.status === 'success') {
        const rawResults = res.data.results;
        const resultsList = Array.isArray(rawResults)
          ? rawResults
          : (rawResults && typeof rawResults === 'object' ? Object.values(rawResults) : []);
        setRefreshAllFeedback({
          type: 'success',
          msg: res.data.message || 'Daily session tokens refreshed for all connected brokers.',
          results: resultsList
        });
        await loadCredentialsAndStatus();
        await loadTokensStatus();
      } else {
        setRefreshAllFeedback({
          type: 'error',
          msg: res.data?.message || 'Failed to refresh daily tokens for all brokers.'
        });
      }
    } catch (err) {
      setRefreshAllFeedback({
        type: 'error',
        msg: 'Connection to server failed while refreshing tokens.'
      });
    } finally {
      setRefreshingAllTokens(false);
    }
  };

  // Load live Kill Switch state from backend API
  const loadKillSwitchStatus = async () => {
    try {
      const data = await fetchKillSwitchApi();
      if (data) {
        setKillSwitchInfo(data);
      }
    } catch (e) {}
  };

  // Real-time Event Stream: Zero-polling subscription for hardware & app kill switch updates
  useEffect(() => {
    loadKillSwitchStatus();

    const unsubKillSwitch = realtimeService.subscribe('kill_switch', (data) => {
      if (data) {
        setKillSwitchInfo(data);
      }
    });

    return () => {
      unsubKillSwitch();
    };
  }, []);

  // Emergency Kill Switch trigger
  const handleEngageKillSwitch = async () => {
    const isCurrentOnly = killSwitchScope === 'current';
    const targetDesc = isCurrentOnly 
      ? `on the currently selected broker (${broker || 'Active'})` 
      : `across ALL connected brokers (${addedBrokers.join(', ')})`;

    const confirmed = window.confirm(
      "🚨 EMERGENCY KILL SWITCH CONFIRMATION:\n\n" +
      "Are you sure you want to engage the Kill Switch?\n\n" +
      `• Open positions ${targetDesc} will be SQUARED OFF immediately.\n` +
      "• Pending orders will be cancelled.\n" +
      "• Hardware and app trading execution will be HALTED.\n\n" +
      "Proceed with emergency exit?"
    );
    if (!confirmed) return;

    setIsKillSwitchTriggering(true);
    setKillSwitchFeedback(null);
    try {
      const res = await triggerKillSwitchApi(true, `Trading Setup Panic Button (${killSwitchScope === 'all' ? 'All Brokers' : broker})`);
      setKillSwitchInfo({ active: true, triggered_by: 'WEB_APP', triggered_at: new Date().toISOString() });
      const rawRes = res?.kill_switch?.exit_results || res?.exit_results || [];
      const resultsList = Array.isArray(rawRes) ? rawRes : [];
      setKillSwitchFeedback({
        type: 'danger',
        msg: isCurrentOnly 
          ? `🚨 EMERGENCY HALT ACTIVE: All trades exited on ${broker || 'active broker'}.` 
          : '🚨 EMERGENCY HALT ACTIVE: All trades exited across all connected brokers.',
        results: resultsList
      });
      await loadCredentialsAndStatus();
    } catch (err) {
      setKillSwitchFeedback({
        type: 'danger',
        msg: `Kill switch signal triggered: ${err.message}`
      });
    } finally {
      setIsKillSwitchTriggering(false);
      loadKillSwitchStatus();
    }
  };

  // Disengage Kill Switch
  const handleDisengageKillSwitch = async () => {
    const confirmed = window.confirm("Disengage Emergency Kill Switch and resume order execution on this console?");
    if (!confirmed) return;

    try {
      await triggerKillSwitchApi(false, 'Disengaged by User in App');
      setKillSwitchInfo({ active: false });
      setKillSwitchFeedback({
        type: 'success',
        msg: '✓ Kill switch lifted. Console trading resumed.'
      });
    } catch (err) {
      alert('Failed to lift kill switch: ' + err.message);
    } finally {
      loadKillSwitchStatus();
    }
  };

  // Generate Token for currently viewed broker tab
  const handleGenerateToken = async () => {
    if (tokenCooldown > 0 || generatingToken) return;
    setGeneratingToken(true);
    setTokenFeedback(null);
    try {
      const res = await generateTokenNow(true, activeBrokerTab);
      if (res.ok && res.data?.status === 'success') {
        setTokenFeedback({ type: 'success', msg: res.data.message || `${activeBrokerTab} session token generated successfully!` });
        setTokenCooldown(30);
        const tState = await fetchTokenState(activeBrokerTab);
        setTokenState(tState);
        await loadTokensStatus();
      } else {
        setTokenFeedback({ type: 'error', msg: res.data?.message || `Token generation failed for ${activeBrokerTab}. Check API credentials.` });
      }
    } catch (err) {
      setTokenFeedback({ type: 'error', msg: 'Server connection failed.' });
    } finally {
      setGeneratingToken(false);
    }
  };

  // Revoke Token for user
  const handleRevokeToken = async () => {
    if (!window.confirm(`Are you sure you want to revoke today's ${activeBrokerTab} session token? Hardware order execution will require a new token.`)) {
      return;
    }
    await revokeToken(user?.id);
    const tState = await fetchTokenState(activeBrokerTab);
    setTokenState(tState);
    await loadTokensStatus();
    setTokenFeedback({ type: 'info', msg: `Session token for ${activeBrokerTab} was cleared.` });
  };

  // Re-auth to reveal secrets
  const handleReAuthSubmit = async (e) => {
    e.preventDefault();
    setReAuthError('');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password: reAuthPassword })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowSecrets(true);
        setReAuthModalOpen(false);
        setReAuthPassword('');
      } else {
        setReAuthError('Incorrect password');
      }
    } catch (err) {
      setReAuthError('Network error');
    }
  };

  const getBrokerFriendlyName = (b) => {
    const match = ALL_AVAILABLE_BROKERS.find(item => item.id === b);
    return match ? `${match.name} (${match.apiLabel})` : b;
  };

  const getBrokerShortLabel = (bId) => {
    const match = ALL_AVAILABLE_BROKERS.find(item => item.id === bId);
    return match ? match.shortLabel : bId;
  };

  return (
    <div className="app">
      {/* 1. Header & Moving Market Ticker */}
      <NavBar />

      {/* 2. Page Heading */}
      <section className="page-head">
        <div>
          <span className="pill-linked" style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)', borderColor: 'rgba(123, 91, 240, 0.22)' }}>
            <span className="live" style={{ background: 'var(--brand-violet)', boxShadow: '0 0 0 0 rgba(123, 91, 240, 0.5)' }}></span>
            Hardware Ready
          </span>
          <h1>Trading Setup</h1>
          <p className="subtitle">
            Target Instrument, Multi-Broker Vault &amp; Direct Order Routing
          </p>
        </div>
        <button 
          className="icon-btn-round" 
          onClick={async () => {
            setIsRefreshingHeader(true);
            await Promise.all([loadCredentialsAndStatus(), loadTokensStatus()]);
            setIsRefreshingHeader(false);
          }} 
          disabled={isRefreshingHeader}
          title="Refresh Setup Status"
          aria-label="Refresh setup status"
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
            cursor: isRefreshingHeader ? 'not-allowed' : 'pointer',
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
              animation: isRefreshingHeader ? 'spin 1s linear infinite' : 'none'
            }}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </section>

      {/* Save Toast Notification */}
      {saveToast && (
        <div style={{
          margin: '0 14px 12px',
          padding: '12px 16px',
          borderRadius: '16px',
          background: 'var(--green-soft)',
          border: '1px solid rgba(15, 157, 106, 0.25)',
          color: 'var(--green)',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{saveToast}</span>
        </div>
      )}

      {/* Expiry Day Rollover Warning */}
      {isExpiryDay && (
        <div style={{
          margin: '0 14px 12px',
          padding: '12px 16px',
          borderRadius: '16px',
          background: 'var(--amber-soft)',
          border: '1px solid rgba(184, 110, 0, 0.25)',
          color: 'var(--amber)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>Expiry Day Alert:</strong> Today is contract expiry. Ensure open options are closed before 15:00 IST.
          </div>
        </div>
      )}

      {/* 3. Cards Stack */}
      <main className="stack">

        {/* PROMINENT ACTIVE BROKER DISPLAY BANNER */}
        <section className="card active-broker-banner" style={{
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--brand-gradient)',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                boxShadow: '0 6px 16px -6px rgba(92,110,240,.7)',
                flexShrink: 0
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 700 }}>
                  Active Console Target
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{getBrokerFriendlyName(broker)}</span>
                </div>
              </div>
            </div>

            {/* Active Status Badge with Live Validity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span className="pill-linked" style={{
                background: (activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday) ? 'var(--green-soft)' : 'var(--amber-soft)',
                color: (activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday) ? 'var(--green)' : 'var(--amber)',
                borderColor: (activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday) ? 'rgba(15, 157, 106, 0.25)' : 'rgba(184, 110, 0, 0.25)',
                padding: '5px 10px',
                fontSize: '11.5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <span className="live" style={{
                  background: (activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday) ? 'var(--green)' : 'var(--amber)',
                  boxShadow: (activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday) ? '0 0 0 0 rgba(15, 157, 106, 0.5)' : 'none'
                }}></span>
                {(activeBrokerTokenInfo?.token_valid_today || tokenState.tokenValidToday)
                  ? `Session Active · ${formatTimeRemaining(activeBrokerTokenInfo?.remaining_seconds)}`
                  : 'Token Required'}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px dashed var(--line)',
            fontSize: '11.5px',
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>Physical CE/PE clicks route to <strong>{broker}</strong> via REST API.</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--brand-ink)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>1 Click = 1 Market Order</span>
          </div>
        </section>

        {/* CARD 1: Contract Routing */}
        <section className="card">
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ whiteSpace: 'nowrap' }}>Contract Routing</h2>
                <p className="card-sub">Exchange route &amp; automated strike resolution engine.</p>
              </div>
            </div>
            <span className="method" style={{ padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
              REST API
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '18px' }}>
            {/* Execution Broker (Only user's added brokers) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600 }}>Active Execution Broker</label>
                <span style={{ fontSize: '11.5px', color: 'var(--brand-ink)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {addedBrokers.length} Connected
                </span>
              </div>
              <CustomSelect 
                value={broker} 
                onChange={(val) => {
                  setBroker(val);
                  setActiveBrokerTab(val);
                }} 
                options={brokerOptions} 
              />
            </div>

            {/* Target Index */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600 }}>Target Index</label>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '999px',
                  background: 'var(--brand-soft)',
                  color: 'var(--brand-ink)',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  1 Lot = {lotMultiplier} units
                </span>
              </div>
              <CustomSelect value={index} onChange={setIndex} options={indexOptions} />
            </div>

            {/* Contract Expiry */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600 }}>Contract Expiry</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={autoExpiry} 
                    onChange={e => {
                      setAutoExpiry(e.target.checked);
                      if (e.target.checked && availableExpiries.length > 0) {
                        setExpiry(availableExpiries[0].value);
                      }
                    }} 
                    style={{ accentColor: 'var(--brand-violet)', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <span>Auto-nearest</span>
                </label>
              </div>
              <CustomSelect 
                value={expiry} 
                onChange={setExpiry} 
                options={availableExpiries} 
                disabled={autoExpiry} 
              />
            </div>

            {/* Save Routing Settings Action Button */}
            <div style={{ marginTop: '4px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
              <button 
                type="button"
                className="btn-primary" 
                onClick={handleSaveRisk} 
                disabled={isSaving}
                style={{ 
                  width: '100%', 
                  height: '42px', 
                  borderRadius: '12px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '13.5px'
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{isSaving ? 'Saving & Syncing...' : 'Save Routing Settings'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* CARD 2: Daily Session Tokens (Universal for all added brokers) */}
        <section className="card">
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ whiteSpace: 'nowrap' }}>Daily Session Tokens</h2>
                <p className="card-sub" style={{ marginTop: '2px', lineHeight: 1.35 }}>Universal authentication &amp; daily sync for all connected brokers.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshAllTokens}
              disabled={refreshingAllTokens}
              className="btn-sync"
              style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '11.5px',
                fontWeight: 700,
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Refresh daily session tokens for all connected brokers"
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                style={{ width: '13px', height: '13px', animation: refreshingAllTokens ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{refreshingAllTokens ? 'Syncing...' : 'Refresh All Tokens'}</span>
            </button>
          </div>

          {/* Multi-Broker Sync Results Feedback */}
          {refreshAllFeedback && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: refreshAllFeedback.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
              color: refreshAllFeedback.type === 'success' ? 'var(--green)' : 'var(--red)',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{refreshAllFeedback.msg}</span>
                <button 
                  type="button" 
                  onClick={() => setRefreshAllFeedback(null)} 
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '13px', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
              {refreshAllFeedback.results && refreshAllFeedback.results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', fontSize: '11.5px' }}>
                  {refreshAllFeedback.results.map((res, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{res.status === 'success' ? '✓' : res.status === 'skipped' ? '⚠' : '✕'}</span>
                      <strong>{res.broker}:</strong>
                      <span>{res.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedule Footer Note */}
          <div style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--line)',
            fontSize: '11.5px',
            color: 'var(--text-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            <span style={{ whiteSpace: 'nowrap' }}>⏰ Auto-generation schedule: Daily at 06:00:00 AM IST</span>
            <span style={{ whiteSpace: 'nowrap' }}>Midnight Expiry (23:59:59 IST)</span>
          </div>
        </section>

        {/* CARD 3: Emergency Kill Switch & Panic Exit */}
        <section className="card" style={{
          border: killSwitchInfo.active ? '1.5px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--line)',
          background: killSwitchInfo.active 
            ? (theme === 'dark' ? 'linear-gradient(135deg, #18111e 0%, #1e131d 100%)' : 'linear-gradient(180deg, #FFF8F8 0%, #FFFFFF 100%)') 
            : 'var(--surface)'
        }}>
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div className="chip" style={{
                background: killSwitchInfo.active ? 'rgba(239, 68, 68, 0.18)' : 'var(--red-soft)',
                color: 'var(--red)'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ whiteSpace: 'nowrap', color: killSwitchInfo.active ? 'var(--red)' : 'var(--text)' }}>
                  Emergency Kill Switch
                </h2>
                <p className="card-sub" style={{ marginTop: '2px', lineHeight: 1.35 }}>
                  Panic shutdown. Instantly exits all trades across brokers &amp; halts hardware.
                </p>
              </div>
            </div>

            <span className="pill-linked" style={{
              background: killSwitchInfo.active ? 'var(--red-soft)' : 'var(--green-soft)',
              color: killSwitchInfo.active ? 'var(--red)' : 'var(--green)',
              borderColor: killSwitchInfo.active ? 'rgba(239, 68, 68, 0.35)' : 'rgba(15, 157, 106, 0.25)',
              padding: '5px 10px',
              fontSize: '11.5px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              <span className="live" style={{
                background: killSwitchInfo.active ? 'var(--red)' : 'var(--green)',
                boxShadow: killSwitchInfo.active ? '0 0 0 0 rgba(239, 68, 68, 0.5)' : 'none'
              }}></span>
              {killSwitchInfo.active ? 'HALTED · TRADES EXITED' : 'Armed & Ready'}
            </span>
          </div>

          {/* Kill Switch Trigger Button or Active State Banner */}
          {!killSwitchInfo.active ? (
            <button
              type="button"
              onClick={handleEngageKillSwitch}
              disabled={isKillSwitchTriggering}
              style={{
                width: '100%',
                marginTop: '14px',
                height: '42px',
                padding: '0 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isKillSwitchTriggering ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px -4px rgba(220, 38, 38, 0.55)',
                transition: 'all 0.15s ease'
              }}
              title={killSwitchScope === 'all' 
                ? "Immediately exit all trades across all connected brokers and lock hardware" 
                : `Immediately exit open trades on ${broker || 'current broker'} and lock hardware`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', flexShrink: 0 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>
                {isKillSwitchTriggering 
                  ? (killSwitchScope === 'all' ? 'Exiting All Brokers...' : `Exiting ${broker} Trades...`) 
                  : (killSwitchScope === 'all' ? 'ENGAGE KILL SWITCH · EXIT ALL BROKERS' : `ENGAGE KILL SWITCH · EXIT ${broker?.toUpperCase() || 'CURRENT'} TRADES`)}
              </span>
            </button>
          ) : (
            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'var(--red-soft)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)', fontWeight: 700, fontSize: '12.5px' }}>
                  <span>🚨</span>
                  <span>
                    {killSwitchScope === 'all' 
                      ? 'ALL POSITIONS SQUARED OFF · CONSOLE LOCKED' 
                      : `${broker?.toUpperCase() || 'CURRENT BROKER'} SQUARED OFF · CONSOLE LOCKED`}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--red)', fontWeight: 600 }}>
                  Source: {killSwitchInfo?.triggered_by || 'EMERGENCY'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.4 }}>
                Emergency kill switch is currently active. All open positions were exited and hardware order execution is blocked.
              </p>
              <button
                type="button"
                onClick={handleDisengageKillSwitch}
                style={{
                  marginTop: '4px',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                Disengage Kill Switch &amp; Resume
              </button>
            </div>
          )}

          {/* Feedback Notification */}
          {killSwitchFeedback && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: killSwitchFeedback.type === 'danger' ? 'var(--red-soft)' : 'var(--green-soft)',
              color: killSwitchFeedback.type === 'danger' ? 'var(--red)' : 'var(--green)',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{killSwitchFeedback.msg}</span>
                <button
                  type="button"
                  onClick={() => setKillSwitchFeedback(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '13px', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
              {killSwitchFeedback.results && killSwitchFeedback.results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', fontSize: '11.5px' }}>
                  {killSwitchFeedback.results.map((res, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{res.status === 'success' ? '✓' : '✕'}</span>
                      <strong>{res.broker}:</strong>
                      <span>{res.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Note */}
          <div style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--line)',
            fontSize: '11.5px',
            color: 'var(--text-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            <span style={{ whiteSpace: 'nowrap' }}>ESP32 Physical Kill Switch &amp; App Panic Button in sync</span>
            <span style={{ whiteSpace: 'nowrap' }}>Instant Market Order Square Off</span>
          </div>
        </section>

        {/* CARD 4: Broker Credentials Vault */}
        <section className="card">
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ whiteSpace: 'nowrap' }}>Broker Credentials Vault</h2>
                <p className="card-sub" style={{ marginTop: '2px', lineHeight: 1.35 }}>Setup &amp; manage trading APIs added to your console.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (showSecrets) {
                  setShowSecrets(false);
                } else {
                  setReAuthModalOpen(true);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line-2)',
                color: 'var(--text-2)',
                padding: '5px 11px',
                borderRadius: '999px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', flexShrink: 0 }}>
                {showSecrets ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              <span>{showSecrets ? 'Mask Keys' : 'Reveal Keys'}</span>
            </button>
          </div>

          {/* 1. BROKER TABS & TARGET CONTROLS (Single sleek horizontal row) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Added Brokers Switcher Tabs with Live Status Dots */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              maxWidth: '100%'
            }}>
              {addedBrokers.map(bId => {
                const isSelected = activeBrokerTab === bId;
                const isCurrentActive = broker === bId;
                const bTokenInfo = getBrokerTokenInfo(bId);
                const isValid = bTokenInfo ? bTokenInfo.token_valid_today : false;
                return (
                  <button
                    key={bId}
                    type="button"
                    onClick={() => setActiveBrokerTab(bId)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '999px',
                      border: isSelected ? 'none' : '1px solid var(--line-2)',
                      background: isSelected ? 'var(--brand-gradient)' : 'var(--surface-2)',
                      color: isSelected ? '#ffffff' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 600,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 12px -4px rgba(92,110,240,.7)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Status dot */}
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isValid 
                        ? (isSelected ? '#a7f3d0' : 'var(--green)') 
                        : (isSelected ? '#fecaca' : 'var(--amber)'),
                      boxShadow: isValid && isSelected ? '0 0 6px #a7f3d0' : 'none'
                    }} />
                    <span>{getBrokerShortLabel(bId)}</span>
                  </button>
                );
              })}

              {/* "+ Add" Button */}
              <button
                type="button"
                onClick={() => setAddBrokerModalOpen(true)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: '1.5px dashed var(--brand-violet)',
                  background: 'transparent',
                  color: 'var(--brand-ink)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
                title="Add another broker to console"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add</span>
              </button>
            </div>

            {/* Quick Actions for Selected Tab (Set as Target / Disconnect) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeBrokerTab !== broker && (
                <button
                  type="button"
                  onClick={() => setBroker(activeBrokerTab)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    background: 'var(--brand-soft)',
                    border: '1px solid rgba(123, 91, 240, 0.25)',
                    color: 'var(--brand-ink)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title={`Route console trades to ${activeBrokerTab}`}
                >
                  Set as Target
                </button>
              )}
              {addedBrokers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDisconnectBroker(activeBrokerTab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={`Disconnect ${activeBrokerTab}`}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Vault Status Message */}
          {vaultStatus.msg && (
            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '14px',
              background: vaultStatus.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
              border: `1px solid ${vaultStatus.type === 'success' ? 'rgba(15, 157, 106, 0.25)' : 'rgba(224, 67, 78, 0.25)'}`,
              color: vaultStatus.type === 'success' ? 'var(--green)' : 'var(--red)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {vaultStatus.msg}
            </div>
          )}

          {/* DYNAMIC CREDENTIALS FORM PER BROKER */}
          <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>

            {/* 1. FYERS */}
            {activeBrokerTab === 'Fyers' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Fyers ID / Client Code
                  </label>
                  <input 
                    type="text" 
                    value={fyersId} 
                    onChange={e => setFyersId(e.target.value)} 
                    placeholder="e.g. FAJ97539" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    App ID (Fyers API Dashboard)
                  </label>
                  <input 
                    type="text" 
                    value={fyersAppId} 
                    onChange={e => setFyersAppId(e.target.value)} 
                    placeholder="e.g. 0LJX4AMOQB-100" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Secret Key
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={fyersSecretKey} 
                    onChange={e => setFyersSecretKey(e.target.value)} 
                    placeholder="••••••••••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    TOTP Authenticator Secret (32 chars)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={fyersTotpSecret} 
                    onChange={e => setFyersTotpSecret(e.target.value)} 
                    placeholder="Authenticator string" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Trading PIN (4 digits)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={fyersPin} 
                    onChange={e => setFyersPin(e.target.value)} 
                    placeholder="••••" 
                    maxLength="4" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Direct Daily Access Token (Optional)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={fyersAccessToken} 
                    onChange={e => setFyersAccessToken(e.target.value)} 
                    placeholder="Paste Fyers Bearer Token (optional direct)" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* 2. DHAN */}
            {activeBrokerTab === 'Dhan' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Dhan Client ID
                  </label>
                  <input 
                    type="text" 
                    value={dhanClientId} 
                    onChange={e => setDhanClientId(e.target.value)} 
                    placeholder="e.g. 1000123456" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Dhan API Key
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={dhanApiKey} 
                    onChange={e => setDhanApiKey(e.target.value)} 
                    placeholder="API Access Key" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Dhan API Secret
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={dhanApiSecret} 
                    onChange={e => setDhanApiSecret(e.target.value)} 
                    placeholder="••••••••••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    TOTP Secret (Optional for auto-login)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={dhanTotpSecret} 
                    onChange={e => setDhanTotpSecret(e.target.value)} 
                    placeholder="Authenticator string" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Direct Daily Access Token (Optional)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={dhanAccessToken} 
                    onChange={e => setDhanAccessToken(e.target.value)} 
                    placeholder="Paste DhanHQ Access Token" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* 3. UPSTOX */}
            {activeBrokerTab === 'Upstox' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Upstox API Key / Client ID
                  </label>
                  <input 
                    type="text" 
                    value={upstoxApiKey} 
                    onChange={e => setUpstoxApiKey(e.target.value)} 
                    placeholder="e.g. 5d8e78fc-..." 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Upstox API Secret
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={upstoxApiSecret} 
                    onChange={e => setUpstoxApiSecret(e.target.value)} 
                    placeholder="••••••••••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Redirect URL
                  </label>
                  <input 
                    type="text" 
                    value={upstoxRedirectUrl} 
                    onChange={e => setUpstoxRedirectUrl(e.target.value)} 
                    placeholder="https://127.0.0.1:3000/callback" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Daily Access Token
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={upstoxAccessToken} 
                    onChange={e => setUpstoxAccessToken(e.target.value)} 
                    placeholder="Paste Upstox Bearer Token" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* 4. ANGEL ONE (SmartAPI) */}
            {activeBrokerTab === 'Angel One' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Client Code (Angel One)
                  </label>
                  <input 
                    type="text" 
                    value={angelClientCode} 
                    onChange={e => setAngelClientCode(e.target.value)} 
                    placeholder="e.g. S123456" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Account Password / MPIN
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={angelPassword} 
                    onChange={e => setAngelPassword(e.target.value)} 
                    placeholder="••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    SmartAPI Key
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={angelApiKey} 
                    onChange={e => setAngelApiKey(e.target.value)} 
                    placeholder="Angel SmartAPI App Key" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    TOTP Secret (For automated 2FA)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={angelTotpSecret} 
                    onChange={e => setAngelTotpSecret(e.target.value)} 
                    placeholder="Authenticator string" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    JWT Access Token (Optional direct)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={angelAccessToken} 
                    onChange={e => setAngelAccessToken(e.target.value)} 
                    placeholder="SmartAPI JWT token" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* 5. KOTAK NEO */}
            {activeBrokerTab === 'Kotak Neo' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Kotak Consumer Key
                  </label>
                  <input 
                    type="text" 
                    value={kotakConsumerKey} 
                    onChange={e => setKotakConsumerKey(e.target.value)} 
                    placeholder="Consumer Key" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Kotak Consumer Secret
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={kotakConsumerSecret} 
                    onChange={e => setKotakConsumerSecret(e.target.value)} 
                    placeholder="••••••••••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Registered Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={kotakMobile} 
                    onChange={e => setKotakMobile(e.target.value)} 
                    placeholder="e.g. 9876543210" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Neo MPIN (6 digits)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={kotakMpin} 
                    onChange={e => setKotakMpin(e.target.value)} 
                    placeholder="••••••" 
                    maxLength="6" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Access Token (Optional direct)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={kotakAccessToken} 
                    onChange={e => setKotakAccessToken(e.target.value)} 
                    placeholder="Paste Neo access token" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* 6. ZERODHA KITE CONNECT */}
            {activeBrokerTab === 'Zerodha' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Kite API Key
                  </label>
                  <input 
                    type="text" 
                    value={zerodhaApiKey} 
                    onChange={e => setZerodhaApiKey(e.target.value)} 
                    placeholder="Zerodha Developer API Key" 
                    required 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Kite API Secret
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={zerodhaApiSecret} 
                    onChange={e => setZerodhaApiSecret(e.target.value)} 
                    placeholder="••••••••••••••••" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Daily Request Token (From Kite Login Redirect)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={zerodhaRequestToken} 
                    onChange={e => setZerodhaRequestToken(e.target.value)} 
                    placeholder="Daily request token from kite.zerodha.com" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Session Access Token (Optional direct)
                  </label>
                  <input 
                    type={showSecrets ? "text" : "password"} 
                    value={zerodhaAccessToken} 
                    onChange={e => setZerodhaAccessToken(e.target.value)} 
                    placeholder="Paste Kite Access Token" 
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-2)',
                      borderRadius: '12px',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontFamily: 'var(--mono)',
                      outline: 'none'
                    }} 
                  />
                </div>
              </>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={vaultLoading}
              className="btn-email"
              style={{
                marginTop: '10px',
                cursor: vaultLoading ? 'not-allowed' : 'pointer',
                border: 'none',
                height: '52px'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '17px', height: '17px' }}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{vaultLoading ? 'Encrypting & Saving Keys...' : `Save ${activeBrokerTab} Keys`}</span>
            </button>
          </form>
        </section>

      </main>

      {/* "ADD BROKER CONNECTION" MODAL */}
      {addBrokerModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
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
            maxWidth: '440px',
            background: 'var(--surface)',
            borderRadius: '24px',
            padding: '1.6rem',
            border: '1px solid var(--line)',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.22)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text)', margin: '0 0 4px 0', fontWeight: 700 }}>
                  Add Broker Connection
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: 0 }}>
                  Select a supported API to add to your console.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setAddBrokerModalOpen(false)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-3)'
                }}
              >
                ✕
              </button>
            </div>

            {/* List of unadded brokers */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', paddingRight: '2px' }}>
              {unaddedBrokers.length === 0 ? (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: 'var(--surface-2)',
                  borderRadius: '16px',
                  color: 'var(--text-2)',
                  fontSize: '0.9rem'
                }}>
                  All supported stockbroker APIs have been connected to your console!
                </div>
              ) : (
                unaddedBrokers.map(b => (
                  <div
                    key={b.id}
                    onClick={() => handleSelectNewBroker(b.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '16px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--brand-violet)';
                      e.currentTarget.style.background = '#FFFFFF';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                          {b.name}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'var(--green-soft)',
                          color: 'var(--green)',
                          fontFamily: 'var(--mono)'
                        }}>
                          {b.tag}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '3px' }}>
                        {b.desc}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{
                        padding: '6px 14px',
                        borderRadius: '999px',
                        background: 'var(--brand-gradient)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px -4px rgba(92,110,240,.7)'
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setAddBrokerModalOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--text-2)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RE-AUTH MODAL TO REVEAL SECRETS */}
      {reAuthModalOpen && (
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: 'var(--brand-violet)' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Security Verification
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.2rem', lineHeight: 1.45 }}>
              Enter your account password to decrypt and view sensitive API secret keys.
            </p>

            {reAuthError && (
              <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '12px', background: 'var(--red-soft)', padding: '6px 10px', borderRadius: '8px' }}>
                {reAuthError}
              </div>
            )}

            <form onSubmit={handleReAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder="Account password"
                value={reAuthPassword}
                onChange={e => setReAuthPassword(e.target.value)}
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
                  onClick={() => { setReAuthModalOpen(false); setReAuthPassword(''); setReAuthError(''); }}
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
                  style={{
                    flex: 1,
                    height: '44px',
                    background: 'var(--brand-gradient)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px -6px rgba(92,110,240,.7)'
                  }}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
