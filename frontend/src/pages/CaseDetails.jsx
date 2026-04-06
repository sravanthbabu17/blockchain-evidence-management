import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import StatusBadge from '../components/StatusBadge';
import { records as backupRecords } from '../data';
import API from '../services/api';

export default function CaseDetails({ user }) { // 🏛️ STEP 9: PASS USER
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    // 🎭 ROLE FROM AUTH SESSION
    const currentRole = user?.role || location.state?.role || "admin";

    // Prioritize passed state from dashboard, fallback to data.js
    const [data, setData] = useState(location.state || backupRecords.find(r => r.id.toString() === id));
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [showDebug, setShowDebug] = useState(false);

    // 🔄 REAL-TIME SYNC ON MOUNT
    useEffect(() => {
        const fetchFreshData = async () => {
            try {
                const res = await API.get(`/accident/${id}`);
                if (res.data.success) {
                    setData(res.data.data);
                    console.log("🔍 Forensic Timeline Synced from Server");
                }
            } catch (err) {
                console.warn("⚠️ Sync failed, using cached state.", err.message);
            }
        };
        fetchFreshData();
    }, [id]);

    if (!data) return (
        <div className="dashboard-container">
            <p>🚫 Case record not found.</p>
            <button onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
    );

    // 🔬 RECURSIVE FORENSIC SORT
    const stableSort = (obj) => {
        if (typeof obj !== "object" || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(stableSort);
        const sortedKeys = Object.keys(obj).sort();
        const result = {};
        for (let key of sortedKeys) {
            result[key] = stableSort(obj[key]);
        }
        return result;
    };

    // 🔄 WORKFLOW TRANSITIONS
    const updateWorkflowStatus = async (newStatus) => {
        try {
            setLoading(true);
            const res = await API.post(`/accident/status/${data.id}`, { status: newStatus });
            
            // 🔥 Sync EVERYTHING (including updated timeline) from server response
            if (res.data?.data) {
                setData(res.data.data);
            } else {
                setData(prev => ({ ...prev, status: newStatus }));
            }

            setStatus(`📋 System: Case moved to ${newStatus.toUpperCase()}`);
        } catch (error) {
            console.error("Workflow Update Failed:", error);
            alert("Failed to update case status. Check connection.");
        } finally {
            setLoading(false);
        }
    };

    const verifyIntegrity = async () => {
        try {
            setLoading(true);
            setStatus("⏳ Fetching forensic payload...");

            let sourceData;
            let source = "local";

            // 1. Indestructible Source Selection (IPFS with 10s Timeout → Local)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                if (data.cid && !data.cid.startsWith("local-")) {
                    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${data.cid}`, { signal: controller.signal });
                    if (!res.ok) throw new Error("Gateway failure.");
                    const text = await res.text();
                    sourceData = JSON.parse(text);
                    source = "ipfs";
                } else {
                    sourceData = data.evidenceData;
                }
            } catch (e) {
                console.warn("⚠️ IPFS Fetch failed, utilizing forensic backup.", e.message);
                sourceData = data.evidenceData;
                source = "local-fallback";
            } finally {
                clearTimeout(timeoutId);
            }

            setStatus("📂 Synchronizing re-hash...");
            
            // 2. Cryptographic Re-hashing (SubtleCrypto SHA-256 with recursion)
            const encoder = new TextEncoder();
            const sortedSource = stableSort(sourceData);
            const dataBuffer = encoder.encode(JSON.stringify(sortedSource));
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 3. COMPARISON & AUDIT
            if (newHash === data.hash) {
                setStatus(`✅ VERIFIED: Proof matches ${source} payload exactly.`);
                setData(prev => ({ ...prev, isVerified: true, source, verifiedAt: new Date().toLocaleTimeString() }));
                
                // 🔥 AUTO-UPDATE WORKFLOW STATUS
                if (data.status !== "verified" && data.status !== "closed") {
                    await updateWorkflowStatus("verified");
                }
            } else {
                setStatus("❌ ALERT: Tamper detected! Generated hash does not match blockchain record.");
                setData(prev => ({ ...prev, isVerified: false, source, verifiedAt: new Date().toLocaleTimeString() }));
            }

        } catch (error) {
            console.error("❌ Audit Error:", error.message);
            setStatus(`❌ Forensic check failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '5px 15px', cursor: 'pointer' }}>
                    ← Back
                </button>
                <span style={{ fontSize: '11px', background: '#e9ecef', padding: '4px 10px', borderRadius: '15px', fontWeight: 600 }}>
                    🕵️ INVESTIGATION MODE: {currentRole.toUpperCase()}
                </span>
            </div>
            
            <div className="card" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900 }}>🔍 EvidenceChain Audit: {data.id}</h2>
                        <p style={{ color: '#666', marginTop: '5px' }}>Evidence Record: <strong>{data.vehicle_id || data.vehicleId}</strong></p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                        <StatusBadge status={data.status || "pending"} />
                        {data.isVerified && <span style={{ fontSize: '10px', color: '#28a745', fontWeight: 700 }}>✓ CRYPTO INTEGRITY OK</span>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
                    
                    {/* Left: Metadata */}
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Blockchain Provenance Hash</label>
                            <code style={{ display: 'block', background: '#f1f3f5', padding: '10px', borderRadius: '4px', wordBreak: 'break-all', marginTop: '5px', fontSize: '12px' }}>
                                {data.hash}
                            </code>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>IPFS Content ID</label>
                            <a href={`https://gateway.pinata.cloud/ipfs/${data.cid}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 500, fontSize: '14px', display: 'block', marginTop: '5px' }}>
                                {data.cid} ↗
                            </a>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Forensic Payload</label>
                                <button onClick={() => setShowDebug(!showDebug)} style={{ fontSize: '10px', background: 'none', border: '1px solid #ccc', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}>
                                    {showDebug ? "Hide Trace" : "View Hashed Trace"}
                                </button>
                            </div>
                            
                            {showDebug ? (
                                <pre style={{ fontSize: '12px', background: '#F8F9FA', padding: '15px', borderRadius: '8px', border: '1px solid #eee', color: '#333', maxHeight: '200px', overflowY: 'auto' }}>
                                    {JSON.stringify(data.evidenceData || data, null, 2)}
                                </pre>
                            ) : (
                                <div style={{ background: '#F8F9FA', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                                    Diagnostic data hidden. Use "View Hashed Trace" for manual audit.
                                </div>
                            )}
                        </div>

                        {/* 🔑 ROLE-BASED ACTION GUARD */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {currentRole === "investigator" && data.status === "assigned" && (
                                <button 
                                    onClick={() => updateWorkflowStatus("investigating")}
                                    style={{ width: '100%', padding: '12px', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    🚀 Start Investigation
                                </button>
                            )}

                            {currentRole === "admin" && (data.status === "verified" || data.status === "investigating") && (
                                <button 
                                    onClick={() => updateWorkflowStatus("closed")}
                                    style={{ width: '100%', padding: '12px', background: '#343a40', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    ⚫ Close Case Permanently
                                </button>
                            )}

                            {currentRole !== "owner" ? (
                                <button 
                                    onClick={verifyIntegrity} 
                                    disabled={loading}
                                    style={{ 
                                        width: '100%', 
                                        padding: '15px', 
                                        background: '#000', 
                                        color: '#fff', 
                                        border: 'none', 
                                        borderRadius: '8px', 
                                        fontSize: '15px', 
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {loading ? "🔐 Auditing Evidence..." : "🔐 Re-Verify forensic Integrity"}
                                </button>
                            ) : (
                                <div style={{ padding: '15px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px', color: '#856404', fontSize: '13px', textAlign: 'center' }}>
                                    ⚠️ <strong>View Only</strong>: Vehicle Owners cannot perform forensic audits. Please contact an Investigator for a certified integrity check.
                                </div>
                            )}
                        </div>
                        
                        <p style={{ marginTop: '15px', padding: '12px', borderRadius: '8px', background: status.includes("✅") ? '#d4edda' : status.includes("❌") ? '#f8d7da' : '#f1f3f5', color: status.includes("✅") ? '#155724' : status.includes("❌") ? '#721c24' : '#495057', fontSize: '13px', fontWeight: 500 }}>
                            {status || `Audit Source: ${data.source || 'Local Sync'} • Audit Time: ${data.verifiedAt || 'Pending'}`}
                        </p>
                    </div>

                    {/* Right: GPS Map & Blockchain Proof */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Detected Coordinates</label>
                        <div style={{ height: '350px', width: '100%', marginBottom: '30px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ddd' }}>
                            <MapContainer center={[data.gps?.lat || (data.evidenceData?.gps?.lat) || 16.33, data.gps?.lon || (data.evidenceData?.gps?.lon) || 80.44]} zoom={14} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={[data.gps?.lat || (data.evidenceData?.gps?.lat) || 16.33, data.gps?.lon || (data.evidenceData?.gps?.lon) || 80.44]}>
                                    <Popup>Forensic Location Check: {data.vehicle_id || data.vehicleId}</Popup>
                                </Marker>
                            </MapContainer>
                        </div>

                        {/* 📜 FORENSIC TIMELINE */}
                        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 800, color: '#333' }}>📜 Forensic Timeline</h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {data.timeline && data.timeline.length > 0 ? (
                                    data.timeline.map((item, i) => (
                                        <div key={i} style={{ 
                                            position: 'relative', 
                                            paddingLeft: '25px',
                                            borderLeft: '2px dashed #ccc'
                                        }}>
                                            <div style={{ 
                                                position: 'absolute', 
                                                left: '-6px', 
                                                top: '0', 
                                                width: '10px', 
                                                height: '10px', 
                                                borderRadius: '50%', 
                                                background: '#007bff',
                                                border: '2px solid #fff' 
                                            }}></div>
                                            
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', textTransform: 'uppercase' }}>{item.action}</div>
                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                Executed by: <strong>{item.by}</strong>
                                                {item.to && <span> → Target: <strong>{item.to}</strong></span>}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                                📅 {new Date(item.time).toLocaleString()}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Pending timeline synchronization...</p>
                                )}
                            </div>
                        </div>

                        <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', padding: '12px', border: '1px solid #000', borderRadius: '8px', textAlign: 'center', color: '#000', fontWeight: 600, background: '#fff', fontSize: '14px', marginTop: '20px' }}>
                            🌍 View Decentralized Proof (Etherscan)
                        </a>
                    </div>

                </div>
            </div>
        </div>
    );
}