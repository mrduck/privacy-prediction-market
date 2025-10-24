import { ethers, TransactionReceipt, Log, LogDescription } from "ethers";

// 1. 配置：交易哈希、合约地址、Sepolia RPC、合约ABI（包含事件定义）
const TRANSACTION_HASH: string = "0xeb84bc8a805b6ff2c17575ef221ef0b58b07bf3471d7f170f7830834ebe83a2c";
const CONTRACT_ADDRESS: string = "0x765999577fa2841FE14DDb7bdd93dD1F45422AAC"; // 合约地址
const RPC_URL: string = "https://sepolia.infura.io/v3/6f7297d3a3b3445190b7b33caed682e9"; // Sepolia RPC

// 2. 合约ABI（包含MarketCreated事件定义）
const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
      { indexed: false, internalType: "string", name: "title", type: "string" },
      { indexed: false, internalType: "uint256", name: "voteEndTime", type: "uint256" },
      { indexed: true, internalType: "address", name: "creator", type: "address" }
    ],
    name: "MarketCreated",
    type: "event"
  }
] as const;

// 3. 核心函数：查询交易事件并打印
async function checkTransactionEvents(): Promise<void> {
  try {
    // 连接到Sepolia测试网
    const provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("已连接到Sepolia测试网");

    // 获取交易收据（包含事件日志）
    const receipt: TransactionReceipt | null = await provider.getTransactionReceipt(TRANSACTION_HASH);
    if (!receipt) {
      console.error("❌ 未找到交易收据，可能交易未确认或哈希错误");
      return;
    }

    // 获取交易详情以获取哈希（解决transactionHash不存在的问题）
    const transaction = await provider.getTransaction(TRANSACTION_HASH);

    console.log(`\n交易详情：`);
    console.log(`- 交易哈希：${transaction?.hash}`);
    console.log(`- 区块号：${receipt.blockNumber}`);
    console.log(`- 状态：${receipt.status === 1 ? "成功" : "失败"}`);
    console.log(`- 事件数量：${receipt.logs.length}\n`);

    // 初始化合约实例（用于解析事件）
    const contract: ethers.Contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // 遍历所有日志，解析并打印事件
    console.log("交易中的所有事件：");
    receipt.logs.forEach((log: Log, index: number) => {
      try {
        // 尝试用合约ABI解析事件，处理可能返回null的情况
        const event: LogDescription | null = contract.interface.parseLog(log);
        if (!event) {
          console.log(`\n事件 ${index + 1}：无法解析（非目标合约事件或ABI缺失）`);
          return;
        }

        console.log(`\n事件 ${index + 1}：`);
        console.log(`- 事件名称：${event.name}`);
        console.log(`- 参数：`);
        event.args.forEach((arg: unknown, i: number) => {
          // 格式化参数（BigInt转字符串，地址保持原样）
          const value: string | unknown = typeof arg === "bigint" ? arg.toString() : arg;
          console.log(`  ${event.fragment.inputs[i].name}: ${value}`);
        });
      } catch (e) {
        // 无法解析的事件（可能不是目标合约的事件，或ABI不匹配）
        console.log(`\n事件 ${index + 1}：无法解析（非目标合约事件或ABI缺失）${e}`);
        console.log(`- 原始日志：${JSON.stringify(log, null, 2)}`);
      }
    });

  } catch (error) {
    console.error("查询失败：", error instanceof Error ? error.message : String(error));
  }
}

// 执行查询
checkTransactionEvents();