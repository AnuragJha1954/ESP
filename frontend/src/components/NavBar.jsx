import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MarketTicker from './MarketTicker';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* 1. TOP LIVE REAL-TIME NSE/BSE MARKET TICKER */}
      <MarketTicker />

      {/* 2. PINNED BOTTOM STICKY NAVIGATION (Order: Setup -> Console -> Ledger -> Profile) */}
      <nav className="nav-wrap" aria-label="Primary Navigation">
        <div className="nav">
          {/* Tab 1: Setup */}
          <button
            onClick={() => navigate('/dashboard')}
            className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            aria-current={isActive('/dashboard') ? 'page' : undefined}
            title="Setup & Parameters"
          >
            <div className="nav-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
              </svg>
            </div>
            <span className="nav-label">Setup</span>
          </button>

          {/* Tab 2: Console */}
          <button
            onClick={() => navigate('/device')}
            className={`nav-item ${isActive('/device') ? 'active' : ''}`}
            aria-current={isActive('/device') ? 'page' : undefined}
            title="Console Control"
          >
            <div className="nav-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
              </svg>
            </div>
            <span className="nav-label">Console</span>
          </button>

          {/* Tab 3: Ledger */}
          <button
            onClick={() => navigate('/history')}
            className={`nav-item ${isActive('/history') ? 'active' : ''}`}
            aria-current={isActive('/history') ? 'page' : undefined}
            title="Ledger & Trades"
          >
            <div className="nav-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="nav-label">Ledger</span>
          </button>

          {/* Tab 4: Profile */}
          <button
            onClick={() => navigate('/profile')}
            className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
            aria-current={isActive('/profile') ? 'page' : undefined}
            title="Trader Profile"
          >
            <div className="nav-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </div>
            <span className="nav-label">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
}
