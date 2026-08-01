import { User, LogOut, Key, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import { useAppState } from './StateContext';
import { useState, useEffect } from 'react';

export default function Profile() {
  const navigate = useNavigate();
  const { user, authToken, logout, broker } = useAppState();
  
  const [fyersId, setFyersId] = useState('');
  const [appId, setAppId] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [pin, setPin] = useState('');
  const [secretKey, setSecretKey] = useState('');

  const [dhanClientId, setDhanClientId] = useState('');
  const [dhanPassword, setDhanPassword] = useState('');
  const [dhanTotpSecret, setDhanTotpSecret] = useState('');
  const [dhanApiKey, setDhanApiKey] = useState('');
  const [dhanApiSecret, setDhanApiSecret] = useState('');

  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    const fetchCreds = async () => {
      try {
        const res = await fetch(import.meta.env.VITE_API_URL + '/api/user/credentials', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          if (data.data.fyers_id) setFyersId(data.data.fyers_id);
          if (data.data.fyers_app_id) setAppId(data.data.fyers_app_id);
          if (data.data.dhan_client_id) setDhanClientId(data.data.dhan_client_id);
          if (data.data.dhan_api_key) setDhanApiKey(data.data.dhan_api_key);
          // We intentionally do not fetch the PIN or Secrets back for security
        }
      } catch (err) {
        console.error("Failed to fetch creds");
      }
    };
    if (authToken) fetchCreds();
  }, [authToken]);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/user/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fyers_id: fyersId,
          fyers_totp_secret: totpSecret,
          fyers_pin: pin,
          fyers_app_id: appId,
          fyers_secret_key: secretKey,
          dhan_client_id: dhanClientId,
          dhan_password: dhanPassword,
          dhan_totp_secret: dhanTotpSecret,
          dhan_api_key: dhanApiKey,
          dhan_api_secret: dhanApiSecret
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatus({ type: 'success', msg: 'Credentials saved successfully!' });
      } else {
        setStatus({ type: 'error', msg: data.message || 'Failed to save credentials' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '120px'
    }}>
      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Profile Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User color="#fff" size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '600', color: '#fff', margin: 0 }}>{user?.username || 'Trader'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontSize: '0.9rem', marginTop: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }}></div>
                Active Session
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
            <LogOut size={24} />
          </button>
        </div>

        {user?.role === 'admin' && (
          <button onClick={() => navigate('/admin')} className="futuristic-pill" style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', border: 'none', padding: '14px', justifyContent: 'center', marginTop: '0.5rem', width: '100%' }}>
            <span style={{ fontWeight: '600' }}>Open Admin Dashboard</span>
          </button>
        )}

        {/* Fyers Credentials Card */}
        <div className="futuristic-card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <Key color="#60a5fa" size={20} />
            <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Broker API Keys</h3>
          </div>

          {status.msg && (
            <div style={{ background: status.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: status.type === 'success' ? '#4ade80' : '#f87171', padding: '10px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {status.msg}
            </div>
          )}

          <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {broker === 'Fyers' ? (
              <>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>Fyers ID</label>
                  <div className="futuristic-input-container">
                    <input type="text" value={fyersId} onChange={e => setFyersId(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="e.g. FAJ97539" required={broker === 'Fyers'} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>App ID</label>
                  <div className="futuristic-input-container">
                    <input type="text" value={appId} onChange={e => setAppId(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="e.g. 0LJX4AMOQB-100" required={broker === 'Fyers'} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>Secret Key</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••••••••••••••" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>TOTP Secret (32 chars)</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={totpSecret} onChange={e => setTotpSecret(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••••••••••••••" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>4-Digit PIN</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={pin} onChange={e => setPin(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>Dhan Client ID</label>
                  <div className="futuristic-input-container">
                    <input type="text" value={dhanClientId} onChange={e => setDhanClientId(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="e.g. 110012345" required={broker === 'Dhan'} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>Dhan Password</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={dhanPassword} onChange={e => setDhanPassword(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••••••" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>TOTP Secret</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={dhanTotpSecret} onChange={e => setDhanTotpSecret(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••••••••••••••" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>API Key</label>
                  <div className="futuristic-input-container">
                    <input type="text" value={dhanApiKey} onChange={e => setDhanApiKey(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="API Key" required={broker === 'Dhan'} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px', display: 'block' }}>API Secret</label>
                  <div className="futuristic-input-container">
                    <input type="password" value={dhanApiSecret} onChange={e => setDhanApiSecret(e.target.value)} className="futuristic-input" style={{ textAlign: 'left', padding: '8px' }} placeholder="••••••••••••••••" />
                  </div>
                </div>
              </>
            )}
            
            <button type="submit" disabled={loading} className="futuristic-pill" style={{ background: '#2563eb', color: '#fff', border: 'none', justifyContent: 'center', marginTop: '0.5rem', padding: '12px', width: '100%' }}>
              {loading ? 'Saving...' : <><Save size={18} style={{ marginRight: '8px' }} /> Save Credentials</>}
            </button>
          </form>
        </div>

      </div>

      <NavBar />
    </div>
  );
}
