import React from 'react';
import SystemHero from '../components/SystemHero';

export default function SystemSpecs() {
  return (
    <div className="dashboard-container fade-in" style={{ paddingTop: '60px', paddingBottom: '100px' }}>
      <div style={{ textAlign: 'center', marginBottom: '80px' }}>
        <h1 style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--cyan)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
          Technical Specifications
        </h1>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>
          EvidenceChain Forensic Architecture
        </h2>
        <div style={{ width: '60px', height: '3px', background: 'var(--gradient-ai)', margin: '24px auto', borderRadius: '2px' }} />
      </div>

      <div className="card" style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 40px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <SystemHero mode="full" />
      </div>

      {/* Additional Tech Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '900px', margin: '40px auto 0' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--cyan)', marginBottom: '12px' }}>Smart Contract</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Deployed on Ethereum Sepolia. Implements strict Role-Based Access Control (RBAC) and immutable event logging for all forensic submissions.
          </p>
          <div style={{ marginTop: '16px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
            0xd2CF...15F4
          </div>
        </div>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--cyan)', marginBottom: '12px' }}>Forensic Pipeline</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Ring-buffer based video recording with zero-latency extraction on collision detection. Multi-stage integrity verification (SHA-256 → IPFS → Blockchain).
          </p>
        </div>
      </div>
    </div>
  );
}
