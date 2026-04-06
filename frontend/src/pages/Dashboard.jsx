import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import API from '../services/api';
import StatsBar from '../components/StatsBar';
import Filters from '../components/Filters';
import CaseCard from '../components/CaseCard';

export default function Dashboard({ user }) { // 🏛️ STEP 4: PASS USER TO DASHBOARD
    const [records, setRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 🎭 ROLE FROM LOGIN
    const role = user.role;
    const [investigators, setInvestigators] = useState([]);

    // 🕵️ FETCH ALL INVESTIGATORS (For Admin Assignment)
    useEffect(() => {
        const fetchInvestigators = async () => {
            if (role !== "admin") return;
            try {
                const q = query(collection(db, "users"), where("role", "==", "investigator"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => doc.data());
                setInvestigators(list);
                console.log("🔍 INVESTIGATORS SYNCED:", list.length);
            } catch (err) {
                console.error("Failed to fetch investigators:", err);
            }
        };
        fetchInvestigators();
    }, [role]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                
                // 🛡️ STEP 7: SEND FIREBASE TOKEN TO BACKEND (Auto-injected by Interceptor)
                const res = await API.get('/accident/all');
                
                const rawData = res.data.data;

                // On Dashboard, we prioritize high performance metadata view.
                // Deep Forensic Audit is moved to CaseDetails for efficiency.
                setRecords(rawData);
                setFilteredRecords(rawData);
            } catch (error) {
                console.error("❌ Dashboard Metadata Fetch Error:", error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    // 🕵️ STEP 6: FILTER DATA BASED ON ROLE (CLIENT SIDE GUARD)
    const filterByRole = (data) => {
        if (!data) return [];
        if (role === "admin") return data;

        if (role === "investigator") {
            // Investigators see ONLY cases assigned directly to their email ID
            return data.filter(r => r.assignedTo === user.email);
        }

        if (role === "owner") {
            // Owners see ONLY their vehicle forensic telemetry (Security Filter)
            return data.filter(r => r.vehicle_id === user.vehicle_id);
        }

        return data;
    };

    const handleFilter = ({ search, status }) => {
        let filtered = records;
        if (search) {
            filtered = filtered.filter(r => 
                (r.vehicle_id || "").toLowerCase().includes(search.toLowerCase())
            );
        }
        if (status === "valid") {
            filtered = filtered.filter(r => r.isVerified === true);
        } else if (status === "tampered") {
            filtered = filtered.filter(r => r.isVerified === false);
        }
        setFilteredRecords(filtered);
    };

    // ✨ APPLY STEP 6 FILTERING
    const visibleRecords = filterByRole(filteredRecords);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', paddingTop: '100px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🕵️</div>
                <h2>Retrieving Case Files...</h2>
                <p style={{ color: '#666' }}>Role Identified: <strong>{user.role.toUpperCase()}</strong></p>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <h1 style={{ 
                fontSize: '34px', 
                fontWeight: '900', 
                color: '#1a1a1a', 
                marginBottom: '35px',
                letterSpacing: '-1px',
                borderLeft: '6px solid #007bff',
                paddingLeft: '20px',
                textShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                EvidenceChain Dashboard
            </h1>

            <StatsBar records={visibleRecords} />
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', marginBottom: '30px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#666' }}>Investigation Filters</h4>
                <Filters onFilter={handleFilter} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {visibleRecords.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '12px', color: '#888' }}>
                        <h3>No Cases Found for Role: {user.role.toUpperCase()}</h3>
                        <p>Cases appear here once they are generated and assigned by an Admin.</p>
                    </div>
                ) : (
                    visibleRecords.map((record, index) => (
                        <CaseCard 
                            key={record.id || index} 
                            record={record} 
                            role={user.role} 
                            investigators={investigators} 
                        />
                    ))
                )}
            </div>
        </div>
    );
}