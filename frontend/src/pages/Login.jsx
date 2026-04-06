import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError("");
      
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      // Pass the raw Firebase user object upward
      onLogin(userCred.user);
    } catch (err) {
      setError("Invalid Firebase Credentials. Entry denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
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
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '30px', fontWeight: '500' }}>Secure Forensic Access Portal</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
              Firebase Identity (Email)
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              placeholder="admin@forensic.com"
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              style={{ 
                width: '100%', 
                padding: '12px 15px', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                color: '#fff', 
                fontSize: '15px',
                outline: 'none',
                transition: 'border 0.3s'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
              Secure Password
            </label>
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px 15px', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                color: '#fff', 
                fontSize: '15px',
                outline: 'none',
                transition: 'border 0.3s'
              }}
            />
          </div>

          {error && <p style={{ color: '#ff4d4d', fontSize: '13px', marginBottom: '20px' }}>⚠️ {error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '14px', 
              background: '#007bff', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '10px', 
              fontSize: '16px', 
              fontWeight: '700', 
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 123, 255, 0.3)',
              transition: 'transform 0.2s'
            }}
          >
            {loading ? "Verifying..." : "Unlock Dashboard"}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: '#666', fontSize: '11px', letterSpacing: '0.5px' }}>
            SECURE ACCESS PORTAL V2.4 • BLOCKCHAIN SYNC ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
}