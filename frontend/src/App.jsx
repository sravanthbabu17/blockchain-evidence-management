import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CaseDetails from "./pages/CaseDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";
import SystemSpecs from "./pages/SystemSpecs";
import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import API from "./services/api";

/* ── Animated hex-shield logo ─────────────────────────────────────────── */
function ShieldLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 2L4 7v9c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z"
        fill="url(#shield-grad)"
        opacity="0.9"
      />
      <path
        d="M16 2L4 7v9c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z"
        fill="none"
        stroke="url(#shield-stroke)"
        strokeWidth="1"
        opacity="0.6"
      />
      {/* Chain link icon inside */}
      <path d="M13 14.5h2m2 0h2M16 12v5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.85"/>
      <defs>
        <linearGradient id="shield-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="shield-stroke" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Camera status pill — fetches /api/camera/status ─────────────────── */
function CameraStatusPill() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetch_ = () =>
      API.get('/camera/status')
        .then(({ data }) => setStatus(data.camera))
        .catch(() => setStatus(null));
    fetch_();
    const id = setInterval(fetch_, 8000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const isHardware = status.mode === 'hardware';
  const isStopped  = status.mode === 'stopped';
  const dotClass   = isStopped ? '' : isHardware ? 'green' : 'amber';

  return (
    <div className="status-pill" title={status.note}>
      {!isStopped && <span className={`dot ${dotClass}`} />}
      {isHardware ? '● CAM LIVE' : isStopped ? '⊘ CAM OFF' : '◌ SIM'}
    </div>
  );
}

/* ── Chain status pill ────────────────────────────────────────────────── */
function ChainPill() {
  return (
    <div className="status-pill" title="Ethereum Sepolia Testnet">
      <span className="dot blue" />
      SEPOLIA
    </div>
  );
}

/* ── Navbar link using useLocation hook for active detection ──────────── */
function NavLink({ to, children }) {
  const location = useLocation();
  const active   = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      style={{
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 600,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        background: active ? 'var(--surface-2)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.2s',
        borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
      }}
    >
      {children}
    </Link>
  );
}

/* ── App ──────────────────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser]         = useState(null);
  const [userData, setUserData] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [theme, setTheme]       = useState(() => localStorage.getItem('ec-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ec-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      setUserData(docSnap.exists()
        ? docSnap.data()
        : { email: user.email, role: 'investigator', vehicle_id: '' }
      );
    };
    fetchUserData();
  }, [user]);

  /* ── Auth screen ──────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
        {isSignup 
          ? <Signup onSignup={setUser} onLoginToggle={() => setIsSignup(false)} /> 
          : <Login onLogin={setUser} onSignupToggle={() => setIsSignup(true)} />}
      </div>
    );
  }

  /* ── Loading user profile ─────────────────────────────────────────────── */
  if (!userData) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: '16px' }}>
        <div style={{ width: '38px', height: '38px', border: '2.5px solid var(--border-2)', borderTopColor: 'var(--cyan)', borderRadius: '50%' }} className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--mono)' }}>Syncing identity...</p>
      </div>
    );
  }

  const roleColors = { admin: '#f59e0b', investigator: '#3b82f6', owner: '#10b981' };
  const roleColor  = roleColors[userData.role] || 'var(--cyan)';

  return (
    <BrowserRouter>
      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderBottom: '1px solid var(--nav-border)',
        padding: '0 24px',
        height: '62px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <ShieldLogo />
            <span style={{
              fontSize: '17px', fontWeight: 900, letterSpacing: '0.5px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              EvidenceChain
            </span>
          </Link>

          {/* Nav links — need BrowserRouter context so rendered inside */}
          <div style={{ display: 'flex', gap: '2px' }}>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/verify">Verify</NavLink>
            <NavLink to="/specs">System Specs</NavLink>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Live status pills */}
          <CameraStatusPill />
          <ChainPill />

          {/* Theme */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '15px',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'all 0.2s',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '5px 12px',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${roleColor}44, ${roleColor}22)`,
              border: `1.5px solid ${roleColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: roleColor,
            }}>
              {userData.email[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {userData.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.8px', lineHeight: 1 }}>
                {userData.role}
              </div>
            </div>
          </div>

          <button
            onClick={async () => { await signOut(auth); setUser(null); setUserData(null); }}
            style={{
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', padding: '6px 14px',
              borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── ROUTES ─────────────────────────────────────────────────────── */}
      <main style={{ minHeight: 'calc(100vh - 62px)', position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/"         element={<Dashboard user={userData} />} />
          <Route path="/case/:id" element={<CaseDetails user={userData} />} />
          <Route path="/verify"   element={<Verify />} />
          <Route path="/specs"    element={<SystemSpecs />} />
          <Route path="*"         element={<Navigate to="/" />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
