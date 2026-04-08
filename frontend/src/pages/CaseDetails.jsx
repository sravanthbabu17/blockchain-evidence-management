import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import StatusBadge from '../components/StatusBadge';
import { records as backupRecords } from '../data';
import API from '../services/api';
import jsPDF from 'jspdf';

// Fix leaflet icon in webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default function CaseDetails({ user }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentRole = user?.role || location.state?.role || "admin";

  const [data, setData] = useState(location.state || backupRecords.find(r => r.id?.toString() === id));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    API.get(`/accident/${id}`)
      .then(res => { if (res.data.success) setData(res.data.data); })
      .catch(err => console.warn("⚠️ Sync failed, using cached state.", err.message));
  }, [id]);

  if (!data) return (
    <div className="dashboard-container">
      <p style={{ color: 'var(--text-muted)' }}>🚫 Case not found.</p>
      <button className="btn-ghost" onClick={() => navigate('/')} style={{ marginTop: 16 }}>← Back</button>
    </div>
  );

  const stableSort = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(stableSort);
    return Object.keys(obj).sort().reduce((r, k) => { r[k] = stableSort(obj[k]); return r; }, {});
  };

  const updateWorkflowStatus = async (newStatus) => {
    try {
      setLoading(true);
      const res = await API.post(`/accident/status/${data.id}`, { status: newStatus });
      if (res.data?.data) setData(res.data.data);
      else setData(prev => ({ ...prev, status: newStatus }));
      setStatus(`📋 Case moved to ${newStatus.toUpperCase()}`);
    } catch (err) {
      alert("Failed to update case status.");
    } finally { setLoading(false); }
  };

  const verifyIntegrity = async () => {
    try {
      setLoading(true);
      setStatus("⏳ Fetching forensic payload...");
      let sourceData, source = "local";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        if (data.cid && !data.cid.startsWith("local-")) {
          const res = await fetch(`https://gateway.pinata.cloud/ipfs/${data.cid}`, { signal: controller.signal });
          if (!res.ok) throw new Error("Gateway failure.");
          sourceData = await res.json();
          source = "ipfs";
        } else sourceData = data.evidenceData;
      } catch { sourceData = data.evidenceData; source = "local-fallback"; }
      finally { clearTimeout(timeout); }

      setStatus("📂 Re-hashing...");
      const sorted = stableSort(sourceData);
      const buf = new TextEncoder().encode(JSON.stringify(sorted));
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      const newHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (newHash === data.hash) {
        setStatus(`✅ VERIFIED — Hash matches ${source} payload.`);
        setData(prev => ({ ...prev, isVerified: true, source, verifiedAt: new Date().toLocaleTimeString() }));
        if (data.status !== "verified" && data.status !== "closed") await updateWorkflowStatus("verified");
      } else {
        setStatus("❌ TAMPER DETECTED — Hash does not match blockchain record.");
        setData(prev => ({ ...prev, isVerified: false, source, verifiedAt: new Date().toLocaleTimeString() }));
      }
    } catch (err) {
      setStatus(`❌ Audit failed: ${err.message}`);
    } finally { setLoading(false); }
  };

  // ─── PDF EXPORT ───────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    const accentY = (doc) => { doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.8); };

    // Header
    doc.setFillColor(8, 8, 16);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EVIDENCECHAIN — FORENSIC CASE REPORT', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Role: ${currentRole.toUpperCase()}`, 14, 23);

    doc.setTextColor(30, 30, 30);

    // Section helper
    let y = 40;
    const section = (title) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(title, 14, y);
      accentY(doc);
      doc.line(14, y + 2, 196, y + 2);
      doc.setTextColor(30, 30, 30);
      y += 8;
    };
    const row = (label, value, indent = 14) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', indent, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || '—'), 130);
      doc.text(lines, indent + 45, y);
      y += 6 * lines.length;
    };

    section('CASE IDENTIFICATION');
    row('Case ID', data.id);
    row('Vehicle ID', data.vehicle_id || data.vehicleId);
    row('Timestamp', new Date(data.timestamp).toLocaleString());
    row('Status', (data.status || 'pending').toUpperCase());
    row('Assigned To', data.assignedTo || 'Unassigned');
    if (data.verifiedAt) row('Verified At', data.verifiedAt);
    y += 4;

    section('CRYPTOGRAPHIC PROOFS');
    row('SHA-256 Hash', data.hash);
    row('IPFS CID', data.cid);
    row('Blockchain TX', data.txHash);
    y += 4;

    // GPS
    const lat = data.gps?.lat || data.evidenceData?.gps?.lat;
    const lon = data.gps?.lon || data.evidenceData?.gps?.lon;
    if (lat && lon) {
      section('GPS COORDINATES');
      row('Latitude', lat);
      row('Longitude', lon);
      y += 4;
    }

    // Evidence data
    if (data.evidenceData) {
      section('SENSOR DATA');
      Object.entries(data.evidenceData).forEach(([k, v]) => {
        row(k.replace(/_/g, ' ').toUpperCase(), typeof v === 'object' ? JSON.stringify(v) : v);
      });
      y += 4;
    }

    // Video evidence
    if (data.video) {
      section('FORENSIC VIDEO EVIDENCE');
      if (data.video.cid) row('Video CID', data.video.cid);
      if (data.video.hash) row('Video Hash', data.video.hash);
      if (data.video.txHash) row('Video TX', data.video.txHash);
      if (data.video.anchoredAt) row('Anchored At', new Date(data.video.anchoredAt).toLocaleString());
      y += 4;
    }

    // Timeline
    if (data.timeline?.length) {
      if (y > 240) { doc.addPage(); y = 20; }
      section('FORENSIC AUDIT TRAIL');
      data.timeline.forEach((item, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}. ${item.action}`, 14, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`   By: ${item.by}${item.to ? ' → ' + item.to : ''}   •   ${new Date(item.time).toLocaleString()}`, 14, y);
        doc.setTextColor(30, 30, 30);
        y += 7;
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`EvidenceChain Forensic Report  |  Case ${data.id}  |  Page ${p} of ${pageCount}`, 14, 290);
    }

    doc.save(`EvidenceChain_Case_${data.id}.pdf`);
  };

  // ─── DOWNLOAD EVIDENCE JSON ──────────────────────────────
  // This is the SAME data that was hashed and stored on IPFS/blockchain.
  // Users download this to verify integrity on the /verify page.
  const downloadJSON = () => {
    const evidencePayload = data.evidenceData || {
      vehicle_id: data.vehicle_id || data.vehicleId,
      timestamp: data.timestamp,
      type: data.type || 'COLLISION',
      source: data.source || 'EvidenceChain',
      gps: data.gps,
    };
    const blob = new Blob([JSON.stringify(evidencePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence_${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── GPS coords ─────────────────────────────────────────
  const lat = data.gps?.lat || data.evidenceData?.gps?.lat || 16.33;
  const lon = data.gps?.lon || data.evidenceData?.gps?.lon || 80.44;

  // ─── Status color ────────────────────────────────────────
  const statusIsOk = status.includes('✅');
  const statusIsErr = status.includes('❌');

  return (
    <div className="dashboard-container fade-in">
      {/* Back + role badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate('/')} className="btn-ghost">
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>
            🕵️ {currentRole.toUpperCase()}
          </span>
          {/* Download JSON — for integrity verification */}
          <button
            onClick={downloadJSON}
            title="Download the original evidence JSON to verify its integrity on the Verify Evidence page"
            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)', padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
          >
            ⬇️ Download JSON
          </button>
          {/* PDF Export — all roles */}
          <button
            onClick={exportPDF}
            style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)', padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '28px' }}>
        {/* Case header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '6px' }}>
              🔍 Case: {data.vehicle_id || data.vehicleId}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ID: {data.id} · {new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <StatusBadge status={data.status || 'pending'} />
            {data.isVerified && <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 700 }}>✓ CRYPTO INTEGRITY OK</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Hash */}
            <InfoBox label="Blockchain Hash (SHA-256)">
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '11px', padding: '10px 12px' }}>{data.hash}</code>
            </InfoBox>

            {/* CID */}
            <InfoBox label="IPFS Content ID">
              <a href={`https://gateway.pinata.cloud/ipfs/${data.cid}`} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all', display: 'block', padding: '8px 0', color: 'var(--primary)' }}>
                {data.cid} ↗
              </a>
            </InfoBox>

            {/* Evidence data toggle */}
            <InfoBox label="Sensor Payload" action={<button onClick={() => setShowDebug(!showDebug)} className="btn-ghost" style={{ padding: '3px 10px', fontSize: '11px' }}>{showDebug ? 'Hide' : 'View'}</button>}>
              {showDebug ? (
                <pre style={{ maxHeight: 200, overflowY: 'auto', fontSize: '11px', marginTop: 8 }}>
                  {JSON.stringify(data.evidenceData || data, null, 2)}
                </pre>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '8px 0', fontStyle: 'italic' }}>Hidden — click View to inspect</div>
              )}
            </InfoBox>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentRole === "investigator" && data.status === "assigned" && (
                <button onClick={() => updateWorkflowStatus("investigating")} disabled={loading}
                  style={{ padding: '12px', background: 'rgba(139,92,246,0.15)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                  🚀 Start Investigation
                </button>
              )}
              {currentRole === "admin" && (data.status === "verified" || data.status === "investigating") && (
                <button onClick={() => updateWorkflowStatus("closed")} disabled={loading}
                  style={{ padding: '12px', background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                  ⚫ Close Case Permanently
                </button>
              )}
              {currentRole !== "owner" ? (
                <button onClick={verifyIntegrity} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '14px' }}>
                  {loading ? '🔐 Auditing...' : '🔐 Re-Verify Forensic Integrity'}
                </button>
              ) : (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '14px', color: 'var(--warning)', fontSize: '13px', textAlign: 'center' }}>
                  ⚠️ <strong>View Only</strong> — Owners cannot perform forensic audits.
                </div>
              )}
            </div>

            {/* Status message */}
            {status && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: statusIsOk ? 'var(--success-bg)' : statusIsErr ? 'var(--danger-bg)' : 'var(--surface-2)', color: statusIsOk ? 'var(--success)' : statusIsErr ? 'var(--danger)' : 'var(--text-muted)', border: `1px solid ${statusIsOk ? 'rgba(16,185,129,0.25)' : statusIsErr ? 'rgba(239,68,68,0.25)' : 'var(--border)'}` }}>
                {status}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Mini Map */}
            <InfoBox label="Detected Coordinates">
              <div style={{ height: 280, borderRadius: '8px', overflow: 'hidden', marginTop: 8 }}>
                <MapContainer center={[lat, lon]} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[lat, lon]}>
                    <Popup>{data.vehicle_id || data.vehicleId}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </InfoBox>

            {/* Video */}
            {data.video && (
              <InfoBox label={data.video.cid ? "Full Incident Evidence (60s)" : "Multi-modal Forensic Evidence"}>
                {(data.video.local || data.video.cid) ? (
                  <video controls width="100%" style={{ borderRadius: '6px', background: '#000', marginTop: 8 }}>
                    <source src={data.video.local ? `http://localhost:5000/${data.video.local}` : `https://gateway.pinata.cloud/ipfs/${data.video.cid}`}
                      type={data.video.local?.endsWith('.mp4') ? "video/mp4" : "video/webm"} />
                  </video>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    {data.video.beforeCid && <video controls style={{ width: '100%', borderRadius: 6, background: '#000' }}><source src={`https://gateway.pinata.cloud/ipfs/${data.video.beforeCid}`} type="video/webm" /></video>}
                    {data.video.afterCid && <video controls style={{ width: '100%', borderRadius: 6, background: '#000' }}><source src={`https://gateway.pinata.cloud/ipfs/${data.video.afterCid}`} type="video/webm" /></video>}
                  </div>
                )}
                {data.video.hash && <code style={{ display: 'block', marginTop: 8, fontSize: '10px', wordBreak: 'break-all' }}>SHA-256: {data.video.hash}</code>}
              </InfoBox>
            )}

            {/* Timeline */}
            <InfoBox label="Forensic Audit Trail">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {data.timeline?.length > 0 ? data.timeline.map((item, i) => (
                  <div key={i} style={{ paddingLeft: '20px', borderLeft: '2px solid var(--border-2)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.action}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                      By <strong style={{ color: 'var(--text)' }}>{item.by}</strong>{item.to && <> → <strong style={{ color: 'var(--primary)' }}>{item.to}</strong></>}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: 1 }}>{new Date(item.time).toLocaleString()}</div>
                  </div>
                )) : <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>No timeline events yet.</p>}
              </div>
            </InfoBox>

            {/* Etherscan */}
            <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`} target="_blank" rel="noreferrer"
              style={{ display: 'block', padding: '12px', border: '1px solid var(--border-2)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', background: 'var(--surface)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              🌍 View Decentralized Proof on Etherscan ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, children, action }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}