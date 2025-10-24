import { ethers } from "hardhat";
import { PrivacyVoting, PrivacyToken, PredictionMarket, UUPSProxy } from "../types";

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
  console.log("🚀 开始部署所有合约（UUPS代理模式）...");
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`部署者地址：${deployerAddr}`);
  console.log("======================================\n");

  // 获取UUPS代理工厂
  const ProxyFactory = await ethers.getContractFactory("UUPSProxy");

  // ------------------------------
  // 步骤1：部署PrivacyVoting（代理+实现）
  // ------------------------------
  console.log("1. 部署 PrivacyVoting 实现合约...");
  const VoteImplFactory = await ethers.getContractFactory("PrivacyVoting");
  const voteImpl = await VoteImplFactory.deploy();
  await voteImpl.waitForDeployment();
  const voteImplAddr = await voteImpl.getAddress();
  console.log(`- 实现合约地址：${voteImplAddr}`);

  console.log("1.2 部署 PrivacyVoting 代理合约...");
  const voteProxy: UUPSProxy = await ProxyFactory.deploy(voteImplAddr, "0x"); // 初始化数据暂时为空
  await voteProxy.waitForDeployment();
  const voteProxyAddr = await voteProxy.getAddress();
  console.log(`- 代理合约地址：${voteProxyAddr}`);

  // 通过代理获取PrivacyVoting实例（后续交互都通过代理）
  const voting: PrivacyVoting = await ethers.getContractAt("PrivacyVoting", voteProxyAddr);

  console.log("1.3 初始化 PrivacyVoting 合约...");
  const initVoteTx = await voting.initialize(
    deployerAddr,                  // initialOwner（部署者）
    CONFIG.voteNoteName,           // 票据名称
    CONFIG.voteNoteSymbol,         // 票据符号
    CONFIG.voteNoteDecimals,       // 票据小数位
    voteProxyAddr                  // 传入代理自身地址（合约内proxy变量）
  );
  await initVoteTx.wait();
  console.log(`✅ PrivacyVoting 部署+初始化完成：${voteProxyAddr}`);

  // ------------------------------
  // 步骤2：部署PrivacyToken（代理+实现）
  // 依赖：需传入已部署的Vote代理地址
  // ------------------------------
  console.log("\n2. 部署 PrivacyToken 实现合约...");
  const TokenImplFactory = await ethers.getContractFactory("PrivacyToken");
  const tokenImpl = await TokenImplFactory.deploy();
  await tokenImpl.waitForDeployment();
  const tokenImplAddr = await tokenImpl.getAddress();
  console.log(`- 实现合约地址：${tokenImplAddr}`);

  console.log("2.2 部署 PrivacyToken 代理合约...");
  const tokenProxy: UUPSProxy = await ProxyFactory.deploy(tokenImplAddr, "0x"); // 初始化数据暂时为空
  await tokenProxy.waitForDeployment();
  const tokenProxyAddr = await tokenProxy.getAddress();
  console.log(`- 代理合约地址：${tokenProxyAddr}`);

  // 通过代理获取PrivacyToken实例
  const token: PrivacyToken = await ethers.getContractAt("PrivacyToken", tokenProxyAddr);

  console.log("2.3 初始化 PrivacyToken 合约...");
  const initTokenTx = await token.initialize(
    deployerAddr,                  // Token初始owner（部署者）
    CONFIG.tokenInitialSupply,     // 初始铸币量
    CONFIG.tokenName,              // 代币名称
    CONFIG.tokenSymbol,            // 代币符号
    CONFIG.tokenUri,               // 代币URI
    voteProxyAddr,                 // 绑定Vote代理地址（Token→Vote依赖）
    tokenProxyAddr                 // 传入代理自身地址（合约内proxy变量）
  );
  await initTokenTx.wait();
  console.log(`✅ PrivacyToken 部署+初始化完成：${tokenProxyAddr}`);

  // ------------------------------
  // 步骤3：Vote合约绑定Token地址（解决Vote→Token依赖）
  // ------------------------------
  console.log("\n3. 绑定 Vote → Token 地址...");
  const setTokenTx = await voting.setPrivacyToken(tokenProxyAddr);
  await setTokenTx.wait();
  const boundToken = await voting.privacyToken();
  if (boundToken !== tokenProxyAddr) {
    throw new Error("Vote合约绑定Token地址失败！");
  }
  console.log(`✅ Vote已成功绑定Token地址：${boundToken}`);

  // ------------------------------
  // 步骤4：部署PredictionMarket（代理+实现）
  // 依赖：需传入Token和Vote的代理地址
  // ------------------------------
  console.log("\n4. 部署 PredictionMarket 实现合约...");
  const MarketImplFactory = await ethers.getContractFactory("PredictionMarket");
  const marketImpl = await MarketImplFactory.deploy();
  await marketImpl.waitForDeployment();
  const marketImplAddr = await marketImpl.getAddress();
  console.log(`- 实现合约地址：${marketImplAddr}`);

  console.log("4.2 部署 PredictionMarket 代理合约...");
  const marketProxy: UUPSProxy = await ProxyFactory.deploy(marketImplAddr, "0x"); // 初始化数据暂时为空
  await marketProxy.waitForDeployment();
  const marketProxyAddr = await marketProxy.getAddress();
  console.log(`- 代理合约地址：${marketProxyAddr}`);

  // 通过代理获取PredictionMarket实例
  const market: PredictionMarket = await ethers.getContractAt("PredictionMarket", marketProxyAddr);

  console.log("4.3 初始化 PredictionMarket 合约...");
  const initMarketTx = await market.initialize(
    tokenProxyAddr,    // 依赖的Token代理地址
    voteProxyAddr,     // 依赖的Vote代理地址
    marketProxyAddr    // 传入代理自身地址（合约内proxy变量）
  );
  await initMarketTx.wait();
  console.log(`✅ PredictionMarket 部署+初始化完成：${marketProxyAddr}`);

  // ------------------------------
  // 步骤5：权限授权（通过代理合约操作）
  // ------------------------------
  console.log("\n5. 开始权限授权...");

  // 5.1 Token合约给Vote合约授予MINTER_ROLE
  // （Vote的withdrawNoteToToken需要给用户铸Token）
  const tokenMinterRole = ethers.id("MINTER_ROLE");
  const grantTokenToVoteTx = await token.grantRole(tokenMinterRole, voteProxyAddr);
  await grantTokenToVoteTx.wait();
  const voteHasTokenMinter = await token.hasRole(tokenMinterRole, voteProxyAddr);
  console.log(`- Vote拥有Token的MINTER_ROLE：${voteHasTokenMinter ? "✅" : "❌"}`);

  // 5.2 Vote合约给Token合约授予MINTER_ROLE
  // （Token的deposit需要给用户铸票据）
  const voteMinterRole = await voting.MINTER_ROLE();
  const grantVoteToTokenTx = await voting.grantRole(voteMinterRole, tokenProxyAddr);
  await grantVoteToTokenTx.wait();
  const tokenHasVoteMinter = await voting.hasRole(voteMinterRole, tokenProxyAddr);
  console.log(`- Token拥有Vote的MINTER_ROLE：${tokenHasVoteMinter ? "✅" : "❌"}`);

  // 5.3 Vote合约给Market合约授予ADDER_ROLE和MINTER_ROLE
  // （Market的投票逻辑需要转移/铸造票据）
  const voteAdderRole = await voting.ADDER_ROLE();
  const grantVoteAdderToMarketTx = await voting.grantRole(voteAdderRole, marketProxyAddr);
  await grantVoteAdderToMarketTx.wait();
  const marketHasVoteAdder = await voting.hasRole(voteAdderRole, marketProxyAddr);
  console.log(`- Market拥有Vote的ADDER_ROLE：${marketHasVoteAdder ? "✅" : "❌"}`);

  const grantVoteMinterToMarketTx = await voting.grantRole(voteMinterRole, marketProxyAddr);
  await grantVoteMinterToMarketTx.wait();
  const marketHasVoteMinter = await voting.hasRole(voteMinterRole, marketProxyAddr);
  console.log(`- Market拥有Vote的MINTER_ROLE：${marketHasVoteMinter ? "✅" : "❌"}`);

  // ------------------------------
  // 部署完成：输出所有合约地址（代理地址为交互入口）
  // ------------------------------
  console.log("\n======================================");
  console.log("🎉 所有合约部署及授权完成！");
  console.log(`- PrivacyVoting（代理）: ${voteProxyAddr}`);
  console.log(`- PrivacyVoting（实现）: ${voteImplAddr}`);
  console.log(`- PrivacyToken（代理）: ${tokenProxyAddr}`);
  console.log(`- PrivacyToken（实现）: ${tokenImplAddr}`);
  console.log(`- PredictionMarket（代理）: ${marketProxyAddr}`);
  console.log(`- PredictionMarket（实现）: ${marketImplAddr}`);
  console.log("======================================\n");
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败：", error);
    process.exit(1);
  });