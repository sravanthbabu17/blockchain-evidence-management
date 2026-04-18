import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import API from '../services/api';
import StatsBar from '../components/StatsBar';
import Filters from '../components/Filters';
import CaseCard from '../components/CaseCard';
import AccidentMap from '../components/AccidentMap';

/* ── Rotating AI insight message ────────────────────────────────────── */
const INSIGHTS = [
  'All evidence is hashed with SHA-256 before being pinned to IPFS.',
  'Blockchain anchoring runs on Ethereum Sepolia — immutable, verifiable.',
  'The STA/LTA algorithm filters false positives from road vibration.',
  'Video forensics captures 30s pre-impact and 30s post-impact automatically.',
  'Access is RBAC-controlled — admin, investigator, and owner roles enforced.',
];

function AIBanner({ records }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const pending   = records.filter(r => r.status === 'pending').length;
  const confirmed = records.filter(r => r.cid && r.txHash).length;
  const dynamic   = pending > 0
    ? `${pending} case${pending > 1 ? 's' : ''} awaiting investigator assignment.`
    : confirmed > 0
    ? `${confirmed} case${confirmed > 1 ? 's' : ''} fully anchored on-chain.`
    : INSIGHTS[idx];

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % INSIGHTS.length); setVisible(true); }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ai-banner fade-in">
      <span className="ai-banner-label">System</span>
      <span style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease', fontSize: '13px', color: 'var(--text-muted)' }}>
        {dynamic}
      </span>
    </div>
  );
}

/* ── Camera widget card ──────────────────────────────────────────────── */
function CameraWidget() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const load = () =>
      API.get('/camera/status')
        .then(({ data }) => setStatus(data.camera))
        .catch(() => {});
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const isHw      = status.mode === 'hardware';
  const isSim     = status.mode === 'simulation';
  const color     = isHw ? 'var(--success)' : isSim ? 'var(--warning)' : 'var(--text-muted)';
  const bufferMB  = status.bufferSizeBytes ? (status.bufferSizeBytes / 1e6).toFixed(1) : '—';
  const uptimeSec = status.uptimeMs ? Math.floor(status.uptimeMs / 1000) : 0;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isHw ? 'rgba(16,185,129,0.2)' : isSim ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: `${color}18`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px',
        }}>
          🎥
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
            {isHw ? 'Hardware Camera' : isSim ? 'Simulation Mode' : 'Camera Offline'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {status.cameraDevice}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        {status.bufferExists && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{bufferMB} MB</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buffer</div>
          </div>
        )}
        {uptimeSec > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{uptimeSec}s</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uptime</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: !isSim ? 'dot-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', fontWeight: 600, color, textTransform: 'uppercase' }}>
            {status.mode}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────── */
export default function Dashboard({ user }) {
  const [records,          setRecords]          = useState([]);
  const [filteredRecords,  setFilteredRecords]  = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [view,             setView]             = useState('grid');
  const [sort,             setSort]             = useState('newest');
  const [investigators,    setInvestigators]    = useState([]);
  
  if (!user) return null;
  const role = user.role;

  useEffect(() => {
    if (role !== 'admin') return;
    getDocs(query(collection(db, 'users'), where('role', '==', 'investigator')))
      .then(snap => setInvestigators(snap.docs.map(d => d.data())))
      .catch(console.error);
  }, [role]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await API.get('/accident/all');
        setRecords(res.data.data);
        setFilteredRecords(res.data.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const filterByRole = d => {
    if (!d) return [];
    if (role === 'admin')        return d;
    if (role === 'investigator') return d.filter(r => r.assignedTo === user.email);
    if (role === 'owner')        return d.filter(r => r.vehicle_id === user.vehicle_id);
    return d;
  };

  const handleFilter = ({ search, status, sort: newSort }) => {
    let f = records;
    if (search) f = f.filter(r => (r.vehicle_id || '').toLowerCase().includes(search.toLowerCase()));
    if (status && status !== 'all') f = f.filter(r => r.status === status);
    
    setSort(newSort || 'newest');
    setFilteredRecords(f);
  };

  const getVisibleRecords = () => {
    let d = filterByRole(filteredRecords);
    
    // 🔀 Sorting Logic
    return [...d].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.id).getTime();
      const timeB = new Date(b.timestamp || b.id).getTime();
      return sort === 'newest' ? timeB - timeA : timeA - timeB;
    });
  };

  const visible = getVisibleRecords();

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <div style={{ width: '42px', height: '42px', border: '2.5px solid var(--border-2)', borderTopColor: 'var(--cyan)', borderRadius: '50%' }} className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--mono)' }}>
        Loading evidence database…
      </p>
    </div>
  );

  return (
    <div className="dashboard-container fade-in">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              {role.toUpperCase()} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
              Case Management
            </h1>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 700 }}>{visible.length}</span> case{visible.length !== 1 ? 's' : ''} visible
          </div>
        </div>
      </div>

      {/* ── AI Banner ───────────────────────────────────────────── */}
      <AIBanner records={visible} />

      {/* ── Camera widget (only show if backend is up) ──────────── */}
      <div style={{ marginBottom: '24px' }}>
        <CameraWidget />
      </div>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <StatsBar records={visible} />

      {/* ── Toolbar: filters + view toggle ──────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px 20px',
        marginBottom: '24px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px',
        backdropFilter: 'blur(16px)',
      }}>
        <Filters onFilter={handleFilter} />
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞ Grid</button>
          <button className={`tab-btn ${view === 'map'  ? 'active' : ''}`} onClick={() => setView('map')}>🗺 Map</button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      {view === 'map' ? (
        <AccidentMap records={visible} />
      ) : visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-2)', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '44px', marginBottom: '16px', opacity: 0.7 }}>🗂️</div>
          <h3 style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: 700 }}>No cases found</h3>
          <p style={{ fontSize: '13px' }}>
            {role === 'investigator' ? 'No cases assigned to you yet.'
              : role === 'owner' ? 'No incidents recorded for your vehicle.'
              : 'No records match your filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {visible.map((record, i) => (
            <div key={record.id || i} className="card-appear" style={{ animationDelay: `${i * 40}ms` }}>
              <CaseCard record={record} role={role} investigators={investigators} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
