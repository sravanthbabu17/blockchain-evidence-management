import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onLogin(cred.user);
    } catch (err) {
      setError(err.message.includes('wrong-password') || err.message.includes('user-not-found')
        ? 'Invalid email or password.' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛡️</div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>
          EvidenceChain
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Tamper-proof forensic evidence platform
        </p>
      </div>

      {/* Card */}
      <form onSubmit={handleLogin} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '32px', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>Sign In</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Enter your credentials to access the system</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@domain.com" required autoComplete="email" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--danger)', fontSize: '13px' }}>
            ❌ {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '14px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>
      </form>
    </div>
  );
}