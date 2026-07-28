import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', opacity: disabled ? 0.6 : 1 }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          background: '#f3f4f6',
          padding: '14px 16px',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: isOpen ? '2px solid #7c3aed' : '2px solid transparent',
          boxShadow: isOpen ? '0 0 0 4px rgba(124, 58, 237, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          backgroundColor: isOpen ? '#ffffff' : '#f3f4f6'
        }}
      >
        <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#000' }}>
          {selectedOption?.label || value}
        </span>
        <ChevronDown size={20} color="#333" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: 'rgba(25, 25, 25, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '8px',
          zIndex: 1000,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxHeight: '250px',
          overflowY: 'auto'
        }}>
          {options.map(opt => (
            <div 
              key={opt.value}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: value === opt.value ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                color: opt.disabled ? '#666' : '#fff',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                fontWeight: value === opt.value ? '700' : '500',
                transition: 'background 0.2s'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>{opt.label}</span>
              {value === opt.value && <Check size={18} color="#a78bfa" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
