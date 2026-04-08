import React from 'react';

const STATUS_CONFIG = {
  pending:       { label: 'Pending',       dot: '#f59e0b', cls: 'badge-pending' },
  assigned:      { label: 'Assigned',      dot: '#3b82f6', cls: 'badge-assigned' },
  investigating: { label: 'Investigating', dot: '#8b5cf6', cls: 'badge-investigating' },
  verified:      { label: 'Verified',      dot: '#10b981', cls: 'badge-verified' },
  closed:        { label: 'Closed',        dot: '#94a3b8', cls: 'badge-closed' },
  tampered:      { label: 'Tampered',      dot: '#ef4444', cls: 'badge-tampered' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.pending;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}