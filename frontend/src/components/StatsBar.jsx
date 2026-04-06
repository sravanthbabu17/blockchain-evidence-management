import React from 'react';

/**
 * Modern StatsBar for Forensic Workflow.
 * Tracks Workflow Stages: Pending, Active (Assigned/Investigating), and Verified.
 */
export default function StatsBar({ records }) {
  const total = records.length;
  
  // 📋 WORKFLOW METRICS
  const pending = records.filter(r => (r.status || "pending") === "pending").length;
  const active = records.filter(r => r.status === "assigned" || r.status === "investigating").length;
  const verified = records.filter(r => r.status === "verified").length;

  return (
    <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
      <StatCard title="Total Inventory" value={total} color="#343a40" icon="📊" />
      <StatCard title="Pending Review" value={pending} color="#ffc107" icon="🟡" />
      <StatCard title="Active Investigation" value={active} color="#007bff" icon="🔵" />
      <StatCard title="Forensically Verified" value={verified} color="#28a745" icon="🟢" />
    </div>
  );
}

function StatCard({ title, value, color, icon }) {
  return (
    <div style={{
      flex: 1,
      padding: "20px",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
      borderTop: `4px solid ${color}`,
      transition: "transform 0.2s ease-in-out",
      cursor: "default"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h4 style={{ margin: 0, color: '#6c757d', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </h4>
        <span style={{ fontSize: '18px' }}>{icon}</span>
      </div>
      <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#212529' }}>{value}</h2>
      <div style={{ height: '4px', width: '100%', background: '#f8f9fa', borderRadius: '2px', marginTop: '15px' }}>
        <div style={{ height: '100%', width: value > 0 ? '100%' : '0%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }}></div>
      </div>
    </div>
  );
}