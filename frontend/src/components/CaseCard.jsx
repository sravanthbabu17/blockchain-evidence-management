import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import StatusBadge from './StatusBadge';
import SignatureBadge from './SignatureBadge';

/* ── Header banner config per status ────────────────────────────────── */
const STATUS_META = {
  pending:       { bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.25)',  color: '#f59e0b', label: 'PENDING REVIEW'     },
  assigned:      { bg: 'rgba(59,130,246,0.1)',    border: 'rgba(59,130,246,0.22)',  color: '#3b82f6', label: 'ASSIGNED'           },
  investigating: { bg: 'rgba(139,92,246,0.1)',    border: 'rgba(139,92,246,0.22)', color: '#8b5cf6', label: 'UNDER INVESTIGATION' },
  verified:      { bg: 'rgba(16,185,129,0.1)',    border: 'rgba(16,185,129,0.22)', color: '#10b981', label: 'CHAIN VERIFIED'      },
  closed:        { bg: 'rgba(148,163,184,0.07)',  border: 'rgba(148,163,184,0.15)',color: '#94a3b8', label: 'CLOSED'             },
  tampered:      { bg: 'rgba(239,68,68,0.1)',     border: 'rgba(239,68,68,0.22)',  color: '#ef4444', label: '⚠ INTEGRITY ALERT'  },
};

/* ── Copy-to-clipboard pill ─────────────────────────────────────────── */
function CopyPill({ label, value, href }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const inner = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '2px' }}>{label}</span>
      {value ? value.slice(0, 8) + '…' + value.slice(-4) : '—'}
      <span style={{ opacity: 0.55, fontSize: '10px' }}>{copied ? '✓' : '⧉'}</span>
    </span>
  );

  if (href && value) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hash-pill"
        onClick={e => e.stopPropagation()}
        title={`Open ${label} — ${value}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      className="hash-pill"
      style={{ border: 'none', cursor: value ? 'pointer' : 'default', fontFamily: 'var(--mono)' }}
      onClick={handleCopy}
      disabled={!value}
      title={value || 'Not yet available'}
    >
      {value ? inner : <span style={{ color: 'var(--text-dim)' }}>{label}: —</span>}
    </button>
  );
}

/* ── Mini timeline (last 2 events) ──────────────────────────────────── */
function MiniTimeline({ timeline = [] }) {
  if (!timeline.length) return null;
  const last2 = timeline.slice(-2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {last2.map((ev, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
            background: i === last2.length - 1 ? 'var(--cyan)' : 'var(--border-2)',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{ev.action}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {new Date(ev.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {ev.by}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── CaseCard ────────────────────────────────────────────────────────── */
export default function CaseCard({ record, role, investigators = [] }) {
  const navigate = useNavigate();
  const [selectedInvestigator, setSelectedInvestigator] = useState('');
  const [assigning,            setAssigning]            = useState(false);

  const lat    = record.gps?.lat || record.evidenceData?.gps?.lat;
  const lon    = record.gps?.lon || record.evidenceData?.gps?.lon;
  const hasGps = lat && lon && Math.abs(lat) > 0.001;

  const status  = record.status || 'pending';
  const meta    = STATUS_META[status] || STATUS_META.pending;
  const txHash  = record.txHash && typeof record.txHash === 'string' && !record.txHash.includes('mock') ? record.txHash : null;
  const videoTx = record.video?.txHash && typeof record.video.txHash === 'string' && !record.video.txHash.includes('mock') ? record.video.txHash : null;
  const cid     = record.cid;

  const etherscanBase = 'https://sepolia.etherscan.io/tx/';

  return (
    <div
      className="case-card"
      onClick={() => navigate(`/case/${record.id || record.cid}`, { state: { ...record, role } })}
    >
      {/* ── Status banner ─────────────────────────────────────── */}
      <div className="case-card-header" style={{
        background: meta.bg,
        color: meta.color,
        borderBottom: `1px solid ${meta.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{meta.label}</span>
        {record.video?.cid && (
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '1px 6px', borderRadius: '4px' }}>
            VIDEO ✓
          </span>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="case-card-body">

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              {record.vehicle_id || record.vehicleId || 'Unknown Vehicle'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
              {record.id}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span>
            {new Date(record.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          {hasGps && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📍</span>
              {parseFloat(lat).toFixed(5)}, {parseFloat(lon).toFixed(5)}
            </div>
          )}
          {record.assignedTo && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>👤</span>
              {record.assignedTo.split('@')[0]}
            </div>
          )}
        </div>

        {/* Hash pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          <CopyPill label="IPFS" value={cid}     href={cid     ? `https://gateway.pinata.cloud/ipfs/${cid}` : null} />
          <CopyPill label="TX"   value={txHash}  href={txHash  ? `${etherscanBase}${txHash}`  : null} />
          {videoTx && <CopyPill label="VID TX" value={videoTx} href={`${etherscanBase}${videoTx}`} />}
        </div>

        {/* v2.0 badges: signature, impact direction, GPS source */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
          <SignatureBadge signature={record.signature} compact />
          {record.impactDirection && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '10px', color: '#8b5cf6',
              background: '#8b5cf615', padding: '2px 8px',
              borderRadius: '20px', border: '1px solid #8b5cf630',
            }}>
              {record.impactDirection === 'FRONT' ? '↑' : record.impactDirection === 'REAR' ? '↓' :
               record.impactDirection === 'LEFT' ? '←' : record.impactDirection === 'RIGHT' ? '→' :
               record.impactDirection === 'ROLLOVER' ? '↻' : '↕'}
              {' '}{record.impactDirection}
            </span>
          )}
          {record.gpsSource && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px',
              color: record.gpsSource === 'live_fix' ? '#10b981' : record.gpsSource === 'last_known' ? '#f59e0b' : '#ef4444',
              background: record.gpsSource === 'live_fix' ? '#10b98115' : record.gpsSource === 'last_known' ? '#f59e0b15' : '#ef444415',
              padding: '2px 8px', borderRadius: '20px',
              border: `1px solid ${record.gpsSource === 'live_fix' ? '#10b98130' : record.gpsSource === 'last_known' ? '#f59e0b30' : '#ef444430'}`,
            }}>
              📍 {record.gpsSource.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Mini timeline */}
        {record.timeline?.length > 0 && (
          <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', marginBottom: '14px' }}>
            <MiniTimeline timeline={record.timeline} />
          </div>
        )}

        {/* Footer: assign + view */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Admin assign dropdown */}
          {role === 'admin' && (status === 'pending' || !record.assigned) ? (
            <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
              <select
                value={selectedInvestigator}
                onChange={e => setSelectedInvestigator(e.target.value)}
                style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">Assign investigator…</option>
                {investigators.map((inv, i) => (
                  <option key={i} value={inv.email}>{inv.email.split('@')[0]}</option>
                ))}
              </select>
              <button
                disabled={!selectedInvestigator || assigning}
                onClick={async (e) => {
                  e.stopPropagation();
                  setAssigning(true);
                  try {
                    await API.post(`/accident/assign/${record.id}`, { investigator: selectedInvestigator });
                    window.location.reload();
                  } catch (err) {
                    alert(`Failed: ${err.message}`);
                  } finally { setAssigning(false); }
                }}
                style={{
                  padding: '6px 12px', fontSize: '11px', fontWeight: 700,
                  background: selectedInvestigator ? 'var(--blue)' : 'var(--surface-2)',
                  color: selectedInvestigator ? '#fff' : 'var(--text-dim)',
                  border: 'none', borderRadius: '7px',
                  cursor: selectedInvestigator ? 'pointer' : 'not-allowed', flexShrink: 0,
                }}
              >
                {assigning ? '…' : 'Assign'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {record.assignedTo ? `→ ${record.assignedTo.split('@')[0]}` : ''}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => navigate(`/case/${record.id || record.cid}`, { state: { ...record, role } })}
            style={{ padding: '7px 14px', fontSize: '12px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            View →
          </button>
        </div>
      </div>
    </div>
  );
}