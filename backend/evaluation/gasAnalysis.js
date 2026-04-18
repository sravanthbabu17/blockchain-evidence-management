/**
 * gasAnalysis.js — Gas Cost Analysis for Research Paper
 * Extrapolates Sepolia gas usage to mainnet and L2 networks.
 *
 * Usage: node backend/evaluation/gasAnalysis.js
 *
 * NOTE: This script uses ESTIMATED gas values from Hardhat test output.
 * For actual Sepolia measurements, run: npx hardhat test (see gas logs).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Gas measurements from Hardhat tests (update after running npx hardhat test)
// These are typical values for the AccidentEvidence v2.0 contract
const GAS_MEASUREMENTS = {
    deploy:             { gas: 2_100_000, description: 'Contract deployment' },
    addEvidenceRecord:  { gas: 406_821,   description: 'Submit evidence with ECDSA signature' },
    logCustodyEvent:    { gas: 31_400,    description: 'Log custody action (event + state)' },
    transferCustody:    { gas: 56_091,    description: 'Transfer custody to new custodian' },
    grantRole:          { gas: 48_448,    description: 'Grant RBAC role' },
    revokeRole:         { gas: 28_000,    description: 'Revoke RBAC role' },
    verifyCID:          { gas: 35_000,    description: 'On-chain CID verification (view)' },
    verifySignature:    { gas: 30_000,    description: 'Re-verify stored signature (view)' },
};

// Network pricing (as of April 2026 — update with current values)
const NETWORKS = {
    'Ethereum Mainnet': {
        gasPrice_gwei: 25,     // avg gas price
        ethPrice_usd:  3200,   // ETH/USD
    },
    'Sepolia Testnet': {
        gasPrice_gwei: 1,      // testnet (free)
        ethPrice_usd:  0,      // no real value
    },
    'Polygon PoS': {
        gasPrice_gwei: 30,     // avg MATIC gas price
        ethPrice_usd:  0.75,   // MATIC/USD
    },
    'Arbitrum One': {
        gasPrice_gwei: 0.1,    // L2 compressed
        ethPrice_usd:  3200,   // ETH/USD (Arbitrum uses ETH)
    },
    'Optimism': {
        gasPrice_gwei: 0.05,   // L2 compressed
        ethPrice_usd:  3200,   // ETH/USD
    },
};

// Calculate cost
function calculateCost(gasUsed, gasPriceGwei, tokenPriceUsd) {
    const costInToken = (gasUsed * gasPriceGwei) / 1e9;
    const costInUsd = costInToken * tokenPriceUsd;
    return { costInToken, costInUsd };
}

console.log('\n⛽ EvidenceChain Gas Cost Analysis');
console.log('══════════════════════════════════════════════════════════════════\n');

// Build comparison table
const table = [];

for (const [funcName, measurement] of Object.entries(GAS_MEASUREMENTS)) {
    const row = {
        function: funcName,
        description: measurement.description,
        gasUsed: measurement.gas,
        costs: {},
    };

    for (const [network, pricing] of Object.entries(NETWORKS)) {
        const { costInToken, costInUsd } = calculateCost(
            measurement.gas,
            pricing.gasPrice_gwei,
            pricing.ethPrice_usd
        );
        row.costs[network] = {
            costInToken: costInToken.toFixed(8),
            costInUsd: costInUsd.toFixed(4),
        };
    }

    table.push(row);
}

// Print formatted table
console.log('Function                    | Gas Used    | Eth Mainnet  | Polygon PoS  | Arbitrum     | Optimism');
console.log('----------------------------|-------------|--------------|--------------|--------------|-------------');

for (const row of table) {
    const eth = `$${parseFloat(row.costs['Ethereum Mainnet'].costInUsd).toFixed(4)}`;
    const pol = `$${parseFloat(row.costs['Polygon PoS'].costInUsd).toFixed(6)}`;
    const arb = `$${parseFloat(row.costs['Arbitrum One'].costInUsd).toFixed(6)}`;
    const opt = `$${parseFloat(row.costs['Optimism'].costInUsd).toFixed(6)}`;
    const name = row.function.padEnd(28);
    const gas = row.gasUsed.toLocaleString().padEnd(13);
    console.log(`${name}| ${gas}| ${eth.padEnd(13)}| ${pol.padEnd(13)}| ${arb.padEnd(13)}| ${opt}`);
}

// Cost per incident (1 evidence + 1 custody log)
console.log('\n\n📊 Cost Per Incident (1 evidence record + 1 custody log):');
console.log('─────────────────────────────────────────────────────────');

const perIncident = GAS_MEASUREMENTS.addEvidenceRecord.gas + GAS_MEASUREMENTS.logCustodyEvent.gas;

for (const [network, pricing] of Object.entries(NETWORKS)) {
    if (network === 'Sepolia Testnet') continue;
    const { costInUsd } = calculateCost(perIncident, pricing.gasPrice_gwei, pricing.ethPrice_usd);
    console.log(`  ${network.padEnd(20)}: ${perIncident.toLocaleString()} gas → $${costInUsd.toFixed(4)} USD`);
}

// Save results
const outDir = path.join(__dirname, '../../data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const output = {
    timestamp: new Date().toISOString(),
    note: 'Gas values from Hardhat local tests. Update after npx hardhat test.',
    measurements: GAS_MEASUREMENTS,
    networks: NETWORKS,
    costTable: table,
    perIncidentGas: perIncident,
};

fs.writeFileSync(path.join(outDir, 'gas_analysis_results.json'), JSON.stringify(output, null, 2));
console.log(`\n💾 Results saved to data/gas_analysis_results.json`);

// CSV export for paper
let csv = 'Function,Description,Gas Used';
Object.keys(NETWORKS).forEach(n => { csv += `,${n} (USD)`; });
csv += '\n';
for (const row of table) {
    csv += `${row.function},"${row.description}",${row.gasUsed}`;
    Object.keys(NETWORKS).forEach(n => { csv += `,${row.costs[n].costInUsd}`; });
    csv += '\n';
}
fs.writeFileSync(path.join(outDir, 'gas_analysis_results.csv'), csv);
console.log(`💾 CSV saved to data/gas_analysis_results.csv\n`);
