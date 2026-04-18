// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  AccidentEvidence  v2.0
 * @notice Immutable, tamper-proof registry for vehicular accident evidence
 *         with on-chain RBAC, chain-of-custody logging, ECDSA signature
 *         enforcement, and duplicate-hash detection.
 *
 * @dev    Architecture: ESP32 sensors → Node.js backend (authorised node) →
 *         this contract → Sepolia Testnet.  Evidence metadata (IPFS CID +
 *         SHA-256 hash) is anchored here; raw data lives on IPFS.
 *
 *         v2.0 additions (research paper contributions):
 *           1. On-chain RBAC  (None / Viewer / Investigator / Admin)
 *           2. Chain-of-custody event log  (gas-optimised: events + minimal state)
 *           3. ECDSA signature enforcement (non-repudiation)
 *           4. Duplicate-hash detection    (replay-attack mitigation)
 *
 * Research context: EvidenceChain — Blockchain-Based Forensic Evidence
 * Management for Vehicular Accidents (2026).
 */
contract AccidentEvidence {

    // ────────────────────────────────────────────────────────────────────────
    //  RBAC  (Role-Based Access Control)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Role hierarchy (higher value = more privileges):
     *   0 = None     — no special permissions (public reads still allowed)
     *   1 = Viewer   — read-only (future: gated views)
     *   2 = Investigator — can access evidence + custody actions
     *   3 = Admin    — can manage roles
     */
    mapping(address => uint8) public roles;

    modifier onlyRole(uint8 minRole) {
        require(roles[msg.sender] >= minRole, "AccidentEvidence: insufficient role");
        _;
    }

    modifier onlyInvestigator() {
        require(roles[msg.sender] >= 2, "AccidentEvidence: caller is not an investigator");
        _;
    }

    modifier onlyAdmin() {
        require(
            roles[msg.sender] >= 3 || msg.sender == owner,
            "AccidentEvidence: caller is not an admin"
        );
        _;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  STATE
    // ────────────────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Nodes permitted to submit evidence (e.g. the backend server wallet)
    mapping(address => bool) public authorisedNodes;

    struct Record {
        string  cid;            // IPFS Content Identifier of the forensic package
        string  jsonHash;       // SHA-256 hex digest of the JSON evidence payload
        string  vehicleId;      // Vehicle registration / device identifier
        uint256 timestamp;      // Unix epoch of the collision event
        address uploadedBy;     // Address of the authorised node that submitted
        bytes   signature;      // ECDSA signature of the evidence digest
    }

    Record[] public records;

    // ── Duplicate-hash tracking ──────────────────────────────────────────────
    mapping(bytes32 => bool) public hashAnchored;
    mapping(bytes32 => uint256) private cidIndexPlusOne;

    // ── Chain-of-custody: minimal on-chain state (gas efficient) ─────────────
    enum CustodyAction  { Created, Accessed, Transferred, StatusChanged, Disputed, Resolved }
    enum CustodyStatus  { Active, UnderInvestigation, Transferred, Disputed, Resolved }

    mapping(uint256 => address)       public currentCustodian;
    mapping(uint256 => CustodyStatus) public currentStatus;

    // ────────────────────────────────────────────────────────────────────────
    //  EVENTS
    // ────────────────────────────────────────────────────────────────────────

    event RecordAdded(
        uint256 indexed index,
        string  cid,
        string  jsonHash,
        string  indexed vehicleId,
        uint256 timestamp,
        address indexed uploadedBy
    );

    event NodeAuthorised(address indexed node);
    event NodeRevoked(address indexed node);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // RBAC events
    event RoleGranted(address indexed account, uint8 role);
    event RoleRevoked(address indexed account);

    // Chain-of-custody events (PRIMARY history — cheap, indexed, off-chain queryable)
    event CustodyEvent(
        uint256 indexed recordIndex,
        CustodyAction   action,
        address indexed actor,
        uint256         timestamp,
        string          detail
    );

    // Duplicate / replay detection
    event DuplicateHashWarning(
        uint256 indexed newIndex,
        bytes32 indexed hashDigest,
        address indexed submitter
    );

    // ────────────────────────────────────────────────────────────────────────
    //  MODIFIERS  (legacy)
    // ────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AccidentEvidence: caller is not the owner");
        _;
    }

    modifier onlyAuthorised() {
        require(
            authorisedNodes[msg.sender],
            "AccidentEvidence: caller is not an authorised node"
        );
        _;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  CONSTRUCTOR
    // ────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;

        // Auto-authorise deployer as a submission node
        authorisedNodes[msg.sender] = true;
        emit NodeAuthorised(msg.sender);

        // Grant Admin role to deployer
        roles[msg.sender] = 3;
        emit RoleGranted(msg.sender, 3);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  ADMIN: NODE MANAGEMENT  (legacy — preserved for backward compat)
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Grant submission rights to a backend gateway node.
    function authoriseNode(address node) external onlyOwner {
        require(node != address(0), "AccidentEvidence: zero address");
        authorisedNodes[node] = true;
        emit NodeAuthorised(node);
    }

    /// @notice Revoke submission rights from a node.
    function revokeNode(address node) external onlyOwner {
        authorisedNodes[node] = false;
        emit NodeRevoked(node);
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AccidentEvidence: zero address");
        emit OwnershipTransferred(owner, newOwner);
        roles[owner] = 0;
        owner = newOwner;
        roles[newOwner] = 3;
        emit RoleRevoked(msg.sender);
        emit RoleGranted(newOwner, 3);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  ADMIN: RBAC ROLE MANAGEMENT
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Grant a role to an account. Only admin or owner may call.
    /// @param  account  The address to grant the role to
    /// @param  role     Role level: 1=Viewer, 2=Investigator, 3=Admin
    function grantRole(address account, uint8 role) external onlyAdmin {
        require(account != address(0), "AccidentEvidence: zero address");
        require(role >= 1 && role <= 3, "AccidentEvidence: invalid role (1-3)");
        roles[account] = role;
        emit RoleGranted(account, role);
    }

    /// @notice Revoke all roles from an account.
    function revokeRole(address account) external onlyAdmin {
        require(account != address(0), "AccidentEvidence: zero address");
        roles[account] = 0;
        emit RoleRevoked(account);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  CORE: EVIDENCE SUBMISSION  (with signature enforcement)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchor evidence metadata on-chain with ECDSA signature enforcement.
     * @param  _cid        IPFS CID of the forensic video/JSON package.
     * @param  _jsonHash   SHA-256 hex hash of the JSON evidence payload.
     * @param  _vehicleId  Vehicle / device identifier string.
     * @param  _timestamp  Unix timestamp of the collision event (seconds).
     * @param  _signature  ECDSA signature of keccak256(jsonHash, cid, vehicleId, timestamp)
     *                     signed by the calling node's private key.
     *
     * @dev    The signature is verified on-chain via ecrecover.  If the recovered
     *         address does not match msg.sender, the transaction reverts.
     *         This ensures non-repudiation: the submitter provably signed the data.
     *
     *         Duplicate hashes are allowed (legitimate re-anchor) but emit a
     *         DuplicateHashWarning event for off-chain monitoring.
     */
    function addEvidenceRecord(
        string memory _cid,
        string memory _jsonHash,
        string memory _vehicleId,
        uint256       _timestamp,
        bytes  memory _signature
    ) external onlyAuthorised {
        require(bytes(_cid).length       > 0, "AccidentEvidence: empty CID");
        require(bytes(_jsonHash).length  > 0, "AccidentEvidence: empty hash");
        require(bytes(_vehicleId).length > 0, "AccidentEvidence: empty vehicleId");
        require(_signature.length == 65,       "AccidentEvidence: invalid signature length");

        // ── Signature verification (non-repudiation) ─────────────────────────
        _verifySubmitterSignature(_jsonHash, _cid, _vehicleId, _timestamp, _signature);

        // ── Duplicate-hash detection ─────────────────────────────────────────
        {
            bytes32 hashDigest = keccak256(bytes(_jsonHash));
            if (hashAnchored[hashDigest]) {
                emit DuplicateHashWarning(records.length, hashDigest, msg.sender);
            }
            hashAnchored[hashDigest] = true;
        }

        // ── Store record ─────────────────────────────────────────────────────
        records.push(Record({
            cid:        _cid,
            jsonHash:   _jsonHash,
            vehicleId:  _vehicleId,
            timestamp:  _timestamp,
            uploadedBy: msg.sender,
            signature:  _signature
        }));

        uint256 idx = records.length - 1;
        cidIndexPlusOne[keccak256(bytes(_cid))] = idx + 1;
        emit RecordAdded(idx, _cid, _jsonHash, _vehicleId, _timestamp, msg.sender);

        // ── Auto-log custody "Created" event ─────────────────────────────────
        currentCustodian[idx] = msg.sender;
        currentStatus[idx]    = CustodyStatus.Active;
        emit CustodyEvent(idx, CustodyAction.Created, msg.sender, block.timestamp, "Evidence anchored");
    }

    // ────────────────────────────────────────────────────────────────────────
    //  CHAIN OF CUSTODY
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Log a custody action for an evidence record.
     * @dev    Primary history is stored via events (cheap).
     *         Only updates on-chain state for status changes.
     */
    function logCustodyEvent(
        uint256       recordIndex,
        CustodyAction action,
        string memory detail
    ) external onlyInvestigator {
        require(recordIndex < records.length, "AccidentEvidence: index out of bounds");

        emit CustodyEvent(recordIndex, action, msg.sender, block.timestamp, detail);

        // Update on-chain status if action implies a status change
        if (action == CustodyAction.Disputed) {
            currentStatus[recordIndex] = CustodyStatus.Disputed;
        } else if (action == CustodyAction.Resolved) {
            currentStatus[recordIndex] = CustodyStatus.Resolved;
        } else if (action == CustodyAction.StatusChanged) {
            currentStatus[recordIndex] = CustodyStatus.UnderInvestigation;
        }
    }

    /**
     * @notice Transfer custody of an evidence record to a new custodian.
     */
    function transferCustody(
        uint256       recordIndex,
        address       newCustodian,
        string memory detail
    ) external onlyInvestigator {
        require(recordIndex < records.length, "AccidentEvidence: index out of bounds");
        require(newCustodian != address(0),   "AccidentEvidence: zero address");

        currentCustodian[recordIndex] = newCustodian;
        currentStatus[recordIndex]    = CustodyStatus.Transferred;

        emit CustodyEvent(recordIndex, CustodyAction.Transferred, msg.sender, block.timestamp, detail);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  QUERIES
    // ────────────────────────────────────────────────────────────────────────

    function getRecord(uint256 index) external view returns (
        string  memory cid,
        string  memory jsonHash,
        string  memory vehicleId,
        uint256        timestamp,
        address        uploadedBy,
        bytes   memory signature
    ) {
        require(index < records.length, "AccidentEvidence: index out of bounds");
        Record memory r = records[index];
        return (r.cid, r.jsonHash, r.vehicleId, r.timestamp, r.uploadedBy, r.signature);
    }

    function getTotalRecords() external view returns (uint256) {
        return records.length;
    }

    /// @notice Check whether a given CID exists on-chain.
    function verifyCID(string memory _cid) external view returns (bool found, uint256 index) {
        uint256 indexPlusOne = cidIndexPlusOne[keccak256(bytes(_cid))];
        if (indexPlusOne != 0) {
            return (true, indexPlusOne - 1);
        }
        return (false, 0);
    }

    /// @notice Check whether a hash has already been anchored.
    function isHashAnchored(string memory _jsonHash) external view returns (bool) {
        return hashAnchored[keccak256(bytes(_jsonHash))];
    }

    /// @notice Verify the stored signature for a record matches its data.
    function verifyRecordSignature(uint256 index) external view returns (
        bool   valid,
        address signer
    ) {
        require(index < records.length, "AccidentEvidence: index out of bounds");
        Record storage rec = records[index];

        address recovered = _recoverSigner(rec.jsonHash, rec.cid, rec.vehicleId, rec.timestamp, rec.signature);
        return (recovered == rec.uploadedBy, recovered);
    }

    /// @notice Get current custody info for a record.
    function getCustodyInfo(uint256 index) external view returns (
        address       custodian,
        CustodyStatus status
    ) {
        require(index < records.length, "AccidentEvidence: index out of bounds");
        return (currentCustodian[index], currentStatus[index]);
    }

    /// @notice Get the role of an address.
    function getRole(address account) external view returns (uint8) {
        return roles[account];
    }

    // ────────────────────────────────────────────────────────────────────────
    //  INTERNAL: Signature Helpers
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @dev Verify that _signature was produced by msg.sender over the evidence digest.
     *      Reverts if the recovered address does not match msg.sender.
     */
    function _verifySubmitterSignature(
        string memory _jsonHash,
        string memory _cid,
        string memory _vehicleId,
        uint256       _timestamp,
        bytes  memory _signature
    ) internal view {
        bytes32 digest  = keccak256(abi.encodePacked(_jsonHash, _cid, _vehicleId, _timestamp));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);
        address recovered = ecrecover(ethHash, v, r, s);
        require(recovered == msg.sender, "AccidentEvidence: invalid signature");
    }

    /**
     * @dev Recover signer address from an evidence digest + signature.
     *      Used by verifyRecordSignature (view function).
     */
    function _recoverSigner(
        string memory _jsonHash,
        string memory _cid,
        string memory _vehicleId,
        uint256       _timestamp,
        bytes  memory _signature
    ) internal pure returns (address) {
        bytes32 digest  = keccak256(abi.encodePacked(_jsonHash, _cid, _vehicleId, _timestamp));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);
        return ecrecover(ethHash, v, r, s);
    }

    /**
     * @dev Split a 65-byte ECDSA signature into (r, s, v) components.
     */
    function _splitSignature(bytes memory sig) internal pure returns (
        bytes32 r,
        bytes32 s,
        uint8   v
    ) {
        require(sig.length == 65, "AccidentEvidence: invalid sig length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        // Normalise v to 27/28
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "AccidentEvidence: invalid v value");
    }
}
