# STRIDE Threat Model — EvidenceChain

## System Overview

EvidenceChain is a blockchain-based forensic evidence management system for vehicular accidents.
Architecture: 5-layer pipeline (IoT Sensor → Backend → IPFS → Smart Contract → React Dashboard).

## STRIDE Analysis by Layer

### Layer 1: IoT Sensor Node (ESP32 + MPU6050 + NEO-6M)

| Threat | Category | Description | Mitigation | Residual Risk |
|--------|----------|-------------|------------|---------------|
| Fake collision data injection | **Spoofing** | Attacker sends fabricated sensor data to the backend | API key authentication + HTTPS transport encryption | Medium — API key theft |
| GPS coordinate spoofing | **Tampering** | SDR-based GPS signal manipulation causes wrong coordinates | GPS confidence tracking (`live_fix`/`last_known`/`dead_reckoning`), HDOP validation, flagging low-confidence fixes | Medium — hardware-level attack |
| Sensor calibration drift | **Tampering** | Gradual MPU6050 drift produces false positives/negatives | STA/LTA algorithm with jerk validation, false positive counter | Low |
| Denial of WiFi connectivity | **Denial of Service** | Jammer prevents collision report transmission | Local buffer + retry on reconnect | Medium — data loss if sustained |
| Firmware extraction | **Information Disclosure** | Physical access to ESP32 reveals API keys, server URL | Flash encryption (future), secure boot chain | High — mitigated by API key rotation |

### Layer 2: Backend Server (Node.js + Express)

| Threat | Category | Description | Mitigation | Residual Risk |
|--------|----------|-------------|------------|---------------|
| Unauthorized evidence submission | **Spoofing** | Attacker submits data without valid API key | API key validation middleware, Firebase Auth for dashboard | Low |
| Evidence payload tampering | **Tampering** | Man-in-the-middle modifies JSON between ESP32 and backend | HTTPS transport, SHA-256 hash computed at backend before IPFS upload | Low |
| Replay of old evidence | **Repudiation** | Attacker resubmits previously captured collision data | On-chain `DuplicateHashWarning` event, `hashAnchored` mapping | Low |
| Unsigned evidence submission | **Repudiation** | Backend submits without signing, enabling plausible deniability | ECDSA signature enforcement on-chain via `ecrecover` + `require(recovered == msg.sender)` | None — enforced |
| Private key theft | **Information Disclosure** | `.env` file compromised exposes wallet private key | Environment variable isolation, no key logging, key rotation plan | Medium |
| Backend crash under load | **Denial of Service** | Burst of concurrent collision reports overwhelms Express | Rate limiting, async pipeline, fire-and-forget forensic video capture | Low |
| Firebase credential leak | **Elevation of Privilege** | Service account JSON exposed grants full Firestore access | IAM least-privilege, credential rotation, `.gitignore` enforcement | Medium |

### Layer 3: IPFS Storage (Pinata + Secondary Provider)

| Threat | Category | Description | Mitigation | Residual Risk |
|--------|----------|-------------|------------|---------------|
| Pinata API key compromise | **Spoofing** | Attacker uses stolen key to pin malicious content | Key rotation, usage monitoring, IP allowlisting | Low |
| Single-provider unpinning | **Denial of Service** | Pinata unpins evidence due to account expiry or policy | Multi-pin strategy (primary + secondary provider), CID consistency verification | Low |
| CID tampering via gateway | **Tampering** | Compromised gateway serves wrong content for a CID | Content-addressed by design (CID = hash of content), SHA-256 re-verification at client | None — inherent to IPFS |
| Gateway latency/unavailability | **Denial of Service** | Public IPFS gateways slow or offline | Multiple gateway fallback checks, local retrieval option | Low |
| Data permanence failure | **Information Disclosure** | Evidence disappears from all IPFS nodes after garbage collection | Pinning service SLA, multi-provider redundancy, on-chain CID for re-retrieval | Low |

### Layer 4: Smart Contract (Solidity on Sepolia)

| Threat | Category | Description | Mitigation | Residual Risk |
|--------|----------|-------------|------------|---------------|
| Unauthorized role escalation | **Elevation of Privilege** | Non-admin grants themselves investigator/admin role | `onlyAdmin` modifier, `onlyOwner` for critical functions | None — enforced |
| Invalid signature submission | **Spoofing** | Submitter provides a forged or wrong-signer signature | `ecrecover` + `require(recovered == msg.sender)` rejects invalid signatures | None — enforced on-chain |
| Replay attack (duplicate hash) | **Spoofing** | Attacker re-submits identical evidence hash | `hashAnchored` mapping + `DuplicateHashWarning` event, allows but flags | Low |
| Contract ownership hijack | **Elevation of Privilege** | Attacker calls `transferOwnership` | `onlyOwner` modifier, single-owner pattern | None — enforced |
| Custody log manipulation | **Tampering** | Unauthorized user logs false custody events | `onlyInvestigator` modifier (role >= 2 required) | None — enforced |
| Smart contract bugs | **Tampering** | Reentrancy, overflow, or logic errors | Solidity 0.8.x (built-in overflow checks), no external calls in state-modifying functions, Hardhat test suite | Low |
| Gas exhaustion attack | **Denial of Service** | Attacker fills contract storage to increase gas costs | Storage-minimal design (events for history, state for current only) | Low |

### Layer 5: Frontend Dashboard (React)

| Threat | Category | Description | Mitigation | Residual Risk |
|--------|----------|-------------|------------|---------------|
| XSS via evidence data display | **Tampering** | Malicious vehicle_id or sensor data contains script tags | React's default JSX escaping, no `dangerouslySetInnerHTML` | Low |
| Session token theft | **Information Disclosure** | Firebase Auth token intercepted | HTTPS-only, secure cookie flags, token expiration | Low |
| UI spoofing (false verification) | **Spoofing** | Tampered frontend shows "verified" for unverified evidence | Client-side SHA-256 re-computation against blockchain-stored hash | Low — user can independently verify |
| Unauthorized action execution | **Elevation of Privilege** | Viewer attempts investigator actions via API directly | Backend role check (Firebase claims), on-chain role enforcement as second layer | None — dual-layer |

## Risk Summary

| Risk Level | Count | Categories |
|------------|-------|------------|
| **None** (fully mitigated) | 7 | Signature enforcement, RBAC, custody access control |
| **Low** | 13 | Standard web security, content-addressed storage, rate limiting |
| **Medium** | 5 | Key management, GPS spoofing, firmware extraction |
| **High** | 0 | — |

## Key Security Properties Achieved

1. **Non-repudiation**: ECDSA signature enforced on-chain — submitter provably signed the evidence
2. **Immutability**: Blockchain + IPFS content-addressing — evidence cannot be altered post-anchor
3. **Access control**: Dual-layer RBAC (Firebase Auth + on-chain modifiers) — defense in depth
4. **Auditability**: On-chain event log for all custody actions — tamper-proof audit trail
5. **Replay detection**: Duplicate hash detection with warning events — observable on-chain
6. **Availability**: Multi-pin IPFS strategy — no single point of storage failure
