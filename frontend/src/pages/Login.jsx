import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login({ onLogin, onSignupToggle }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onLogin(cred.user);
    } catch (err) {
      setError(
        err.message.includes('wrong-password') || err.message.includes('user-not-found') || err.message.includes('invalid-credential')
          ? 'Invalid email or password. Please try again.'
          : 'Authentication failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 7v9c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z" fill="url(#login-grad)"/>
            <path d="M13 14.5h2m2 0h2M16 12v5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
            <defs>
              <linearGradient id="login-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#06b6d4"/><stop offset="0.5" stopColor="#3b82f6"/><stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>
          EvidenceChain
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Forensic Intelligence System
        </p>
      </div>

      <form onSubmit={handleLogin} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '32px', backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column', gap: '18px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Welcome back</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sign in to access your dashboard.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@domain.com" required className="input-accented" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="input-accented" style={{ width: '100%' }} />
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '14px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Authenticating...' : 'Sign In →'}
        </button>

        <button
          type="button"
          onClick={onSignupToggle}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, marginTop: '8px', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          Need an account? Register here →
        </button>
      </form>
    </div>
  );
}