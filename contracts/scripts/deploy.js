/**
 * deploy.js — EvidenceChain Contract Deployment v2.0
 * Deploys AccidentEvidence with RBAC, custody, ECDSA, duplicate detection.
 * Logs deployment gas cost for the research paper.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *   npx hardhat run scripts/deploy.js --network localhost
 */

import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.create();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n🚀 Deploying AccidentEvidence v2.0...");
    console.log(`   Deployer : ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`   Balance  : ${ethers.formatEther(balance)} ETH`);

    // Deploy
    const Factory  = await ethers.getContractFactory("AccidentEvidence");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();
    const receipt  = await deployTx.wait();

    console.log(`\n✅ Contract deployed!`);
    console.log(`   Address  : ${address}`);
    console.log(`   TX Hash  : ${deployTx.hash}`);
    console.log(`   Block    : ${receipt.blockNumber}`);
    console.log(`   Gas Used : ${receipt.gasUsed.toString()}`);

    // Verify deployer has Admin role
    const role = await contract.getRole(deployer.address);
    console.log(`   Role     : ${role} (3=Admin) ✅`);
    console.log(`   Node Auth: ${await contract.authorisedNodes(deployer.address)} ✅`);

    // Save address for backend
    const addressData = {
        address,
        network: (await ethers.provider.getNetwork()).name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        gasUsed: receipt.gasUsed.toString(),
        version: "2.0.0"
    };

    const outPath = path.join(__dirname, "../contract_address.json");
    fs.writeFileSync(outPath, JSON.stringify(addressData, null, 2));
    console.log(`\n💾 Address saved to ${outPath}`);

    // Also save Sepolia-specific copy
    const sepoliaPath = path.join(__dirname, "../contract_address_sepolia.json");
    fs.writeFileSync(sepoliaPath, JSON.stringify(addressData, null, 2));
    console.log(`💾 Sepolia copy saved to ${sepoliaPath}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
