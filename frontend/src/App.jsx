import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Splash from './Splash';
import Dashboard from './Dashboard';
import DeviceTab from './DeviceTab';
import History from './History';
import Profile from './Profile';
import DeviceCheck from './DeviceCheck';
import { StateProvider, useAppState } from './StateContext';
import { useState, useEffect } from 'react';
import PWAPrompt from './PWAPrompt';
import Login from './Login';
import AdminPanel from './AdminPanel';
import RiskDisclosureModal from './components/RiskDisclosureModal';
import { getRiskDisclosureStatus } from './services/complianceService';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Replace with your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = "830780122729-lg49d049t4pt5ldgqd25ngd3iqdfh6ct.apps.googleusercontent.com"; 

function ProtectedRoute({ children, requireAdmin, mobileOnly = false }) {
  const { authToken, user } = useAppState();
  const location = useLocation();

  if (!authToken || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Wrap mobile-only routes with DeviceCheck
  if (mobileOnly) {
    return <DeviceCheck>{children}</DeviceCheck>;
  }

  return children;
}

function MainAppRoutes() {
  const { authToken, user } = useAppState();
  const location = useLocation();

  // SEBI Risk Disclosure: Strictly shown for traders in the app upon login, NEVER in the admin panel
  const isAppRoute = !location.pathname.startsWith('/admin');
  const [showRiskModal, setShowRiskModal] = useState(() => {
    return sessionStorage.getItem('tradopad_sebi_acknowledged') !== 'true';
  });

  useEffect(() => {
    if (authToken && isAppRoute && user?.role !== 'admin') {
      if (sessionStorage.getItem('tradopad_sebi_acknowledged') !== 'true') {
        setShowRiskModal(true);
      }
    }
  }, [authToken, isAppRoute, user]);

  return (
    <>
      {/* SEBI Compliance Risk Disclosure Modal: ONLY in user app, NEVER in admin panel */}
      {isAppRoute && (
        <RiskDisclosureModal 
          isOpen={Boolean(authToken && showRiskModal)} 
          onClose={() => setShowRiskModal(false)} 
        />
      )}

      <Routes>
        {/* Login is mobile-only for user app */}
        <Route path="/login" element={authToken ? <Navigate to={user?.role === 'admin' ? "/admin" : "/dashboard"} replace /> : <Login />} />
        
        {/* User Routes (Strictly Mobile Only) */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/device" element={<ProtectedRoute><DeviceTab /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        
        {/* Legacy /trade redirect */}
        <Route path="/trade" element={<Navigate to="/dashboard" replace />} />
        
        {/* Admin Panel — Desktop Control Panel (No SEBI modal, self-protecting) */}
        <Route path="/admin" element={<AdminPanel />} />

        <Route path="*" element={<Navigate to={authToken ? (user?.role === 'admin' ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
      
      {/* PWA Install Prompt Dialog: Active on all app routes */}
      {isAppRoute && <PWAPrompt />}
    </>
  );
}

function App() {
  const [splashPhase, setSplashPhase] = useState('active'); // 'active' | 'fading' | 'hidden'

  useEffect(() => {
    // Show splash for initial boot, then smoothly fade out
    const fadeTimer = setTimeout(() => {
      setSplashPhase('fading');
    }, 1400);

    const hideTimer = setTimeout(() => {
      setSplashPhase('hidden');
    }, 1900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <StateProvider>
        <Router>
          <DeviceCheck>
            <MainAppRoutes />
          </DeviceCheck>
        </Router>
        {splashPhase !== 'hidden' && (
          <Splash isFading={splashPhase === 'fading'} />
        )}
      </StateProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
