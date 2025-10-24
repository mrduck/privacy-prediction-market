// chainApi.js - 封装与链上合约交互的方法（替代原api.js中从sqlite读取的逻辑）
/* global BigInt */
import { ethers } from 'ethers';

// -------------------------- 链上配置（需与你的合约和网络匹配）--------------------------
// 1. 合约地址（你的 PredictionMarket 合约地址）
export const MARKET_CONTRACT_ADDRESS = '0xF5520368b51cc6091C5A1357bF65757dB5fD69E3';
export const PRIVACY_TOKEN_ADDRESS = '0xB3F8bFD4c5D484B78E42A50624A528e17c014ABE';
export const PRIVACY_VOTE_ADDRESS = '0xc58306822935f9a024aF264c74B3a675A7b79B98';

// 2. RPC 节点（Sepolia 测试网，可替换为 Alchemy 等其他节点）
const RPC_URL = 'https://sepolia.infura.io/v3/6f7297d3a3b3445190b7b33caed682e9';
// const instance = await createInstance(SepoliaConfig);
// 3. 合约 ABI（仅包含需要调用的 view 方法，简化版）
const MARKET_ABI = [
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
                            { "internalType": "string", "name": "imageUrl", "type": "string" },
                            { "internalType": "bool", "name": "isSettled", "type": "bool" },        // 4. 正确
                            { "internalType": "bool", "name": "isCanceled", "type": "bool" },       // 5. 正确
                            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" }, // 6. 正确
                            { "internalType": "uint8", "name": "optionCount", "type": "uint8" },     // 7. 关键修正：是 uint8！
                            { "internalType": "uint8", "name": "category", "type": "uint8" }, // 分类（1-5）
                            { "internalType": "uint64", "name": "totalMarketCap", "type": "uint64" }, // 总市值
                            { "internalType": "uint64", "name": "totalVolume", "type": "uint64" }
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
    },
    {
        "inputs": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "imageUrl", "type": "string" },
            { "internalType": "uint8", "name": "category", "type": "uint8" },
            { "internalType": "string[]", "name": "options", "type": "string[]" },
            { "internalType": "uint64[]", "name": "odds", "type": "uint64[]" },
            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
            { "internalType": "uint256", "name": "resultTime", "type": "uint256" }
        ],
        "name": "createMarket",
        "outputs": [
            { "internalType": "uint256", "name": "marketId", "type": "uint256" }
        ],
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
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            }
        ],
        "name": "getMarketInfo",
        "outputs": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "uint8", "name": "category", "type": "uint8" },
            { "internalType": "string", "name": "imageUrl", "type": "string" },
            { "internalType": "string[]", "name": "options", "type": "string[]" },
            { "internalType": "uint64[]", "name": "odds", "type": "uint64[]" },
            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
            { "internalType": "uint256", "name": "resultTime", "type": "uint256" },
            { "internalType": "bool", "name": "isSettled", "type": "bool" },
            { "internalType": "bool", "name": "isCanceled", "type": "bool" },
            { "internalType": "uint8", "name": "winningOption", "type": "uint8" },
            { "internalType": "uint64", "name": "totalMarketCap", "type": "uint64" },
            { "internalType": "uint64", "name": "totalVolume", "type": "uint64" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            },
            {
                "internalType": "uint8",
                "name": "optionIndex",
                "type": "uint8"
            }
        ],
        "name": "getOptionTotalVotes",
        "outputs": [
            {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "page",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "pageSize",
                "type": "uint256"
            }
        ],
        "name": "getMarketVoteRecords",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "voter",
                        "type": "address"
                    },
                    {
                        "internalType": "uint8",
                        "name": "optionIndex",
                        "type": "uint8"
                    },
                    {
                        "internalType": "uint64",
                        "name": "amount",
                        "type": "uint64"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct PredictionMarket.VoteRecord[]",
                "name": "records",
                "type": "tuple[]"
            },
            {
                "internalType": "uint256",
                "name": "totalCount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "marketId", "type": "uint256" },
            { "internalType": "uint8", "name": "optionIndex", "type": "uint8" },
            { "internalType": "uint64", "name": "amount", "type": "uint64" }
        ],
        "name": "vote",
        "outputs": [], // 无返回值（交易哈希通过 tx.hash 获取）
        "stateMutability": "nonpayable", // 需要发送交易（消耗gas）
        "type": "function"
    },
];

const TOKEN_ABI = [
    {
        "inputs": [
            { "internalType": "uint64", "name": "amount", "type": "uint64" }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "user", "type": "address" }
        ],
        "name": "getConfidentialBalance",
        "outputs": [
            { "internalType": "bytes", "name": "", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint64", "name": "tokenAmount", "type": "uint64" }
        ],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const VOTE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "user", "type": "address" }
        ],
        "name": "getVotingNoteBalance",
        "outputs": [
            { "internalType": "euint64", "name": "", "type": "bytes" } // euint64 加密类型在 ABI 中以 bytes 呈现
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
// --------------------------------------------------------------------------

// 初始化合约实例（只读，无需签名，仅用于读取链上数据）
let marketContract;
function initContract() {
    if (!marketContract) {
        // 连接到 RPC 节点（只读模式，无需用户钱包）
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        // 创建合约实例
        marketContract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            provider  // 用 provider 而非 signer，因为读取数据不需要签名
        );
    }
    return marketContract;
}

/**
 * 从链上读取市场列表（分页）
 * @param {number} page - 页码（从1开始）
 * @param {number} pageSize - 每页数量（1-100）
 * @param {boolean} isDesc - 是否降序（true: 最新的在前，false: 最早的在前）
 * @returns {Promise<{ items: MarketListItem[], totalCount: number }>} 市场列表数据
 */
export async function getMarketListFromChain(page, pageSize, isDesc = true) {
    try {
        // 1. 初始化合约
        const contract = initContract();

        // 2. 调用合约的 getMarketList 方法（链上读取，无需交易费）
        const [items, totalCount] = await contract.getMarketList(page, pageSize, isDesc);

        // 3. 转换数据格式（将 BigInt 转为 number/string，适配前端展示）
        const formattedItems = items.map(item => ({
            marketId: item.marketId.toString(),  // 市场ID（转为字符串避免精度丢失）
            title: item.title,                   // 标题
            description: item.description,       // 描述
            imageUrl: item.imageUrl,
            isSettled: item.isSettled,           // 是否已结算
            isCanceled: item.isCanceled,         // 是否已取消
            voteEndTime: new Date(Number(item.voteEndTime) * 1000).toLocaleString(), // 转换为本地时间
            optionCount: Number(item.optionCount), // 选项数量
            category: Number(item.category), // 分类（1-5）
            totalMarketCap: Number(item.totalMarketCap), // 总市值
            totalVolume: Number(item.totalVolume) // 总交易量
        }));

        console.log(`formattedItems:${formattedItems}`);
        console.log('formattedItems:',formattedItems);
        console.log(`count:${totalCount}`);
        // 4. 返回格式化后的数据
        return {
            items: formattedItems,
            totalCount: Number(totalCount)  // 总市场数
        };
    } catch (error) {
        console.error('❌ 从链上读取市场列表失败：', error.message);
        throw new Error(`获取市场列表失败：${error.message}`); // 抛给前端处理
    }
}

/**
 * 在链上创建新市场（需要用户钱包签名）
 * @param {string} title - 市场标题（需唯一）
 * @param {string} description - 市场描述
 * @param {string} imageUrl - 封面图 URL
 * @param {string[]} options - 投票选项数组（至少 2 个）
 * @param {number[]} odds - 对应选项的赔率数组（与 options 长度一致）
 * @param {number} voteEndTime - 投票截止时间（时间戳，单位：秒）
 * @param {number} resultTime - 结果公布时间（时间戳，单位：秒，需晚于 voteEndTime）
 * @returns {Promise<string>} 新创建的市场 ID
 */
export async function createMarketFromChain(title, description, imageUrl, category, options, odds, voteEndTime, resultTime) {
    try {
        // 1. 检查钱包是否存在（如 MetaMask）
        if (!window.ethereum) {
            throw new Error("请安装 MetaMask 钱包并连接");
        }

        // 2. 连接钱包并获取签名者（signer）
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        console.log("当前钱包地址：", await signer.getAddress());

        // 3. 初始化可写合约实例（使用 signer 支持交易签名）
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 4. 发送“创建市场”交易（设置足够 Gas 上限）
        const tx = await contract.createMarket(
            title,
            description,
            imageUrl,
            category,
            options,
            odds,
            voteEndTime,
            resultTime,
            { gasLimit: 3000000 } // FHE 合约需较高 Gas
        );
        console.log("交易已发送，哈希：", tx.hash);

        // 5. 等待交易确认（上链）
        const receipt = await tx.wait();
        console.log("交易已确认，区块号：", receipt.blockNumber);

        // 6. 从事件中提取市场 ID（通过 MarketCreated 事件更可靠）
        let marketCreatedEvent = null;
        for (const log of receipt.logs) {
            // 过滤：只处理当前合约的日志
            if (log.address.toLowerCase() !== MARKET_CONTRACT_ADDRESS.toLowerCase()) {
                continue;
            }
            try {
                // 用合约ABI手动解析日志（与测试脚本逻辑一致）
                const parsedEvent = contract.interface.parseLog(log);
                if (parsedEvent.name === "MarketCreated") {
                    marketCreatedEvent = parsedEvent;
                    break; // 找到目标事件，退出循环
                }
            } catch (err) {
                // 忽略无法解析的日志（非目标事件）
                continue;
            }
        }

        if (!marketCreatedEvent) {
            throw new Error("未找到MarketCreated事件，无法获取市场ID");
        }
        const marketId = marketCreatedEvent.args.marketId.toString();

        console.log("市场创建成功，ID：", marketId);
        return marketId;
    } catch (error) {
        console.error("❌ 创建市场失败：", error.message);
        throw new Error(`创建市场失败：${error.message}`);
    }
}

export const getMarketDetail = async (marketId) => {
    try {
        if (!window.ethereum) {
            throw new Error('请先连接钱包');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        console.log("当前钱包地址：", await signer.getAddress());

        // 3. 初始化可写合约实例（使用 signer 支持交易签名）
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 3. 转换marketId为数字（合约要求uint256类型）
        const marketIdNum = Number(marketId);
        console.log(`convert market id:${marketId}`)
        if (isNaN(marketIdNum)) {
            throw new Error('无效的市场ID');
        }

        // 4. 调用合约getMarketInfo（view函数，无需gas）
        const [title,description,category,imageUrl,options,odds,voteEndTime,resultTime,isSettled,isCanceled,winningOption,totalMarketCap,totalVolume] = await contract.getMarketInfo(marketIdNum);
        console.log(`title:${title}`);
        console.log(`description:${description}`);
        console.log(`imageUrl:${imageUrl}`);
        console.log(`options:${options}`);
        console.log(`odds:${odds}`);
        console.log(`voteEndTime:${voteEndTime}`);
        console.log(`resultTime:${resultTime}`);
        console.log(`isSettled:${isSettled}`);
        console.log(`isCanceled:${isCanceled}`);
        console.log(`winningOption:${winningOption}`);
        console.log(`category:${category}`);
        console.log(`category:${totalMarketCap}`);
        console.log(`category:${totalVolume}`);
        // 5. 整理数据（处理BigNumber类型，转换为字符串/数字）
        const marketData = {
            marketId: marketIdNum, // 补充市场ID（合约返回值中没有，手动添加）
            title,
            description,
            imageUrl, // 关键：包含图片URL
            category: Number(category),
            options: options.map(opt => opt), // 转换为普通数组
            odds: odds.map(odd => Number(odd)), // uint64转数字
            voteEndTime: voteEndTime.toString(), // 时间戳转字符串（避免大数问题）
            resultTime: resultTime.toString(),
            isSettled,
            isCanceled,
            winningOption: Number(winningOption), // uint8转数字
            totalMarketCap: Number(totalMarketCap), // 总市值
            totalVolume: Number(totalVolume)
        };

        return {success: true, data: marketData};

    } catch (error) {
        console.error('获取市场详情失败:', error);
        // 处理合约revert错误（如"Market does not exist"）
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        return {success: false, error: errorMsg};
    }
}

export async function vote(marketId, optionIndex, amount) {
    try {
        // 1. 检查钱包是否存在（如 MetaMask）
        if (!window.ethereum) {
            throw new Error("请安装 MetaMask 钱包并连接");
        }

        // 2. 连接钱包并获取签名者（signer）
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const voterAddress = await signer.getAddress();
        console.log(`当前投注用户地址：${voterAddress}`);

        // 3. 参数验证
        if (isNaN(marketId) || marketId < 0) {
            throw new Error("无效的市场ID（必须为非负整数）");
        }
        if (isNaN(optionIndex) || optionIndex < 0) {
            throw new Error("无效的选项索引（必须为非负整数）");
        }
        if (isNaN(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
            throw new Error("投注金额必须为正数且不超过安全整数范围");
        }

        // 4. 初始化可写合约实例（使用 signer 支持交易签名）
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 5. 发送投注交易（设置足够的 Gas 上限，FHE 合约需较高 Gas）
        console.log(`发送投注交易：市场ID=${marketId}，选项索引=${optionIndex}，金额=${amount}`);
        const tx = await contract.vote(
            marketId,       // 市场ID（uint256）
            optionIndex,    // 选项索引（uint8）
            amount,         // 投注金额（uint64）
            { gasLimit: 2000000 } // 调整Gas上限，避免交易失败
        );

        console.log(`投注交易已发送，哈希：${tx.hash}`);

        // 6. 等待交易确认（上链）
        const receipt = await tx.wait();
        console.log(`投注交易已确认，区块号：${receipt.blockNumber}`);

        // 7. 验证交易是否成功
        if (receipt.status !== 1) {
            throw new Error("投注交易失败（状态码非1）");
        }

        // 8. 从事件中提取投注信息（可选，用于前端展示）
        let voteEvent = null;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== MARKET_CONTRACT_ADDRESS.toLowerCase()) {
                continue;
            }
            try {
                const parsedEvent = contract.interface.parseLog(log);
                if (parsedEvent.name === "Voted") {
                    voteEvent = parsedEvent;
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        if (voteEvent) {
            console.log(`投注成功：用户=${voteEvent.args.voter}，市场ID=${voteEvent.args.marketId}，选项=${voteEvent.args.optionIndex}，金额=${voteEvent.args.amount}`);
        }

        return tx.hash; // 返回交易哈希，供前端跟踪

    } catch (error) {
        console.error("❌ 投注失败：", error.message);
        // 提取合约 revert 错误信息（如"Voting closed"等）
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`投注失败：${errorMsg}`);
    }
}

/**
 * 从链上获取市场的投票记录（分页）
 * @param {number} marketId - 市场ID（uint256）
 * @param {number} page - 页码（从1开始，uint256）
 * @param {number} pageSize - 每页数量（1-100，uint256）
 * @returns {Promise<{ records: Array<{voter: string, optionIndex: number, amount: number, timestamp: number}>, totalCount: number }>}
 *          投票记录列表及总数量
 */
export async function getMarketVoteRecords(marketId, page, pageSize) {
    try {
        // 1. 检查钱包是否连接（至少需要只读连接）
        if (!window.ethereum) {
            throw new Error("请先连接钱包");
        }

        // 2. 初始化 provider 和合约实例（只读模式，无需签名）
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            provider // 读取数据用 provider 即可，无需 signer
        );

        // 3. 参数验证（防止无效调用）
        if (isNaN(marketId) || marketId < 0) {
            throw new Error("无效的市场ID（必须为非负整数）");
        }
        if (isNaN(page) || page < 1) {
            throw new Error("页码必须≥1");
        }
        if (isNaN(pageSize) || pageSize < 1) {
            throw new Error("每页数量必须为1-100");
        }

        // 4. 调用合约的 getMarketVoteRecords 方法
        const [records, totalCount] = await contract.getMarketVoteRecords(
            marketId,    // 市场ID（转为 uint256）
            page,        // 页码（转为 uint256）
            pageSize     // 每页数量（转为 uint256）
        );

        // 5. 格式化返回数据（将 BigInt 转为 Number，适配前端处理）
        const formattedRecords = records.map(record => ({
            voter: record.voter, // 投票者地址（string）
            optionIndex: Number(record.optionIndex), // 选项索引（uint8 → number）
            amount: Number(record.amount), // 投票金额（uint64 → number）
            timestamp: Number(record.timestamp) // 投票时间戳（uint256 → 秒级 number）
        }));

        // 6. 返回格式化结果
        return {
            records: formattedRecords,
            totalCount: Number(totalCount) // 总记录数（uint256 → number）
        };

    } catch (error) {
        console.error(`获取市场${marketId}的投票记录失败:`, error);
        // 提取合约 revert 错误信息（如"Market does not exist"）
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`获取投票记录失败：${errorMsg}`);
    }
}

// chainApi.js 新增方法
export async function requestFaucet(amount = 100) {
    try {
        // 1. 检查钱包连接
        if (!window.ethereum) {
            throw new Error("请先连接钱包");
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();

        // 2. 初始化合约实例（使用 PrivacyToken 合约地址和 ABI）
        const tokenContract = new ethers.Contract(
            PRIVACY_TOKEN_ADDRESS, // 替换为你的 PrivacyToken 合约地址
            TOKEN_ABI,     // 需包含 mint 方法的 ABI
            signer
        );

        // 3. 参数校验（符合合约 uint64 类型，最大值 18446744073709551615）
        if (amount <= 0 || amount > 1e18) {
            throw new Error("领取数量必须为正数且不超过 1e18");
        }

        // 4. 调用合约 mint 方法（向当前用户铸造代币）
        const tx = await tokenContract.mint(amount); // 合约中 mint 方法参数为 uint64 amount
        await tx.wait(); // 等待交易确认

        console.log(`地址:${userAddress} Faucet 领取成功：${amount} 代币，交易哈希：${tx.hash}`);
        return { success: true, txHash: tx.hash };

    } catch (error) {
        console.error("Faucet 领取失败：", error);
        // 提取合约 revert 错误信息（如总量超限）
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`领取失败：${errorMsg}`);
    }
}

// chainApi.js 新增方法
/**
 * 将代币兑换为票据（调用 PrivacyToken.deposit 方法）
 * @param {number} amount - 兑换数量（uint64 类型）
 */
export async function depositTokens(amount) {
    try {
        if (!window.ethereum) throw new Error("请连接钱包");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // 初始化 PrivacyToken 合约实例
        const tokenContract = new ethers.Contract(
            PRIVACY_TOKEN_ADDRESS, // PrivacyToken 合约地址
            TOKEN_ABI,     // 包含 deposit 方法的 ABI
            signer
        );

        // 调用合约 deposit 方法（参数为 uint64 类型的金额）
        const tx = await tokenContract.deposit(amount);
        return tx; // 返回交易对象，由调用方等待确认
    } catch (error) {
        console.error("代币兑换票据失败：", error);
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`兑换失败：${errorMsg}`);
    }
}

export async function getNoteBalance() {
    try {
        if (!window.ethereum) throw new Error("请连接钱包");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        const votingContract = new ethers.Contract(
            PRIVACY_VOTE_ADDRESS, // PrivacyVoting 合约地址
            VOTE_ABI,
            signer
        );

        // 调用合约方法获取加密余额（euint64）
        const iface = new ethers.Interface(VOTE_ABI);
        const callData = iface.encodeFunctionData('getVotingNoteBalance',[userAddress]);
        // const encryptedBalance = await votingContract.getVotingNoteBalance(userAddress);
        console.log(`获取投票余额:${callData}`);
        // 注意：加密余额需要用 FHE 客户端库解密
        // 示例（需结合 @fhevm/client）：
        // const decryptedBalance = await fheClient.decrypt(encryptedBalance);
        // return Number(decryptedBalance);

        return callData; // 未解密的原始加密数据（bytes）
    } catch (error) {
        console.error("查询票据余额失败：", error);
        throw error;
    }
}

export const getTokenBalance = async (zamaInstance) => {
    try {
        // 1. 连接 provider（只读操作无需 signer，用 provider 更轻量）
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        console.log(`开始查询用户 ${userAddress} 的代币余额`);

        // 2. 手动编码函数调用数据（完全绕过 ethers 自动处理）
        const iface = new ethers.Interface(TOKEN_ABI); // 用 ABI 生成接口
        // 编码 getConfidentialBalance(address) 的调用数据
        const callData = iface.encodeFunctionData("getConfidentialBalance", [userAddress]);
        console.log("手动编码的调用数据：", callData);

        // 3. 用 provider.call 获取原始密文（不经过合约实例的解码逻辑）
        const encryptedBalanceBytes = await provider.call({
            to: PRIVACY_TOKEN_ADDRESS, // 合约地址
            data: callData             // 手动编码的调用数据
        });
        console.log("合约返回的原始加密密文：", encryptedBalanceBytes);

        const keypair = zamaInstance.generateKeypair();
        console.log("生成密钥对：", {
            publicKey: keypair.publicKey.slice(0, 20) + "...",
            privateKey: keypair.privateKey.slice(0, 20) + "..."
        });

        const handleContractPairs = [
            {
                handle: encryptedBalanceBytes,
                contractAddress: PRIVACY_TOKEN_ADDRESS,
            },
        ];

        const startTimeStamp = Math.floor(Date.now() / 1000).toString(); // 秒级时间戳
        const durationDays = '10'; // 有效期10天（字符串格式）
        const contractAddresses = [PRIVACY_TOKEN_ADDRESS];

        const eip712 = zamaInstance.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimeStamp,
            durationDays,
        );
        console.log("生成EIP712数据：", eip712);

        // 8. 用钱包签名（注意类型指定为UserDecryptRequestVerification）
        // const signature = await signer.signTypedData(
        //     eip712.domain,
        //     {
        //         UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        //     },
        //     eip712.message,
        // );
        // console.log("签名结果：", signature.slice(0, 20) + "...");

        // 9. 调用userDecrypt解密（移除签名的0x前缀，与你的代码一致）
        // const result = await zamaInstance.userDecrypt(
        //     handleContractPairs,
        //     keypair.privateKey,
        //     keypair.publicKey,
        //     signature.replace('0x', ''), // 移除0x前缀
        //     contractAddresses,
        //     userAddress, // signer.address即当前用户地址
        //     startTimeStamp,
        //     durationDays,
        // );
        //
        // // 10. 提取解密结果
        // const decryptedValue = result[encryptedBalanceBytes];
        // if (decryptedValue === undefined) {
        //     throw new Error("解密结果为空，可能密文无效或无权限");
        // }

        // 11. 格式化结果（假设18位小数，根据你的代币调整）
        // const readableValue = ethers.formatUnits(BigInt(decryptedValue), 18);
        // console.log("解密原始值：", decryptedValue);
        // console.log("可读余额：", readableValue);
        // const instance = await init();
        // const instance = await createInstance(SepoliaConfig);
        // console.log(`relayer instan:${instance}`);
        // let fhe = getFheInstance();
        // if (!fhe) throw new Error('Failed to initialize FHE instance');
        // initializeFheInstance();

        // const decryptBalance = await decryptValue(encryptedBalanceBytes);
        // console.log(`解密金额:${decryptBalance}`);
        // const fhe = await init();
        // console.log(`fhe init compile`);
        return callData;
        // 4. 解密（使用 Zama 实例）
        // const relayer = await getZamaInstance();
        // const decrypted = await relayer.userDecrypt({
        //     ciphertext: encryptedBalanceBytes,
        //     userAddress: userAddress,
        //     dataType: "euint64",
        //     contractAddress: PRIVACY_TOKEN_ADDRESS,
        // });
        //
        // console.log("解密后的余额：", decrypted.plaintext);
        // return Number(decrypted.plaintext);
    } catch (error) {
        console.error("查询余额失败（详细错误）：", error);
        throw new Error(`查询余额失败：${error.message}`);
    }
};

// export const decryptNoteBalance = async (encryptedBalance) => {
//     if (!window.ethereum) throw new Error("请连接钱包");
//     const provider = new ethers.BrowserProvider(window.ethereum);
//     const signer = await provider.getSigner();
//     const userAddress = await signer.getAddress();
//     const result = await getZamaInstance().userDecrypt({
//         ciphertext: encryptedBalance,      // 合约返回的加密数据
//         userAddress: userAddress,         // 解密授权用户地址
//         dataType: 'euint64',              // 数据类型（与合约一致）
//         contractAddress: PRIVACY_VOTE_ADDRESS, // 可选：验证数据来源
//     });
//     return Number(result.plaintext);    // 明文余额转为数字
// };