/**
 * AccidentEvidence.test.js — Hardhat Unit Tests
 * -----------------------------------------------
 * Validates the AccidentEvidence smart contract against all research-level
 * requirements:
 *   1. Access control (only authorised nodes may submit records)
 *   2. Owner management (authorise / revoke / transfer ownership)
 *   3. Evidence storage (correct CID, hash, vehicleId, timestamp)
 *   4. Event emission (RecordAdded indexed for off-chain indexing)
 *   5. On-chain CID verification (verifyCID helper function)
 *   6. Input validation (reject empty strings)
 *
 * Run: npx hardhat test
 */

const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("AccidentEvidence", function () {

    // ── Fixtures ─────────────────────────────────────────────────────────────

    async function deployFixture() {
        const [owner, authorisedNode, unauthorisedNode, newOwner] =
            await ethers.getSigners();

        const Factory  = await ethers.getContractFactory("AccidentEvidence");
        const contract = await Factory.deploy();
        await contract.waitForDeployment();

        return { contract, owner, authorisedNode, unauthorisedNode, newOwner };
    }

    // Sample evidence payload (mirrors what the backend sends)
    const SAMPLE = {
        cid:       "QmXyzABCDEFGHIJKL1234567890abcdef",
        jsonHash:  "a3f1c2d4e5b6789012345678abcdef0123456789abcdef0123456789abcdef01",
        vehicleId: "AP09XX1234",
        timestamp: 1713180000   // Unix epoch
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DEPLOYMENT
    // ─────────────────────────────────────────────────────────────────────────

    describe("Deployment", function () {
        it("should set the deployer as owner", async function () {
            const { contract, owner } = await deployFixture();
            expect(await contract.owner()).to.equal(owner.address);
        });

        it("should auto-authorise the deployer as a node", async function () {
            const { contract, owner } = await deployFixture();
            expect(await contract.authorisedNodes(owner.address)).to.be.true;
        });

        it("should start with zero records", async function () {
            const { contract } = await deployFixture();
            expect(await contract.getTotalRecords()).to.equal(0n);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ACCESS CONTROL — NODE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    describe("Access Control — Node Management", function () {
        it("owner can authorise a new node", async function () {
            const { contract, authorisedNode } = await deployFixture();
            await expect(contract.authoriseNode(authorisedNode.address))
                .to.emit(contract, "NodeAuthorised")
                .withArgs(authorisedNode.address);
            expect(await contract.authorisedNodes(authorisedNode.address)).to.be.true;
        });

        it("owner can revoke a node", async function () {
            const { contract, authorisedNode } = await deployFixture();
            await contract.authoriseNode(authorisedNode.address);
            await expect(contract.revokeNode(authorisedNode.address))
                .to.emit(contract, "NodeRevoked")
                .withArgs(authorisedNode.address);
            expect(await contract.authorisedNodes(authorisedNode.address)).to.be.false;
        });

        it("non-owner cannot authorise nodes", async function () {
            const { contract, unauthorisedNode } = await deployFixture();
            await expect(
                contract.connect(unauthorisedNode).authoriseNode(unauthorisedNode.address)
            ).to.be.revertedWith("AccidentEvidence: caller is not the owner");
        });

        it("rejects authorising zero address", async function () {
            const { contract } = await deployFixture();
            await expect(
                contract.authoriseNode(ethers.ZeroAddress)
            ).to.be.revertedWith("AccidentEvidence: zero address");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ACCESS CONTROL — EVIDENCE SUBMISSION
    // ─────────────────────────────────────────────────────────────────────────

    describe("Access Control — Evidence Submission", function () {
        it("unauthorised caller cannot submit records", async function () {
            const { contract, unauthorisedNode } = await deployFixture();
            await expect(
                contract.connect(unauthorisedNode).addEvidenceRecord(
                    SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
                )
            ).to.be.revertedWith("AccidentEvidence: caller is not an authorised node");
        });

        it("authorised node (owner) can submit a record", async function () {
            const { contract } = await deployFixture();
            await expect(
                contract.addEvidenceRecord(
                    SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
                )
            ).not.to.be.reverted;
        });

        it("explicitly authorised node can submit a record", async function () {
            const { contract, authorisedNode } = await deployFixture();
            await contract.authoriseNode(authorisedNode.address);
            await expect(
                contract.connect(authorisedNode).addEvidenceRecord(
                    SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
                )
            ).not.to.be.reverted;
        });

        it("revoked node cannot submit after revocation", async function () {
            const { contract, authorisedNode } = await deployFixture();
            await contract.authoriseNode(authorisedNode.address);
            await contract.revokeNode(authorisedNode.address);
            await expect(
                contract.connect(authorisedNode).addEvidenceRecord(
                    SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
                )
            ).to.be.revertedWith("AccidentEvidence: caller is not an authorised node");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. INPUT VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    describe("Input Validation", function () {
        it("rejects empty CID", async function () {
            const { contract } = await deployFixture();
            await expect(
                contract.addEvidenceRecord("", SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp)
            ).to.be.revertedWith("AccidentEvidence: empty CID");
        });

        it("rejects empty hash", async function () {
            const { contract } = await deployFixture();
            await expect(
                contract.addEvidenceRecord(SAMPLE.cid, "", SAMPLE.vehicleId, SAMPLE.timestamp)
            ).to.be.revertedWith("AccidentEvidence: empty hash");
        });

        it("rejects empty vehicleId", async function () {
            const { contract } = await deployFixture();
            await expect(
                contract.addEvidenceRecord(SAMPLE.cid, SAMPLE.jsonHash, "", SAMPLE.timestamp)
            ).to.be.revertedWith("AccidentEvidence: empty vehicleId");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. EVIDENCE STORAGE CORRECTNESS
    // ─────────────────────────────────────────────────────────────────────────

    describe("Evidence Storage", function () {
        it("stores the correct CID, hash, vehicleId and timestamp", async function () {
            const { contract, owner } = await deployFixture();
            await contract.addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
            );

            const [ cid, jsonHash, vehicleId, timestamp, uploadedBy ] =
                await contract.getRecord(0);

            expect(cid).to.equal(SAMPLE.cid);
            expect(jsonHash).to.equal(SAMPLE.jsonHash);
            expect(vehicleId).to.equal(SAMPLE.vehicleId);
            expect(Number(timestamp)).to.equal(SAMPLE.timestamp);
            expect(uploadedBy).to.equal(owner.address);
        });

        it("increments total record count correctly", async function () {
            const { contract } = await deployFixture();
            expect(await contract.getTotalRecords()).to.equal(0n);
            await contract.addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
            );
            expect(await contract.getTotalRecords()).to.equal(1n);
            await contract.addEvidenceRecord(
                "QmAnotherCID", SAMPLE.jsonHash, "MH01AB5678", SAMPLE.timestamp + 100
            );
            expect(await contract.getTotalRecords()).to.equal(2n);
        });

        it("out-of-bounds getRecord reverts", async function () {
            const { contract } = await deployFixture();
            await expect(contract.getRecord(0))
                .to.be.revertedWith("AccidentEvidence: index out of bounds");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. EVENT EMISSION
    // ─────────────────────────────────────────────────────────────────────────

    describe("Event Emission", function () {
        it("emits RecordAdded with correct args on submission", async function () {
            const { contract, owner } = await deployFixture();
            await expect(
                contract.addEvidenceRecord(
                    SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
                )
            )
            .to.emit(contract, "RecordAdded")
            .withArgs(0n, SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId,
                      SAMPLE.timestamp, owner.address);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. ON-CHAIN CID VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────

    describe("verifyCID", function () {
        it("returns (true, index) for a stored CID", async function () {
            const { contract } = await deployFixture();
            await contract.addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp
            );
            const [ found, index ] = await contract.verifyCID(SAMPLE.cid);
            expect(found).to.be.true;
            expect(Number(index)).to.equal(0);
        });

        it("returns (false, 0) for an unknown CID", async function () {
            const { contract } = await deployFixture();
            const [ found ] = await contract.verifyCID("QmUnknownCID");
            expect(found).to.be.false;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. OWNERSHIP TRANSFER
    // ─────────────────────────────────────────────────────────────────────────

    describe("Ownership Transfer", function () {
        it("owner can transfer ownership", async function () {
            const { contract, newOwner } = await deployFixture();
            await expect(contract.transferOwnership(newOwner.address))
                .to.emit(contract, "OwnershipTransferred");
            expect(await contract.owner()).to.equal(newOwner.address);
        });

        it("previous owner loses owner privileges after transfer", async function () {
            const { contract, owner, newOwner } = await deployFixture();
            await contract.transferOwnership(newOwner.address);
            await expect(
                contract.connect(owner).authoriseNode(owner.address)
            ).to.be.revertedWith("AccidentEvidence: caller is not the owner");
        });
    });

});
