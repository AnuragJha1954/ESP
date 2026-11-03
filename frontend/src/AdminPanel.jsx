import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from './StateContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  LogOut, 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  Key, 
  User, 
  Eye, 
  EyeOff, 
  Cpu, 
  Battery, 
  Wifi, 
  Edit3, 
  Trash2, 
  Link2, 
  Unlink, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  FileText, 
  Clock, 
  X, 
  ArrowUpRight, 
  HardDrive,
  TrendingUp,
  TrendingDown,
  Radio,
  Sliders,
  Shield,
  Zap,
  Server,
  Lock,
  Layers,
  Check
} from 'lucide-react';

// ======================================================================
// DEMANDBASE EXACT DESIGN SYSTEM & TYPOGRAPHY
// ======================================================================
const DB_FONT = '"GT America", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const DB_FONT_SERIF = '"HW Cigars", serif';
const DB_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

// Dark Panel Surfaces (Demandbase Midnight Palette)
const DB_CANVAS = '#060814';         // Deep midnight canvas
const DB_PANEL = '#0c1122';          // Primary panel container
const DB_SURFACE = '#0f162a';        // Card & table surface
const DB_SURFACE_HOVER = '#141d38';  // Interactive hover
const DB_INPUT = '#090d1a';          // Inset form surface
const DB_BORDER = 'rgba(255, 255, 255, 0.08)'; // Hairline border
const DB_BORDER_STRONG = 'rgba(255, 255, 255, 0.16)';

// Subtle Semantic Accents
const DB_BLUE = '#2563eb';           // Demandbase corporate blue
const DB_BLUE_GRADIENT = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
const DB_TEXT_MAIN = '#f8fafc';      // High contrast text
const DB_TEXT_MUTED = '#94a3b8';     // Slate subtext
const DB_TEXT_FAINT = '#64748b';     // Subtle labels
const DB_GREEN = '#22c55e';          // Success / Bullish
const DB_RED = '#ef4444';            // Danger / Bearish
const DB_AMBER = '#f59e0b';          // Caution / Stock
const DB_VIOLET = '#8b5cf6';         // Trader keys / Encryption

const panelCard = {
  background: DB_SURFACE,
  border: `1px solid ${DB_BORDER}`,
  borderRadius: '10px',
  padding: '1.25rem',
  position: 'relative'
};

const thStyle = {
  padding: '10px 14px',
  fontWeight: '600',
  color: DB_TEXT_MUTED,
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  fontFamily: DB_FONT,
  background: 'rgba(255, 255, 255, 0.02)',
  borderBottom: `1px solid ${DB_BORDER}`
};

const tdStyle = {
  padding: '11px 14px',
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  color: '#e2e8f0',
  fontFamily: DB_FONT,
  borderBottom: `1px solid ${DB_BORDER}`
};

// Initial ticker data
const INITIAL_TICKER = [
  { symbol: 'NIFTY 50', price: '24,180.80', change: '+102.40 (+0.42%)', up: true },
  { symbol: 'BANKNIFTY', price: '51,240.15', change: '+158.30 (+0.31%)', up: true },
  { symbol: 'FINNIFTY', price: '23,890.60', change: '-28.40 (-0.12%)', up: false },
  { symbol: 'INDIA VIX', price: '13.84', change: '-0.30 (-2.12%)', up: false },
  { symbol: 'NIFTY 24200 CE', price: '142.50', change: '+18.20 (+14.6%)', up: true },
  { symbol: 'NIFTY 24150 PE', price: '98.20', change: '-14.30 (-12.7%)', up: false },
  { symbol: 'BROKER FYERS', price: 'CONNECTED', change: '12ms latency', up: true },
  { symbol: 'NODE ESP32', price: 'DEV-0012', change: 'AES-256 Active', up: true }
];

export default function AdminPanel() {
  const { authToken, user, login, logout } = useAppState();
  const navigate = useNavigate();

  // Authentication & Session Security State
  const [sessionChecking, setSessionChecking] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);

  // Admin Login Gateway Form State
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  
  // Tabs: 'devices', 'users', 'waitlist', 'trades', 'audit'
  const [activeTab, setActiveTab] = useState('devices');

  // Live Ticker State
  const [tickerItems, setTickerItems] = useState(INITIAL_TICKER);
  const [tickerPulse, setTickerPulse] = useState(false);

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userMsg, setUserMsg] = useState({ type: '', text: '' });

  // Edit User Credentials & Details Modal
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserError, setEditUserError] = useState('');
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);
  const [editingUserTab, setEditingUserTab] = useState('identity');
  const [editingBrokerSubTab, setEditingBrokerSubTab] = useState('fyers');

  // Devices CRUD State
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL'); // 'ALL', 'BOUND', 'UNASSIGNED'
  const [deviceActionMsg, setDeviceActionMsg] = useState({ type: '', text: '' });

  // Register Device Modal / Form
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    device_id: '',
    serial_number: '',
    hw_revision: 'rev1',
    firmware_version: '1.0.0'
  });

  // Edit Device Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  // Bind Device Modal
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [bindForm, setBindForm] = useState({ device_id: '', user_id: '', order_ref: '' });

  // Global Trades State
  const [globalTrades, setGlobalTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Waitlist State
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistMsg, setWaitlistMsg] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // DPDP Act 2023 Erasure Requests State
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionActionMsg, setDeletionActionMsg] = useState({ type: '', text: '' });
  const [confirmApproveModal, setConfirmApproveModal] = useState(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  // Live IST Clock
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------------------------------------------------------
  // LIVE MARKET TICKER AUTO-POLLER
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const endpoints = [
          (import.meta.env.VITE_API_URL || '') + '/api/market/quotes',
          '/api/market/quotes'
        ];
        let data = null;
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
            if (res.ok) {
              const json = await res.json();
              if (json.status === 'success' && json.data) {
                data = json.data;
                break;
              }
            }
          } catch (e) {}
        }

        if (data && Array.isArray(data) && data.length > 0) {
          const formatted = data.map(d => ({
            symbol: d.symbol,
            price: typeof d.price === 'number' ? d.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(d.price),
            change: typeof d.change === 'number'
              ? `${d.change > 0 ? '+' : ''}${d.change.toFixed(2)} (${d.pct > 0 ? '+' : ''}${d.pct}%)`
              : String(d.change),
            up: d.up
          }));
          setTickerItems(formatted);
          setTickerPulse(true);
          setTimeout(() => setTickerPulse(false), 800);
        }
      } catch (err) {}
    };

    fetchTicker();
  }, []);

  // ------------------------------------------------------------------
  // SECURITY & RESILIENT SECURE FETCH INTERCEPTOR
  // ------------------------------------------------------------------
  const adminFetch = async (pathOrUrl, options = {}) => {
    const token = localStorage.getItem('esp_auth_token') || authToken;
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    };

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const cleanPath = pathOrUrl.startsWith('http') ? pathOrUrl.replace(/^http:\/\/[^/]+/, '') : pathOrUrl;
    
    // Candidates to attempt: primary full URL then relative proxy fallback
    const targets = [
      apiUrl ? `${apiUrl}${cleanPath}` : null,
      cleanPath
    ].filter(Boolean);

    let lastRes = null;
    let lastErr = null;

    for (const target of targets) {
      try {
        const res = await fetch(target, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
          logout();
          setIsAdminAuthenticated(false);
          setAdminProfile(null);
          setLoginError('Administrative session expired. Please log in again.');
          throw new Error('SESSION_EXPIRED');
        }
        return res;
      } catch (err) {
        if (err.message === 'SESSION_EXPIRED') throw err;
        lastErr = err;
      }
    }

    throw lastErr || new Error('Connection failed');
  };

  const verifySession = async () => {
    setSessionChecking(true);
    const token = localStorage.getItem('esp_auth_token') || authToken;
    if (!token) {
      setIsAdminAuthenticated(false);
      setSessionChecking(false);
      return;
    }
    try {
      const res = await adminFetch('/api/admin/verify-session');
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.admin) {
        setIsAdminAuthenticated(true);
        setAdminProfile(data.admin);
      } else {
        setIsAdminAuthenticated(false);
        if (data.code === 'ADMIN_REQUIRED') {
          setLoginError('Account does not have administrator privileges.');
        } else {
          setLoginError('Session expired. Please log in.');
        }
      }
    } catch (err) {
      console.error('Session verify error:', err);
      setIsAdminAuthenticated(false);
    } finally {
      setSessionChecking(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const loginEndpoints = [
      apiUrl ? `${apiUrl}/api/admin/login` : null,
      '/api/admin/login'
    ].filter(Boolean);

    let success = false;
    let lastErrorMsg = 'Could not connect to the server.';

    for (const ep of loginEndpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginUsername, password: loginPassword })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          login(data.token, data.admin);
          setIsAdminAuthenticated(true);
          setAdminProfile(data.admin);
          setLoginPassword('');
          success = true;
          break;
        } else {
          lastErrorMsg = data.message || 'Invalid username or password.';
          break; // Server gave valid rejection, do not retry
        }
      } catch (err) {
        console.warn(`Connection attempt to ${ep} failed:`, err.message);
      }
    }

    if (!success) {
      setLoginError(lastErrorMsg);
    }
    setLoginSubmitting(false);
  };

  const handleAdminLogout = async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {}
    logout();
    setIsAdminAuthenticated(false);
    setAdminProfile(null);
  };

  // ------------------------------------------------------------------
  // DATA FETCHING
  // ------------------------------------------------------------------
  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const res = await adminFetch('/api/admin/devices');
      const data = await res.json();
      if (data.status === 'success') {
        setDevices(data.data || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error('Failed to fetch devices', err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await adminFetch('/api/admin/users');
      const data = await res.json();
      if (data.status === 'success') {
        setUsersList(data.data || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchGlobalTrades = async () => {
    setTradesLoading(true);
    try {
      const res = await adminFetch('/api/admin/trade-history');
      const data = await res.json();
      if (data.status === 'success') {
        setGlobalTrades(data.data || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setTradesLoading(false);
    }
  };

  const fetchWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const res = await adminFetch('/api/admin/waitlist');
      const data = await res.json();
      if (data.status === 'success') {
        setWaitlist(data.data || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await adminFetch('/api/admin/audit-logs');
      const data = await res.json();
      if (data.status === 'success') {
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchDeletionRequests = async () => {
    setDeletionLoading(true);
    try {
      const res = await adminFetch('/api/admin/deletion-requests');
      const data = await res.json();
      if (data.status === 'success') {
        setDeletionRequests(data.requests || []);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleApproveDeletion = async (request) => {
    setApproveSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/deletion-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Approved by Administrator under DPDP Act, 2023' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeletionActionMsg({ type: 'success', text: data.message });
        setConfirmApproveModal(null);
        fetchDeletionRequests();
        fetchUsers();
        fetchDevices();
        setTimeout(() => setDeletionActionMsg({ type: '', text: '' }), 8000);
      } else {
        alert(data.message || 'Failed to approve deletion');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Error executing account deletion');
    } finally {
      setApproveSubmitting(false);
    }
  };

  const handleRejectDeletion = async (requestId) => {
    const reason = window.prompt('Enter reason for rejecting this deletion request (optional):', 'Statutory retention required');
    if (reason === null) return;
    try {
      const res = await adminFetch(`/api/admin/deletion-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reason })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeletionActionMsg({ type: 'success', text: 'Deletion request marked as rejected.' });
        fetchDeletionRequests();
        setTimeout(() => setDeletionActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to reject request');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Error rejecting request');
    }
  };

  const fetchUserDetails = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await adminFetch(`/api/admin/user/${userId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedUserData(data.data);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchDevices();
      fetchUsers();
      fetchDeletionRequests();
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    if (activeTab === 'devices') fetchDevices();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'trades') fetchGlobalTrades();
    if (activeTab === 'waitlist') fetchWaitlist();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'dpdp') fetchDeletionRequests();
  }, [activeTab, isAdminAuthenticated]);

  // ------------------------------------------------------------------
  // DEVICE CRUD OPERATIONS
  // ------------------------------------------------------------------
  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    if (!registerForm.device_id.trim()) return;
    try {
      const res = await adminFetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeviceActionMsg({ type: 'success', text: `Console ${registerForm.device_id} registered.` });
        setRegisterForm({ device_id: '', serial_number: '', hw_revision: 'rev1', firmware_version: '1.0.0' });
        setRegisterModalOpen(false);
        fetchDevices();
        setTimeout(() => setDeviceActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to register device');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Error registering device');
    }
  };

  const handleUpdateDevice = async (e) => {
    e.preventDefault();
    if (!editingDevice) return;
    const currentId = editingDevice.original_device_id || editingDevice.device_id;
    const targetId = (editingDevice.new_device_id || editingDevice.device_id)?.trim();
    if (!targetId) {
      alert('Device ID cannot be empty');
      return;
    }
    try {
      const res = await adminFetch(`/api/admin/devices/${currentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_device_id: targetId,
          serial_number: editingDevice.serial_number,
          hw_revision: editingDevice.hw_revision,
          firmware_version: editingDevice.firmware_version,
          status: editingDevice.status
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeviceActionMsg({ type: 'success', text: `Console ${targetId} updated.` });
        setEditModalOpen(false);
        setEditingDevice(null);
        fetchDevices();
        setTimeout(() => setDeviceActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to update device');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm(`Delete console ${deviceId}?`)) return;
    try {
      const res = await adminFetch(`/api/admin/devices/${deviceId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeviceActionMsg({ type: 'success', text: `Console ${deviceId} deleted.` });
        fetchDevices();
        setTimeout(() => setDeviceActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to delete device');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  const handleBindDevice = async (e) => {
    e.preventDefault();
    try {
      const res = await adminFetch('/api/admin/devices/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeviceActionMsg({ type: 'success', text: `Console ${bindForm.device_id} bound to User #${bindForm.user_id}.` });
        setBindForm({ device_id: '', user_id: '', order_ref: '' });
        setBindModalOpen(false);
        fetchDevices();
        setTimeout(() => setDeviceActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to bind device');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  const handleUnbindDevice = async (deviceId) => {
    if (!window.confirm(`Unbind console ${deviceId}?`)) return;
    try {
      const res = await adminFetch('/api/admin/devices/unbind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, reason: 'Admin unbind' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeviceActionMsg({ type: 'success', text: `Console ${deviceId} returned to stock.` });
        fetchDevices();
        setTimeout(() => setDeviceActionMsg({ type: '', text: '' }), 4000);
      } else {
        alert(data.message || 'Failed to unbind');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  // ------------------------------------------------------------------
  // USER OPERATIONS
  // ------------------------------------------------------------------
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMsg({ type: '', text: '' });
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername.trim(), 
          name: newName.trim() || null, 
          email: newEmail.trim() || null, 
          password: newPassword 
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUserMsg({ type: 'success', text: `Trader account "${newUsername}" created successfully.` });
        setNewName('');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        fetchUsers();
      } else {
        setUserMsg({ type: 'error', text: data.message || 'Failed to create user' });
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') setUserMsg({ type: 'error', text: 'Network error.' });
    }
  };

  const handleOpenEditUser = async (user) => {
    setEditUserError('');
    setShowEditUserPassword(false);
    setEditingUserTab('identity');
    setEditingBrokerSubTab('fyers');

    setEditingUser({
      id: user.id,
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
      bound_device_id: user.bound_device_id || '',
      preferences: {
        selected_broker: 'Fyers',
        selected_index: 'NIFTY',
        selected_expiry: '',
        added_brokers: ['Fyers'],
        kill_switch_scope: 'current'
      },
      broker_credentials: {},
      devicesList: devices || []
    });
    setEditUserModalOpen(true);

    try {
      const res = await adminFetch(`/api/admin/user/${user.id}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const u = data.data.user || {};
        const p = data.data.preferences || {};
        const c = data.data.broker_credentials || {};
        const devs = data.data.devices || [];

        let addedList = ['Fyers'];
        if (p.added_brokers) {
          try {
            addedList = typeof p.added_brokers === 'string' ? JSON.parse(p.added_brokers) : p.added_brokers;
          } catch(e) {}
        }

        setEditingUser({
          id: user.id,
          name: u.name || user.name || '',
          username: u.username || user.username || '',
          email: u.email || user.email || '',
          password: '',
          role: u.role || user.role || 'user',
          bound_device_id: u.bound_device_id || '',
          preferences: {
            selected_broker: p.selected_broker || 'Fyers',
            selected_index: p.selected_index || 'NIFTY',
            selected_expiry: p.selected_expiry || '',
            added_brokers: Array.isArray(addedList) && addedList.length > 0 ? addedList : ['Fyers'],
            kill_switch_scope: p.kill_switch_scope || 'current'
          },
          broker_credentials: { ...c },
          devicesList: devs.length > 0 ? devs : (devices || [])
        });
      }
    } catch (err) {
      console.error("Failed to fetch full user config", err);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserSaving(true);
    setEditUserError('');

    try {
      const payload = {
        name: editingUser.name ? editingUser.name.trim() : null,
        username: editingUser.username.trim(),
        email: editingUser.email && editingUser.email.trim() ? editingUser.email.trim() : null,
        role: editingUser.role || 'user',
        bound_device_id: editingUser.bound_device_id || '',
        preferences: {
          selected_broker: editingUser.preferences?.selected_broker || 'Fyers',
          selected_index: editingUser.preferences?.selected_index || 'NIFTY',
          selected_expiry: editingUser.preferences?.selected_expiry || '',
          added_brokers: editingUser.preferences?.added_brokers || ['Fyers'],
          kill_switch_scope: editingUser.preferences?.kill_switch_scope || 'current'
        },
        broker_credentials: editingUser.broker_credentials || {}
      };
      if (editingUser.password && editingUser.password.trim().length > 0) {
        payload.password = editingUser.password.trim();
      }

      const res = await adminFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUserMsg({ type: 'success', text: `Trader #${editingUser.id} (@${editingUser.username}) full configuration saved successfully.` });
        setTimeout(() => setUserMsg({ type: '', text: '' }), 4000);
        setEditUserModalOpen(false);
        setEditingUser(null);
        fetchUsers();
        fetchDevices();
        if (selectedUser && selectedUser.id === editingUser.id) {
          fetchUserDetails(editingUser.id);
        }
      } else {
        setEditUserError(data.message || 'Failed to update user configuration');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        setEditUserError(err.message || 'Network error updating user configuration');
      }
    } finally {
      setEditUserSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this trader account?')) return;
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Trader deleted');
        fetchUsers();
      } else {
        alert('Failed to delete: ' + data.message);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  const handleClearToken = async (userId) => {
    if (!window.confirm('Revoke broker tokens for this user?')) return;
    try {
      const res = await adminFetch(`/api/admin/user/${userId}/clear-token`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Token cleared');
        fetchUserDetails(userId);
      } else {
        alert(data.message || 'Failed to clear token');
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') alert('Network error');
    }
  };

  // ------------------------------------------------------------------
  // WAITLIST OPERATIONS
  // ------------------------------------------------------------------
  const handleApproveWaitlist = async (id) => {
    setWaitlistMsg('');
    try {
      const res = await adminFetch(`/api/admin/waitlist/${id}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWaitlistMsg(`Approved. User created: ${data.credentials?.username}`);
        fetchWaitlist();
        fetchUsers();
      } else {
        setWaitlistMsg('Error: ' + data.message);
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') setWaitlistMsg('Network error.');
    }
  };

  const handleDeleteWaitlist = async (id) => {
    if (!window.confirm('Delete this waitlist request?')) return;
    try {
      const res = await adminFetch(`/api/admin/waitlist/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchWaitlist();
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') console.error(err);
    }
  };

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const matchesFilter = 
        deviceFilter === 'ALL' ? true :
        deviceFilter === 'BOUND' ? d.status === 'bound' :
        deviceFilter === 'UNASSIGNED' ? d.status === 'unassigned' :
        true;

      const q = deviceSearch.toLowerCase();
      const matchesSearch = q === '' ||
        (d.device_id || '').toLowerCase().includes(q) ||
        (d.serial_number || '').toLowerCase().includes(q) ||
        (d.bound_username || '').toLowerCase().includes(q) ||
        String(d.user_id || '').includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [devices, deviceFilter, deviceSearch]);

  // High-level KPI Stats
  const stats = useMemo(() => {
    const total = devices.length;
    const bound = devices.filter(d => d.status === 'bound').length;
    const unassigned = devices.filter(d => d.status === 'unassigned').length;
    return {
      totalDevices: total,
      boundDevices: bound,
      unassignedDevices: unassigned,
      totalUsers: usersList.length,
      waitlistPending: waitlist.filter(w => w.status === 'pending').length
    };
  }, [devices, usersList, waitlist]);

  // ------------------------------------------------------------------
  // 1. SESSION LOADING SCREEN
  // ------------------------------------------------------------------
  if (sessionChecking) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: DB_CANVAS,
        fontFamily: DB_FONT,
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: DB_TEXT_MAIN, 
        padding: '2rem' 
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)'
        }}>
          <img 
            src="/logo.png" 
            alt="Infirow" 
            style={{ width: '48px', height: '48px', objectFit: 'contain', mixBlendMode: 'screen' }} 
            onError={e => { e.target.onerror = null; e.target.src = '/logo.jpg'; }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DB_TEXT_MUTED, fontSize: '0.84rem' }}>
          <RefreshCw size={15} className="animate-spin" style={{ color: DB_BLUE }} />
          <span>Synchronizing Trading Control Station...</span>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. FUTURISTIC SPLIT-SCREEN ADMIN AUTHENTICATION GATE (40% / 60%)
  // ------------------------------------------------------------------
  if (!isAdminAuthenticated) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: DB_CANVAS,
        fontFamily: DB_FONT,
        display: 'flex', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Rich Ambient Mesh Backdrops & Cyber Grid */}
        <div className="cyber-grid-canvas" style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.7,
          pointerEvents: 'none'
        }} />

        <div style={{
          position: 'absolute',
          width: '850px',
          height: '850px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(37, 99, 235, 0.22) 0%, rgba(124, 58, 237, 0.12) 40%, transparent 65%)',
          top: '-180px',
          left: '-180px',
          pointerEvents: 'none',
          filter: 'blur(30px)'
        }} />

        <div style={{
          position: 'absolute',
          width: '950px',
          height: '950px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 65% 65%, rgba(139, 92, 246, 0.20) 0%, rgba(6, 182, 212, 0.14) 45%, transparent 65%)',
          bottom: '-250px',
          right: '-180px',
          pointerEvents: 'none',
          filter: 'blur(30px)'
        }} />

        <div style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, transparent 65%)',
          top: '30%',
          right: '25%',
          pointerEvents: 'none',
          filter: 'blur(40px)'
        }} />

        {/* ------------------------------------------------------------- */}
        {/* LEFT COLUMN: 40% - AUTHENTICATION FORM                        */}
        {/* ------------------------------------------------------------- */}
        <div style={{
          flex: '1 1 42%',
          maxWidth: '560px',
          minWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3rem 3rem',
          borderRight: `1px solid ${DB_BORDER}`,
          background: 'rgba(12, 17, 34, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10
        }}>
          {/* Top Brand Lockup */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${DB_BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)'
              }}>
                <img 
                  src="/logo.png" 
                  alt="Infirow Logo" 
                  style={{ width: '34px', height: '34px', objectFit: 'contain', mixBlendMode: 'screen' }} 
                  onError={e => { e.target.onerror = null; e.target.src = '/logo.jpg'; }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: DB_TEXT_MAIN, letterSpacing: '-0.3px' }}>
                    INFIROW
                  </span>
                  <span style={{ 
                    fontSize: '0.62rem', 
                    color: '#60a5fa', 
                    background: 'rgba(37, 99, 235, 0.12)', 
                    border: '1px solid rgba(37, 99, 235, 0.3)', 
                    padding: '1px 6px', 
                    borderRadius: '4px', 
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                  }}>
                    COMMAND v2.0
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED }}>Tradopad Hardware Management OS</div>
              </div>
            </div>

            {/* Auth Title */}
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: '700', color: DB_TEXT_MAIN, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                Control Station Sign In
              </h1>
              <p style={{ margin: 0, fontSize: '0.84rem', color: DB_TEXT_MUTED, lineHeight: '1.5' }}>
                Authenticate with administrative master credentials to unlock the hardware telemetry bridge and multi-broker options engine.
              </p>
            </div>

            {loginError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid rgba(239, 68, 68, 0.3)`,
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#fca5a5',
                fontSize: '0.82rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, color: DB_RED }} />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAdminLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: DB_TEXT_MUTED, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Administrator Username
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: DB_TEXT_FAINT }}>
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="admin"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: DB_INPUT,
                      border: `1px solid ${DB_BORDER}`,
                      borderRadius: '8px',
                      color: DB_TEXT_MAIN,
                      fontSize: '0.86rem',
                      fontFamily: DB_FONT,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = DB_BLUE}
                    onBlur={e => e.target.style.borderColor = DB_BORDER}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: DB_TEXT_MUTED, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Master Passphrase
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: DB_TEXT_FAINT }}>
                    <Key size={15} />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 38px',
                      background: DB_INPUT,
                      border: `1px solid ${DB_BORDER}`,
                      borderRadius: '8px',
                      color: DB_TEXT_MAIN,
                      fontSize: '0.86rem',
                      fontFamily: DB_FONT,
                      outline: 'none',
                      letterSpacing: showLoginPassword ? 'normal' : '2px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = DB_BLUE}
                    onBlur={e => e.target.style.borderColor = DB_BORDER}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: DB_TEXT_MUTED,
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: DB_TEXT_MUTED }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Shield size={12} color={DB_GREEN} />
                  <span>AES-256 GCM Hardware Authentication</span>
                </span>
                <span style={{ fontFamily: DB_MONO, color: '#60a5fa' }}>SEC-04</span>
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  background: DB_BLUE_GRADIENT,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: loginSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.2s ease',
                  fontFamily: DB_FONT
                }}
              >
                {loginSubmitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Authorizing Platform Access...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Control Station</span>
                    <ArrowUpRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Controls */}
          <div style={{ 
            marginTop: '3rem', 
            paddingTop: '1.25rem', 
            borderTop: `1px solid ${DB_BORDER}`, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <button
              onClick={() => navigate('/device')}
              style={{
                background: 'transparent',
                border: 'none',
                color: DB_TEXT_MUTED,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: DB_FONT,
                padding: 0
              }}
            >
              <ChevronLeft size={13} />
              <span>Trader Companion</span>
            </button>
            <span style={{ fontSize: '0.72rem', color: DB_TEXT_FAINT, fontFamily: DB_MONO }}>
              SYSTEM READY • 12ms PING
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RIGHT COLUMN: 58% - FUTURISTIC HARDWARE SHOWCASE & TELEMETRY */}
        {/* ------------------------------------------------------------- */}
        <div style={{
          flex: '1 1 58%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 4rem',
          overflow: 'hidden'
        }}>
          {/* High-Visibility Futuristic Orbital Radar & Coordinate Grid */}
          <div style={{
            position: 'absolute',
            width: '720px',
            height: '720px',
            borderRadius: '50%',
            border: '1px dashed rgba(139, 92, 246, 0.28)',
            pointerEvents: 'none',
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.08)'
          }}>
            {/* Orbital Satellite Blip 1 */}
            <span style={{
              position: 'absolute',
              top: '12%',
              left: '20%',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#a78bfa',
              boxShadow: '0 0 10px #a78bfa',
              animation: 'beaconPing 3s infinite'
            }} />
            {/* Orbital Satellite Blip 2 */}
            <span style={{
              position: 'absolute',
              bottom: '18%',
              right: '22%',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#60a5fa',
              boxShadow: '0 0 8px #60a5fa'
            }} />
          </div>

          {/* Middle Radar Ring with Rotating Sweep Beam */}
          <div style={{
            position: 'absolute',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            border: '1px solid rgba(37, 99, 235, 0.35)',
            pointerEvents: 'none',
            overflow: 'hidden'
          }}>
            <div className="radar-sweep-beam" style={{
              position: 'absolute',
              inset: 0,
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(37, 99, 235, 0.22) 55deg, transparent 90deg)',
              borderRadius: '50%'
            }} />
          </div>

          {/* Inner Cyan Dashed Orbit */}
          <div style={{
            position: 'absolute',
            width: '340px',
            height: '340px',
            borderRadius: '50%',
            border: '1px dashed rgba(6, 182, 212, 0.32)',
            pointerEvents: 'none'
          }} />

          {/* Center Target Ring with Crosshair Axes */}
          <div style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.1)', position: 'absolute' }} />
            <div style={{ height: '100%', width: '1px', background: 'rgba(255, 255, 255, 0.1)', position: 'absolute' }} />
          </div>

          {/* Floating Subtle Telemetry Markers */}
          <div style={{
            position: 'absolute',
            top: '12%',
            right: '8%',
            fontSize: '0.66rem',
            fontFamily: DB_MONO,
            color: 'rgba(148, 163, 184, 0.6)',
            letterSpacing: '1px',
            pointerEvents: 'none'
          }}>
            LAT: 12ms • CIPHER: AES-256-GCM
          </div>

          <div style={{
            position: 'absolute',
            bottom: '8%',
            left: '10%',
            fontSize: '0.66rem',
            fontFamily: DB_MONO,
            color: 'rgba(96, 165, 250, 0.6)',
            letterSpacing: '1px',
            pointerEvents: 'none'
          }}>
            GRID // ESP32-S3 MATRIX ACTIVE
          </div>

          {/* Main Showcase Container */}
          <div style={{ maxWidth: '600px', width: '100%', position: 'relative', zIndex: 10 }}>

            {/* Futuristic Header Tag */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.04)', border: `1px solid ${DB_BORDER}`, padding: '4px 12px', borderRadius: '9999px', marginBottom: '1.25rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: DB_GREEN, boxShadow: `0 0 6px ${DB_GREEN}` }} />
              <span style={{ fontSize: '0.7rem', color: DB_TEXT_MUTED, fontWeight: '600', letterSpacing: '0.6px' }}>
                HARDWARE-TO-MARKET EXECUTION ARCHITECTURE
              </span>
            </div>

            <h2 style={{ fontSize: '1.85rem', fontWeight: '700', color: '#fff', margin: '0 0 1rem 0', letterSpacing: '-0.6px', lineHeight: '1.3' }}>
              Physical console intelligence engineered for options trading
            </h2>
            <p style={{ margin: '0 0 2rem 0', fontSize: '0.88rem', color: DB_TEXT_MUTED, lineHeight: '1.6' }}>
              Tradopad bridges hand-held hardware tactile triggers directly into live broker liquidity pools with automatic strike step resolution and zero latency.
            </p>

            {/* 3-Stage Pipeline Architecture Card */}
            <div style={{
              background: 'rgba(15, 22, 42, 0.85)',
              border: `1px solid ${DB_BORDER}`,
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              marginBottom: '1.5rem',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>SIGNAL ROUTING TOPOLOGY</span>
                <span style={{ color: '#60a5fa', fontFamily: DB_MONO }}>SUB-MILLISECOND</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {/* Stage 1 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: `1px solid ${DB_BORDER}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: DB_BLUE, marginBottom: '6px' }}>
                    <Cpu size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>CONSOLE</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#fff' }}>ESP32-S3</div>
                  <div style={{ fontSize: '0.7rem', color: DB_TEXT_FAINT, marginTop: '2px' }}>Tactile Matrix Trigger</div>
                </div>

                {/* Stage 2 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: `1px solid ${DB_BORDER}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: DB_VIOLET, marginBottom: '6px' }}>
                    <Zap size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>GATEWAY</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#fff' }}>12ms Stream</div>
                  <div style={{ fontSize: '0.7rem', color: DB_TEXT_FAINT, marginTop: '2px' }}>5-Min Telemetry Loop</div>
                </div>

                {/* Stage 3 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: `1px solid ${DB_BORDER}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: DB_GREEN, marginBottom: '6px' }}>
                    <Server size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>EXECUTION</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#fff' }}>Fyers & Dhan</div>
                  <div style={{ fontSize: '0.7rem', color: DB_TEXT_FAINT, marginTop: '2px' }}>ATM Strike Router</div>
                </div>
              </div>
            </div>

            {/* Live Ticking Market Telemetry Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              {tickerItems.slice(0, 4).map((item, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: 'rgba(15, 22, 42, 0.6)', 
                    border: `1px solid ${DB_BORDER}`, 
                    borderRadius: '8px', 
                    padding: '10px 12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, fontWeight: '600' }}>{item.symbol}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff', fontFamily: DB_MONO, margin: '2px 0' }}>{item.price}</div>
                  <div style={{ fontSize: '0.66rem', color: item.up ? '#4ade80' : '#f87171', fontWeight: '600', fontFamily: DB_MONO }}>
                    {item.change}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 3. AUTHENTICATED DEMANDBASE TRADING CONTROL PANEL
  // ------------------------------------------------------------------
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'radial-gradient(ellipse at 15% 10%, rgba(37, 99, 235, 0.16) 0%, transparent 45%), radial-gradient(ellipse at 85% 15%, rgba(139, 92, 246, 0.14) 0%, transparent 45%), radial-gradient(ellipse at 50% 75%, rgba(6, 182, 212, 0.09) 0%, transparent 50%), #060814',
      fontFamily: DB_FONT,
      color: DB_TEXT_MAIN, 
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Subtle Technical Cyber-Grid Texture Overlay */}
      <div className="cyber-grid-canvas" style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.5,
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Futuristic Background Telemetry Orbital Arc in Top Right */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        right: '-150px',
        width: '580px',
        height: '580px',
        borderRadius: '50%',
        border: '1px dashed rgba(139, 92, 246, 0.22)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        top: '-90px',
        right: '-90px',
        width: '420px',
        height: '420px',
        borderRadius: '50%',
        border: '1px solid rgba(37, 99, 235, 0.2)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP LIVE REAL-TIME MARKET TICKER STRIP                     */}
      {/* ------------------------------------------------------------- */}
      <div style={{
        background: '#04060d',
        borderBottom: `1px solid ${DB_BORDER}`,
        height: '36px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        zIndex: 20,
        whiteSpace: 'nowrap'
      }}>
        {/* Solid Opaque Ticker badge that NEVER lets text bleed or overlap */}
        <div style={{
          flexShrink: 0,
          height: '100%',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#080d1a',
          borderRight: `1px solid ${DB_BORDER}`,
          zIndex: 30,
          fontSize: '0.68rem',
          fontWeight: '700',
          color: DB_TEXT_MUTED,
          letterSpacing: '0.6px',
          whiteSpace: 'nowrap',
          boxShadow: '4px 0 12px rgba(0, 0, 0, 0.7)'
        }}>
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: tickerPulse ? '#60a5fa' : DB_GREEN, 
            boxShadow: tickerPulse ? '0 0 8px #60a5fa' : `0 0 6px ${DB_GREEN}`,
            transition: 'all 0.3s ease',
            flexShrink: 0
          }} />
          <span style={{ whiteSpace: 'nowrap' }}>REAL-TIME NSE/BSE</span>
        </div>

        {/* Dedicated Ticker Viewport with strict overflow hidden */}
        <div style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          maskImage: 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)'
        }}>
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div 
                key={i} 
                className="ticker-item"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginRight: '2.5rem',
                  fontSize: '0.74rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  height: '100%',
                  lineHeight: 1
                }}
              >
                <span style={{ fontWeight: '600', color: '#cbd5e1', whiteSpace: 'nowrap', lineHeight: 1 }}>{item.symbol}</span>
                <span style={{ fontFamily: DB_MONO, color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  {typeof item.price === 'number' ? item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.price}
                </span>
                <span style={{ 
                  fontFamily: DB_MONO, 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  color: item.up ? '#4ade80' : '#f87171',
                  whiteSpace: 'nowrap',
                  lineHeight: 1
                }}>
                  {typeof item.change === 'number' ? `${item.change > 0 ? '+' : ''}${item.change.toFixed(2)} (${item.pct > 0 ? '+' : ''}${item.pct}%)` : item.change}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.18)', marginLeft: '6px', whiteSpace: 'nowrap', lineHeight: 1 }}>•</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN PANEL HEADER BAR                                      */}
      {/* ------------------------------------------------------------- */}
      <header style={{ 
        background: DB_PANEL,
        borderBottom: `1px solid ${DB_BORDER}`,
        padding: '0.75rem 2rem',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Brand with Infirow Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${DB_BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(139, 92, 246, 0.25)'
          }}>
            <img 
              src="/logo.png" 
              alt="Infirow Logo" 
              style={{ width: '26px', height: '26px', objectFit: 'contain', mixBlendMode: 'screen' }} 
              onError={e => { e.target.onerror = null; e.target.src = '/logo.jpg'; }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: DB_TEXT_MAIN, letterSpacing: '-0.2px' }}>
                Tradopad Control Panel
              </span>
              <span style={{ 
                fontSize: '0.64rem', 
                color: '#60a5fa', 
                background: 'rgba(37, 99, 235, 0.12)', 
                border: '1px solid rgba(37, 99, 235, 0.3)', 
                padding: '1px 6px', 
                borderRadius: '4px', 
                fontWeight: '600'
              }}>
                OPTIONS ENGINE
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Active Broker Routing Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${DB_BORDER}`,
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem'
          }}>
            <Server size={12} color={DB_BLUE} />
            <span style={{ color: DB_TEXT_MUTED }}>Broker Route:</span>
            <span style={{ fontWeight: '600', color: '#fff' }}>Fyers API</span>
            <span style={{ fontSize: '0.65rem', color: DB_GREEN, fontWeight: '700' }}>● ONLINE</span>
          </div>

          {/* Strike Step Routing */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${DB_BORDER}`,
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem'
          }}>
            <Sliders size={12} color={DB_TEXT_MUTED} />
            <span style={{ color: DB_TEXT_MUTED }}>Strike Step:</span>
            <span style={{ fontWeight: '600', color: '#fff' }}>ATM (Auto)</span>
          </div>

          <div style={{ height: '14px', width: '1px', background: DB_BORDER }} />

          {/* Clock */}
          <span style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED, fontFamily: DB_MONO }}>
            {currentTime} IST
          </span>

          {/* Admin User */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.76rem',
            color: DB_TEXT_MAIN,
            fontWeight: '600'
          }}>
            <User size={13} color={DB_TEXT_MUTED} />
            <span>{adminProfile?.username || 'admin'}</span>
          </div>

          <button 
            onClick={() => navigate('/device')}
            style={{
              background: 'transparent',
              border: `1px solid ${DB_BORDER}`,
              color: DB_TEXT_MUTED,
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: DB_FONT
            }}
          >
            <span>Trader View</span>
            <ArrowUpRight size={12} />
          </button>

          <button 
            onClick={handleAdminLogout}
            style={{
              background: 'transparent',
              border: 'none',
              color: DB_TEXT_MUTED,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: DB_FONT
            }}
            title="Sign Out"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN WORKSPACE BODY                                        */}
      {/* ------------------------------------------------------------- */}
      <main style={{ maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '1.5rem 1.5rem 80px 1.5rem', position: 'relative', zIndex: 1 }}>

        {/* Panel Control Toolbar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: DB_TEXT_MAIN, margin: 0 }}>
                Fleet Operations & Provisioning
              </h2>
              <span style={{ fontSize: '0.68rem', color: DB_TEXT_MUTED, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                Cluster 01
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: DB_TEXT_MUTED }}>
              Manage physical trading consoles, user account bindings, and broker execution routes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setBindModalOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${DB_BORDER}`,
                color: DB_TEXT_MAIN,
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: DB_FONT
              }}
            >
              <Link2 size={13} />
              <span>Bind Console</span>
            </button>

            <button
              onClick={() => setRegisterModalOpen(true)}
              style={{
                background: DB_BLUE,
                border: 'none',
                color: '#ffffff',
                padding: '7px 15px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: DB_FONT
              }}
            >
              <Plus size={14} />
              <span>Register Unit</span>
            </button>
          </div>
        </div>

        {/* Panel Telemetry Overview Cards (4 Clean Metric Blocks) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '10px', 
          marginBottom: '1.5rem' 
        }}>
          {/* Metric 1 */}
          <div style={panelCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Hardware Fleet
              </span>
              <Cpu size={14} color={DB_TEXT_MUTED} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: DB_TEXT_MAIN, fontFamily: DB_MONO }}>
              {stats.totalDevices}
            </div>
            <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Registered hardware units
            </div>
          </div>

          {/* Metric 2 */}
          <div style={panelCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Execution Nodes
              </span>
              <Activity size={14} color={DB_GREEN} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: DB_GREEN, fontFamily: DB_MONO }}>
              {stats.boundDevices}
            </div>
            <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Linked & ready to trade
            </div>
          </div>

          {/* Metric 3 */}
          <div style={panelCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Available Stock
              </span>
              <HardDrive size={14} color={DB_AMBER} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: DB_AMBER, fontFamily: DB_MONO }}>
              {stats.unassignedDevices}
            </div>
            <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Unassigned in inventory
            </div>
          </div>

          {/* Metric 4 */}
          <div style={panelCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Trader Accounts
              </span>
              <Users size={14} color={DB_TEXT_MUTED} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: DB_TEXT_MAIN, fontFamily: DB_MONO }}>
              {stats.totalUsers}
            </div>
            <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              {stats.waitlistPending} pending on waitlist
            </div>
          </div>
        </div>

        {/* Global Notification Feedback */}
        {deviceActionMsg.text && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '8px 12px',
            borderRadius: '6px',
            background: deviceActionMsg.type === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: deviceActionMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
            color: deviceActionMsg.type === 'success' ? '#4ade80' : '#f87171',
            fontSize: '0.8rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={14} />
            <span>{deviceActionMsg.text}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PANEL NAVIGATION TABS                                         */}
        {/* ------------------------------------------------------------- */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginBottom: '1rem', 
          borderBottom: `1px solid ${DB_BORDER}`, 
          paddingBottom: '6px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'devices', label: 'Consoles & Hardware', count: devices.length },
            { id: 'users', label: 'Traders & Keys', count: usersList.length },
            { id: 'waitlist', label: 'Waitlist Pipeline', count: waitlist.length },
            { id: 'trades', label: 'Execution Stream', count: null },
            { id: 'audit', label: 'Audit Trail', count: null },
            { 
              id: 'dpdp', 
              label: 'DPDP Erasure Requests', 
              count: deletionRequests.filter(r => r.status === 'PENDING').length,
              isAlert: deletionRequests.filter(r => r.status === 'PENDING').length > 0 
            }
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: active ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                  color: active ? '#ffffff' : (t.isAlert ? '#f87171' : DB_TEXT_MUTED),
                  border: 'none',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: active ? '600' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontFamily: DB_FONT,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{t.label}</span>
                {t.count !== null && (
                  <span style={{
                    fontSize: '0.66rem',
                    background: t.isAlert ? '#ef4444' : (active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)'),
                    color: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: '700'
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: HARDWARE CONSOLES FLEET                                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'devices' && (
          <div>
            {/* Table Search & Filter Toolbar */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '10px', 
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 300px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                  <Search size={13} color={DB_TEXT_MUTED} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Filter by Device ID, Serial #, User..."
                    value={deviceSearch}
                    onChange={e => setDeviceSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      background: DB_INPUT,
                      border: `1px solid ${DB_BORDER}`,
                      borderRadius: '6px',
                      color: DB_TEXT_MAIN,
                      fontSize: '0.8rem',
                      fontFamily: DB_FONT,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <select
                  value={deviceFilter}
                  onChange={e => setDeviceFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    background: DB_INPUT,
                    border: `1px solid ${DB_BORDER}`,
                    borderRadius: '6px',
                    color: DB_TEXT_MUTED,
                    fontSize: '0.8rem',
                    fontFamily: DB_FONT,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="ALL">All Status</option>
                  <option value="BOUND">Bound Only</option>
                  <option value="UNASSIGNED">Stock Only</option>
                </select>
              </div>

              <button
                onClick={fetchDevices}
                style={{
                  background: 'transparent',
                  border: `1px solid ${DB_BORDER}`,
                  color: DB_TEXT_MUTED,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.76rem',
                  fontFamily: DB_FONT
                }}
              >
                <RefreshCw size={12} className={devicesLoading ? 'animate-spin' : ''} />
                <span>Refresh Fleet</span>
              </button>
            </div>

            {/* Devices Control Table */}
            <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Device ID</th>
                      <th style={thStyle}>Serial #</th>
                      <th style={thStyle}>Hardware</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Battery & Signal</th>
                      <th style={thStyle}>Bound Trader</th>
                      <th style={thStyle}>Last Heartbeat</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map(d => {
                      const isBound = d.status === 'bound';
                      const battery = d.battery_pct !== null && d.battery_pct !== undefined ? Number(d.battery_pct) : null;
                      const batteryColor = battery === null ? DB_TEXT_FAINT : battery > 50 ? DB_GREEN : battery > 20 ? DB_AMBER : DB_RED;

                      return (
                        <tr 
                          key={d.id} 
                          style={{ transition: 'background 0.15s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ ...tdStyle, fontWeight: '700', color: '#fff', fontFamily: DB_MONO }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Cpu size={14} color={DB_BLUE} />
                              <span>{d.device_id}</span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: DB_MONO, color: DB_TEXT_MUTED, fontSize: '0.78rem' }}>
                            {d.serial_number || '—'}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ color: DB_TEXT_MAIN, fontWeight: '500' }}>{d.hw_revision || 'rev1'}</span>
                            <span style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginLeft: '6px' }}>v{d.firmware_version || '1.0.0'}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: '600',
                              background: isBound ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: isBound ? '#4ade80' : '#fbbf24',
                              border: isBound ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: isBound ? '#4ade80' : '#fbbf24' }} />
                              {isBound ? 'BOUND' : 'IN STOCK'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: batteryColor, fontWeight: '600', fontSize: '0.78rem' }}>
                                <Battery size={13} />
                                <span>{battery !== null ? `${battery}%` : 'Offline'}</span>
                              </div>
                              {d.wifi_rssi && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: DB_TEXT_MUTED, fontSize: '0.72rem' }}>
                                  <Wifi size={11} />
                                  <span>{d.wifi_rssi} dBm</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            {d.user_id ? (
                              <span style={{ color: DB_TEXT_MAIN }}>
                                {d.bound_username || d.bound_email} <span style={{ color: DB_TEXT_MUTED, fontSize: '0.74rem' }}>#{d.user_id}</span>
                              </span>
                            ) : (
                              <span style={{ color: DB_TEXT_FAINT, fontStyle: 'italic' }}>Unassigned</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.75rem', color: DB_TEXT_MUTED }}>
                            {d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : '—'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              <button
                                onClick={() => { setEditingDevice({ ...d, original_device_id: d.device_id, new_device_id: d.device_id }); setEditModalOpen(true); }}
                                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                                title="Edit Console"
                              >
                                <Edit3 size={13} />
                              </button>
                              {isBound ? (
                                <button
                                  onClick={() => handleUnbindDevice(d.device_id)}
                                  style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Unbind Console"
                                >
                                  <Unlink size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setBindForm({ device_id: d.device_id, user_id: '', order_ref: '' }); setBindModalOpen(true); }}
                                  style={{ background: 'transparent', border: 'none', color: DB_BLUE, padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Bind Console"
                                >
                                  <Link2 size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteDevice(d.device_id)}
                                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                                title="Delete from Warehouse"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredDevices.length === 0 && !devicesLoading && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: DB_TEXT_MUTED }}>
                          <Cpu size={28} style={{ margin: '0 auto 8px auto', display: 'block', color: DB_TEXT_FAINT }} />
                          <div style={{ fontSize: '0.84rem' }}>No hardware consoles found.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: TRADER USERS & KEYS                                    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'users' && (
          <div>
            {/* Quick Provisioning Bar */}
            <div style={{ ...panelCard, marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: '600', color: DB_TEXT_MAIN, marginBottom: '4px' }}>
                Provision Trader Account
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: DB_TEXT_MUTED }}>
                Authorize credentials for physical console binding and broker synchronization.
              </p>

              {userMsg.text && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  background: userMsg.type === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  color: userMsg.type === 'success' ? '#4ade80' : '#f87171'
                }}>
                  {userMsg.text}
                </div>
              )}

              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Full Name (e.g. Vikram Sharma)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ flex: '1 1 160px', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: DB_FONT }}
                />
                <input
                  type="text"
                  placeholder="Username (e.g. device14)"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  style={{ flex: '1 1 150px', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: DB_FONT }}
                  required
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={{ flex: '1 1 180px', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: DB_FONT }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ flex: '1 1 150px', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: DB_FONT }}
                  required
                />
                <button
                  type="submit"
                  style={{
                    background: DB_BLUE,
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    fontFamily: DB_FONT
                  }}
                >
                  Create Trader
                </button>
              </form>
            </div>

            {/* Users Directory Table */}
            <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Trader Name & Handle</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Bound Console</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Created</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr 
                        key={u.id}
                        onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ ...tdStyle, color: DB_TEXT_MUTED, fontFamily: DB_MONO }}>#{u.id}</td>
                        <td style={{ ...tdStyle }}>
                          <div style={{ fontWeight: '600', color: DB_TEXT_MAIN, fontSize: '0.84rem' }}>
                            {u.name || u.username}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, fontFamily: DB_MONO, marginTop: '2px' }}>
                            @{u.username}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.66rem',
                            fontWeight: '600',
                            background: u.role === 'admin' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(255,255,255,0.04)',
                            color: u.role === 'admin' ? '#60a5fa' : DB_TEXT_MUTED
                          }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {u.bound_device_id ? (
                            <span style={{ color: '#4ade80', fontFamily: DB_MONO, fontSize: '0.78rem', fontWeight: '600' }}>
                              {u.bound_device_id}
                            </span>
                          ) : (
                            <span style={{ color: DB_TEXT_FAINT, fontStyle: 'italic' }}>None</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: DB_TEXT_MUTED }}>{u.email || '—'}</td>
                        <td style={{ ...tdStyle, color: DB_TEXT_MUTED, fontSize: '0.76rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              style={{
                                background: 'rgba(37, 99, 235, 0.1)',
                                border: '1px solid rgba(37, 99, 235, 0.25)',
                                color: '#60a5fa',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontFamily: DB_FONT
                              }}
                              title="Edit trader credentials & details"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => { setSelectedUser(u); fetchUserDetails(u.id); }}
                              style={{ background: 'transparent', border: `1px solid ${DB_BORDER}`, color: DB_TEXT_MAIN, padding: '4px 8px', borderRadius: '4px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: DB_FONT }}
                            >
                              Inspect
                            </button>
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, padding: '4px 8px', cursor: 'pointer', fontSize: '0.74rem', fontFamily: DB_FONT }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Inspection Modal Drawer */}
            {selectedUser && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                zIndex: 99999
              }}>
                <div style={{
                  background: DB_PANEL,
                  border: `1px solid ${DB_BORDER}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  width: '100%',
                  maxWidth: '460px',
                  fontFamily: DB_FONT
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', color: DB_TEXT_MAIN, margin: 0, fontWeight: '600' }}>
                        Trader Profile: {selectedUserData?.user?.name || selectedUser.name || selectedUser.username}
                      </h3>
                      <span style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED }}>
                        @{selectedUser.username} • #{selectedUser.id} • {selectedUser.email || 'No email registered'}
                      </span>
                    </div>
                    <button onClick={() => setSelectedUser(null)} style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>

                  {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: DB_TEXT_MUTED }}>
                      <RefreshCw size={20} className="animate-spin" />
                    </div>
                  ) : selectedUserData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ background: DB_INPUT, padding: '1rem', borderRadius: '8px', border: `1px solid ${DB_BORDER}` }}>
                        <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, fontWeight: '600', marginBottom: '8px' }}>
                          BROKER SYNCHRONIZATION
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: DB_TEXT_MUTED }}>Selected Broker:</span>
                          <span style={{ fontWeight: '600', color: DB_TEXT_MAIN }}>{selectedUserData.preferences?.selected_broker || 'Fyers'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: DB_TEXT_MUTED }}>Options Strike Step:</span>
                          <span style={{ color: DB_TEXT_MAIN }}>{selectedUserData.preferences?.selected_index || 'NIFTY'} ({selectedUserData.preferences?.strike_step || 'ATM'})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            const u = selectedUserData?.user || selectedUser;
                            setSelectedUser(null);
                            handleOpenEditUser(u);
                          }}
                          style={{
                            flex: '1 1 140px',
                            padding: '9px',
                            borderRadius: '6px',
                            background: 'rgba(37, 99, 235, 0.1)',
                            border: '1px solid rgba(37, 99, 235, 0.25)',
                            color: '#60a5fa',
                            fontWeight: '600',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontFamily: DB_FONT
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Edit Credentials</span>
                        </button>
                        <button
                          onClick={() => handleClearToken(selectedUser.id)}
                          style={{
                            flex: '1 1 140px',
                            padding: '9px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            fontWeight: '500',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontFamily: DB_FONT
                          }}
                        >
                          Revoke Broker Tokens
                        </button>
                        <button
                          onClick={() => setSelectedUser(null)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${DB_BORDER}`,
                            color: DB_TEXT_MAIN,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontFamily: DB_FONT
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: WAITLIST PIPELINE                                      */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'waitlist' && (
          <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: `1px solid ${DB_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: DB_TEXT_MAIN }}>Hardware Waitlist Queue</div>
                <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED }}>Pending applications for console allocation and private beta keys.</div>
              </div>
              <button 
                onClick={fetchWaitlist} 
                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontFamily: DB_FONT }}
              >
                <RefreshCw size={13} className={waitlistLoading ? 'animate-spin' : ''} /> <span>Refresh</span>
              </button>
            </div>

            {waitlistMsg && (
              <div style={{ margin: '1rem', padding: '8px 12px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.08)', color: '#4ade80', fontSize: '0.8rem' }}>
                {waitlistMsg}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Applicant Email</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Date Applied</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map(w => (
                    <tr 
                      key={w.id}
                      onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...tdStyle, color: DB_TEXT_MAIN }}>{w.email}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '600',
                          background: w.status === 'approved' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: w.status === 'approved' ? '#4ade80' : '#fbbf24'
                        }}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: DB_TEXT_MUTED, fontSize: '0.78rem' }}>{new Date(w.created_at).toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {w.status === 'pending' && (
                            <button
                              onClick={() => handleApproveWaitlist(w.id)}
                              style={{ background: DB_BLUE, border: 'none', color: '#ffffff', padding: '5px 12px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: '600', cursor: 'pointer', fontFamily: DB_FONT }}
                            >
                              Approve & Dispatch
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteWaitlist(w.id)}
                            style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, padding: '5px 10px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: DB_FONT }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {waitlist.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2.5rem', color: DB_TEXT_MUTED }}>
                        No pending waitlist applications.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: TRADES EXECUTION STREAM                                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'trades' && (
          <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: `1px solid ${DB_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: DB_TEXT_MAIN }}>Hardware Trade Execution Stream</div>
                <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED }}>Real-time execution log from console hardware buttons and web terminal.</div>
              </div>
              <button 
                onClick={fetchGlobalTrades} 
                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontFamily: DB_FONT }}
              >
                <RefreshCw size={13} className={tradesLoading ? 'animate-spin' : ''} /> <span>Refresh</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Trader</th>
                    <th style={thStyle}>Broker</th>
                    <th style={thStyle}>Side</th>
                    <th style={thStyle}>Contract / Symbol</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {globalTrades.map((t, idx) => (
                    <tr 
                      key={idx}
                      onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...tdStyle, color: DB_TEXT_MAIN, fontWeight: '600' }}>{t.username || `User #${t.user_id}`}</td>
                      <td style={{ ...tdStyle, color: DB_TEXT_MUTED }}>{t.broker}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          background: t.side === 'BUY' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: t.side === 'BUY' ? '#4ade80' : '#f87171'
                        }}>
                          {t.side}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: DB_MONO }}>{t.symbol}</td>
                      <td style={{ ...tdStyle, fontFamily: DB_MONO }}>{t.qty}</td>
                      <td style={tdStyle}>
                        <span style={{ color: t.status === 'SUCCESS' ? '#4ade80' : '#fbbf24', fontSize: '0.76rem', fontWeight: '600' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: DB_TEXT_MUTED, fontSize: '0.76rem' }}>
                        {new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>
                    </tr>
                  ))}
                  {globalTrades.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: DB_TEXT_MUTED }}>
                        No platform trade executions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: AUDIT LOG                                              */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: `1px solid ${DB_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: DB_TEXT_MAIN }}>Immutable Security & Hardware Audit Trail</div>
                <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED }}>Cryptographic records of console pairings, unbinds, and admin logins.</div>
              </div>
              <button 
                onClick={fetchAuditLogs} 
                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontFamily: DB_FONT }}
              >
                <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} /> <span>Refresh</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Event</th>
                    <th style={thStyle}>Actor</th>
                    <th style={thStyle}>IP Address</th>
                    <th style={thStyle}>Details</th>
                    <th style={thStyle}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr 
                      key={log.id}
                      onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...tdStyle, color: '#60a5fa', fontFamily: DB_MONO, fontSize: '0.76rem', fontWeight: '600' }}>
                        {log.action}
                      </td>
                      <td style={{ ...tdStyle, color: DB_TEXT_MAIN }}>
                        {log.actor_type}: #{log.actor_id || 'System'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: DB_MONO, color: DB_TEXT_MUTED, fontSize: '0.76rem' }}>
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', color: DB_TEXT_MUTED, fontSize: '0.76rem' }}>
                        {log.details || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: DB_TEXT_FAINT, fontSize: '0.76rem' }}>
                        {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: DB_TEXT_MUTED }}>
                        No audit records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: DPDP ACT 2023 DATA ERASURE QUEUE                       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'dpdp' && (
          <div>
            {deletionActionMsg.text && (
              <div style={{
                background: deletionActionMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${deletionActionMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: deletionActionMsg.type === 'success' ? '#6ee7b7' : '#fca5a5',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Shield size={16} color={deletionActionMsg.type === 'success' ? '#10b981' : '#ef4444'} />
                <span>{deletionActionMsg.text}</span>
              </div>
            )}

            <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: `1px solid ${DB_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: DB_TEXT_MAIN, margin: 0 }}>
                      DPDP Act 2023 Statutory Data Erasure Queue
                    </h3>
                    <span style={{
                      fontSize: '0.62rem',
                      fontFamily: DB_MONO,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(124, 58, 237, 0.2)',
                      color: '#c4b5fd',
                      border: '1px solid rgba(124, 58, 237, 0.4)',
                      fontWeight: '700'
                    }}>
                      SEC. 12 COMPLIANCE
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED, marginTop: '3px' }}>
                    Review statutory account &amp; data deletion requests. Upon approval, all credentials, hardware links, and trade logs are purged, and a confirmation email is triggered.
                  </div>
                </div>

                <button
                  onClick={fetchDeletionRequests}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${DB_BORDER}`,
                    color: DB_TEXT_MAIN,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={13} className={deletionLoading ? 'spin-icon' : ''} />
                  <span>Refresh Queue</span>
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: `1px solid ${DB_BORDER}` }}>
                      <th style={thStyle}>Request ID</th>
                      <th style={thStyle}>Trader Account</th>
                      <th style={thStyle}>Registered Email</th>
                      <th style={thStyle}>Grounds / Reason</th>
                      <th style={thStyle}>Requested Date</th>
                      <th style={thStyle}>DPDP Status</th>
                      <th style={thStyle}>Statutory Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletionRequests.map((req) => (
                      <tr 
                        key={req.id}
                        onMouseEnter={e => e.currentTarget.style.background = DB_SURFACE_HOVER}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ borderBottom: `1px solid rgba(255, 255, 255, 0.04)` }}
                      >
                        <td style={{ ...tdStyle, fontFamily: DB_MONO, color: '#60a5fa', fontWeight: '700' }}>
                          #REQ-{req.id}
                        </td>
                        <td style={{ ...tdStyle, color: DB_TEXT_MAIN, fontWeight: '600' }}>
                          @{req.username || `user_${req.user_id}`}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: DB_MONO, color: DB_TEXT_MUTED, fontSize: '0.78rem' }}>
                          {req.email || '—'}
                        </td>
                        <td style={{ ...tdStyle, color: DB_TEXT_MAIN, fontSize: '0.78rem', maxWidth: '200px' }}>
                          {req.reason || 'Account closure'}
                        </td>
                        <td style={{ ...tdStyle, color: DB_TEXT_FAINT, fontSize: '0.76rem', fontFamily: DB_MONO }}>
                          {new Date(req.requested_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                        </td>
                        <td style={tdStyle}>
                          {req.status === 'PENDING' && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontFamily: DB_MONO,
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.35)'
                            }}>
                              PENDING REVIEW
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontFamily: DB_MONO,
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)'
                            }}>
                              PURGED &amp; CONFIRMED
                            </span>
                          )}
                          {req.status === 'REJECTED' && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontFamily: DB_MONO,
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.35)'
                            }}>
                              REJECTED
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {req.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setConfirmApproveModal(req)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '5px',
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#fca5a5',
                                  fontSize: '0.74rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Approve &amp; Purge</span>
                              </button>

                              <button
                                onClick={() => handleRejectDeletion(req.id)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '5px',
                                  background: 'transparent',
                                  border: `1px solid ${DB_BORDER}`,
                                  color: DB_TEXT_MUTED,
                                  fontSize: '0.74rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: DB_TEXT_FAINT }}>
                              {req.reviewed_by ? `By @${req.reviewed_by}` : 'Processed'}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {deletionRequests.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: DB_TEXT_MUTED }}>
                          <Shield size={28} color="#10b981" style={{ marginBottom: '8px', opacity: 0.8 }} />
                          <div style={{ fontSize: '0.90rem', fontWeight: '600', color: DB_TEXT_MAIN }}>
                            No Pending Data Erasure Requests
                          </div>
                          <div style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED, marginTop: '4px' }}>
                            All trader profiles and database records are 100% compliant with the DPDP Act 2023.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: REGISTER CONSOLE                                       */}
      {/* ------------------------------------------------------------- */}
      {registerModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 99999
        }}>
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '12px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            fontFamily: DB_FONT
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: DB_TEXT_MAIN, margin: 0, fontWeight: '600' }}>Register Hardware Console</h3>
                <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED }}>Add new ESP32 unit to warehouse stock</span>
              </div>
              <button onClick={() => setRegisterModalOpen(false)} style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Device ID (e.g. DEV-0013)
                </label>
                <input
                  type="text"
                  placeholder="DEV-0013"
                  value={registerForm.device_id}
                  onChange={e => setRegisterForm({ ...registerForm, device_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Serial Number
                </label>
                <input
                  type="text"
                  placeholder="SN-TP-0013"
                  value={registerForm.serial_number}
                  onChange={e => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Hardware Rev
                  </label>
                  <input
                    type="text"
                    value={registerForm.hw_revision}
                    onChange={e => setRegisterForm({ ...registerForm, hw_revision: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Firmware Version
                  </label>
                  <input
                    type="text"
                    value={registerForm.firmware_version}
                    onChange={e => setRegisterForm({ ...registerForm, firmware_version: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'transparent', border: `1px solid ${DB_BORDER}`, color: DB_TEXT_MUTED, cursor: 'pointer', fontSize: '0.82rem', fontFamily: DB_FONT }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: DB_BLUE, border: 'none', color: '#ffffff', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', fontFamily: DB_FONT }}
                >
                  Save Console
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT CONSOLE                                           */}
      {/* ------------------------------------------------------------- */}
      {editModalOpen && editingDevice && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 99999
        }}>
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '12px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            fontFamily: DB_FONT
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: DB_TEXT_MAIN, margin: 0, fontWeight: '600' }}>
                  Edit Console ({editingDevice.original_device_id || editingDevice.device_id})
                </h3>
                <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED }}>Update hardware identifier & specifications</span>
              </div>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Device ID (Hardware Identifier)
                </label>
                <input
                  type="text"
                  value={editingDevice.new_device_id !== undefined ? editingDevice.new_device_id : editingDevice.device_id || ''}
                  onChange={e => setEditingDevice({ ...editingDevice, new_device_id: e.target.value })}
                  placeholder="e.g. DEV-0012"
                  required
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Serial Number
                </label>
                <input
                  type="text"
                  value={editingDevice.serial_number || ''}
                  onChange={e => setEditingDevice({ ...editingDevice, serial_number: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Hardware Rev
                  </label>
                  <input
                    type="text"
                    value={editingDevice.hw_revision || ''}
                    onChange={e => setEditingDevice({ ...editingDevice, hw_revision: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Firmware
                  </label>
                  <input
                    type="text"
                    value={editingDevice.firmware_version || ''}
                    onChange={e => setEditingDevice({ ...editingDevice, firmware_version: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Console Status
                </label>
                <select
                  value={editingDevice.status || 'unassigned'}
                  onChange={e => setEditingDevice({ ...editingDevice, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                >
                  <option value="unassigned">In Stock</option>
                  <option value="bound">Bound (In-Use)</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'transparent', border: `1px solid ${DB_BORDER}`, color: DB_TEXT_MUTED, cursor: 'pointer', fontSize: '0.82rem', fontFamily: DB_FONT }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: DB_BLUE, border: 'none', color: '#ffffff', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', fontFamily: DB_FONT }}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: BIND CONSOLE TO USER                                   */}
      {/* ------------------------------------------------------------- */}
      {bindModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 99999
        }}>
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '12px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            fontFamily: DB_FONT
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: DB_TEXT_MAIN, margin: 0, fontWeight: '600' }}>Bind Console</h3>
                <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED }}>Link physical hardware to trader account</span>
              </div>
              <button onClick={() => setBindModalOpen(false)} style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBindDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Select Hardware Console
                </label>
                <select
                  value={bindForm.device_id}
                  onChange={e => setBindForm({ ...bindForm, device_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  required
                >
                  <option value="">-- Choose Console --</option>
                  {devices.map(d => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id} ({d.status === 'bound' ? `Currently Bound to #${d.user_id}` : 'In Stock'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Select Trader Account
                </label>
                <select
                  value={bindForm.user_id}
                  onChange={e => setBindForm({ ...bindForm, user_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                  required
                >
                  <option value="">-- Choose Trader --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      #{u.id}: {u.username} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Order / Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-0012"
                  value={bindForm.order_ref}
                  onChange={e => setBindForm({ ...bindForm, order_ref: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setBindModalOpen(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'transparent', border: `1px solid ${DB_BORDER}`, color: DB_TEXT_MUTED, cursor: 'pointer', fontSize: '0.82rem', fontFamily: DB_FONT }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: DB_BLUE, border: 'none', color: '#ffffff', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', fontFamily: DB_FONT }}
                >
                  Confirm Binding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT USER & FULL CONFIGURATION CONSOLE                 */}
      {/* ------------------------------------------------------------- */}
      {editUserModalOpen && editingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          zIndex: 99999
        }}>
          <div style={{
            background: DB_PANEL,
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '14px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: DB_FONT,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
            boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${DB_BORDER}` }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: DB_TEXT_MAIN, margin: 0, fontWeight: '700' }}>
                  Configure Trader: @{editingUser.username}
                </h3>
                <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED }}>
                  User #{editingUser.id} • Configures mobile app parameters, hardware node, and broker vault
                </span>
              </div>
              <button 
                onClick={() => setEditUserModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: `1px solid ${DB_BORDER}` }}>
              {[
                { id: 'identity', label: 'Identity & Auth', icon: User },
                { id: 'trading', label: 'Trading Engine', icon: Sliders },
                { id: 'hardware', label: 'Console Node', icon: Cpu },
                { id: 'brokers', label: 'Broker Keys', icon: Key }
              ].map(tab => {
                const active = editingUserTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditingUserTab(tab.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: active ? '700' : '500',
                      background: active ? DB_BLUE : 'transparent',
                      color: active ? '#ffffff' : DB_TEXT_MUTED,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: DB_FONT,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <TabIcon size={12} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {editUserError && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.8rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertCircle size={14} />
                <span>{editUserError}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* TAB 1: IDENTITY & AUTH */}
              {editingUserTab === 'identity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Full Name / Display Name
                    </label>
                    <input
                      type="text"
                      value={editingUser.name || ''}
                      onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                      placeholder="e.g. Vikram Sharma"
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Username (Login Handle)
                    </label>
                    <input
                      type="text"
                      value={editingUser.username || ''}
                      onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                      placeholder="e.g. device12"
                      required
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Notification &amp; Login Email Address
                    </label>
                    <input
                      type="email"
                      value={editingUser.email || ''}
                      onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                      placeholder="e.g. trader@tradopad.com"
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, fontWeight: '500' }}>
                        Password (Reset / Overwrite)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
                          let generated = '';
                          for (let i = 0; i < 10; i++) {
                            generated += chars.charAt(Math.floor(Math.random() * chars.length));
                          }
                          setEditingUser({ ...editingUser, password: generated });
                          setShowEditUserPassword(true);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.7rem', cursor: 'pointer', fontFamily: DB_FONT, padding: 0 }}
                      >
                        Generate Random
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showEditUserPassword ? 'text' : 'password'}
                        value={editingUser.password || ''}
                        onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                        placeholder="Leave blank to keep existing password"
                        style={{ width: '100%', padding: '8px 36px 8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: DB_TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {showEditUserPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Account Role &amp; Access Privileges
                    </label>
                    <select
                      value={editingUser.role || 'user'}
                      onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    >
                      <option value="user">Trader (Mobile Terminal Access)</option>
                      <option value="admin">Administrator (Full Admin Panel Control)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: TRADING ENGINE PREFERENCES */}
              {editingUserTab === 'trading' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Primary Active Broker (App Default)
                    </label>
                    <select
                      value={editingUser.preferences?.selected_broker || 'Fyers'}
                      onChange={e => setEditingUser({
                        ...editingUser,
                        preferences: { ...editingUser.preferences, selected_broker: e.target.value }
                      })}
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    >
                      <option value="Fyers">Fyers (REST API v3)</option>
                      <option value="Dhan">Dhan (DhanHQ v2)</option>
                      <option value="Zerodha">Zerodha (Kite Connect)</option>
                      <option value="Upstox">Upstox (API v2)</option>
                      <option value="Angel">Angel One (SmartAPI)</option>
                      <option value="Kotak">Kotak Neo (Trade API)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                      Enabled Brokers in Mobile App (Multi-select)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: DB_INPUT, padding: '10px', borderRadius: '8px', border: `1px solid ${DB_BORDER}` }}>
                      {['Fyers', 'Dhan', 'Zerodha', 'Upstox', 'Angel', 'Kotak'].map(bName => {
                        const currentAdded = editingUser.preferences?.added_brokers || ['Fyers'];
                        const isChecked = currentAdded.includes(bName);
                        return (
                          <label key={bName} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: isChecked ? '#fff' : DB_TEXT_MUTED, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                let nextList = [...currentAdded];
                                if (e.target.checked) {
                                  if (!nextList.includes(bName)) nextList.push(bName);
                                } else {
                                  nextList = nextList.filter(b => b !== bName);
                                  if (nextList.length === 0) nextList = ['Fyers']; // Keep at least one
                                }
                                setEditingUser({
                                  ...editingUser,
                                  preferences: { ...editingUser.preferences, added_brokers: nextList }
                                });
                              }}
                            />
                            <span>{bName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                        Default Index Symbol
                      </label>
                      <select
                        value={editingUser.preferences?.selected_index || 'NIFTY'}
                        onChange={e => setEditingUser({
                          ...editingUser,
                          preferences: { ...editingUser.preferences, selected_index: e.target.value }
                        })}
                        style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                      >
                        <option value="NIFTY">NIFTY</option>
                        <option value="BANKNIFTY">BANKNIFTY</option>
                        <option value="FINNIFTY">FINNIFTY</option>
                        <option value="SENSEX">SENSEX</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                        Default Expiry Tag
                      </label>
                      <input
                        type="text"
                        value={editingUser.preferences?.selected_expiry || ''}
                        onChange={e => setEditingUser({
                          ...editingUser,
                          preferences: { ...editingUser.preferences, selected_expiry: e.target.value.toUpperCase() }
                        })}
                        placeholder="e.g. 05NOV26"
                        style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Emergency Kill Switch Execution Scope
                    </label>
                    <select
                      value={editingUser.preferences?.kill_switch_scope || 'current'}
                      onChange={e => setEditingUser({
                        ...editingUser,
                        preferences: { ...editingUser.preferences, kill_switch_scope: e.target.value }
                      })}
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    >
                      <option value="current">Current Selected Broker Only</option>
                      <option value="all">Global Emergency Exit (All Connected Brokers)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 3: HARDWARE CONSOLE BINDING */}
              {editingUserTab === 'hardware' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: editingUser.bound_device_id ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${editingUser.bound_device_id ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED }}>Current Console Pairing</div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: editingUser.bound_device_id ? '#4ade80' : '#f87171', fontFamily: DB_MONO, marginTop: '2px' }}>
                        {editingUser.bound_device_id || 'NO CONSOLE BOUND'}
                      </div>
                    </div>
                    {editingUser.bound_device_id && (
                      <button
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, bound_device_id: '' })}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', fontFamily: DB_FONT }}
                      >
                        Unbind Console
                      </button>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Assign / Rebind Hardware Node
                    </label>
                    <select
                      value={editingUser.bound_device_id || ''}
                      onChange={e => setEditingUser({ ...editingUser, bound_device_id: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                    >
                      <option value="">-- No Console / Unbound --</option>
                      {(editingUser.devicesList || devices || []).map(d => (
                        <option key={d.device_id} value={d.device_id}>
                          {d.device_id} ({d.serial_number || 'No S/N'}) — Status: {d.status}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.70rem', color: DB_TEXT_MUTED, marginTop: '6px', lineHeight: 1.45 }}>
                      When bound, physical CE/PE button clicks and rotary inputs from this console node are instantly decrypted and dispatched using @{editingUser.username}'s active broker credentials.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BROKER API VAULT */}
              {editingUserTab === 'brokers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Broker Sub-tabs */}
                  <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {['fyers', 'dhan', 'zerodha', 'upstox', 'angel', 'kotak'].map(bKey => {
                      const active = editingBrokerSubTab === bKey;
                      const labels = {
                        fyers: 'Fyers v3',
                        dhan: 'DhanHQ',
                        zerodha: 'Zerodha Kite',
                        upstox: 'Upstox v2',
                        angel: 'Angel SmartAPI',
                        kotak: 'Kotak Neo'
                      };
                      return (
                        <button
                          key={bKey}
                          type="button"
                          onClick={() => setEditingBrokerSubTab(bKey)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: active ? '700' : '500',
                            background: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${active ? '#3b82f6' : DB_BORDER}`,
                            color: active ? '#60a5fa' : DB_TEXT_MUTED,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontFamily: DB_FONT
                          }}
                        >
                          {labels[bKey]}
                        </button>
                      );
                    })}
                  </div>

                  {/* 1. FYERS VAULT */}
                  {editingBrokerSubTab === 'fyers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Fyers App ID (e.g. XC12345-100)</label>
                        <input
                          type="text"
                          value={editingUser.broker_credentials?.fyers_app_id || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, fyers_app_id: e.target.value }
                          })}
                          placeholder="App ID"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Fyers Secret Key</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.fyers_secret_key || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, fyers_secret_key: e.target.value }
                          })}
                          placeholder="Secret Key"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Fyers Client ID</label>
                          <input
                            type="text"
                            value={editingUser.broker_credentials?.fyers_id || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, fyers_id: e.target.value }
                            })}
                            placeholder="e.g. XC12345"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Fyers PIN</label>
                          <input
                            type="password"
                            value={editingUser.broker_credentials?.fyers_pin || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, fyers_pin: e.target.value }
                            })}
                            placeholder="4-digit PIN"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Fyers TOTP Secret (Base32)</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.fyers_totp_secret || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, fyers_totp_secret: e.target.value }
                          })}
                          placeholder="TOTP Secret Key"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. DHAN VAULT */}
                  {editingBrokerSubTab === 'dhan' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Dhan Client ID</label>
                        <input
                          type="text"
                          value={editingUser.broker_credentials?.dhan_client_id || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, dhan_client_id: e.target.value }
                          })}
                          placeholder="10-digit Client ID"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Dhan Permanent Access Token</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.dhan_access_token || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, dhan_access_token: e.target.value }
                          })}
                          placeholder="JWT Access Token from Dhan web"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Dhan API Key</label>
                          <input
                            type="text"
                            value={editingUser.broker_credentials?.dhan_api_key || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, dhan_api_key: e.target.value }
                            })}
                            placeholder="API Key"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Dhan API Secret</label>
                          <input
                            type="password"
                            value={editingUser.broker_credentials?.dhan_api_secret || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, dhan_api_secret: e.target.value }
                            })}
                            placeholder="API Secret"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. ZERODHA VAULT */}
                  {editingBrokerSubTab === 'zerodha' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Zerodha Kite API Key</label>
                        <input
                          type="text"
                          value={editingUser.broker_credentials?.zerodha_api_key || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, zerodha_api_key: e.target.value }
                          })}
                          placeholder="Developer API Key"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Zerodha Kite API Secret</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.zerodha_api_secret || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, zerodha_api_secret: e.target.value }
                          })}
                          placeholder="Developer API Secret"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Active Daily Access Token</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.zerodha_access_token || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, zerodha_access_token: e.target.value }
                          })}
                          placeholder="Session Access Token"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. UPSTOX VAULT */}
                  {editingBrokerSubTab === 'upstox' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Upstox API Key / Client ID</label>
                        <input
                          type="text"
                          value={editingUser.broker_credentials?.upstox_api_key || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, upstox_api_key: e.target.value }
                          })}
                          placeholder="Upstox API Key"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Upstox API Secret</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.upstox_api_secret || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, upstox_api_secret: e.target.value }
                          })}
                          placeholder="Upstox API Secret"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Active Access Token</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.upstox_access_token || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, upstox_access_token: e.target.value }
                          })}
                          placeholder="Bearer Access Token"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 5. ANGEL ONE VAULT */}
                  {editingBrokerSubTab === 'angel' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Client Code</label>
                          <input
                            type="text"
                            value={editingUser.broker_credentials?.angel_client_code || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, angel_client_code: e.target.value }
                            })}
                            placeholder="Angel Client Code"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Password / PIN</label>
                          <input
                            type="password"
                            value={editingUser.broker_credentials?.angel_password || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, angel_password: e.target.value }
                            })}
                            placeholder="Password"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>SmartAPI Key</label>
                        <input
                          type="text"
                          value={editingUser.broker_credentials?.angel_api_key || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, angel_api_key: e.target.value }
                          })}
                          placeholder="SmartAPI App Key"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>TOTP Secret (Base32)</label>
                        <input
                          type="password"
                          value={editingUser.broker_credentials?.angel_totp_secret || ''}
                          onChange={e => setEditingUser({
                            ...editingUser,
                            broker_credentials: { ...editingUser.broker_credentials, angel_totp_secret: e.target.value }
                          })}
                          placeholder="TOTP Secret Seed"
                          style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 6. KOTAK NEO VAULT */}
                  {editingBrokerSubTab === 'kotak' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Consumer Key</label>
                          <input
                            type="text"
                            value={editingUser.broker_credentials?.kotak_consumer_key || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, kotak_consumer_key: e.target.value }
                            })}
                            placeholder="Consumer Key"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Consumer Secret</label>
                          <input
                            type="password"
                            value={editingUser.broker_credentials?.kotak_consumer_secret || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, kotak_consumer_secret: e.target.value }
                            })}
                            placeholder="Consumer Secret"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>Registered Mobile</label>
                          <input
                            type="text"
                            value={editingUser.broker_credentials?.kotak_mobile || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, kotak_mobile: e.target.value }
                            })}
                            placeholder="10-digit mobile"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, display: 'block', marginBottom: '3px' }}>MPIN</label>
                          <input
                            type="password"
                            value={editingUser.broker_credentials?.kotak_mpin || ''}
                            onChange={e => setEditingUser({
                              ...editingUser,
                              broker_credentials: { ...editingUser.broker_credentials, kotak_mpin: e.target.value }
                            })}
                            placeholder="6-digit MPIN"
                            style={{ width: '100%', padding: '7px 10px', background: DB_INPUT, border: `1px solid ${DB_BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '0.80rem', outline: 'none', fontFamily: DB_FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: `1px solid ${DB_BORDER}` }}>
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  style={{ flex: 1, padding: '9px', borderRadius: '6px', background: 'transparent', border: `1px solid ${DB_BORDER}`, color: DB_TEXT_MUTED, cursor: 'pointer', fontSize: '0.82rem', fontFamily: DB_FONT }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserSaving}
                  style={{ flex: 1.5, padding: '9px', borderRadius: '6px', background: DB_BLUE, border: 'none', color: '#ffffff', fontWeight: '700', fontSize: '0.82rem', cursor: editUserSaving ? 'not-allowed' : 'pointer', opacity: editUserSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: DB_FONT, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
                >
                  {editUserSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Full Config...</span>
                    </>
                  ) : (
                    <span>Save Trader Configuration</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CONFIRM DPDP DATA ERASURE & PURGE                      */}
      {/* ------------------------------------------------------------- */}
      {confirmApproveModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 99999
        }}>
          <div style={{
            background: DB_PANEL,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '460px',
            fontFamily: DB_FONT,
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 20px rgba(239, 68, 68, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: '700' }}>
                  Execute Irreversible DPDP Erasure
                </h3>
                <span style={{ fontSize: '0.74rem', color: DB_TEXT_MUTED }}>
                  Statutory Deletion under DPDP Act 2023 (Sec. 12)
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: DB_TEXT_MAIN, lineHeight: '1.55', margin: '0 0 1rem 0' }}>
              You are about to approve the statutory data erasure request for trader:
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${DB_BORDER}`,
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '1.25rem',
              fontSize: '0.80rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: DB_TEXT_FAINT }}>Trader Handle:</span>
                <span style={{ color: '#fff', fontWeight: '700', fontFamily: DB_MONO }}>@{confirmApproveModal.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: DB_TEXT_FAINT }}>Notification Email:</span>
                <span style={{ color: '#60a5fa', fontFamily: DB_MONO }}>{confirmApproveModal.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: DB_TEXT_FAINT }}>Request Reason:</span>
                <span style={{ color: DB_TEXT_MUTED }}>{confirmApproveModal.reason}</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.74rem',
              color: '#fca5a5',
              lineHeight: '1.45',
              marginBottom: '1.25rem'
            }}>
              <strong>⚠️ Immediate Statutory Impact:</strong>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px' }}>
                <li>Permanent deletion of account credentials &amp; profile identity.</li>
                <li>Instant purge of all linked broker keys, secrets, &amp; session tokens.</li>
                <li>Unbinding and deletion of hardware console assignments.</li>
                <li>Purge of order history ledger and telemetry.</li>
                <li><strong>Automatic delivery of official statutory DPDP confirmation email to the trader.</strong></li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmApproveModal(null)}
                disabled={approveSubmitting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: `1px solid ${DB_BORDER}`,
                  color: DB_TEXT_MUTED,
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleApproveDeletion(confirmApproveModal)}
                disabled={approveSubmitting}
                style={{
                  flex: 1.6,
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  cursor: approveSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 18px rgba(239, 68, 68, 0.4)'
                }}
              >
                {approveSubmitting ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Purging &amp; Sending Email...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Approve &amp; Purge Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
