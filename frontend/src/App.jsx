import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Splash from './Splash';
import Dashboard from './Dashboard';
import Trade from './Trade';
import History from './History';
import Profile from './Profile';
import DeviceCheck from './DeviceCheck';
import { StateProvider } from './StateContext';
import { useState, useEffect } from 'react';
import PWAPrompt from './PWAPrompt';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <DeviceCheck>
      <StateProvider>
        {showSplash ? (
          <Splash />
        ) : (
          <>
            <Router>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/trade" element={<Trade />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Router>
            <PWAPrompt />
          </>
        )}
      </StateProvider>
    </DeviceCheck>
  );
}

export default App;
