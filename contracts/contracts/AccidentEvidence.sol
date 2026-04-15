// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  AccidentEvidence
 * @notice Immutable, tamper-proof registry for vehicular accident evidence.
 *         Only whitelisted IoT gateway nodes (authorised by the contract owner)
 *         may submit evidence records, preventing unauthorised writes.
 *
 * @dev    Architecture: ESP32 sensors → Node.js backend (authorised node) →
 *         this contract → Sepolia Testnet.  Evidence metadata (IPFS CID +
 *         SHA-256 hash) is anchored here; raw data lives on IPFS.
 *
 * Research context: EvidenceChain — Blockchain-Based Forensic Evidence
 * Management for Vehicular Accidents (2026).
 */
contract AccidentEvidence {

    // ────────────────────────────────────────────────────────────────────────
    //  STATE
    // ────────────────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Nodes permitted to submit evidence (e.g. the backend server wallet)
    mapping(address => bool) public authorisedNodes;

    struct Record {
        string  cid;         // IPFS Content Identifier of the forensic package
        string  jsonHash;    // SHA-256 hex digest of the JSON evidence payload
        string  vehicleId;   // Vehicle registration / device identifier
        uint256 timestamp;   // Unix epoch of the collision event
        address uploadedBy;  // Address of the authorised node that submitted
    }

    Record[] public records;

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

    // ────────────────────────────────────────────────────────────────────────
    //  MODIFIERS
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
        // Automatically authorise the deploying wallet so the backend can
        // submit records immediately after deployment.
        authorisedNodes[msg.sender] = true;
        emit NodeAuthorised(msg.sender);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  ADMIN: NODE MANAGEMENT
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
        owner = newOwner;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  CORE: EVIDENCE SUBMISSION
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchor evidence metadata on-chain.
     * @param  _cid        IPFS CID of the forensic video/JSON package.
     * @param  _jsonHash   SHA-256 hex hash of the JSON evidence payload.
     * @param  _vehicleId  Vehicle / device identifier string.
     * @param  _timestamp  Unix timestamp of the collision event (seconds).
     *
     * @dev    Only authorised nodes may call this function.  The CID and hash
     *         together allow any verifier to re-download from IPFS and confirm
     *         data integrity without trusting the backend server.
     */
    function addEvidenceRecord(
        string memory _cid,
        string memory _jsonHash,
        string memory _vehicleId,
        uint256       _timestamp
    ) external onlyAuthorised {
        require(bytes(_cid).length      > 0, "AccidentEvidence: empty CID");
        require(bytes(_jsonHash).length > 0, "AccidentEvidence: empty hash");
        require(bytes(_vehicleId).length > 0, "AccidentEvidence: empty vehicleId");

        records.push(Record({
            cid:        _cid,
            jsonHash:   _jsonHash,
            vehicleId:  _vehicleId,
            timestamp:  _timestamp,
            uploadedBy: msg.sender
        }));

        uint256 idx = records.length - 1;
        emit RecordAdded(idx, _cid, _jsonHash, _vehicleId, _timestamp, msg.sender);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  QUERIES
    // ────────────────────────────────────────────────────────────────────────

    function getRecord(uint256 index) external view returns (
        string  memory cid,
        string  memory jsonHash,
        string  memory vehicleId,
        uint256        timestamp,
        address        uploadedBy
    ) {
        require(index < records.length, "AccidentEvidence: index out of bounds");
        Record memory r = records[index];
        return (r.cid, r.jsonHash, r.vehicleId, r.timestamp, r.uploadedBy);
    }

    function getTotalRecords() external view returns (uint256) {
        return records.length;
    }

    /// @notice Check whether a given CID exists on-chain.
    function verifyCID(string memory _cid) external view returns (bool found, uint256 index) {
        for (uint256 i = records.length; i > 0; i--) {
            if (keccak256(bytes(records[i - 1].cid)) == keccak256(bytes(_cid))) {
                return (true, i - 1);
            }
        }
        return (false, 0);
    }
}