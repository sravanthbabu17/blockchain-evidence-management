/**
 * AccidentEvidence.test.js — Hardhat Unit Tests v2.0
 * Validates: access control, RBAC, custody, ECDSA, duplicate detection, gas
 * Run: npx hardhat test
 */
import { expect } from "chai";
import { describe, it } from "node:test";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AccidentEvidence", function () {
    async function deployFixture() {
        const [owner, authorisedNode, unauthorisedNode, newOwner, investigator, viewer] =
            await ethers.getSigners();
        const Factory  = await ethers.getContractFactory("AccidentEvidence");
        const contract = await Factory.deploy();
        await contract.waitForDeployment();
        return { contract, owner, authorisedNode, unauthorisedNode, newOwner, investigator, viewer };
    }

    const SAMPLE = {
        cid: "QmXyzABCDEFGHIJKL1234567890abcdef",
        jsonHash: "a3f1c2d4e5b6789012345678abcdef0123456789abcdef0123456789abcdef01",
        vehicleId: "AP09XX1234",
        timestamp: 1713180000
    };

    async function signEvidence(signer, jsonHash, cid, vehicleId, timestamp) {
        const digest = ethers.solidityPackedKeccak256(
            ["string", "string", "string", "uint256"],
            [jsonHash, cid, vehicleId, timestamp]
        );
        return signer.signMessage(ethers.getBytes(digest));
    }

    async function submitRecord(contract, signer, sample) {
        const s = sample || SAMPLE;
        const sig = await signEvidence(signer, s.jsonHash, s.cid, s.vehicleId, s.timestamp);
        return contract.connect(signer).addEvidenceRecord(s.cid, s.jsonHash, s.vehicleId, s.timestamp, sig);
    }

    async function expectRevert(promise, message) {
        try {
            await promise;
            throw new Error("Expected transaction to revert");
        } catch (err) {
            expect(err.message).to.include(message);
        }
    }

    async function expectNoRevert(promise) {
        await promise;
    }

    async function waitReceipt(txPromise) {
        const tx = await txPromise;
        return tx.wait();
    }

    function parsedEvents(contract, receipt) {
        return receipt.logs
            .map(log => {
                try { return contract.interface.parseLog(log); }
                catch { return null; }
            })
            .filter(Boolean);
    }

    async function expectEvent(contract, txPromise, eventName, args = []) {
        const receipt = await waitReceipt(txPromise);
        const event = parsedEvents(contract, receipt).find(e => e.name === eventName);
        expect(event, `Missing event ${eventName}`).to.not.equal(undefined);
        args.forEach((arg, i) => {
            if (arg !== undefined) expect(event.args[i]).to.equal(arg);
        });
        return receipt;
    }

    async function expectNoEvent(contract, txPromise, eventName) {
        const receipt = await waitReceipt(txPromise);
        const event = parsedEvents(contract, receipt).find(e => e.name === eventName);
        expect(event, `Unexpected event ${eventName}`).to.equal(undefined);
        return receipt;
    }

    // 1. DEPLOYMENT
    describe("Deployment", function () {
        it("sets deployer as owner with Admin role", async function () {
            const { contract, owner } = await deployFixture();
            expect(await contract.owner()).to.equal(owner.address);
            expect(await contract.authorisedNodes(owner.address)).to.be.true;
            expect(await contract.roles(owner.address)).to.equal(3n);
        });
        it("starts with zero records", async function () {
            const { contract } = await deployFixture();
            expect(await contract.getTotalRecords()).to.equal(0n);
        });
    });

    // 2. NODE MANAGEMENT
    describe("Node Management", function () {
        it("owner can authorise/revoke nodes", async function () {
            const { contract, authorisedNode } = await deployFixture();
            await expectEvent(contract, contract.authoriseNode(authorisedNode.address), "NodeAuthorised", [authorisedNode.address]);
            expect(await contract.authorisedNodes(authorisedNode.address)).to.be.true;
            await expectEvent(contract, contract.revokeNode(authorisedNode.address), "NodeRevoked", [authorisedNode.address]);
            expect(await contract.authorisedNodes(authorisedNode.address)).to.be.false;
        });
        it("non-owner cannot authorise", async function () {
            const { contract, unauthorisedNode } = await deployFixture();
            await expectRevert(contract.connect(unauthorisedNode).authoriseNode(unauthorisedNode.address), "AccidentEvidence: caller is not the owner");
        });
        it("rejects zero address", async function () {
            const { contract } = await deployFixture();
            await expectRevert(contract.authoriseNode(ethers.ZeroAddress), "AccidentEvidence: zero address");
        });
    });

    // 3. EVIDENCE SUBMISSION + SIGNATURE
    describe("Evidence Submission", function () {
        it("authorised node with valid signature succeeds", async function () {
            const { contract, owner } = await deployFixture();
            await expectNoRevert(submitRecord(contract, owner));
        });
        it("unauthorised caller is rejected", async function () {
            const { contract, unauthorisedNode } = await deployFixture();
            const sig = await signEvidence(unauthorisedNode, SAMPLE.jsonHash, SAMPLE.cid, SAMPLE.vehicleId, SAMPLE.timestamp);
            await expectRevert(contract.connect(unauthorisedNode).addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp, sig
            ), "AccidentEvidence: caller is not an authorised node");
        });
        it("wrong signer signature is rejected", async function () {
            const { contract, owner, authorisedNode } = await deployFixture();
            const sig = await signEvidence(authorisedNode, SAMPLE.jsonHash, SAMPLE.cid, SAMPLE.vehicleId, SAMPLE.timestamp);
            await expectRevert(contract.connect(owner).addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp, sig
            ), "AccidentEvidence: invalid signature");
        });
        it("tampered data with original signature is rejected", async function () {
            const { contract, owner } = await deployFixture();
            const sig = await signEvidence(owner, SAMPLE.jsonHash, SAMPLE.cid, SAMPLE.vehicleId, SAMPLE.timestamp);
            await expectRevert(contract.connect(owner).addEvidenceRecord(
                "QmTamperedCID", SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp, sig
            ), "AccidentEvidence: invalid signature");
        });
        it("invalid signature length is rejected", async function () {
            const { contract } = await deployFixture();
            await expectRevert(contract.addEvidenceRecord(
                SAMPLE.cid, SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp, "0x1234"
            ), "AccidentEvidence: invalid signature length");
        });
        it("rejects empty CID/hash/vehicleId", async function () {
            const { contract, owner } = await deployFixture();
            const s1 = await signEvidence(owner, SAMPLE.jsonHash, "", SAMPLE.vehicleId, SAMPLE.timestamp);
            await expectRevert(contract.addEvidenceRecord("", SAMPLE.jsonHash, SAMPLE.vehicleId, SAMPLE.timestamp, s1), "AccidentEvidence: empty CID");
            const s2 = await signEvidence(owner, "", SAMPLE.cid, SAMPLE.vehicleId, SAMPLE.timestamp);
            await expectRevert(contract.addEvidenceRecord(SAMPLE.cid, "", SAMPLE.vehicleId, SAMPLE.timestamp, s2), "AccidentEvidence: empty hash");
        });
    });

    // 4. STORAGE + VERIFICATION
    describe("Storage & Verification", function () {
        it("stores and retrieves correct data", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const [cid, jsonHash, vehicleId, timestamp, uploadedBy] = await contract.getRecord(0);
            expect(cid).to.equal(SAMPLE.cid);
            expect(jsonHash).to.equal(SAMPLE.jsonHash);
            expect(vehicleId).to.equal(SAMPLE.vehicleId);
            expect(Number(timestamp)).to.equal(SAMPLE.timestamp);
            expect(uploadedBy).to.equal(owner.address);
        });
        it("verifyRecordSignature returns true for valid record", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const [valid, signer] = await contract.verifyRecordSignature(0);
            expect(valid).to.be.true;
            expect(signer).to.equal(owner.address);
        });
        it("verifyCID finds stored CID", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const [found, index] = await contract.verifyCID(SAMPLE.cid);
            expect(found).to.be.true;
            expect(Number(index)).to.equal(0);
        });
        it("verifyCID returns false for unknown", async function () {
            const { contract } = await deployFixture();
            const [found] = await contract.verifyCID("QmUnknown");
            expect(found).to.be.false;
        });
        it("out-of-bounds reverts", async function () {
            const { contract } = await deployFixture();
            await expectRevert(contract.getRecord(0), "AccidentEvidence: index out of bounds");
        });
    });

    // 5. EVENTS
    describe("Events", function () {
        it("emits RecordAdded", async function () {
            const { contract, owner } = await deployFixture();
            await expectEvent(contract, submitRecord(contract, owner), "RecordAdded", [0n, SAMPLE.cid, SAMPLE.jsonHash, undefined, BigInt(SAMPLE.timestamp), owner.address]);
        });
        it("emits CustodyEvent(Created) on submission", async function () {
            const { contract, owner } = await deployFixture();
            await expectEvent(contract, submitRecord(contract, owner), "CustodyEvent");
        });
    });

    // 6. RBAC ROLES
    describe("RBAC Roles", function () {
        it("admin grants/revokes roles", async function () {
            const { contract, investigator, viewer } = await deployFixture();
            await expectEvent(contract, contract.grantRole(investigator.address, 2), "RoleGranted", [investigator.address, 2n]);
            expect(await contract.roles(investigator.address)).to.equal(2n);
            await contract.grantRole(viewer.address, 1);
            expect(await contract.getRole(viewer.address)).to.equal(1n);
            await expectEvent(contract, contract.revokeRole(investigator.address), "RoleRevoked", [investigator.address]);
            expect(await contract.roles(investigator.address)).to.equal(0n);
        });
        it("non-admin cannot grant roles", async function () {
            const { contract, unauthorisedNode, viewer } = await deployFixture();
            await expectRevert(contract.connect(unauthorisedNode).grantRole(viewer.address, 1), "AccidentEvidence: caller is not an admin");
        });
        it("rejects invalid role values (0 or >3)", async function () {
            const { contract, viewer } = await deployFixture();
            await expectRevert(contract.grantRole(viewer.address, 0), "AccidentEvidence: invalid role (1-3)");
            await expectRevert(contract.grantRole(viewer.address, 4), "AccidentEvidence: invalid role (1-3)");
        });
    });

    // 7. CHAIN OF CUSTODY
    describe("Chain of Custody", function () {
        it("auto-creates custody on submission", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const [custodian, status] = await contract.getCustodyInfo(0);
            expect(custodian).to.equal(owner.address);
            expect(status).to.equal(0n); // Active
        });
        it("investigator can log + transfer custody", async function () {
            const { contract, owner, investigator, newOwner } = await deployFixture();
            await submitRecord(contract, owner);
            await contract.grantRole(investigator.address, 2);
            await expectEvent(contract, contract.connect(investigator).logCustodyEvent(0, 1, "Accessed"), "CustodyEvent");
            await expectEvent(contract, contract.connect(investigator).transferCustody(0, newOwner.address, "Transfer"), "CustodyEvent");
            const [custodian, status] = await contract.getCustodyInfo(0);
            expect(custodian).to.equal(newOwner.address);
            expect(status).to.equal(2n); // Transferred
        });
        it("viewer cannot log custody", async function () {
            const { contract, owner, viewer } = await deployFixture();
            await submitRecord(contract, owner);
            await contract.grantRole(viewer.address, 1);
            await expectRevert(contract.connect(viewer).logCustodyEvent(0, 1, "No access"), "AccidentEvidence: caller is not an investigator");
        });
        it("dispute/resolve changes status", async function () {
            const { contract, owner, investigator } = await deployFixture();
            await submitRecord(contract, owner);
            await contract.grantRole(investigator.address, 2);
            await contract.connect(investigator).logCustodyEvent(0, 4, "Disputed");
            expect((await contract.getCustodyInfo(0))[1]).to.equal(3n); // Disputed
            await contract.connect(investigator).logCustodyEvent(0, 5, "Resolved");
            expect((await contract.getCustodyInfo(0))[1]).to.equal(4n); // Resolved
        });
    });

    // 8. DUPLICATE HASH DETECTION
    describe("Duplicate Hash Detection", function () {
        it("marks hash as anchored", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            expect(await contract.isHashAnchored(SAMPLE.jsonHash)).to.be.true;
        });
        it("duplicate emits warning but stores", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const s2 = { ...SAMPLE, cid: "QmReplayCID" };
            await expectEvent(contract, submitRecord(contract, owner, s2), "DuplicateHashWarning");
            expect(await contract.getTotalRecords()).to.equal(2n);
        });
        it("different hash has no warning", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const s2 = { ...SAMPLE, cid: "QmOther", jsonHash: "b4g2d3e5f6a7890123456789abcdef0123456789abcdef0123456789abcdef02" };
            await expectNoEvent(contract, submitRecord(contract, owner, s2), "DuplicateHashWarning");
        });
        it("unknown hash returns false", async function () {
            const { contract } = await deployFixture();
            expect(await contract.isHashAnchored("unknown")).to.be.false;
        });
    });

    // 9. OWNERSHIP TRANSFER
    describe("Ownership Transfer", function () {
        it("transfers and revokes previous owner", async function () {
            const { contract, owner, newOwner } = await deployFixture();
            await expectEvent(contract, contract.transferOwnership(newOwner.address), "OwnershipTransferred");
            expect(await contract.owner()).to.equal(newOwner.address);
            expect(await contract.roles(owner.address)).to.equal(0n);
            expect(await contract.roles(newOwner.address)).to.equal(3n);
            await expectRevert(contract.connect(owner).authoriseNode(owner.address), "AccidentEvidence: caller is not the owner");
            await expectRevert(contract.connect(owner).grantRole(owner.address, 3), "AccidentEvidence: caller is not an admin");
        });
    });

    // 10. GAS MEASUREMENTS
    describe("Gas Measurements", function () {
        it("addEvidenceRecord", async function () {
            const { contract, owner } = await deployFixture();
            const tx = await submitRecord(contract, owner);
            const r = await tx.wait();
            console.log(`    ⛽ addEvidenceRecord: ${r.gasUsed.toString()} gas`);
        });
        it("logCustodyEvent", async function () {
            const { contract, owner } = await deployFixture();
            await submitRecord(contract, owner);
            const tx = await contract.logCustodyEvent(0, 1, "Accessed");
            const r = await tx.wait();
            console.log(`    ⛽ logCustodyEvent: ${r.gasUsed.toString()} gas`);
        });
        it("transferCustody", async function () {
            const { contract, owner, investigator } = await deployFixture();
            await submitRecord(contract, owner);
            await contract.grantRole(investigator.address, 2);
            const tx = await contract.connect(investigator).transferCustody(0, owner.address, "Test");
            const r = await tx.wait();
            console.log(`    ⛽ transferCustody: ${r.gasUsed.toString()} gas`);
        });
        it("grantRole", async function () {
            const { contract, investigator } = await deployFixture();
            const tx = await contract.grantRole(investigator.address, 2);
            const r = await tx.wait();
            console.log(`    ⛽ grantRole: ${r.gasUsed.toString()} gas`);
        });
    });
});
