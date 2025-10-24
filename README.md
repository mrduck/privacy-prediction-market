# ZAMA Predict 🔮

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.x-367bc0?logo=solidity)
![Built with Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)
![Codecov](https://img.shields.io/badge/Codecov-99%25-brightgreen)
![Sourcery](https://img.shields.io/badge/Sourcery-Enabled-green)
![Tests](https://img.shields.io/badge/Tests-Passing-success)
![Privacy](https://img.shields.io/badge/Privacy-First-important)
![Decentralized](https://img.shields.io/badge/Decentralized-Prediction-orange)

> 完全隐私保护的去中心化市场预测平台 · 基于 ZAMA FHE Protocol

## 🌟 Featured In

[![Twitter](https://img.shields.io/badge/Twitter-Follow-1DA1F2?logo=twitter)](https://twitter.com/genio_tony)
[![Telegram](https://img.shields.io/badge/Telegram-Join-blue?logo=telegram)](https://t.me/evil5210)
[![Discord](https://img.shields.io/badge/Discord-Chat-7289da?logo=discord)](https://discord.gg/zamapredict)

## 📖 About


**ZAMA Predict** 是一个深度集成 **ZAMA 的FHE Protocol** 全同态加密协议的下一代去中心化预测市场平台。通过 **ZAMA FHE Protocol** 的先进加密技术，在区块链上实现了前所未有的隐私保护水平，让用户能够在完全保密的状态下参与市场预测。

### 🎬 项目演示

**在线演示地址**: [https://demo.zamapredict.io](https://demo.zamapredict.io)

**视频演示**:
[![ZAMA Predict Demo Video](https://img.shields.io/badge/Watch_Demo-Video-FF0000?logo=youtube)](https://youtube.com/watch?v=your-demo-video-id)


### 🚀 快速体验
```bash
# 或使用本地开发版本
https://github.com/mrduck/privacy-prediction-market.git
1.启动服务端
cd backend
npm install
node server.js

2.启动frontend
cd frontend
npm install 
npx start

```
**测试指南**:
1. 连接Sepolia测试网
2. 从Faucet获取测试ETH
3. 体验完整的预测市场流程
`
### 🔐 隐私优先的设计理念

- **端到端加密**: 基于 ZAMA 的FHE Protocol协议，所有用户数据在链上进行全同态加密处理
- **零知识证明**: 在不暴露任何信息的前提下验证交易合法性
- **机密计算**: 在加密状态下执行智能合约逻辑，确保业务逻辑的完全隐私
- **抗审查**: 通过密码学保证，即使节点运营商也无法获取用户敏感信息

## 🏗️ How It Works

### 业务流程概览

```
### 业务流程概览
![业务流程](https://blue-far-butterfly-900.mypinata.cloud/ipfs/bafkreibe4vpr34sxffh24f7qudjojypmc6bhjn2zoq4ev32mpcla5aj75e)

### 技术架构图
![技术架构图](https://blue-far-butterfly-900.mypinata.cloud/ipfs/bafkreibe4vpr34sxffh24f7qudjojypmc6bhjn2zoq4ev32mpcla5aj75e)

```

## 🛠️ Tech Stack

### 📜 智能合约部分

**开发框架 & 工具**
- **Hardhat** - 智能合约开发框架
- **fhevm/hardhat-plugin** - 全同态加密虚拟机插件
- **OpenZeppelin** - 安全的合约库
- **openzeppelin/confidential-contracts** - ERC7984合约库
- **zama-fhe/oracle-solidity** - zama-fhe预言机
- **@fhevm/solidity** - zama solidity库
- **...**

**合约功能描述**
- **PrivacyToken (ERC7984)**: 隐私代币管理，支持加密mint,加密burn，加密余额查询和加密转账
- **PredictionMarket**: 市场创建、管理和投票逻辑，集成 fhevm 进行数据授权和访问
- **PrivacyTicket**: fhevm隐私票据兑换和管理，支持加密票据操作

### 🌐 前端部分

**前端框架 & 库**
- **React 19.2** - 用户界面框架
- **TypeScript** - 类型安全的JavaScript

**区块链集成**
- **@web3-react** - React Hooks for Web3
- **zama-fhe/relayer-sdk** - 链上数据解密

**功能介绍**

#### 用户中心化登录
- **用户登录**: 中心化登录

#### 💧 隐私代币获取
- **测试网水龙头**: 用户可通过 Faucet 获取隐私测试代币
- **FHE 加密余额**: 代币余额通过 ZAMA FHE 协议进行加密存储
- **隐私交易**: 所有代币转账在加密状态下完成

#### 🎫 隐私票据系统
- **代币兑换**: 用户将隐私代币存入合约，换取加密隐私票据
- **FHE 加密票据**: 票据信息通过全同态加密技术保护
- **匿名持仓**: 用户持仓情况在链上完全加密

#### 📊 去中心化市场
- **市场创建**: 用户可创建基于 FHE 协议的预测市场
- **隐私参数**: 市场参数和规则通过加密方式存储
- **抗审查**: 基于 ZAMA 协议，确保市场创建的完全去中心化

#### 📈 加密数据可视化
- **隐私图表**: 市场数据通过 FHE 协议处理后可视化展示
- **加密分析**: 所有分析计算在加密数据上执行
- **机密洞察**: 为用户提供有价值的市场洞察，同时保护数据隐私

#### 🗳️ 全同态加密投票
- **隐私投票**: 用户使用隐私票据进行完全匿名的预测投票
- **FHE 计票**: 投票统计在全同态加密状态下完成
- **可验证结果**: 在保持隐私的同时确保结果的可验证性

## 🗺️ Development Roadmap

### Phase 1: 基础功能完善 (当前)
- ✅ 集成 ZAMA FHE Protocol 基础框架
- ✅ 隐私代币和票据系统
- ✅ 基础预测市场创建功能
- ✅ 加密投票机制

### Phase 2: 隐私增强 (Q1 2026)
- 🔄 **用户身份隐私保护**
    - 零知识证明身份验证
    - 去中心化身份管理系统
    - 匿名凭证系统
- 🔄 **增强数据隐私**
    - 多方安全计算集成
    - 差分隐私保护
    - 隐私数据生命周期管理

### Phase 3: 预言机系统升级 (Q3 2026)
- ⏳ **去中心化预言机网络**
    - 多数据源聚合验证
    - 抗操纵的结果提交机制
    - 经济激励机制
- ⏳ **隐私保护预言机**
    - FHE 加密数据喂价
    - 隐私保护的数据获取
    - 可验证的随机函数

## 🙏 Acknowledgments
衷心感谢 ZAMA FHE Protocol团队和社区成员的辛勤工作和无私奉献。正是有了你们的支持，ZAMA Predict 才能够实现如此高水平的隐私保护功能。

**特别鸣谢**：[https://www.zama.ai/](https://community.zama.ai/) 开发团队及所有社区贡献者！





