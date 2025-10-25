# AegisPredict 🔮

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.x-367bc0?logo=solidity)
![Built with Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)
![Codecov](https://img.shields.io/badge/Codecov-99%25-brightgreen)
![Sourcery](https://img.shields.io/badge/Sourcery-Enabled-green)
![Tests](https://img.shields.io/badge/Tests-Passing-success)
![Privacy](https://img.shields.io/badge/Privacy-First-important)
![Decentralized](https://img.shields.io/badge/Decentralized-Prediction-orange)

> Fully Privacy-Preserving Decentralized Market Prediction Platform · Built on ZAMA FHE Protocol

## 🌟 Featured In

[![Twitter](https://img.shields.io/badge/Twitter-Follow-1DA1F2?logo=twitter)](https://twitter.com/genio_tony)
[![Telegram](https://img.shields.io/badge/Telegram-Join-blue?logo=telegram)](https://t.me/evil5210)
[![Discord](https://img.shields.io/badge/Discord-Chat-7289da?logo=discord)](https://discord.gg/zamapredict)

## 📖 About


**AegisPredict** is a next-generation decentralized prediction market platform deeply integrated with **ZAMA's FHE Protocol**. Utilizing the advanced encryption technology of **ZAMA FHE Protocol**, it achieves unprecedented levels of privacy protection on the blockchain, allowing users to participate in market predictions in a completely confidential state.

### 🎬 Project Demo

**Live Demo**: [https://privacy-prediction-market-frontend.vercel.app/](https://privacy-prediction-market-frontend.vercel.app/)

[![AegisPredict Demo Video](https://blue-far-butterfly-900.mypinata.cloud/ipfs/bafkreihy5xuiokqjvxs3gfqehaeoqpujc4hkn3uiaklzbieaciiuhagdh4)](https://youtu.be/svAdPPnLwa4)

📺 **Watch Demo**: [YouTube Link](https://youtu.be/svAdPPnLwa4)


### 🚀 Quick Start
```bash
# Or use local development version
https://github.com/mrduck/privacy-prediction-market.git
1.Start backend server
cd backend
npm install
node server.js

2. Start frontend
cd frontend
npm install 
npx start

```
**Testing Guide**:
1. Connect to Sepolia testnet
2. Get test ETH from Faucet
3. Experience the complete prediction market workflow

`
### 🔐 Privacy-First Design Philosophy

- **End-to-End Encryption**: All user data is processed with fully homomorphic encryption on-chain based on ZAMA's FHE Protocol
- **Zero-Knowledge Proofs**: Verify transaction legitimacy without exposing any information
- **Confidential Computing**: Execute smart contract logic in encrypted state, ensuring complete privacy of business logic
- **Censorship Resistance**: Cryptographic guarantees ensure even node operators cannot access user sensitive information

## 🏗️ How It Works

### Business Process Overview
![Business Process Overview](https://blue-far-butterfly-900.mypinata.cloud/ipfs/bafkreibe4vpr34sxffh24f7qudjojypmc6bhjn2zoq4ev32mpcla5aj75e)

### Technical Architecture Diagram
![Technical Architecture Diagram](https://blue-far-butterfly-900.mypinata.cloud/ipfs/bafkreigenqgsi43e2ymmbbwit57evd5rvf3qz3fpcgtnpynubrkoq2wbga)

## 🛠️ Tech Stack

### 📜 Smart Contracts

**Development Framework & Tools**
- **Hardhat** - Smart contract development framework
- **fhevm/hardhat-plugin** - Fully homomorphic encryption virtual machine plugin
- **OpenZeppelin** - Secure contract library
- **openzeppelin/confidential-contracts** - ERC7984 contract library
- **zama-fhe/oracle-solidity** - Zama FHE oracle
- **@fhevm/solidity** - Zama Solidity library
- **...**

**ContractInfo**

| name             | address        | scan    |
|------------------|----------------|--------|
| PrivacyToken     | 0x0892d63C1bc130d39A129a23696f87dDd763cEb4  | https://sepolia.etherscan.io/address/0x0892d63C1bc130d39A129a23696f87dDd763cEb4 |
| PredictionMarket | 0x0babE07D6C6aCaa7d9E9C18D59bf4324172468e0    | https://sepolia.etherscan.io/address/0x0babE07D6C6aCaa7d9E9C18D59bf4324172468e0 |
| PrivacyTicket    | 0x88d458415D2110f8ec373De5Ac1878b837BE900a| https://sepolia.etherscan.io/address/0x88d458415D2110f8ec373De5Ac1878b837BE900a |

**Contract Function Description**
- **PrivacyToken (ERC7984)**: Base ACL Privacy token management, supporting encrypted mint, encrypted burn, encrypted balance queries and encrypted transfers
- **PredictionMarket**: BASE ACL Market creation, management and voting logic, integrated with fhevm for data authorization and access
- **PrivacyTicket**: BASE ACL Fhevm privacy ticket exchange and management, supporting encrypted ticket operations

### 🌐 Frontend

**Frontend Framework & Libraries**
- **React 19.2** - User interface framework
- **TypeScript** - Type-safe JavaScript

**Blockchain Integration**
- **@web3-react** - React Hooks for Web3
- **zama-fhe/relayer-sdk** - On-chain data decryption

**Feature Description**

#### Centralized User Login
- **User Login**: Centralized login system

#### 💧 Privacy Token Acquisition
- **Testnet Faucet**: Users can obtain privacy test tokens through Faucet
- **FHE Encrypted Balances**: Token balances are encrypted and stored via ZAMA FHE protocol
- **Private Transactions**: All token transfers are completed in encrypted state

#### 🎫Privacy Ticket System
- **Token Exchange**: Users deposit privacy tokens into contracts in exchange for encrypted privacy tickets
- **FHE Encrypted Tickets**: Ticket information protected by fully homomorphic encryption technology
- **Anonymous Holdings**: User holding positions are fully encrypted on-chain

#### 📊 Decentralized Market
- **Market Creation**: Users can create prediction markets based on FHE protocol
- **Privacy Parameters**: Market parameters and rules stored via encryption
- **Censorship Resistance**: Based on ZAMA protocol, ensuring completely decentralized market creation

#### 📈 Encrypted Data Visualization
- **Privacy Charts**: Market data visualized after processing through FHE protocol
- **Encrypted Analysis**: All analytical computations performed on encrypted data
- **Confidential Insights**: Providing valuable market insights to users while protecting data privacy

#### 🗳️ Fully Homomorphic Encrypted Voting
- **Private Voting**: Users use privacy tickets for completely anonymous prediction voting
- **FHE Vote Counting**: Vote tallying completed in fully homomorphic encrypted state
- **Verifiable Results**: Ensuring result verifiability while maintaining privacy

## 🗺️ Development Roadmap

### Phase 1: Core Features (Current)
- ✅  Integrated ZAMA FHE Protocol foundation
- ✅ Privacy token and ticket system
- ✅ Basic prediction market creation
- ✅ Encrypted voting mechanism

### Phase 2: Privacy Enhancement (Q1 2026)
- 🔄 **User Identity Privacy Protection**
    - Zero-knowledge proof authentication
    - ecentralized identity management system
    - Anonymous credential system
- 🔄 **Enhanced Data Privacy**
    - Multi-party secure computation integration
    - Differential privacy protection
    - Privacy data lifecycle management

### Phase 3: Oracle System Upgrade (Q3 2026)
- ⏳ **Decentralized Oracle Network**
    - Multi-source data aggregation verification
    - Anti-manipulation result submission mechanism
    - Economic incentive mechanism
- ⏳ **Privacy-Preserving Oracle**
    - FHE encrypted data feeds
    - Privacy-protected data acquisition
    - Verifiable random functions

## 🙏 Acknowledgments
Sincere thanks to the ZAMA FHE Protocol team and community members for their hard work and selfless contributions. It is with your support that AegisPredict can achieve such high levels of privacy protection functionality.

**Special Thanks**：[https://www.zama.ai/](https://community.zama.ai/) development team and all community contributors!





