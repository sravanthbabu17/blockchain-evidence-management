import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import API from '../services/api';
import StatsBar from '../components/StatsBar';
import Filters from '../components/Filters';
import CaseCard from '../components/CaseCard';
import AccidentMap from '../components/AccidentMap';

export default function Dashboard({ user }) {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid'); // 'grid' | 'map'
  const role = user.role;
  const [investigators, setInvestigators] = useState([]);

  useEffect(() => {
    if (role !== "admin") return;
    const fetchInvestigators = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "investigator"));
        const snap = await getDocs(q);
        setInvestigators(snap.docs.map(d => d.data()));
      } catch (err) { console.error("Failed to fetch investigators:", err); }
    };
    fetchInvestigators();
  }, [role]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await API.get('/accident/all');
        setRecords(res.data.data);
        setFilteredRecords(res.data.data);
      } catch (error) {
        console.error("❌ Dashboard fetch error:", error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  const filterByRole = (data) => {
    if (!data) return [];
    if (role === "admin") return data;
    if (role === "investigator") return data.filter(r => r.assignedTo === user.email);
    if (role === "owner") return data.filter(r => r.vehicle_id === user.vehicle_id);
    return data;
  };

  const handleFilter = ({ search, status }) => {
    let filtered = records;
    if (search) filtered = filtered.filter(r => (r.vehicle_id || "").toLowerCase().includes(search.toLowerCase()));
    if (status && status !== 'all') filtered = filtered.filter(r => r.status === status);
    setFilteredRecords(filtered);
  };

  const visibleRecords = filterByRole(filteredRecords);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <div style={{ width: 48, height: 48, border: '3px solid var(--border-2)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading case files for <strong style={{ color: 'var(--text)' }}>{role.toUpperCase()}</strong>...</p>
    </div>
  );

  return (
    <div className="dashboard-container fade-in">
      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg,#f1f5f9,#94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          EvidenceChain Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
          {visibleRecords.length} case{visibleRecords.length !== 1 ? 's' : ''} visible · Role: <span style={{ color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>{role}</span>
        </p>
      </div>

      {/* Stats */}
      <StatsBar records={visibleRecords} />

      {/* Filters + Tab bar */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Filters onFilter={handleFilter} />
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞ Grid</button>
          <button className={`tab-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>🗺 Map</button>
        </div>
      </div>

      {/* Content */}
      {view === 'map' ? (
        <AccidentMap records={visibleRecords} />
      ) : (
        visibleRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-2)', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗂️</div>
            <h3 style={{ color: 'var(--text)', marginBottom: '8px' }}>No Cases Found</h3>
            <p style={{ fontSize: '14px' }}>
              {role === 'investigator' ? 'No cases have been assigned to you yet.' :
               role === 'owner' ? 'No incidents recorded for your vehicle.' :
               'No records match your current filters.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {visibleRecords.map((record, i) => (
              <CaseCard key={record.id || i} record={record} role={role} investigators={investigators} />
            ))}
          </div>
        )
      )}
    </div>
  );
}