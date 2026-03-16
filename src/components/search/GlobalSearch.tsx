import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import type { Vehicle } from '../../types';
import { formatCurrency } from '../../utils/format';

function highlight(text: string, query: string): string {
  return text; // plain text; markup done via <mark> trick below
}

function matchesQuery(vehicle: Vehicle, q: string): boolean {
  const target = `${vehicle.stockId} ${vehicle.make} ${vehicle.model} ${vehicle.variant} ${vehicle.year}`.toLowerCase();
  return target.includes(q.toLowerCase());
}

export function GlobalSearch() {
  const { vehicles } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim().length >= 2
    ? vehicles.filter((v) => matchesQuery(v, query.trim())).slice(0, 6)
    : [];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(vehicle: Vehicle) {
    setQuery('');
    setOpen(false);
    navigate(`/vehicle/${vehicle.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', padding: '0 12px 8px' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search vehicles…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '7px 10px',
          fontSize: '13px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.07)',
          color: 'inherit',
          outline: 'none',
        }}
      />

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '12px',
            right: '12px',
            zIndex: 100,
            background: 'var(--color-surface, #1e2130)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {results.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => handleSelect(vehicle)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '9px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'inherit',
                gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {vehicle.make} {vehicle.model}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.6 }}>
                  {vehicle.stockId} · {vehicle.year} · {vehicle.fuel}
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.85 }}>
                {formatCurrency(vehicle.price)}
              </div>
            </button>
          ))}
          {query.trim().length >= 2 && (
            <button
              type="button"
              onClick={() => { setOpen(false); navigate(`/inventory?q=${encodeURIComponent(query.trim())}`); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: 0.5,
                textAlign: 'left',
                color: 'inherit',
              }}
            >
              View all results in Inventory →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
