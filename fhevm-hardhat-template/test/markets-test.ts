import { ethers,fhevm } from "hardhat";
import { PredictionMarket } from "../types"; // 从TypeChain生成的合约类型（确保已编译）

// 已部署的Market合约地址（你的合约地址）
const MARKET_CONTRACT_ADDRESS = "0x765999577fa2841FE14DDb7bdd93dD1F45422AAC";

// 要创建的2个市场配置（可根据需求修改标题、描述等）
const MARKET_CONFIGS = [
  {
    title: "2025 NBA Finals Winner Prediction", // 市场标题（唯一，不可重复）
    description: "Predict which team will win the 2025 NBA Finals. Voting closes 1 hour before the game starts.", // 描述
    imageUrl: "https://example.com/nba-finals-2025.jpg", // 封面图URL
    options: ["Team A", "Team B", "Team C"], // 投票选项（至少2个）
    odds: [180, 220, 350], // 对应选项的赔率（180=1.8x，与options长度一致）
  },
  {
    title: "2025 World Cup Final Score Prediction", // 第二个市场标题（需唯一）
    description: "Predict the final score range of the 2025 World Cup Final. Rewards will be distributed after the match.", // 描述
    imageUrl: "https://example.com/world-cup-2025.jpg", // 封面图URL
    options: ["0-1 Goals", "2-3 Goals", "4+ Goals"], // 投票选项
    odds: [150, 120, 280], // 对应赔率
  },
];

async function main() {
  console.log(`\n🚀 开始创建市场，目标合约地址：${MARKET_CONTRACT_ADDRESS}`);
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`部署者账号：${deployerAddr}`);

  await fhevm.initializeCLIApi();
  console.log("✅ FHEVM 插件初始化完成");

  // 1. 加载已部署的Market合约
  const MarketFactory = await ethers.getContractFactory("PredictionMarket");
  const marketContract = MarketFactory.attach(
    MARKET_CONTRACT_ADDRESS
  ) as PredictionMarket;
  console.log("✅ Market合约加载成功");

  // 2. 计算投票截止时间和结果公布时间（基于链上当前时间，避免时间戳错误）
  const latestBlock = await ethers.provider.getBlock("latest");
  const currentBlockTime = latestBlock.timestamp; // 链上当前时间（秒）
  const voteEndTime = currentBlockTime + 604800; // 1小时后关闭投票（确保在未来）
  const resultTime = voteEndTime + 7200; // 投票关闭后2小时公布结果（符合合约校验）
  console.log(`⏰ 投票截止时间：${new Date(voteEndTime * 1000).toLocaleString()}`);
  console.log(`⏰ 结果公布时间：${new Date(resultTime * 1000).toLocaleString()}`);

  // 3. 循环创建2个市场
  for (let i = 0; i < MARKET_CONFIGS.length; i++) {
    const config = MARKET_CONFIGS[i];
    console.log(`\n📌 创建第 ${i + 1} 个市场：${config.title}`);

    // 调用createMarket创建市场（参数顺序需与合约完全一致）
    const tx = await marketContract.connect(deployer).createMarket(
      config.title,
      config.description,
      config.imageUrl,
      config.options,
      config.odds,
      voteEndTime,
      resultTime
    );

    // 等待交易确认（测试网需1-3个区块，约12-36秒）
    const txReceipt = await tx.wait();
    console.log(`✅ 第 ${i + 1} 个市场创建交易确认，哈希：${txReceipt.hash}`);

    // 从事件中提取市场ID（通过MarketCreated事件获取，更可靠）
    const marketCreatedEvent = txReceipt.events?.find(
      (e: any) => e.event === "MarketCreated"
    );
    if (!marketCreatedEvent) {
      throw new Error(`第 ${i + 1} 个市场创建事件未找到，请检查合约事件定义`);
    }
    const marketId = marketCreatedEvent.args?.marketId;
    console.log(`🎉 第 ${i + 1} 个市场创建成功！市场ID：${marketId.toString()}`);
  }

  console.log("\n🏁 所有市场创建完成！可通过区块链浏览器查询合约地址验证。");
}

// 执行脚本并捕获错误
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 市场创建失败：", error.message);
    process.exit(1);
  });