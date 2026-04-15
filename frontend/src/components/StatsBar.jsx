import React, { useEffect, useRef, useState } from 'react';

/* ── Animated counting number ───────────────────────────────────────── */
function AnimatedNumber({ target, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return <>{display}</>;
}

/* ── Single stat card ───────────────────────────────────────────────── */
function StatCard({ value, label, color, glow, icon }) {
  return (
    <div className="stat-card" style={{
      borderColor: `${color}20`,
      boxShadow: `0 0 20px ${color}10, var(--shadow-card)`,
    }}>
      {/* Left accent stripe */}
      <div className="stat-card-stripe" style={{ background: `linear-gradient(180deg, ${color}, ${color}66)` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-card-value" style={{ color }}>
            <AnimatedNumber target={typeof value === 'number' ? value : 0} />
          </div>
          <div className="stat-card-label">{label}</div>
        </div>
        <div style={{
          width: '36px', height: '36px', borderRadius: '9px',
          background: `${color}14`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── StatsBar ────────────────────────────────────────────────────────── */
export default function StatsBar({ records }) {
  const total      = records.length;
  const pending    = records.filter(r => r.status === 'pending').length;
  const assigned   = records.filter(r => r.status === 'assigned').length;
  const verified   = records.filter(r => r.status === 'verified').length;
  const confirmed  = records.filter(r => r.txHash && typeof r.txHash === 'string' && !r.txHash.includes('mock')).length;
  const withVideo  = records.filter(r => r.video?.cid).length;

  const stats = [
    { value: total,     label: 'Total Cases',           color: '#8b5cf6', icon: '🗂️' },
    { value: pending,   label: 'Pending Review',         color: '#f59e0b', icon: '⏳' },
    { value: confirmed, label: 'On-Chain Confirmed',     color: '#10b981', icon: '⛓️' },
    { value: withVideo, label: 'Video Evidence Secured', color: '#06b6d4', icon: '🎥' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '14px',
      marginBottom: '24px',
    }}>
      {stats.map((s, i) => (
        <StatCard key={i} {...s} />
      ))}
    </div>
  );
}