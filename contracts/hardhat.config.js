import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatEthers, hardhatVerify],
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.ALCHEMY_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  verify: {
    etherscan: {
      apiKey: "UM6NZ4YKJJVMNJQUDGBSTJ38PAV3XXKXGY"
    }
  }
});
