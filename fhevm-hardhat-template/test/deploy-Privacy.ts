import { ethers } from "hardhat";
import { PrivacyVoting, PrivacyToken, PredictionMarket } from "../types";

// 合约配置参数（可根据实际需求修改）
const CONFIG = {
  // Vote合约参数
  voteNoteName: "Voting Note",       // 票据名称
  voteNoteSymbol: "VN",              // 票据符号
  voteNoteDecimals: 0,               // 票据小数位（加密票据通常用0）

  // Token合约参数
  tokenInitialSupply: 10000n,        // 初始铸币量（给部署者）
  tokenName: "Privacy Token",        // 代币名称
  tokenSymbol: "PT",                 // 代币符号
  tokenUri: "https://privacy-token.uri" // 代币元数据URI
};

async function main() {
  console.log("\n======================================");
  console.log("🚀 开始部署所有合约...");
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`部署者地址：${deployerAddr}`);
  console.log("======================================\n");

  // ------------------------------
  // 步骤1：部署PrivacyVoting（Vote合约）
  // ------------------------------
  console.log("1. 部署 PrivacyVoting 合约...");
  const VoteFactory = await ethers.getContractFactory("PrivacyVoting");
  const voting: PrivacyVoting = await VoteFactory.deploy(
    deployerAddr,                  // initialOwner（部署者）
    CONFIG.voteNoteName,           // 票据名称
    CONFIG.voteNoteSymbol,         // 票据符号
    CONFIG.voteNoteDecimals        // 票据小数位
  );
  await voting.waitForDeployment();
  const votingAddr = await voting.getAddress();
  console.log(`✅ PrivacyVoting 部署完成：${votingAddr}`);

  // ------------------------------
  // 步骤2：部署PrivacyToken（Token合约）
  // 依赖：需传入已部署的Vote合约地址
  // ------------------------------
  console.log("\n2. 部署 PrivacyToken 合约...");
  const TokenFactory = await ethers.getContractFactory("PrivacyToken");
  const token: PrivacyToken = await TokenFactory.deploy(
    deployerAddr,                  // Token初始owner（部署者）
    CONFIG.tokenInitialSupply,     // 初始铸币量
    CONFIG.tokenName,              // 代币名称
    CONFIG.tokenSymbol,            // 代币符号
    CONFIG.tokenUri,               // 代币URI
    votingAddr                     // 绑定Vote合约地址（Token→Vote依赖）
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`✅ PrivacyToken 部署完成：${tokenAddr}`);

  // ------------------------------
  // 步骤3：Vote合约绑定Token地址（解决Vote→Token依赖）
  // ------------------------------
  console.log("\n3. 绑定 Vote → Token 地址...");
  const setTokenTx = await voting.setPrivacyToken(tokenAddr);
  await setTokenTx.wait();
  const boundToken = await voting.privacyToken();
  if (boundToken !== tokenAddr) {
    throw new Error("Vote合约绑定Token地址失败！");
  }
  console.log(`✅ Vote已成功绑定Token地址：${boundToken}`);

  // ------------------------------
  // 步骤4：部署PredictionMarket（市场合约）
  // 依赖：需传入Token和Vote合约地址
  // ------------------------------
  console.log("\n4. 部署 PredictionMarket 合约...");
  const MarketFactory = await ethers.getContractFactory("PredictionMarket");
  const market: PredictionMarket = await MarketFactory.deploy(
    tokenAddr,    // 依赖的Token合约地址
    votingAddr    // 依赖的Vote合约地址
  );
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log(`✅ PredictionMarket 部署完成：${marketAddr}`);

  // ------------------------------
  // 步骤5：权限授权（双向授权+市场合约授权）
  // ------------------------------
  console.log("\n5. 开始权限授权...");

  // 5.1 Token合约给Vote合约授予MINTER_ROLE
  // （Vote的withdrawNoteToToken需要给用户铸Token）
  const tokenMinterRole = ethers.id("MINTER_ROLE");
  const grantTokenToVoteTx = await token.grantRole(tokenMinterRole, votingAddr);
  await grantTokenToVoteTx.wait();
  const voteHasTokenMinter = await token.hasRole(tokenMinterRole, votingAddr);
  console.log(`- Vote拥有Token的MINTER_ROLE：${voteHasTokenMinter ? "✅" : "❌"}`);

  // 5.2 Vote合约给Token合约授予MINTER_ROLE
  // （Token的deposit需要给用户铸票据）
  const voteMinterRole = await voting.MINTER_ROLE();
  const grantVoteToTokenTx = await voting.grantRole(voteMinterRole, tokenAddr);
  await grantVoteToTokenTx.wait();
  const tokenHasVoteMinter = await voting.hasRole(voteMinterRole, tokenAddr);
  console.log(`- Token拥有Vote的MINTER_ROLE：${tokenHasVoteMinter ? "✅" : "❌"}`);

  // 5.3 Vote合约给Market合约授予ADDER_ROLE和MINTER_ROLE
  // （Market的投票逻辑需要转移/铸造票据）
  const voteAdderRole = await voting.ADDER_ROLE();
  const grantVoteAdderToMarketTx = await voting.grantRole(voteAdderRole, marketAddr);
  await grantVoteAdderToMarketTx.wait();
  const marketHasVoteAdder = await voting.hasRole(voteAdderRole, marketAddr);
  console.log(`- Market拥有Vote的ADDER_ROLE：${marketHasVoteAdder ? "✅" : "❌"}`);

  const grantVoteMinterToMarketTx = await voting.grantRole(voteMinterRole, marketAddr);
  await grantVoteMinterToMarketTx.wait();
  const marketHasVoteMinter = await voting.hasRole(voteMinterRole, marketAddr);
  console.log(`- Market拥有Vote的MINTER_ROLE：${marketHasVoteMinter ? "✅" : "❌"}`);

  // ------------------------------
  // 部署完成：输出所有合约地址
  // ------------------------------
  console.log("\n======================================");
  console.log("🎉 所有合约部署及授权完成！");
  console.log(`- PrivacyVoting: ${votingAddr}`);
  console.log(`- PrivacyToken: ${tokenAddr}`);
  console.log(`- PredictionMarket: ${marketAddr}`);
  console.log("======================================\n");
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败：", error);
    process.exit(1);
  });

// ======================================
// 🚀 开始部署所有合约...
// 部署者地址：0x5b3581B5A44b0c93ED2bce9708A549C8496B680b
// ======================================
//
// 1. 部署 PrivacyVoting 合约...
// ✅ PrivacyVoting 部署完成：0xc58306822935f9a024aF264c74B3a675A7b79B98
//
// 2. 部署 PrivacyToken 合约...
// ✅ PrivacyToken 部署完成：0xB3F8bFD4c5D484B78E42A50624A528e17c014ABE
//
// 3. 绑定 Vote → Token 地址...
// ✅ Vote已成功绑定Token地址：0xB3F8bFD4c5D484B78E42A50624A528e17c014ABE
//
// 4. 部署 PredictionMarket 合约...
// ✅ PredictionMarket 部署完成：0xF5520368b51cc6091C5A1357bF65757dB5fD69E3
//
// 5. 开始权限授权...
// - Vote拥有Token的MINTER_ROLE：✅
// - Token拥有Vote的MINTER_ROLE：✅
// - Market拥有Vote的ADDER_ROLE：✅
// - Market拥有Vote的MINTER_ROLE：✅
//
// ======================================
// 🎉 所有合约部署及授权完成！
// - PrivacyVoting: 0xc58306822935f9a024aF264c74B3a675A7b79B98
// - PrivacyToken: 0xB3F8bFD4c5D484B78E42A50624A528e17c014ABE
// - PredictionMarket: 0xF5520368b51cc6091C5A1357bF65757dB5fD69E3
// ======================================


