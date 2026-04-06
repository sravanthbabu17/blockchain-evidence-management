import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import API from '../services/api';
import StatusBadge from "./StatusBadge";

export default function CaseCard({ record, role, investigators = [] }) {
    const navigate = useNavigate();
    const [selectedInvestigator, setSelectedInvestigator] = useState("");
    const [assigning, setAssigning] = useState(false);

    return (
        <div style={{
            padding: "20px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            border: "1px solid #eee",
            position: 'relative'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', marginTop: '5px' }}>
                <h3 style={{ margin: 0 }}>{record.vehicle_id || record.vehicleId}</h3>
                <StatusBadge status={record.status || "pending"} />
            </div>
            
            <p style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
                📅 {new Date(record.timestamp).toLocaleString()}
            </p>
            
            <p style={{ fontSize: '13px', background: '#f8f9fa', padding: '8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                CID: {record.cid.slice(0, 12)}...
            </p>

            <div style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#999' }}>Audit: {record.verifiedAt || 'Pending'}</span>
                    <button 
                        onClick={() => navigate(`/case/${record.id || record.cid}`, { state: { ...record, role } })}
                        style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        View Details
                    </button>
                </div>

                {/* 🔑 ADMIN ONLY ASSIGN ACTION (Separate Row to prevent overlap) */}
                {role === "admin" && (record.status === "pending" || !record.assigned) && (
                    <div style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        paddingTop: '10px', 
                        borderTop: '1px solid #f1f1f1',
                        marginTop: '10px'
                    }}>
                        <select 
                            value={selectedInvestigator}
                            onChange={(e) => setSelectedInvestigator(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #ccc',
                                fontSize: '11px',
                                outline: 'none',
                                background: '#fff'
                            }}
                        >
                            <option value="">Assign Investigator...</option>
                            {investigators.map((inv, i) => (
                                <option key={i} value={inv.email}>
                                    {inv.email.split('@')[0]} ({inv.email})
                                </option>
                            ))}
                        </select>
                        <button 
                            disabled={!selectedInvestigator || assigning}
                            onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                    setAssigning(true);
                                    await API.post(`/accident/assign/${record.id}`, { investigator: selectedInvestigator });
                                    alert(`Case assigned securely to ${selectedInvestigator}`);
                                    window.location.reload();
                                } catch (error) {
                                    alert(`Failed: ${error.message}`);
                                } finally {
                                    setAssigning(false);
                                }
                            }}
                            style={{ 
                                padding: '8px 15px', 
                                background: selectedInvestigator ? '#007bff' : '#ccc', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                cursor: selectedInvestigator ? 'pointer' : 'not-allowed' 
                            }}
                        >
                            {assigning ? "..." : "Assign"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}