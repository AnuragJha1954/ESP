import React, { createContext, useContext, useState, useEffect } from 'react';

const StateContext = createContext();

export function StateProvider({ children }) {
  const [authToken, setAuthToken] = useState(localStorage.getItem('esp_auth_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('esp_user')) || null);

  const [broker, setBroker] = useState('Fyers');
  const [index, setIndex] = useState('NIFTY 50');
  const [expiry, setExpiry] = useState('26 JUL (Current)');
  const [autoExpiry, setAutoExpiry] = useState(true);
  
  // Execution State
  const [strike, setStrike] = useState('24000');
  const [qty, setQty] = useState('65');

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
  };

  const fetchPreferences = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/user/preferences', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        if (data.data.selected_broker) setBroker(data.data.selected_broker);
        if (data.data.selected_index) setIndex(data.data.selected_index);
        if (data.data.selected_expiry) setExpiry(data.data.selected_expiry);
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

  const savePreferences = async (newBroker, newIndex, newExpiry) => {
    if (!authToken) return;
    try {
      await fetch(import.meta.env.VITE_API_URL + '/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          selected_broker: newBroker,
          selected_index: newIndex,
          selected_expiry: newExpiry
        })
      });
    } catch (err) {
      console.error("Failed to save preferences", err);
    }
  };

  // Override setters to trigger saves
  const handleSetBroker = (val) => { setBroker(val); savePreferences(val, index, expiry); };
  const handleSetIndex = (val) => { setIndex(val); savePreferences(broker, val, expiry); };
  const handleSetExpiry = (val) => { setExpiry(val); savePreferences(broker, index, val); };

  return (
    <StateContext.Provider value={{
      authToken, user, login, logout,
      broker, setBroker: handleSetBroker,
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
