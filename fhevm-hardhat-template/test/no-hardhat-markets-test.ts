import { ethers } from "ethers";

// -------------------------- 配置信息（需手动填写）--------------------------
const RPC_URL = "https://sepolia.infura.io/v3/6f7297d3a3b3445190b7b33caed682e9"; // Sepolia RPC 端点
const MNEMONIC = "okay breeze powder confirm violin slice number pluck forest neutral tell fiction"; // 测试用助记词
const MARKET_CONTRACT_ADDRESS = "0x765999577fa2841FE14DDb7bdd93dD1F45422AAC"; // 合约地址
// 合约 ABI（保持不变）
const MARKET_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "title", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "string", "name": "imageUrl", "type": "string" },
      { "internalType": "string[]", "name": "options", "type": "string[]" },
      { "internalType": "uint64[]", "name": "odds", "type": "uint64[]" },
      { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
      { "internalType": "uint256", "name": "resultTime", "type": "uint256" }
    ],
    "name": "createMarket",
    "outputs": [{ "internalType": "uint256", "name": "marketId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "marketId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "title", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" }
    ],
    "name": "MarketCreated",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "page", "type": "uint256" },
      { "internalType": "uint256", "name": "pageSize", "type": "uint256" },
      { "internalType": "bool", "name": "isDesc", "type": "bool" }
    ],
    "name": "getMarketList",
    "outputs": [
      {
        // 第一个返回值：MarketListResult 结构体
        "components": [
          {
            // 结构体中的 items 字段：MarketListItem[] 数组
            "components": [
              // MarketListItem 的 7 个字段（顺序、类型与合约完全一致！）
              { "internalType": "uint256", "name": "marketId", "type": "uint256" },    // 1. 正确
              { "internalType": "string", "name": "title", "type": "string" },        // 2. 正确
              { "internalType": "string", "name": "description", "type": "string" },  // 3. 正确
              { "internalType": "bool", "name": "isSettled", "type": "bool" },        // 4. 正确
              { "internalType": "bool", "name": "isCanceled", "type": "bool" },       // 5. 正确
              { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" }, // 6. 正确
              { "internalType": "uint8", "name": "optionCount", "type": "uint8" }     // 7. 关键修正：是 uint8！
            ],
            "internalType": "struct PredictionMarket.MarketListItem[]",
            "name": "items",
            "type": "tuple[]"
          },
          { "internalType": "uint256", "name": "totalCount", "type": "uint256" }      // 第二个返回值：总数量
        ],
        "internalType": "struct PredictionMarket.MarketListResult",
        "name": "",  // 结构体返回值名称可空，但 components 必须正确
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
// --------------------------------------------------------------------------

async function main() {
  console.log(`\n🚀 开始调用 Market 合约（独立脚本，助记词版）`);
  console.log(`合约地址：${MARKET_CONTRACT_ADDRESS}`);

  // 1. 连接到 Sepolia 网络
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  console.log(`✅ 已连接到网络：${await provider.getNetwork().then(net => net.name)}`);

  // 2. 从助记词生成钱包（默认使用第一个账户）
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC, provider); // 助记词生成钱包并连接provider
  console.log(`✅ 钱包初始化完成（助记词生成）：${wallet.address}`);
  console.log(`⚠️ 注意：当前使用助记词对应的第一个账户，地址：${wallet.address}`);

  // 3. 初始化合约实例
  const marketContract = new ethers.Contract(
    MARKET_CONTRACT_ADDRESS,
    MARKET_ABI,
    wallet
  );

  // 4. 准备创建市场的参数（与之前一致）
  const currentTime = Math.floor(Date.now() / 1000);
  const marketParams = {
    title: "Will BTC break through to $150,000 by the end of 2025?",
    description: "Will BTC break through to $150,000 by the end of 2025?",
    imageUrl: "https://example.com/nba-mnemonic-test.jpg",
    options: ["Yes", "No"],
    odds: [180, 220],
    voteEndTime: currentTime + 3600,
    resultTime: currentTime + 7200
  };
  console.log(`📌 市场参数准备完成：${marketParams.title}`);

  // 5. 调用 createMarket 方法
  console.log(`⏳ 正在发送创建市场交易...`);
  const tx = await marketContract.createMarket(
    marketParams.title,
    marketParams.description,
    marketParams.imageUrl,
    marketParams.options,
    marketParams.odds,
    marketParams.voteEndTime,
    marketParams.resultTime,
    { gasLimit: 3000000 }
  );

  // 6. 等待交易确认
  console.log(`⏳ 等待交易确认... 交易哈希：${tx.hash}`);
  const txReceipt = await tx.wait();

  console.log("交易状态（1=成功，0=失败）：", txReceipt.status); // 关键！
  if (txReceipt.status !== 1) {
    throw new Error("交易执行失败，状态码：" + txReceipt.status);
  }

  // 7. 提取市场ID
  const marketCreatedEvent = txReceipt.events?.find(
    (e: any) => e.event === "MarketCreated"
  );
  if (!marketCreatedEvent) {
    throw new Error("未找到 MarketCreated 事件，可能交易失败");
  }
  const marketId = marketCreatedEvent.args?.marketId;

  console.log(`\n🎉 市场创建成功！`);
  console.log(`市场ID：${marketId.toString()}`);
  console.log(`交易链接：https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ 失败：", err.message);
    process.exit(1);
  });