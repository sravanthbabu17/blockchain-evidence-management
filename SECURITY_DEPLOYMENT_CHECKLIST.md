# EvidenceChain Security Deployment Checklist

## Implemented in this hardening pass

- Device ingestion keys are loaded from `IOT_API_KEYS` instead of source code.
- `/api/impact` now requires the IoT API key.
- Custody routes require Firebase authentication and admin/investigator roles.
- Custody actions use `req.user.email`; request-supplied `actor` is ignored.
- Case status updates require admin or the assigned investigator.
- Metrics and camera status routes require Firebase authentication; metrics are admin-only.
- Local forensic videos are no longer exposed through public static hosting.
- Backend CORS is restricted through `ALLOWED_ORIGINS`.
- Security headers, JSON body limits, and in-memory rate limits are enabled.
- Production backend startup requires real TLS certificate paths.
- ESP32 firmware now supports CA validation and keeps `setInsecure()` behind `ALLOW_INSECURE_TLS`.
- Smart contract ownership transfer revokes old-owner admin role and grants admin to the new owner.
- Smart contract CID lookup is indexed instead of scanning all records.
- The stale Hardhat `Lock` sample test was removed.

## Required before real deployment

- Rotate all existing IoT API keys, Firebase service-account keys, and blockchain wallet keys.
- Configure Firebase/Firestore security rules so users cannot self-assign `admin` or arbitrary roles.
- Replace shared API keys with per-device asymmetric signatures or HMAC with timestamp + nonce replay protection.
- Move `PRIVATE_KEY`, Firebase service credentials, and Pinata keys into a managed secret store or KMS.
- Deploy behind a real HTTPS endpoint and disable `ENABLE_HTTP` in production.
- Configure `BACKEND_ROOT_CA` on each ESP32; do not define `ALLOW_INSECURE_TLS`.
- Add a durable job queue for video/IPFS/blockchain processing so crashes do not lose work.
- Implement persistent ESP32 offline buffering and retry.
- Keep IPFS uploads on direct maintained HTTP clients; do not reintroduce the deprecated Pinata SDK dependency.
- Keep the frontend on Vite or another maintained build system; do not reintroduce deprecated `react-scripts`.
- Run Slither and a Solidity coverage report before paper submission.
