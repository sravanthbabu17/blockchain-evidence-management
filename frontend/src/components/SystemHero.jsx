import React from 'react';

/* ── Forensic stat shown in the hero panel ──────────────────────────── */
function HeroStat({ value, label }) {
  return (
    <div className="hero-stat">
      <div className="hero-stat-value">{value}</div>
      <div className="hero-stat-label">{label}</div>
    </div>
  );
}

/* ── Feature bullet for hero ─────────────────────────────────────────── */
function HeroBullet({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export default function SystemHero({ mode = 'integrated' }) {
  const isAboutPage = mode === 'full';

  return (
    <div className={isAboutPage ? 'fade-in' : ''} style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: isAboutPage ? 'flex-start' : 'center',
      padding: isAboutPage ? '0' : '0',
      maxWidth: isAboutPage ? '800px' : 'none',
      margin: isAboutPage ? '0 auto' : '0'
    }}>
      {/* Logo (only if not on about page where logo is in navbar) */}
      {!isAboutPage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '52px' }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 7v9c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z" fill="url(#lhg)" />
            <path d="M13 14.5h2m2 0h2M16 12v5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            <defs>
              <linearGradient id="lhg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#06b6d4" /><stop offset="0.5" stopColor="#3b82f6" /><stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontSize: '20px', fontWeight: 900, background: 'linear-gradient(135deg,#06b6d4,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            EvidenceChain
          </span>
        </div>
      )}

      {/* Headline */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '40px' }}>
        <div style={{
          fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 600,
          letterSpacing: '2px', color: 'var(--cyan)', textTransform: 'uppercase',
          marginBottom: '12px',
        }}>
          FORENSIC INTELLIGENCE SYSTEM
        </div>
        <h1 style={{
          fontSize: isAboutPage ? '42px' : '34px', fontWeight: 900, lineHeight: 1.2,
          color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '14px',
        }}>
          Evidence that can't<br />
          <span style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            be questioned.
          </span>
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '500px' }}>
          Autonomous collision detection, cryptographic hashing, decentralised storage,
          and immutable blockchain anchoring — all in under 60 seconds. Our system ensures that every frame of forensic data is cryptographically secured at the moment of impact.
        </p>
      </div>

      {/* Live metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px 32px', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <HeroStat value="&lt; 1 ms" label="SHA-256 hash time" />
        <HeroStat value="~13 s" label="Blockchain confirm" />
        <HeroStat value="~1.9 s" label="IPFS upload (JSON)" />
        <HeroStat value="22 / 22" label="Contract tests pass" />
      </div>

      {/* Feature bullets */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: isAboutPage ? '1fr 1fr' : '1fr',
        gap: isAboutPage ? '0 40px' : '0'
      }}>
        <HeroBullet icon="🔒" text="Tamper-proof SHA-256 integrity on every record" />
        <HeroBullet icon="⛓️" text="Ethereum Sepolia — publicly verifiable on-chain" />
        <HeroBullet icon="🎥" text="60-second forensic dashcam window, auto-preserved" />
        <HeroBullet icon="🛡️" text="Role-based access — admin, investigator, owner" />
      </div>

      {/* Bottom tag */}
      {mode === 'integrated' && (
        <div style={{ marginTop: 'auto', paddingTop: '48px', position: 'relative', zIndex: 1, opacity: 0.6 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            Contract: 0xd2CF...15F4 · Sepolia Testnet
          </div>
        </div>
      )}
    </div>
  );
}
