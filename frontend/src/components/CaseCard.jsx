import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import API from '../services/api';
import StatusBadge from "./StatusBadge";

export default function CaseCard({ record, role, investigators = [] }) {
  const navigate = useNavigate();
  const [selectedInvestigator, setSelectedInvestigator] = useState("");
  const [assigning, setAssigning] = useState(false);

  const lat = record.gps?.lat || record.evidenceData?.gps?.lat;
  const lon = record.gps?.lon || record.evidenceData?.gps?.lon;
  const hasGps = lat && lon && lat !== 0;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      transition: 'all 0.25s',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--glow-blue)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top gradient line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: record.video ? 'linear-gradient(90deg,#10b981,#3b82f6)' : 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
            {record.vehicle_id || record.vehicleId}
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            ID: {record.id}
          </div>
        </div>
        <StatusBadge status={record.status || "pending"} />
      </div>

      {/* Meta info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📅</span>
          {new Date(record.timestamp).toLocaleString()}
        </div>

        {hasGps && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📍</span>
            {parseFloat(lat).toFixed(5)}, {parseFloat(lon).toFixed(5)}
          </div>
        )}

        {record.video && (
          <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span>🎬</span> Forensic Video Anchored
          </div>
        )}
      </div>

      {/* CID */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px 10px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IPFS CID</div>
        <code style={{ fontSize: '11px', color: '#10b981', background: 'none', border: 'none', padding: 0 }}>
          {record.cid?.slice(0, 20)}...
        </code>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {record.assignedTo ? `→ ${record.assignedTo.split('@')[0]}` : 'Unassigned'}
        </span>
        <button
          onClick={() => navigate(`/case/${record.id || record.cid}`, { state: { ...record, role } })}
          className="btn-primary"
          style={{ padding: '7px 16px', fontSize: '12px' }}
        >
          View Details →
        </button>
      </div>

      {/* Admin assign */}
      {role === "admin" && (record.status === "pending" || !record.assigned) && (
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <select
            value={selectedInvestigator}
            onChange={e => setSelectedInvestigator(e.target.value)}
            style={{ flex: 1, fontSize: '11px', padding: '7px 10px' }}
          >
            <option value="">Assign investigator...</option>
            {investigators.map((inv, i) => (
              <option key={i} value={inv.email}>{inv.email.split('@')[0]}</option>
            ))}
          </select>
          <button
            disabled={!selectedInvestigator || assigning}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                setAssigning(true);
                await API.post(`/accident/assign/${record.id}`, { investigator: selectedInvestigator });
                alert(`✅ Assigned to ${selectedInvestigator}`);
                window.location.reload();
              } catch (err) {
                alert(`❌ Failed: ${err.message}`);
              } finally {
                setAssigning(false);
              }
            }}
            style={{
              padding: '7px 14px',
              background: selectedInvestigator ? 'var(--primary)' : 'var(--surface-2)',
              color: selectedInvestigator ? '#fff' : 'var(--text-dim)',
              border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              cursor: selectedInvestigator ? 'pointer' : 'not-allowed',
              flexShrink: 0,
            }}
          >
            {assigning ? '...' : 'Assign'}
          </button>
        </div>
      )}
    </div>
  );
}