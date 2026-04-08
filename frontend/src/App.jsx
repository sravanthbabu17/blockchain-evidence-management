import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CaseDetails from "./pages/CaseDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";
import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ec-theme') || 'dark');

  // Apply theme to <html> element whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ec-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          setUserData({ email: user.email, role: 'investigator', vehicle_id: '' });
        }
      }
    };
    fetchUserData();
  }, [user]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
        {isSignup ? <Signup onSignup={setUser} /> : <Login onLogin={setUser} />}
        <button
          onClick={() => setIsSignup(!isSignup)}
          style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
        >
          {isSignup ? "Already have an account? Log in." : "Need an account? Register here."}
        </button>
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-2)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Synchronizing identity...</p>
      </div>
    );
  }

  const roleColor = { admin: '#f59e0b', investigator: '#3b82f6', owner: '#10b981' };

  return (
    <BrowserRouter>
      {/* ── TOP NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: 'rgba(8,8,16,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left — Logo + Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', textDecoration: 'none' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EvidenceChain
            </span>
          </Link>

          <div style={{ display: 'flex', gap: '4px' }}>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/verify">Verify Evidence</NavLink>
          </div>
        </div>

        {/* Right — Theme toggle + Session info + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              lineHeight: 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              {userData.email.split('@')[0]}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: roleColor[userData.role] || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ● {userData.role}
            </div>
          </div>
          <button
            onClick={async () => { await signOut(auth); setUser(null); setUserData(null); }}
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.25)'}
            onMouseLeave={e => e.target.style.background = 'var(--danger-bg)'}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── ROUTES ── */}
      <main style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Routes>
          <Route path="/"        element={<Dashboard user={userData} />} />
          <Route path="/case/:id" element={<CaseDetails user={userData} />} />
          <Route path="/verify"  element={<Verify />} />
          <Route path="*"        element={<Navigate to="/" />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

// Small helper for nav links
function NavLink({ to, children }) {
  const active = window.location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        padding: '6px 14px',
        borderRadius: '7px',
        fontSize: '13px',
        fontWeight: 600,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        background: active ? 'var(--surface-2)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </Link>
  );
}