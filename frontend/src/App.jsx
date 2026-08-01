import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Splash from './Splash';
import Dashboard from './Dashboard';
import Trade from './Trade';
import History from './History';
import Profile from './Profile';
import DeviceCheck from './DeviceCheck';
import { StateProvider, useAppState } from './StateContext';
import { useState, useEffect } from 'react';
import PWAPrompt from './PWAPrompt';
import Login from './Login';
import AdminPanel from './AdminPanel';
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
  return (
    <>
      <Routes>
        {/* Login is accessible on both PC and mobile, no DeviceCheck */}
        <Route path="/login" element={authToken ? <Navigate to={user?.role === 'admin' ? "/admin" : "/dashboard"} replace /> : <Login />} />
        
        {/* Mobile-only User Routes wrapped with DeviceCheck */}
        <Route path="/dashboard" element={<ProtectedRoute mobileOnly={true}><Dashboard /></ProtectedRoute>} />
        <Route path="/trade" element={<ProtectedRoute mobileOnly={true}><Trade /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute mobileOnly={true}><History /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute mobileOnly={true}><Profile /></ProtectedRoute>} />
        
        {/* Admin Panel — accessible on BOTH PC and mobile, NO DeviceCheck */}
        <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminPanel /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={authToken ? (user?.role === 'admin' ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
      {authToken && <PWAPrompt />}
    </>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <StateProvider>
        {showSplash ? (
          <Splash />
        ) : (
          <Router>
            <MainAppRoutes />
          </Router>
        )}
      </StateProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
