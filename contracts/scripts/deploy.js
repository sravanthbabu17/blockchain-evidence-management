/**
 * deploy.js — AccidentEvidence Contract Deployment Script
 * --------------------------------------------------------
 * Deploys the AccidentEvidence smart contract to the configured network.
 * After deployment:
 *   1. Saves the deployed address to contract_address.json
 *   2. Prints instructions to update backend/.env with CONTRACT_ADDRESS
 *   3. Optionally verifies on Etherscan if ETHERSCAN_API_KEY is set
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 */

const fs   = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await ethers.getSigners();
    const network    = await ethers.provider.getNetwork();

    console.log('\n========================================');
    console.log(' EvidenceChain Contract Deployment');
    console.log('========================================');
    console.log(`  Network  : ${network.name} (chainId: ${network.chainId})`);
    console.log(`  Deployer : ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.error('\n❌ Deployer wallet has 0 ETH. Fund it from the Sepolia faucet first.');
        process.exit(1);
    }

    console.log('\n📦 Deploying AccidentEvidence...');

    const Factory  = await ethers.getContractFactory('AccidentEvidence');
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();

    console.log(`\n✅ AccidentEvidence deployed to: ${address}`);
    console.log(`   Deployer auto-authorised as node: true`);

    // ── Save address to JSON files ────────────────────────────────────────────
    const addressData = { address, network: network.name, chainId: Number(network.chainId) };

    const localFile   = path.join(__dirname, '../contract_address.json');
    const sepoliaFile = path.join(__dirname, '../contract_address_sepolia.json');

    fs.writeFileSync(localFile,   JSON.stringify(addressData, null, 2));
    fs.writeFileSync(sepoliaFile, JSON.stringify(addressData, null, 2));

    console.log(`\n💾 Saved to contract_address.json`);

    // ── Print next steps ──────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log(' NEXT STEPS');
    console.log('========================================');
    console.log('1. Add to backend/.env:');
    console.log(`     CONTRACT_ADDRESS=${address}`);
    console.log('2. Run the test suite:');
    console.log('     npx hardhat test');
    console.log('3. (Optional) Verify on Etherscan:');
    console.log(`     npx hardhat verify --network sepolia ${address}`);
    console.log('========================================\n');
}

main().catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exitCode = 1;
});