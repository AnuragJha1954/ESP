import React, { createContext, useContext, useState, useEffect } from 'react';

const StateContext = createContext();

export function StateProvider({ children }) {
  const [authToken, setAuthToken] = useState(localStorage.getItem('esp_auth_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('esp_user')) || null);

  // App Theme: 'dark' (default terminal matching splash screen) or 'light'
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('tradopad_theme') || 'dark';
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('tradopad_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#060814');
      } else {
        document.documentElement.classList.remove('dark');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#F5F6F8');
      }
    } catch (e) {}
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#060814');
    } else {
      document.documentElement.classList.remove('dark');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#F5F6F8');
    }
  }, [theme]);

  const [broker, setBroker] = useState('Fyers');
  const [addedBrokers, setAddedBrokers] = useState(['Fyers']);
  const [index, setIndex] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [autoExpiry, setAutoExpiry] = useState(true);
  
  // Execution State
  const [strike, setStrike] = useState('24000');
  const [qty, setQty] = useState('65');

  // Kill Switch Scope: 'current' (default: exit current selected broker only) or 'all' (exit all connected brokers)
  const [killSwitchScope, setKillSwitchScopeState] = useState(() => {
    return localStorage.getItem('tradopad_kill_switch_scope') || 'current';
  });

  const setKillSwitchScope = async (scope) => {
    const validScope = scope === 'all' ? 'all' : 'current';
    setKillSwitchScopeState(validScope);
    try {
      localStorage.setItem('tradopad_kill_switch_scope', validScope);
      if (authToken) {
        await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            kill_switch_scope: validScope
          })
        });
      }
    } catch (err) {
      console.error("Failed to save kill switch scope preference", err);
    }
  };

  const login = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('esp_auth_token', token);
    localStorage.setItem('esp_user', JSON.stringify(userData));
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('esp_auth_token');
    localStorage.removeItem('esp_user');
    sessionStorage.removeItem('tradopad_sebi_acknowledged');
  };

  const fetchPreferences = async () => {
    if (!authToken) return;
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/preferences', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        if (data.data.selected_broker) setBroker(data.data.selected_broker);
        if (data.data.selected_index) {
          const cleanIdx = data.data.selected_index.replace(/\s*50\b/i, '').replace(/\s+/g, '').toUpperCase();
          setIndex(cleanIdx);
        }
        if (data.data.selected_expiry) setExpiry(data.data.selected_expiry);
        if (data.data.added_brokers) {
          const list = Array.isArray(data.data.added_brokers) ? data.data.added_brokers : JSON.parse(data.data.added_brokers);
          if (Array.isArray(list) && list.length > 0) {
            setAddedBrokers(list);
          }
        }
        if (data.data.kill_switch_scope) {
          setKillSwitchScopeState(data.data.kill_switch_scope);
          localStorage.setItem('tradopad_kill_switch_scope', data.data.kill_switch_scope);
        }
      }
    } catch (err) {
      console.error("Failed to load preferences", err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchPreferences();
    }
  }, [authToken]);

  const savePreferences = async (newBroker, newIndex, newExpiry, newAddedBrokers) => {
    if (!authToken) return;
    try {
      await fetch((import.meta.env.VITE_API_URL || '') + '/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          selected_broker: newBroker,
          selected_index: newIndex,
          selected_expiry: newExpiry,
          added_brokers: newAddedBrokers !== undefined ? newAddedBrokers : addedBrokers,
          kill_switch_scope: killSwitchScope
        })
      });
    } catch (err) {
      console.error("Failed to save preferences", err);
    }
  };

  // Override setters to trigger saves
  const handleSetBroker = (val) => { 
    setBroker(val); 
    // Ensure the newly selected broker is also in addedBrokers
    let updatedAdded = addedBrokers;
    if (!addedBrokers.includes(val)) {
      updatedAdded = [...addedBrokers, val];
      setAddedBrokers(updatedAdded);
    }
    savePreferences(val, index, expiry, updatedAdded); 
  };

  const handleSetIndex = (val) => { setIndex(val); savePreferences(broker, val, expiry); };
  const handleSetExpiry = (val) => { setExpiry(val); savePreferences(broker, index, val); };

  const addBroker = (newBrokerId) => {
    if (!addedBrokers.includes(newBrokerId)) {
      const next = [...addedBrokers, newBrokerId];
      setAddedBrokers(next);
      savePreferences(broker, index, expiry, next);
      return next;
    }
    return addedBrokers;
  };

  const removeBroker = (brokerId) => {
    const next = addedBrokers.filter(b => b !== brokerId);
    if (next.length === 0) return addedBrokers; // Keep at least one broker
    setAddedBrokers(next);
    let nextActive = broker;
    if (broker === brokerId) {
      nextActive = next[0];
      setBroker(nextActive);
    }
    savePreferences(nextActive, index, expiry, next);
    return next;
  };

  return (
    <StateContext.Provider value={{
      authToken, user, login, logout,
      theme, setTheme, toggleTheme,
      killSwitchScope, setKillSwitchScope,
      broker, setBroker: handleSetBroker,
      addedBrokers, setAddedBrokers, addBroker, removeBroker,
      index, setIndex: handleSetIndex,
      expiry, setExpiry: handleSetExpiry,
      autoExpiry, setAutoExpiry,
      strike, setStrike,
      qty, setQty
    }}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  return useContext(StateContext);
}
