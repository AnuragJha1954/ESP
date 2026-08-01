import React, { useState, useEffect } from 'react';
import { useAppState } from './StateContext';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Plus, RefreshCw, ChevronLeft, Database, Key, Settings, User, Eye, EyeOff } from 'lucide-react';

const thStyle = { padding: '12px 10px', fontWeight: '600', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', textAlign: 'left' };
const tdStyle = { padding: '12px 10px', fontSize: '0.9rem', whiteSpace: 'nowrap', textAlign: 'left', color: '#ccc' };
const cardStyle = { marginBottom: '1.5rem', padding: '1.5rem' };

function MaskedCell({ value }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <td style={tdStyle}>-</td>;
  return (
    <td style={tdStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{visible ? value : '••••••••'}</span>
        <button onClick={() => setVisible(!visible)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}>
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </td>
  );
}

export default function AdminPanel() {
  const { authToken, user, logout } = useAppState();
  const navigate = useNavigate();
  
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Global Trade History state
  const [globalTrades, setGlobalTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'trades', 'waitlist'

  // Waitlist state
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUsersList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalTrades = async () => {
    setTradesLoading(true);
    try {
      const res = await fetch('/api/admin/trade-history', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setGlobalTrades(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTradesLoading(false);
    }
  };

  const fetchWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const res = await fetch('/api/admin/waitlist', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWaitlist(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedUserData(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveWaitlist = async (id) => {
    try {
      const res = await fetch(`/api/admin/waitlist/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWaitlistMessage('User approved successfully!');
        fetchWaitlist();
        setTimeout(() => setWaitlistMessage(''), 3000);
      } else {
        setWaitlistMessage(`Error: ${data.message || 'Failed to approve'}`);
        setTimeout(() => setWaitlistMessage(''), 3000);
      }
    } catch (err) {
      setWaitlistMessage('Network error');
      setTimeout(() => setWaitlistMessage(''), 3000);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
      fetchGlobalTrades();
      fetchWaitlist();
    }
  }, [authToken, user]);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    fetchUserDetails(u.id);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setSelectedUserData(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newUsername && !newEmail) {
      setError('Please provide at least a username or email.');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ username: newUsername, email: newEmail, password: newPassword, role: 'user' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccess(`User created! ID: ${data.userId}`);
        setNewUsername(''); setNewEmail(''); setNewPassword('');
        fetchUsers();
      } else {
        setError(data.message || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error.');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // ─── USER DETAIL VIEW ─────────────────────────────
  if (selectedUser && selectedUserData) {
    const { user: ud, preferences: prefs, broker_credentials: creds } = selectedUserData;
    return (
      <div style={{ minHeight: '100vh', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '100px' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          
          {/* Back Button */}
          <button onClick={handleBackToList} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '8px 0', marginBottom: '1.5rem', fontSize: '1rem' }}>
            <ChevronLeft size={20} /> Back to All Users
          </button>

          {/* User Identity Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '55px', height: '55px', borderRadius: '14px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User color="#fff" size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '600', color: '#fff', margin: 0 }}>{ud.username || ud.email || `User #${ud.id}`}</h2>
              <div style={{ color: '#888', fontSize: '0.9rem', marginTop: '2px' }}>
                <span style={{ background: ud.role === 'admin' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.1)', color: ud.role === 'admin' ? '#c4b5fd' : '#aaa', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>{ud.role.toUpperCase()}</span>
                <span style={{ marginLeft: '10px' }}>Joined {new Date(ud.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* TABLE 1: Users Table */}
          <div className="futuristic-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <Database color="#60a5fa" size={18} />
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>users</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>id</th>
                    <th style={thStyle}>username</th>
                    <th style={thStyle}>email</th>
                    <th style={thStyle}>google_id</th>
                    <th style={thStyle}>role</th>
                    <th style={thStyle}>created_at</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}>{ud.id}</td>
                    <td style={tdStyle}>{ud.username || '-'}</td>
                    <td style={tdStyle}>{ud.email || '-'}</td>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{ud.google_id || '-'}</span></td>
                    <td style={tdStyle}>{ud.role}</td>
                    <td style={tdStyle}>{ud.created_at}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: User Preferences */}
          <div className="futuristic-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <Settings color="#4ade80" size={18} />
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>user_preferences</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>user_id</th>
                    <th style={thStyle}>selected_broker</th>
                    <th style={thStyle}>selected_index</th>
                    <th style={thStyle}>selected_expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {prefs ? (
                    <tr>
                      <td style={tdStyle}>{prefs.user_id}</td>
                      <td style={tdStyle}>{prefs.selected_broker || '-'}</td>
                      <td style={tdStyle}>{prefs.selected_index || '-'}</td>
                      <td style={tdStyle}>{prefs.selected_expiry || '-'}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan="4" style={{ ...tdStyle, textAlign: 'center', color: '#666' }}>No preferences saved yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 3: Broker Credentials */}
          <div className="futuristic-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <Key color="#f59e0b" size={18} />
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>broker_credentials</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>user_id</th>
                    <th style={thStyle}>fyers_id</th>
                    <th style={thStyle}>fyers_app_id</th>
                    <th style={thStyle}>fyers_secret_key</th>
                    <th style={thStyle}>fyers_totp_secret</th>
                    <th style={thStyle}>fyers_pin</th>
                    <th style={thStyle}>fyers_access_token</th>
                    <th style={thStyle}>dhan_client_id</th>
                    <th style={thStyle}>dhan_password</th>
                    <th style={thStyle}>dhan_totp_secret</th>
                    <th style={thStyle}>dhan_api_key</th>
                    <th style={thStyle}>dhan_api_secret</th>
                    <th style={thStyle}>dhan_access_token</th>
                    <th style={thStyle}>updated_at</th>
                  </tr>
                </thead>
                <tbody>
                  {creds ? (
                    <tr>
                      <td style={tdStyle}>{creds.user_id}</td>
                      <td style={tdStyle}>{creds.fyers_id || '-'}</td>
                      <td style={tdStyle}>{creds.fyers_app_id || '-'}</td>
                      <MaskedCell value={creds.fyers_secret_key} />
                      <MaskedCell value={creds.fyers_totp_secret} />
                      <MaskedCell value={creds.fyers_pin} />
                      <MaskedCell value={creds.fyers_access_token} />
                      <td style={tdStyle}>{creds.dhan_client_id || '-'}</td>
                      <MaskedCell value={creds.dhan_password} />
                      <MaskedCell value={creds.dhan_totp_secret} />
                      <MaskedCell value={creds.dhan_api_key} />
                      <MaskedCell value={creds.dhan_api_secret} />
                      <MaskedCell value={creds.dhan_access_token} />
                      <td style={tdStyle}>{creds.updated_at || '-'}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan="14" style={{ ...tdStyle, textAlign: 'center', color: '#666' }}>No broker credentials configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─── MAIN LIST VIEW ─────────────────────────────
  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '100px' }}>
      <div style={{ width: '100%', maxWidth: '900px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff', margin: 0 }}>Admin Panel</h1>
              <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Welcome, {user?.username}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer' }}>
            <LogOut size={18} />
            <span style={{ fontWeight: '600' }}>Logout</span>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ background: 'transparent', border: 'none', color: activeTab === 'users' ? '#60a5fa' : '#aaa', fontWeight: activeTab === 'users' ? '600' : '400', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'users' ? '2px solid #60a5fa' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            Users
          </button>
          <button 
            onClick={() => setActiveTab('trades')}
            style={{ background: 'transparent', border: 'none', color: activeTab === 'trades' ? '#60a5fa' : '#aaa', fontWeight: activeTab === 'trades' ? '600' : '400', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'trades' ? '2px solid #60a5fa' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            Global Trades
          </button>
          <button 
            onClick={() => setActiveTab('waitlist')}
            style={{ background: 'transparent', border: 'none', color: activeTab === 'waitlist' ? '#60a5fa' : '#aaa', fontWeight: activeTab === 'waitlist' ? '600' : '400', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'waitlist' ? '2px solid #60a5fa' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            Waitlist
          </button>
        </div>

        {activeTab === 'users' && (
          <>
            {/* Invite New User */}
            <div className="futuristic-card" style={cardStyle}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>Invite New User</h2>
              {error && <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
              {success && <div style={{ color: '#4ade80', marginBottom: '1rem', fontSize: '0.9rem' }}>{success}</div>}
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'flex-start' }}>
                <div className="futuristic-input-container" style={{ flex: '1 1 160px' }}>
                  <input type="text" placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} />
                </div>
                <div className="futuristic-input-container" style={{ flex: '1 1 180px' }}>
                  <input type="email" placeholder="Google SSO Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} />
                </div>
                <div className="futuristic-input-container" style={{ flex: '1 1 160px' }}>
                  <input type="password" placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} />
                </div>
                <button type="submit" className="futuristic-pill" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 20px', flex: '0 0 auto' }}>
                  <Plus size={20} />
                </button>
              </form>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                * Provide a Gmail address to enable Google SSO for this user.
              </div>
            </div>

            {/* All Users Table */}
            <div className="futuristic-card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>All Users ({usersList.length})</h2>
                <button onClick={fetchUsers} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <RefreshCw size={20} />
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Username</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Google</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Joined</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => handleSelectUser(u)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={tdStyle}>{u.id}</td>
                        <td style={tdStyle}>{u.username || '-'}</td>
                        <td style={tdStyle}>{u.email || '-'}</td>
                        <td style={tdStyle}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', background: u.google_id ? '#4ade80' : '#555' }}></span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ background: u.role === 'admin' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.1)', color: u.role === 'admin' ? '#c4b5fd' : '#aaa', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, color: '#60a5fa', fontWeight: '600', fontSize: '0.85rem' }}>View →</td>
                      </tr>
                    ))}
                    {usersList.length === 0 && !loading && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'trades' && (
          <div className="futuristic-card" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Global Trade History</h2>
              <button onClick={fetchGlobalTrades} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <RefreshCw size={20} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Broker</th>
                    <th style={thStyle}>Symbol</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Side</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Created At</th>
                    <th style={thStyle}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {globalTrades.map(trade => (
                    <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={tdStyle}>{trade.id}</td>
                      <td style={tdStyle}>{trade.user_id}</td>
                      <td style={tdStyle}>{trade.broker}</td>
                      <td style={tdStyle}>{trade.symbol}</td>
                      <td style={tdStyle}>{trade.type}</td>
                      <td style={{ ...tdStyle, color: trade.side === 'BUY' ? '#60a5fa' : '#f87171' }}>{trade.side}</td>
                      <td style={tdStyle}>{trade.quantity}</td>
                      <td style={{ ...tdStyle, color: trade.status === 'SUCCESS' ? '#4ade80' : trade.status === 'FAILED' || trade.status === 'REJECTED' ? '#f87171' : '#ccc' }}>{trade.status}</td>
                      <td style={tdStyle}>{new Date(trade.created_at).toLocaleString()}</td>
                      <td style={tdStyle}>{trade.message || '-'}</td>
                    </tr>
                  ))}
                  {globalTrades.length === 0 && !tradesLoading && (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No trades found.</td></tr>
                  )}
                  {tradesLoading && (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'waitlist' && (
          <div className="futuristic-card" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Waitlist ({waitlist.length})</h2>
              <button onClick={fetchWaitlist} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <RefreshCw size={20} />
              </button>
            </div>
            {waitlistMessage && (
              <div style={{ color: waitlistMessage.includes('Error') ? '#f87171' : '#4ade80', marginBottom: '1rem', fontSize: '0.9rem' }}>{waitlistMessage}</div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Experience</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={tdStyle}>{w.id}</td>
                      <td style={tdStyle}>{w.name || '-'}</td>
                      <td style={tdStyle}>{w.email || '-'}</td>
                      <td style={tdStyle}>{w.phone || '-'}</td>
                      <td style={tdStyle}>{w.trading_experience || '-'}</td>
                      <td style={{ ...tdStyle, color: w.status === 'approved' ? '#4ade80' : w.status === 'pending' ? '#f59e0b' : '#ccc' }}>
                        {w.status}
                      </td>
                      <td style={tdStyle}>{new Date(w.created_at).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        {w.status === 'pending' && (
                          <button 
                            onClick={() => handleApproveWaitlist(w.id)}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {waitlist.length === 0 && !waitlistLoading && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No waitlist entries found.</td></tr>
                  )}
                  {waitlistLoading && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
