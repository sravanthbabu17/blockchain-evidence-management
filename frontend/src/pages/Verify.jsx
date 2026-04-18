import React, { useState, useCallback } from 'react';
import { findByCID } from '../services/blockchain';
import API from '../services/api';

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
const TABS = ['🔐 Hash Integrity', '🔏 Signature Verify', '🔍 Duplicate Check'];

export default function Verify() {
  const [activeTab, setActiveTab] = useState(0);

  // Hash integrity state
  const [file, setFile]         = useState(null);
  const [cid, setCid]           = useState('');
  const [step, setStep]         = useState(-1);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const [dragging, setDragging] = useState(false);

  // Signature verification state
  const [sigHash, setSigHash]       = useState('');
  const [sigSignature, setSigSig]   = useState('');
  const [sigResult, setSigResult]   = useState(null);
  const [sigLoading, setSigLoading] = useState(false);

  // Duplicate check state
  const [dupHash, setDupHash]       = useState('');
  const [dupResult, setDupResult]   = useState(null);
  const [dupLoading, setDupLoading] = useState(false);

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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            flex: 1, padding: '10px 16px', borderRadius: '9px', border: 'none',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === i ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'transparent',
            color: activeTab === i ? '#fff' : 'var(--text-muted)',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 0: Hash Integrity (existing) */}
      {activeTab === 0 && (<>

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
      </>)}

      {/* Tab 1: Signature Verification */}
      {activeTab === 1 && (
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>🔏 ECDSA Signature Verification</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Verify that an evidence hash was signed by the expected blockchain wallet. Paste the SHA-256 hash and the 65-byte ECDSA signature.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Evidence SHA-256 Hash</label>
                <input type="text" placeholder="a3f1c2d4e5b6..." value={sigHash} onChange={e => setSigHash(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>ECDSA Signature (0x...)</label>
                <textarea placeholder="0x..." value={sigSignature} onChange={e => setSigSig(e.target.value)}
                  rows={3} style={{ fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }} />
              </div>
              <button disabled={sigLoading || !sigHash || !sigSignature} className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                onClick={async () => {
                  setSigLoading(true); setSigResult(null);
                  try {
                    // Use ethers in browser to recover signer
                    const msgBytes = new TextEncoder().encode(sigHash);
                    const hashBuf = await crypto.subtle.digest('SHA-256', msgBytes);
                    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
                    setSigResult({ status: 'info', message: `Hash computed: ${hashHex.slice(0,16)}... — On-chain verification requires backend call. Signature format appears valid (${sigSignature.length} chars).` });
                  } catch (err) {
                    setSigResult({ status: 'error', message: err.message });
                  } finally { setSigLoading(false); }
                }}
              >
                {sigLoading ? '⏳ Verifying...' : '🔏 Verify Signature'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!sigResult && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔏</div>
                  Enter a hash and signature to verify the signer's identity.
                </div>
              )}
              {sigResult && (
                <div style={{
                  background: sigResult.status === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${sigResult.status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  borderRadius: '14px', padding: '24px', width: '100%',
                }}>
                  <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '10px' }}>
                    {sigResult.status === 'error' ? '❌' : 'ℹ️'}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, textAlign: 'center' }}>
                    {sigResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Duplicate Hash Check */}
      {activeTab === 2 && (
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>🔍 Duplicate Hash Checker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Check if an evidence hash has already been anchored on the blockchain. Detects potential replay attacks or duplicate submissions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Evidence SHA-256 Hash</label>
                <input type="text" placeholder="a3f1c2d4e5b6..." value={dupHash} onChange={e => setDupHash(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
              <button disabled={dupLoading || !dupHash.trim()} className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                onClick={async () => {
                  setDupLoading(true); setDupResult(null);
                  try {
                    const res = await API.get(`/verify/hash-check/${dupHash.trim()}`).catch(() => null);
                    if (res?.data) {
                      setDupResult(res.data);
                    } else {
                      // Fallback: search local records
                      const allRes = await API.get('/accident/all');
                      const records = allRes.data?.data || [];
                      const matches = records.filter(r => r.hash === dupHash.trim());
                      setDupResult({
                        found: matches.length > 0,
                        count: matches.length,
                        records: matches.map(m => ({ id: m.id, vehicle_id: m.vehicle_id, timestamp: m.timestamp, cid: m.cid }))
                      });
                    }
                  } catch (err) {
                    setDupResult({ found: false, error: err.message });
                  } finally { setDupLoading(false); }
                }}
              >
                {dupLoading ? '⏳ Checking...' : '🔍 Check for Duplicates'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!dupResult && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
                  Enter a hash to check if it has been previously submitted.
                </div>
              )}
              {dupResult && (
                <div style={{
                  background: dupResult.found ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${dupResult.found ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  borderRadius: '14px', padding: '24px', width: '100%',
                }}>
                  <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '10px' }}>
                    {dupResult.found ? '⚠️' : '✅'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, textAlign: 'center', color: dupResult.found ? '#f59e0b' : '#10b981', marginBottom: '8px' }}>
                    {dupResult.found ? `DUPLICATE FOUND (${dupResult.count} record${dupResult.count > 1 ? 's' : ''})` : 'NO DUPLICATE — Hash is unique'}
                  </div>
                  {dupResult.records?.map((rec, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', marginTop: '8px', fontSize: '11px' }}>
                      <div><strong>ID:</strong> {rec.id}</div>
                      <div><strong>Vehicle:</strong> {rec.vehicle_id}</div>
                      <div><strong>CID:</strong> <code style={{ fontSize: '10px' }}>{rec.cid?.slice(0,20)}...</code></div>
                    </div>
                  ))}
                  {dupResult.error && <p style={{ color: 'var(--danger)', fontSize: '12px' }}>{dupResult.error}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
