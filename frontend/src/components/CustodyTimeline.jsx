import { useState } from 'react';

/**
 * CustodyTimeline — Vertical timeline of chain-of-custody events.
 * Used in CaseDetails to show the full audit trail.
 */

const actionConfig = {
  'Case Created':        { icon: '📦', color: '#3b82f6' },
  'Created':             { icon: '📦', color: '#3b82f6' },
  'Accessed':            { icon: '👁️', color: '#10b981' },
  'Transferred':         { icon: '🔄', color: '#f59e0b' },
  'StatusChanged':       { icon: '📋', color: '#8b5cf6' },
  'Disputed':            { icon: '⚠️', color: '#ef4444' },
  'Resolved':            { icon: '✅', color: '#10b981' },
  'Forensic Video Assembled (60 s Window)': { icon: '🎥', color: '#06b6d4' },
};

function getConfig(action) {
  return actionConfig[action] || { icon: '📋', color: 'var(--text-muted)' };
}

export default function CustodyTimeline({ timeline = [], onTransfer }) {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? timeline : timeline.slice(0, 5);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          ⛓️ Chain of Custody
        </h3>
        {onTransfer && (
          <button onClick={onTransfer} style={{
            background: 'linear-gradient(135deg, #f59e0b22, #f59e0b11)',
            color: '#f59e0b',
            border: '1px solid #f59e0b33',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Transfer Custody
          </button>
        )}
      </div>

      {items.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No custody events recorded.</p>
      )}

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Vertical line */}
        {items.length > 1 && (
          <div style={{
            position: 'absolute', left: '7px', top: '4px', bottom: '4px',
            width: '2px', background: 'var(--border-2)',
          }} />
        )}

        {items.map((entry, i) => {
          const cfg = getConfig(entry.action);
          return (
            <div key={i} style={{ position: 'relative', marginBottom: '14px' }}>
              {/* Dot */}
              <div style={{
                position: 'absolute', left: '-20px', top: '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: `${cfg.color}22`, border: `2px solid ${cfg.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', zIndex: 1,
              }}>
                <span style={{ fontSize: '10px' }}>{cfg.icon}</span>
              </div>

              {/* Content */}
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.color }}>
                    {entry.action}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    {new Date(entry.time).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {entry.by && <span>by <strong>{entry.by}</strong></span>}
                  {entry.detail && typeof entry.detail === 'string' && (
                    <span> — {entry.detail}</span>
                  )}
                </div>
                {entry.signature && (
                  <div style={{ fontSize: '10px', color: 'var(--cyan)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
                    Signer: {entry.signature}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {timeline.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} style={{
          background: 'transparent', border: 'none', color: 'var(--cyan)',
          fontSize: '11px', cursor: 'pointer', fontWeight: 600, marginTop: '4px',
        }}>
          {showAll ? '▲ Show less' : `▼ Show all ${timeline.length} events`}
        </button>
      )}
    </div>
  );
}
