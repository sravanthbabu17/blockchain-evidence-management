/**
 * SignatureBadge — ECDSA verification badge component.
 * Shows lock icon + signer address + verification status.
 */

export default function SignatureBadge({ signature, compact = false }) {
  if (!signature) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '10px', color: 'var(--text-muted)',
        background: 'var(--surface-2)', padding: '2px 8px',
        borderRadius: '20px', border: '1px solid var(--border)',
      }}>
        🔓 Unsigned
      </span>
    );
  }

  const { signerAddress, isDuplicate } = signature;
  const truncAddr = signerAddress
    ? `${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}`
    : '—';

  if (compact) {
    return (
      <span title={`Signed by ${signerAddress}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '10px', color: '#10b981',
        background: '#10b98115', padding: '2px 8px',
        borderRadius: '20px', border: '1px solid #10b98130',
      }}>
        🔒 {truncAddr}
        {isDuplicate && <span style={{ color: '#f59e0b', marginLeft: '3px' }}>⚠️</span>}
      </span>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '16px 20px',
    }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
        🔏 ECDSA Signature Verification
      </h3>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {/* Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#10b98112', border: '1px solid #10b98130',
          borderRadius: '10px', padding: '8px 14px',
        }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
              Signature Valid
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Non-repudiation enforced on-chain
            </div>
          </div>
        </div>

        {/* Signer */}
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 14px',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Signer Address</div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>
            {signerAddress || '—'}
          </div>
        </div>

        {/* Duplicate warning */}
        {isDuplicate && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f59e0b12', border: '1px solid #f59e0b30',
            borderRadius: '10px', padding: '8px 14px',
          }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
                Duplicate Hash Detected
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                This evidence hash was previously submitted
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
