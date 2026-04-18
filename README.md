# EvidenceChain: Blockchain-Based Forensic Evidence Management

## 1. Project Title & Overview

**EvidenceChain** is an end-to-end, immutable, and cryptographically secure forensic evidence management system designed for vehicular accidents. 

When a vehicular accident occurs, crucial data—such as sensor telemetry (speed, impact force, location) and video dashcam footage—is often vulnerable to tampering, loss, or jurisdictional disputes. EvidenceChain solves this problem by autonomously collecting telemetry from an on-board IoT device, generating an immutable cryptographic package, anchoring the metadata on the Ethereum blockchain (Sepolia Testnet), and storing the bulky evidence files on IPFS. This guarantees a mathematically verifiable, tamper-proof chain of custody from the moment of impact to the courtroom.

## 2. Key Features

*   **Autonomous IoT Triggering:** ESP32-based hardware automatically detects collisions and securely transmits encrypted sensor data to the backend gateway.
*   **Decentralized Storage (IPFS):** Large media files (dashcam videos) and forensic JSON metadata are stored immutably on the InterPlanetary File System via Pinata.
*   **Blockchain Immutability:** Uses an Ethereum smart contract (Sepolia Testnet) to anchor the IPFS Content Identifier (CID) and a SHA-256 hash of the evidence.
*   **Non-Repudiation (ECDSA):** Evidence payloads are signed cryptographically by the gateway node using Elliptic Curve Digital Signature Algorithm (ECDSA) prior to on-chain anchoring.
*   **Role-Based Access Control (RBAC):** On-chain permissions restrict viewing, investigating, and administrative capabilities to authorized personnel.
*   **Cryptographic Chain of Custody:** The system tracks evidence transfers and status changes directly on the blockchain, generating a verifiable audit trail.
*   **Replay-Attack Mitigation:** Enforces duplicate-hash detection on-chain to prevent malicious replay or double-submitting of identical collision events.

## 3. System Architecture

The architecture is divided into five distinct layers that ensure separation of concerns and robust security:

*   **IoT / Input Layer:** An ESP32 microcontroller outfitted with accelerometers and GPS modules (or simulated feeds). It detects high-G impacts and securely initiates the pipeline over Wi-Fi.
*   **Backend Layer:** A Node.js/Express gateway that acts as a secure intermediary. It ingests IoT data, validates API keys, coordinates IPFS pinning, signs the payload (ECDSA), and submits the transaction to the blockchain.
*   **Storage Layer:** IPFS (via Pinata) handles the decentralized storage of bulky video files and structured JSON evidence packages, returning a unique CID.
*   **Blockchain Layer:** An Ethereum Smart Contract deployed on the Sepolia Testnet. It serves as the ultimate source of truth, enforcing RBAC, storing CIDs, and maintaining the chain-of-custody event log.
*   **Frontend Layer:** A React.js application powered by Vite. It provides an intuitive dashboard for investigators to view cases, playback video, verify signatures, and track custody timelines.

## 4. Complete Workflow (Step-by-Step)

1.  **Collision Event:** The ESP32 sensor detects an impact exceeding the defined threshold and captures pre-and-post-impact telemetry and GPS data.
2.  **Secure Transmission:** The ESP32 sends a payload to the Node.js backend over an encrypted connection, authenticated via a hardware-specific API Key.
3.  **Data Ingestion & Packaging:** The backend receives the telemetry, retrieves the associated dashcam video buffer, and packages everything into a structured JSON "Forensic Package."
4.  **IPFS Pinning:** The backend uploads the video and the JSON package to IPFS via Pinata. Pinata returns an immutable Content Identifier (CID).
5.  **Cryptographic Signing:** The backend calculates the SHA-256 hash of the evidence package and signs a digest (combining the hash, CID, vehicle ID, and timestamp) using its private ECDSA key.
6.  **Blockchain Anchoring:** The backend submits a transaction to the Sepolia Smart Contract containing the CID, SHA-256 hash, and the ECDSA signature.
7.  **Contract Verification:** The smart contract verifies the ECDSA signature (ecrecover), checks for duplicate hashes, and stores the record on-chain, emitting a `RecordAdded` event.
8.  **Frontend Retrieval:** An investigator logs into the React dashboard. The frontend queries the smart contract for the record list, fetches the raw data from IPFS using the CID, and verifies the ECDSA signature locally to assure the investigator the data has not been tampered with.

## 5. Project Structure (Folder Breakdown)

```text
EvidenceChain/
│
├── backend/                  # Node.js Express Gateway
│   ├── certs/                # SSL certificates for HTTPS communication
│   ├── config/               # Firebase & Environment configurations
│   ├── controllers/          # Route logic (accident, custody, verify)
│   ├── evaluation/           # Scripts for gas analysis and tamper testing
│   ├── middleware/           # Security (Helmet, CORS) and API Key validation
│   ├── routes/               # Express API routing endpoints
│   ├── services/             # Core logic (Blockchain, IPFS, Signatures)
│   ├── app.js / server.js    # Express app setup and server entry point
│   └── sensorSimulator.js    # Utility to simulate ESP32 hardware triggers
│
├── contracts/                # Hardhat Ethereum Smart Contracts
│   ├── contracts/            # Solidity source files (AccidentEvidence.sol)
│   ├── scripts/              # Deployment scripts for Sepolia
│   ├── test/                 # Unit tests for smart contract logic
│   └── hardhat.config.js     # Hardhat configuration and network setup
│
├── esp32/                    # IoT Hardware Firmware
│   └── EvidenceChain_Sensor/ # Arduino C++ code for ESP32 microcontroller
│
├── frontend/                 # React.js UI Dashboard
│   ├── public/               # Static assets
│   ├── src/                  # React components, pages, services, and routing
│   ├── index.html            # Entry HTML file
│   └── vite.config.js        # Vite bundler configuration
│
├── data/                     # Evaluation results (Gas analysis, Tamper tests)
├── SECURITY_DEPLOYMENT_CHECKLIST.md # Deployment security protocol
└── STRIDE_threat_model.md    # Formal STRIDE security analysis
```

## 6. Technologies Used

*   **IoT:** C++ / Arduino Framework (ESP32)
*   **Backend:** Node.js, Express.js, Ethers.js (v6), Helmet, Firebase Admin (for Auth).
*   **Storage:** IPFS, Pinata API.
*   **Blockchain:** Solidity (^0.8.20), Hardhat, Ethereum Sepolia Testnet, Alchemy RPC.
*   **Frontend:** React 19, Vite, React Router, Leaflet (Mapping), Ethers.js (Web3 integration).

## 7. Smart Contract Explanation

**Contract Name:** `AccidentEvidence.sol` (v2.0)

*   **Key Functions:**
    *   `addEvidenceRecord()`: Anchors the CID, SHA-256 hash, and verifies the ECDSA signature submitted by the authorized backend node.
    *   `logCustodyEvent()` / `transferCustody()`: Updates the chain-of-custody status and transfers the active custodian of a record.
    *   `grantRole()` / `revokeRole()`: Manages the on-chain RBAC system (Viewer, Investigator, Admin).
*   **Data Stored:** Struct containing `cid`, `jsonHash`, `vehicleId`, `timestamp`, `uploadedBy` (address), and the ECDSA `signature`.
*   **Events:** `RecordAdded`, `CustodyEvent` (for cheap, off-chain history querying), `DuplicateHashWarning`, `RoleGranted`.
*   **Security Logic:** `_verifySubmitterSignature` uses `ecrecover` to ensure the submitting node owns the private key that signed the payload. `hashAnchored` mapping prevents duplicate evidence from being anchored twice.

## 8. Backend Architecture

The backend serves as a highly secure bridge between the resource-constrained IoT devices and the blockchain.

*   **Services:** 
    *   `ipfsService.js`: Handles communication with Pinata to pin files and JSON metadata.
    *   `blockchainService.js`: Connects to Sepolia via Alchemy, managing the wallet and nonce for transaction submission.
    *   `signatureService.js`: Generates the ECDSA signature over the keccak256 hash of the payload to guarantee non-repudiation.
*   **APIs:** RESTful endpoints for receiving impact data (`/api/impact`), retrieving forensic data (`/api/verify`), and managing custody (`/api/custody`).
*   **Security Integrations:** Strict CORS policies, Helmet for HTTP header security, API key validation middleware for IoT requests, and Firebase Auth token verification for frontend requests.

## 9. Frontend Overview

The frontend is a Vite-powered React Single Page Application designed for forensic investigators.

*   **Pages:**
    *   `Dashboard.jsx`: Main grid displaying all anchored cases, mapping the contract state to a user-friendly UI.
    *   `CaseDetails.jsx`: Deep-dive into a specific case. Retrieves data from IPFS, plays dashcam video, displays telemetric graphs, and shows an interactive map (Leaflet).
    *   `Verify.jsx`: Cryptographic verification page where investigators can test the SHA-256 hash and ECDSA signatures locally.
*   **Key Components:** `CustodyTimeline` (visualizes the on-chain event log), `SignatureBadge` (displays cryptographic validity status).
*   **Data Flow:** The frontend strictly *reads* from the blockchain (using `ethers.js`) to find CIDs, then fetches the raw, unalterable data directly from the decentralized IPFS network.

## 10. Data Flow Diagram (Textual Explanation)

1.  **Hardware:** ESP32 records [Speed, G-Force, GPS] $\rightarrow$ sends to Backend via HTTPS POST.
2.  **Backend Processing:** Backend creates `evidence.json` $\rightarrow$ pushes video + JSON to **IPFS**.
3.  **IPFS Response:** Returns `CID_Video` and `CID_JSON`.
4.  **Backend Cryptography:** Backend hashes `evidence.json` $\rightarrow$ signs Hash+CID with Private Key.
5.  **Blockchain Anchoring:** Backend sends Transaction [CID, Hash, Signature] $\rightarrow$ **Sepolia Smart Contract**.
6.  **Frontend Viewing:** User requests Dashboard $\rightarrow$ Web App fetches Record List from **Smart Contract**.
7.  **Frontend Rendering:** Web App reads CID from Contract $\rightarrow$ pulls JSON & Video from **IPFS** $\rightarrow$ Renders UI.

## 11. Security & Integrity Features

*   **Cryptographic Hashing:** Every evidence package is hashed using SHA-256 before anchoring. Any 1-bit change in the IPFS file breaks the hash match.
*   **Blockchain Immutability:** Once the CID and Hash are committed to Sepolia, they cannot be altered or deleted, ensuring a permanent mathematical record.
*   **ECDSA Non-Repudiation:** The backend signs the payload data using elliptic curve cryptography. The smart contract natively verifies this via `ecrecover()`, proving definitively *which* node submitted the data.
*   **API Key Validation:** IoT inputs to the backend are gated by strict API key middleware, preventing arbitrary data injection.
*   **STRIDE Threat Model:** The system architecture has been formally analyzed against Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege threats.

## 12. Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   MetaMask (configured for Sepolia Testnet)
*   Alchemy API Key & Pinata API Keys

### Environment Setup
1.  Clone the repository:
    ```bash
    git clone https://github.com/sravanthbabu17/blockchain-evidence-management.git
    cd blockchain-evidence-management
    ```
2.  **Backend:**
    ```bash
    cd backend
    npm install
    # Copy .env.example to .env and populate keys (Alchemy, Pinata, Wallet Private Key)
    cp .env.example .env 
    ```
3.  **Frontend:**
    ```bash
    cd ../frontend
    npm install
    # Copy .env.example to .env and configure Firebase / Contract address
    cp .env.example .env
    ```

## 13. Usage Instructions

1.  **Start the Backend:**
    ```bash
    cd backend
    npm start
    ```
2.  **Start the Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
3.  **Simulate an Accident:**
    Run the simulator script to trigger the IoT pipeline programmatically:
    ```bash
    cd backend
    node sensorSimulator.js
    ```
4.  **Investigate:**
    Open the frontend (usually `http://localhost:5173`), log in, and view the freshly generated, blockchain-anchored case.

## 14. API Endpoints

*   `POST /api/impact/trigger`: Ingests IoT telemetry data (Requires API Key).
*   `GET /api/verify/list`: Returns a formatted list of all anchored cases (combines contract and IPFS data).
*   `GET /api/verify/record/:index`: Returns detailed data for a specific case index.
*   `POST /api/custody/event`: Logs a chain-of-custody event on the smart contract (Requires Investigator Auth).

## 15. Limitations

*   **Testnet Reliance:** The current deployment utilizes the Sepolia testnet. Production deployment requires Mainnet or a secure Layer-2 solution (e.g., Arbitrum, Optimism) for lower gas fees.
*   **Data Privacy:** Data stored on IPFS is currently public (obfuscated only by CID). Production systems handling PII require asymmetric encryption of the IPFS payload.
*   **Hardware Simulation:** Dashcam video is currently simulated via local backend buffers rather than direct camera stream processing from the ESP32 due to micro-controller bandwidth limits.

## 16. Future Improvements

*   **Payload Encryption:** Implement Lit Protocol or AES-256 to encrypt the IPFS payload, granting decryption keys exclusively to authorized investigators via the smart contract.
*   **Layer 2 Scaling:** Migrate from Sepolia to Polygon or Arbitrum to reduce transaction latency from ~12 seconds to sub-second speeds.
*   **Zero-Knowledge Proofs (ZKPs):** Integrate zk-SNARKs to allow investigators to prove a vehicle's speed exceeded a threshold without revealing the exact location or identity of the driver.

---
*EvidenceChain — A mathematically verifiable approach to forensic truth.*
