import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CaseDetails from "./pages/CaseDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isSignup, setIsSignup] = useState(false);

  // 🔥 FETCH ROLE FROM FIRESTORE
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          console.warn("⚠️ Firestore: User record missing.");
          // Fallback if missing
          setUserData({ email: user.email, role: 'investigator', vehicle_id: '' });
        }
      }
    };

    fetchUserData();
  }, [user]);

  // 🛡️ AUTHENTICATION GUARD
  if (!user) {
    return (
      <div style={{ position: 'relative' }}>
        {isSignup ? <Signup onSignup={setUser} /> : <Login onLogin={setUser} />}
        
        <button 
          onClick={() => setIsSignup(!isSignup)}
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isSignup ? "Already have an account? Log in." : "Need an Identity? Register here."}
        </button>
      </div>
    );
  }

  // ⏳ FIRESTORE SESSION LOADING SCREEN
  if (!userData) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', fontFamily: 'monospace' }}>
        <h2>🔐 Synchronizing Firestore Identity...</h2>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* 🏛️ GLOBAL FORENSIC SHELL HEADER */}
      <div style={{
        padding: "15px 30px",
        background: "#000",
        color: "#fff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
        borderBottom: "1px solid #333"
      }}>
        <Link to="/" style={{ color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ fontSize: '32px', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.3))' }}>🛡️</span>
          <h2 style={{ 
            margin: 0, 
            fontSize: "24px", 
            fontWeight: 950, 
            letterSpacing: '1.5px', 
            textTransform: 'uppercase',
            color: '#ffffff', // Explicitly white
            fontFamily: "'Inter', sans-serif"
          }}>
            EvidenceChain
          </h2>
        </Link>

        {/* 🕵️ SESSION INFO */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "#888", fontWeight: "bold", textTransform: "uppercase" }}>Active Session</div>
            <div style={{ fontSize: "14px", fontWeight: "700" }}>{userData.email.split('@')[0]} <span style={{ color: "#007bff", fontSize: '10px', marginLeft: '5px' }}>● {userData.role.toUpperCase()}</span></div>
          </div>
          
          <button 
            onClick={async () => { 
              await signOut(auth);
              setUser(null); 
              setUserData(null); 
            }}
            style={{ 
              background: "#ff4d4d", 
              color: "#fff", 
              border: "none", 
              padding: "6px 12px", 
              borderRadius: "4px", 
              fontSize: "12px", 
              fontWeight: 600, 
              cursor: "pointer" 
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* 🚀 CASE ROUTING (Pass real Firestore data) */}
      <div style={{ minHeight: 'calc(100vh - 71px)', background: '#f8f9fa' }}>
        <Routes>
          <Route path="/" element={<Dashboard user={userData} />} />
          <Route path="/case/:id" element={<CaseDetails user={userData} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}