import React, { createContext, useContext, useState } from 'react';

const StateContext = createContext();

export function StateProvider({ children }) {
  const [broker, setBroker] = useState('Fyers');
  const [index, setIndex] = useState('NIFTY');
  const [autoExpiry, setAutoExpiry] = useState(true);
  const [expiry, setExpiry] = useState('26JUL26');
  const [strike, setStrike] = useState('24050');
  const [qty, setQty] = useState('65');

  return (
    <StateContext.Provider value={{
      broker, setBroker,
      index, setIndex,
      autoExpiry, setAutoExpiry,
      expiry, setExpiry,
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
