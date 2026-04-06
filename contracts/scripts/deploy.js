async function main() {
    const Contract = await ethers.getContractFactory("AccidentEvidence");
    const contract = await Contract.deploy();

    await contract.waitForDeployment();

    console.log("✅ Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
    console.error("❌ Deployment error:", error);
    process.exitCode = 1;
});