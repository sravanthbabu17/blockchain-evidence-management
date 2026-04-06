import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export default function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("owner");
  const [vehicleId, setVehicleId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError("");
      
      // 1. Create Firebase user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // 2. Save user role + vehicle in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email,
        role,
        vehicle_id: role === "owner" ? vehicleId : null
      });

      // 3. Pass user forward
      onSignup(user);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      fontFamily: "'Inter', sans-serif",
      padding: '20px'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '430px', 
        padding: '40px', 
        background: 'rgba(255, 255, 255, 0.05)', 
        backdropFilter: 'blur(10px)', 
        borderRadius: '20px', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '15px' }}>🛡️</div>
        <h2 style={{ color: '#fff', fontSize: '32px', fontWeight: '900', marginBottom: '8px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>EvidenceChain</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '30px', fontWeight: '500' }}>New Identity Registration Portal</p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>
              Firebase Identity (Email)
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              placeholder="user@forensic.com"
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              style={{ width: '100%', padding: '12px 15px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>
              Secure Password
            </label>
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }}
            />
          </div>

          {/* Secure Role Selection Dropdown */}
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>
              Platform Role Identity
            </label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', background: 'rgba(0,0,0,0.5)', border: '1px solid #007bff', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="owner">Vehicle Owner</option>
              <option value="investigator">Investigator</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* Vehicle ID Conditionally Rendered */}
          {role === "owner" && (
            <div style={{ marginBottom: '20px', textAlign: 'left', animation: 'fadeIn 0.3s ease-in-out' }}>
              <label style={{ display: 'block', color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>
                Vehicle Registration Number
              </label>
              <input
                type="text"
                value={vehicleId}
                placeholder="e.g. AP09XX1234"
                onChange={(e) => setVehicleId(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '12px 15px', background: 'rgba(0,0,0,0.3)', border: '1px solid #f39c12', borderRadius: '8px', color: '#f39c12', fontSize: '14px', outline: 'none', fontWeight: '600' }}
              />
            </div>
          )}

          {error && <p style={{ color: '#ff4d4d', fontSize: '13px', marginBottom: '20px' }}>⚠️ {error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 123, 255, 0.3)' }}
          >
            {loading ? "Registering via Web3 Enclave..." : "Initialise Account"}
          </button>
        </form>

        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: '#666', fontSize: '10px', letterSpacing: '0.5px' }}>
            FIREBASE FIRESTORE ENCLAVE • V3.1
          </p>
        </div>
      </div>
    </div>
  );
}
