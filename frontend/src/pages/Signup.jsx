import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Signup({ onSignup }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('investigator');
  const [vehicleId, setVehicleId] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email, role,
        vehicle_id: role === 'owner' ? vehicleId : '',
        createdAt: new Date().toISOString(),
      });
      onSignup(cred.user);
    } catch (err) {
      setError(err.message.includes('email-already') ? 'Email already registered.' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛡️</div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>
          EvidenceChain
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Register your forensic identity</p>
      </div>

      <form onSubmit={handleSignup} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '32px', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Create Account</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Request access from your administrator after registering.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@domain.com" required /></Field>
          <Field label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required /></Field>
          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="investigator">🕵️ Investigator</option>
              <option value="owner">🚗 Vehicle Owner</option>
              <option value="admin">🛡️ Admin</option>
            </select>
          </Field>
          {role === 'owner' && (
            <Field label="Vehicle ID">
              <input type="text" value={vehicleId} onChange={e => setVehicleId(e.target.value)} placeholder="e.g. AP09XX1234" required />
            </Field>
          )}
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--danger)', fontSize: '13px' }}>
            ❌ {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '14px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating account...' : 'Create Account →'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}
