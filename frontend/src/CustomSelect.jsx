import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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
          background: 'var(--surface-2)',
          padding: '11px 14px',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: isOpen ? '1px solid var(--brand-violet)' : '1px solid var(--line)',
          boxShadow: isOpen ? '0 0 0 3px var(--brand-soft)' : 'none',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font)'
        }}
      >
        <span style={{ 
          fontSize: '13.5px', 
          fontWeight: '600', 
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          paddingRight: '8px'
        }}>
          {selectedOption?.label || value}
        </span>
        <ChevronDown 
          size={16} 
          color="var(--text-3)" 
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
            transition: 'transform 0.2s',
            flexShrink: 0
          }} 
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '6px',
          zIndex: 1000,
          boxShadow: '0 16px 36px -12px rgba(15, 23, 42, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {options.map(opt => {
            const isSelected = value === opt.value;
            return (
              <div 
                key={opt.value}
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setIsOpen(false);
                  }
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isSelected ? 'var(--brand-soft)' : 'transparent',
                  color: opt.disabled ? 'var(--text-3)' : (isSelected ? 'var(--brand-ink)' : 'var(--text)'),
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: '13.5px',
                  fontFamily: 'var(--font)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isSelected && !opt.disabled) e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={e => {
                  if (!isSelected && !opt.disabled) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={15} color="var(--brand-ink)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
