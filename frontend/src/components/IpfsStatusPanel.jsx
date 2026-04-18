/**
 * IpfsStatusPanel — Multi-provider IPFS status display.
 * Shows per-provider CID, latency, status, and CID consistency.
 */

export default function IpfsStatusPanel({ ipfsDetails }) {
  if (!ipfsDetails) {
    return null;
  }

  const { providerResults = [], cidConsistent } = ipfsDetails;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          📌 IPFS Multi-Pin Status
        </h3>
        {cidConsistent !== undefined && (
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: cidConsistent ? '#10b981' : '#ef4444',
            background: cidConsistent ? '#10b98115' : '#ef444415',
            padding: '3px 10px', borderRadius: '20px',
            border: `1px solid ${cidConsistent ? '#10b98130' : '#ef444430'}`,
          }}>
            {cidConsistent ? '✅ CIDs Consistent' : '🚨 CID Mismatch'}
          </span>
        )}
      </div>

      {providerResults.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '8px',
        }}>
          {/* Status dot */}
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
            background: r.status === 'success' ? '#10b981' : '#ef4444',
            boxShadow: r.status === 'success' ? '0 0 6px #10b98144' : '0 0 6px #ef444444',
          }} />

          {/* Provider name */}
          <div style={{ minWidth: '80px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
              {r.provider}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {r.priority}
            </div>
          </div>

          {/* CID */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {r.cid ? (
              <div style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.cid}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: '#ef4444' }}>
                {r.error || 'Failed'}
              </div>
            )}
          </div>

          {/* Latency bar */}
          {r.latencyMs && (
            <div style={{ minWidth: '80px', textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                {r.latencyMs.toLocaleString()} ms
              </div>
              <div style={{
                height: '3px', borderRadius: '2px',
                background: 'var(--border)',
                marginTop: '3px',
              }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  background: r.latencyMs < 3000 ? '#10b981' : r.latencyMs < 8000 ? '#f59e0b' : '#ef4444',
                  width: `${Math.min(100, (r.latencyMs / 15000) * 100)}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
