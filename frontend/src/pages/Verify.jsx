import React, { useState, useCallback } from 'react';
import { findByCID } from '../services/blockchain';

// Same stable sort as backend — required for hash to match
const stableSort = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stableSort);
  return Object.keys(obj).sort().reduce((r, k) => { r[k] = stableSort(obj[k]); return r; }, {});
};

const hashJSON = async (jsonObj) => {
  const sorted = stableSort(jsonObj);
  const buf = new TextEncoder().encode(JSON.stringify(sorted));
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const STEPS = ['Upload File', 'Compute Hash', 'Query Blockchain', 'Compare'];

export default function Verify() {
  const [file, setFile]         = useState(null);
  const [cid, setCid]           = useState('');
  const [step, setStep]         = useState(-1);   // -1 = idle
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((f) => {
    if (!f || !f.name.endsWith('.json')) { setError('Please select a valid .json file'); return; }
    setFile(f); setResult(null); setError('');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleVerify = async () => {
    if (!file || !cid.trim()) { setError('Please upload a JSON file and enter the CID.'); return; }
    setError(''); setResult(null);

    try {
      // Step 0: Read file
      setStep(0);
      const text = await file.text();
      let jsonObj;
      try { jsonObj = JSON.parse(text); }
      catch { setError('Invalid JSON file — could not parse.'); setStep(-1); return; }

      // Step 1: Hash
      setStep(1);
      const computedHash = await hashJSON(jsonObj);

      // Step 2: Query blockchain
      setStep(2);
      const blockchainRecord = await findByCID(cid.trim(), (done, total) => setProgress({ done, total }));

      // Step 3: Compare
      setStep(3);
      await new Promise(r => setTimeout(r, 600)); // slight pause for UX

      if (!blockchainRecord) {
        setResult({ status: 'not_found', computedHash, cid: cid.trim() });
      } else if (computedHash === blockchainRecord.jsonHash) {
        setResult({ status: 'verified', computedHash, blockchainHash: blockchainRecord.jsonHash, ...blockchainRecord });
      } else {
        setResult({ status: 'tampered', computedHash, blockchainHash: blockchainRecord.jsonHash, ...blockchainRecord });
      }
      setStep(-1);
    } catch (err) {
      setError('Verification error: ' + err.message);
      setStep(-1);
    }
  };

  const running = step >= 0;

  return (
    <div className="dashboard-container fade-in">
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🔐 Forensic Integrity Verifier
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px', maxWidth: 620, lineHeight: 1.7 }}>
          Upload the original JSON evidence file and its IPFS CID. The browser will re-hash the file using SHA-256 and compare it against the immutable hash stored on the <strong style={{ color: 'var(--text)' }}>Ethereum Sepolia</strong> blockchain.
        </p>
        {/* How to get the JSON */}
        <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 16px' }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            To get the evidence JSON: open any case on the <strong style={{ color: 'var(--success)' }}>Dashboard → Case Details</strong> page and click <strong style={{ color: 'var(--success)' }}>⬇️ Download JSON</strong>. The CID is shown on the same page under "IPFS Content ID".
          </span>
        </div>
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', marginBottom: '36px' }}>
        {[
          { icon: '📂', label: 'Upload JSON', desc: 'Your evidence file' },
          { icon: '#️⃣', label: 'SHA-256 Hash', desc: 'Computed in browser' },
          { icon: '⛓️', label: 'Query Chain', desc: 'Scan Sepolia records' },
          { icon: '🔍', label: 'Compare', desc: 'Hash vs blockchain' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${step === i ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'border-color 0.3s', boxShadow: step === i ? 'var(--glow-blue)' : 'none' }}>
            <div style={{ fontSize: '22px', marginTop: 2 }}>{step === i ? <span className="spinner">⚙️</span> : s.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: step === i ? 'var(--primary)' : 'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left: inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => document.getElementById('json-upload').click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--primary)' : file ? 'var(--success)' : 'var(--border-2)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--primary-glow)' : file ? 'var(--success-bg)' : 'var(--surface)',
              transition: 'all 0.2s',
            }}
          >
            <input id="json-upload" type="file" accept=".json" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>{file ? '✅' : '📂'}</div>
            {file ? (
              <>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{file.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Drop JSON file here</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>or click to browse</div>
              </>
            )}
          </div>

          {/* CID input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              IPFS Content ID (CID)
            </label>
            <input
              type="text"
              placeholder="QmXXX... (from the case record)"
              value={cid}
              onChange={e => setCid(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
              Find this on any case's detail page under "IPFS Content ID"
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--danger)', fontSize: '13px' }}>
              ❌ {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={running || !file || !cid.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', opacity: (running || !file || !cid.trim()) ? 0.5 : 1, cursor: (running || !file || !cid.trim()) ? 'not-allowed' : 'pointer' }}
          >
            {running ? `${STEPS[step]}...` : '🔐 Verify Integrity'}
          </button>

          {step === 2 && progress.total > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Scanning record {progress.done} of {progress.total}...
            </div>
          )}
        </div>

        {/* Right: Result */}
        <div>
          {!result && !running && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ fontSize: '48px' }}>⛓️</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: 280, lineHeight: 1.6 }}>
                Upload a JSON file and enter a CID to verify its integrity against the Ethereum blockchain.
              </div>
            </div>
          )}

          {running && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', boxShadow: 'var(--glow-blue)' }}>
              <div style={{ width: 56, height: 56, border: '3px solid var(--border-2)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} className="spinner" />
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '16px' }}>{STEPS[step] || 'Working...'}...</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Communicating with Sepolia blockchain</div>
            </div>
          )}

          {result && !running && (
            <div style={{ background: result.status === 'verified' ? 'rgba(16,185,129,0.06)' : result.status === 'tampered' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${result.status === 'verified' ? 'rgba(16,185,129,0.3)' : result.status === 'tampered' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Verdict */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '52px', marginBottom: '8px' }}>
                  {result.status === 'verified' ? '✅' : result.status === 'tampered' ? '🚨' : '⚠️'}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: result.status === 'verified' ? 'var(--success)' : result.status === 'tampered' ? 'var(--danger)' : 'var(--warning)' }}>
                  {result.status === 'verified' ? 'VERIFIED — UNTAMPERED' : result.status === 'tampered' ? 'TAMPERED — MISMATCH' : 'NOT FOUND ON CHAIN'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {result.status === 'verified' ? 'The file hash exactly matches the blockchain record.' :
                   result.status === 'tampered' ? 'The file has been modified since it was anchored to the blockchain.' :
                   'No blockchain record found for this CID.'}
                </div>
              </div>

              {/* Hash comparison */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <HashRow label="Computed Hash (your file)" value={result.computedHash} color="var(--text-muted)" />
                {result.blockchainHash && <HashRow label="Blockchain Hash (on-chain)" value={result.blockchainHash} color={result.status === 'verified' ? 'var(--success)' : 'var(--danger)'} />}
              </div>

              {/* Record details */}
              {result.vehicleId && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <Detail label="Vehicle ID"   value={result.vehicleId} />
                  <Detail label="Chain Index"  value={`Record #${result.index}`} />
                  <Detail label="Anchored"     value={new Date(result.timestamp * 1000).toLocaleString()} />
                  <Detail label="Submitted By" value={`${result.uploadedBy?.slice(0,8)}...${result.uploadedBy?.slice(-6)}`} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HashRow({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
      <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '11px', padding: '8px 10px', color }}>{value}</code>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
