import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/FHECounter";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: vars.get("YI5B3AJ7Q6RX1359VQ34YR4QRUH2WRZV3W", ""),
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey: "",
          balance: "100000000000000000"
        }
      ],
      chainId: 31337,
    },
    anvil: {
      accounts: [
        {
          privateKey: "0xc5a48aea9a75ac19c5a032ee5293b1ee08d0f88c8ae4ff402d3fd894e513d683",
          balance: "100000000000000000"
        }
      ],
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: [
        {
          privateKey: "0xc5a48aea9a75ac19c5a032ee5293b1ee08d0f88c8ae4ff402d3fd894e513d683",
          balance: "100000000000000000"
        }
      ],
      chainId: 11155111,
      url: `https://1rpc.io/sepolia`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
