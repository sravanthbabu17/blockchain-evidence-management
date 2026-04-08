import React from 'react';

const STATS = [
  { key: 'total',    label: 'Total Cases',  icon: '📁', color: '#3b82f6', glow: 'rgba(59,130,246,0.25)' },
  { key: 'pending',  label: 'Pending',      icon: '⏳', color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  { key: 'assigned', label: 'Assigned',     icon: '🔍', color: '#8b5cf6', glow: 'rgba(139,92,246,0.25)' },
  { key: 'verified', label: 'Verified',     icon: '✅', color: '#10b981', glow: 'rgba(16,185,129,0.25)' },
];

export default function StatsBar({ records }) {
  const counts = {
    total:    records.length,
    pending:  records.filter(r => r.status === 'pending').length,
    assigned: records.filter(r => r.status === 'assigned' || r.status === 'investigating').length,
    verified: records.filter(r => r.status === 'verified' || r.status === 'closed').length,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
      {STATS.map(({ key, label, icon, color, glow }) => (
        <div key={key} style={{
          background: 'var(--surface)',
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'all 0.25s',
          cursor: 'default',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 0 20px ${glow}`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          {/* Background glow blob */}
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: glow, filter: 'blur(20px)', pointerEvents: 'none' }} />
          
          <div style={{ fontSize: '28px' }}>{icon}</div>
          <div>
            <div style={{ fontSize: '32px', fontWeight: 900, color, lineHeight: 1 }}>
              {counts[key]}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}