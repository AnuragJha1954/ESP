import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { acceptRiskDisclosure } from '../services/complianceService';
import { AlertTriangle, ShieldCheck, CheckSquare, Square, ChevronRight } from 'lucide-react';

const DB_PANEL = '#0b1021';
const DB_BORDER = 'rgba(255, 255, 255, 0.08)';
const DB_BLUE = '#2563eb';
const DB_TEXT_MAIN = '#f1f5f9';
const DB_TEXT_MUTED = '#94a3b8';
const DB_TEXT_FAINT = '#64748b';
const DB_FONT = "'GT America', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DB_MONO = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

export default function RiskDisclosureModal({ isOpen, onClose }) {
  const location = useLocation();
  const [acknowledged, setAcknowledged] = useState(false);

  // STRICT COMPLIANCE: NEVER render on Admin Panel routes
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  if (!isOpen) return null;

  const handleProceed = () => {
    if (!acknowledged) return;
    sessionStorage.setItem('tradopad_sebi_acknowledged', 'true');
    acceptRiskDisclosure('1.0');
    if (onClose) onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 6, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      zIndex: 99999,
      fontFamily: DB_FONT
    }}>
      <div style={{
        background: DB_PANEL,
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '14px',
        padding: '1.75rem 1.5rem',
        maxWidth: '430px',
        width: '100%',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(245, 158, 11, 0.1)',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: DB_TEXT_MAIN,
        position: 'relative'
      }}>
        {/* Subtle Top Amber Glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: '700', letterSpacing: '-0.2px' }}>
                SEBI Risk Disclosure
              </h3>
              <span style={{
                fontSize: '0.62rem',
                fontFamily: DB_MONO,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.18)',
                color: '#fbbf24',
                fontWeight: '700'
              }}>
                MANDATORY
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: DB_TEXT_MUTED, marginTop: '2px' }}>
              Statutory notice on Futures & Options (F&O) Trading
            </div>
          </div>
        </div>

        {/* Regulatory Context */}
        <p style={{ fontSize: '0.76rem', color: DB_TEXT_MUTED, lineHeight: '1.45', margin: '0 0 1rem 0' }}>
          As per SEBI guidelines, all investors trading derivatives must review the key findings of the SEBI study on trading behavior:
        </p>

        {/* SEBI 4 Key Clauses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            color: '#cbd5e1'
          }}>
            <strong style={{ color: '#f87171' }}>9 out of 10 individual traders</strong> in equity Futures and Options segment incurred net losses.
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            color: '#cbd5e1'
          }}>
            On an average, loss makers registered net trading loss close to <strong style={{ color: '#fff' }}>₹50,000</strong>.
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            color: '#cbd5e1'
          }}>
            Over and above net trading losses, loss makers expended an additional <strong style={{ color: '#fff' }}>28% of net losses</strong> as transaction costs.
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${DB_BORDER}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            color: '#cbd5e1'
          }}>
            Tradopad hardware console buttons route <strong style={{ color: '#60a5fa' }}>live intraday orders</strong> directly to your linked broker terminal.
          </div>
        </div>

        {/* Checkbox Acknowledgment */}
        <div
          onClick={() => setAcknowledged(!acknowledged)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: acknowledged ? 'rgba(123, 91, 240, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: acknowledged ? '1px solid rgba(123, 91, 240, 0.45)' : `1px solid ${DB_BORDER}`,
            cursor: 'pointer',
            marginBottom: '1.25rem',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ marginTop: '2px', color: acknowledged ? '#c4b5fd' : DB_TEXT_MUTED }}>
            {acknowledged ? <CheckSquare size={17} /> : <Square size={17} />}
          </div>
          <span style={{ fontSize: '0.74rem', color: acknowledged ? '#fff' : DB_TEXT_MUTED, lineHeight: '1.35', userSelect: 'none' }}>
            I have read and acknowledged the SEBI derivative risk disclosure and agree to proceed to the Tradopad console terminal.
          </span>
        </div>

        {/* Primary Proceed Button */}
        <button
          type="button"
          onClick={handleProceed}
          disabled={!acknowledged}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            background: acknowledged ? 'linear-gradient(135deg, #7B5BF0 0%, #4338ca 100%)' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: acknowledged ? '#fff' : '#64748b',
            fontSize: '0.84rem',
            fontWeight: '700',
            cursor: acknowledged ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: acknowledged ? '0 4px 18px rgba(123, 91, 240, 0.35)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldCheck size={16} />
          <span>Acknowledge & Proceed to Console</span>
        </button>
      </div>
    </div>
  );
}
