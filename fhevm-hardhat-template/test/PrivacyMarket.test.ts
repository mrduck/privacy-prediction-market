import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  PrivacyToken,
  PrivacyToken__factory,
  PrivacyVoting,
  PrivacyVoting__factory,
  PredictionMarket,
  PredictionMarket__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// 业务常量（与合约逻辑严格对齐）
const TOKEN_NAME = "Privacy Token";
const TOKEN_SYMBOL = "PT";
const TOKEN_URI = "https://privacy-token.uri";
const INITIAL_MINT_AMOUNT = 10_000; // User初始代币数量（Token合约参数）
const VOTE_AMOUNT = 500; // 单次投票票据数量（需与Vote合约加密类型兼容）
const MARKET_OPTIONS = ["Team A Win", "Team B Win"]; // 投票选项
const MARKET_ODDS = [150, 120]; // 赔率（150=1.5倍，120=1.2倍）
const VOTE_END_DELAY = 3600; // 投票截止时间（当前+1小时）
const RESULT_DELAY = 7200; // 结果公布时间（当前+2小时）
// 新增：Vote合约元数据（若调整后构造函数仍需，需补充；若仅需initialOwner则注释）
const VOTE_NOTE_NAME = "Voting Note";
const VOTE_NOTE_SYMBOL = "VNOTE";
const VOTE_NOTE_DECIMALS = 0;

type Signers = {
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
};

// 核心调整1：部署函数适配Vote合约构造函数（根据实际调整的Vote合约参数修改）
// 若Vote合约构造函数为「仅需initialOwner」→ 用注释内简化版；若需元数据→用当前版
async function deployAllContracts(owner: HardhatEthersSigner): Promise<{
  token: PrivacyToken;
  voting: PrivacyVoting;
  predictionMarket: PredictionMarket;
}> {
  console.log("\n📦 部署依赖合约链（Token → Voting → Market）...");

  // 1. 部署 PrivacyVoting（关键：与调整后的Vote合约构造函数参数对齐）
  const votingFactory = (await ethers.getContractFactory(
    "PrivacyVoting",
    owner
  )) as PrivacyVoting__factory;
  // 若Vote合约构造函数仅需initialOwner：
  // const voting = await votingFactory.deploy(await owner.getAddress());
  // 若Vote合约仍需元数据（名称/符号/小数位）：
  const voting = await votingFactory.deploy(
    await owner.getAddress(), // initialOwner
    VOTE_NOTE_NAME,          // 票据名称（适配调整后的Vote合约）
    VOTE_NOTE_SYMBOL,        // 票据符号
    VOTE_NOTE_DECIMALS       // 小数位
  );
  await voting.waitForDeployment();
  const votingAddr = await voting.getAddress();
  console.log(`✅ PrivacyVoting 地址：${votingAddr}`);

  // 2. 部署 PrivacyToken（关联 Voting，参数不变）
  const tokenFactory = (await ethers.getContractFactory(
    "PrivacyToken",
    owner
  )) as PrivacyToken__factory;
  const token = await tokenFactory.deploy(
    await owner.getAddress(), // Token初始Owner
    INITIAL_MINT_AMOUNT,      // Token初始铸币量
    TOKEN_NAME,               // Token名称
    TOKEN_SYMBOL,             // Token符号
    TOKEN_URI,                // Token URI
    votingAddr                // 关联的Vote合约地址（核心联动）
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  // 给Token授予Vote合约的MINTER_ROLE（确保deposit能兑换票据）
  const minterRole = await voting.MINTER_ROLE();
  await voting.grantRole(minterRole, tokenAddr);
  console.log(`✅ PrivacyToken 地址：${tokenAddr}（已获Vote的MINTER_ROLE）`);

  // 3. 部署 PredictionMarket（关联 Token 和 Voting，参数不变）
  const pmFactory = (await ethers.getContractFactory(
    "PredictionMarket",
    owner
  )) as PredictionMarket__factory;
  const predictionMarket = await pmFactory.deploy(
    tokenAddr,   // 关联Token合约
    votingAddr   // 关联Vote合约
  );
  await predictionMarket.waitForDeployment();
  const pmAddr = await predictionMarket.getAddress();
  // 给MARKET授予Vote合约的ADDER_ROLE（确保add能添加票据）
  const addVoteRole = await voting.ADDER_ROLE();
  await voting.grantRole(addVoteRole,pmAddr);
  console.log(`✅ PredictionMarket 地址：${pmAddr}已获Vote的ADDER_ROLE）`);

  return { token, voting, predictionMarket };
}

// 辅助函数：用户准备投票（铸币→授权→兑换票据，逻辑不变）
async function prepareUserForVote(
  user: HardhatEthersSigner,
  token: PrivacyToken,
  voting: PrivacyVoting,
  pm: PredictionMarket,
  voteAmount: number
) {
  const userAddr = await user.getAddress();
  console.log(`\n🔧 为用户 ${userAddr.slice(0, 6)} 准备投票...`);

  // 1. 用户铸币（获取初始代币）
  await token.connect(user).mint(voteAmount);
  console.log(`   ✅ 用户铸币 ${voteAmount} PT`);

  // 2. 用户授权 PredictionMarket 使用票据（适配Vote合约的approve参数）
  await voting.connect(user).approve(await pm.getAddress(), voteAmount);
  console.log(`   ✅ 授权 PM 使用 ${voteAmount} 投票票据`);

  // 3. 用户兑换票据（Token → Voting Note，核心联动）
  await token.connect(user).deposit(voteAmount);
  console.log(`   ✅ 兑换 ${voteAmount} 投票票据`);

  // 验证票据余额（从Vote合约获取加密值，解密确认）
  const noteBalEnc = await voting.getVotingNoteBalance(userAddr);
  const noteBalDec = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    noteBalEnc,
    await voting.getAddress(),
    user
  );
  expect(noteBalDec).to.equal(BigInt(voteAmount));
  console.log(`   ✅ 票据余额验证：${noteBalDec}（预期：${voteAmount}）`);
}

// 主测试套件（完整业务流程）
describe("📝 PredictionMarket 测试（适配调整后Vote合约）", function () {
  let signers: Signers;
  let token: PrivacyToken;
  let voting: PrivacyVoting;
  let pm: PredictionMarket;
  let tokenAddr: string;
  let votingAddr: string;
  let pmAddr: string;
  let marketId: bigint; // 测试用市场ID（自增）

  before(async function () {
    console.log("\n======================================");
    console.log("👤 初始化测试账号...");
    const ethSigners = await ethers.getSigners();
    signers = {
      owner: ethSigners[0],
      user1: ethSigners[1],
      user2: ethSigners[2],
    };
    console.log(`- Owner: ${(await signers.owner.getAddress()).slice(0, 10)}...`);
    console.log(`- User1: ${(await signers.user1.getAddress()).slice(0, 10)}...`);
    console.log(`- User2: ${(await signers.user2.getAddress()).slice(0, 10)}...`);
    console.log("======================================\n");
  });

  beforeEach(async function () {
    console.log("======================================");
    console.log("🔄 部署新合约环境...");

    if (!fhevm.isMock) {
      console.warn("⚠️ 仅在FHEVM模拟环境运行，跳过测试");
      this.skip();
    }

    // 部署所有依赖合约（适配调整后的Vote合约）
    const contracts = await deployAllContracts(signers.owner);
    token = contracts.token;
    voting = contracts.voting;
    pm = contracts.predictionMarket;
    tokenAddr = await token.getAddress();
    votingAddr = await voting.getAddress();
    pmAddr = await pm.getAddress();

    console.log("✅ 合约环境部署完成");
    console.log("======================================\n");
  });

  // 测试1：创建市场（参数验证 + 事件触发，逻辑不变）
  it("1. 创建市场：参数验证 + MarketCreated事件", async function () {
    console.log("====== 开始测试：创建市场 ======");
    const ownerAddr = await signers.owner.getAddress();
    const marketTitle = "World Cup Final: Team A vs Team B";
    const description = "This great project!";
    const imageUrl = "https://market-image.uri";

    // 计算时间（当前+1小时投票截止，+2小时结果公布）
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    const voteEndTime = blockTime + VOTE_END_DELAY;
    const resultTime = blockTime + RESULT_DELAY;

    // 创建市场（仅Owner可操作）
    console.log(`1.1 创建市场：${marketTitle}`);
    const tx = await pm.connect(signers.owner).createMarket(
      marketTitle,
      description,
      imageUrl,
      MARKET_OPTIONS,
      MARKET_ODDS,
      voteEndTime,
      resultTime
    );
    await tx.wait();

    // 验证市场ID（从0开始自增）
    marketId = (await pm.nextMarketId()) - 1n;
    console.log(`   ✅ 市场创建成功，ID：${marketId}`);

    // 验证市场信息（与创建参数对齐）
    console.log("1.2 验证市场信息...");
    const marketInfo = await pm.getMarketInfo(marketId);
    expect(marketInfo.title).to.equal(marketTitle);
    expect(marketInfo.imageUrl).to.equal(imageUrl);
    expect(marketInfo.options).to.deep.equal(MARKET_OPTIONS);
    expect(marketInfo.odds).to.deep.equal(MARKET_ODDS.map(BigInt)); // 转BigInt适配类型
    expect(marketInfo.voteEndTime).to.equal(BigInt(voteEndTime));
    expect(marketInfo.resultTime).to.equal(BigInt(resultTime));
    expect(marketInfo.isSettled).to.be.false;
    expect(marketInfo.isCanceled).to.be.false;
    console.log("   ✅ 市场信息验证通过");

    // 验证MarketCreated事件（确保事件触发正确）
    const events = await pm.queryFilter(pm.filters.MarketCreated());
    const createdEvent = events[0];
    expect(createdEvent.args?.marketId).to.equal(marketId);
    expect(createdEvent.args?.creator).to.equal(ownerAddr);
    console.log("   ✅ MarketCreated 事件验证通过");

    console.log("====== 测试通过：创建市场 ======\n");
  });

  // 测试2：投票功能（用户用Vote合约的加密票据投票，核心联动）
  it("2. 投票功能：用户投票 + 票数记录（适配Vote加密票据）", async function () {
    console.log("====== 开始测试：投票功能 ======");
    const user1Addr = await signers.user1.getAddress();
    const user2Addr = await signers.user2.getAddress();
    const user1Option = 0; // 投给 Team A
    const user2Option = 1; // 投给 Team B

    // 前置1：创建市场（基础依赖）
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    await pm.connect(signers.owner).createMarket(
      "Test Vote Market",
      "https://test.url",
      MARKET_OPTIONS,
      MARKET_ODDS,
      blockTime + VOTE_END_DELAY,
      blockTime + RESULT_DELAY
    );
    marketId = (await pm.nextMarketId()) - 1n;
    console.log(`2.1 已创建测试市场，ID：${marketId}`);

    // 前置2：用户1、2准备投票（铸币+授权+兑换票据，依赖Vote合约）
    await prepareUserForVote(signers.user1, token, voting, pm, VOTE_AMOUNT);
    await prepareUserForVote(signers.user2, token, voting, pm, VOTE_AMOUNT);

    // 用户1投票（传递Vote合约的加密票据数量，非新生成加密值）
    console.log(`2.2 User1 投给选项${user1Option}（${MARKET_OPTIONS[user1Option]}）`);
    await pm.connect(signers.user1).vote(marketId, user1Option, VOTE_AMOUNT);

    // 用户2投票（同上）
    console.log(`2.3 User2 投给选项${user2Option}（${MARKET_OPTIONS[user2Option]}）`);
    await pm.connect(signers.user2).vote(marketId, user2Option, VOTE_AMOUNT);

    // 验证总票数（明文记录，直接读取）
    console.log("2.4 验证总票数...");
    const user1TotalVotes = await pm.getOptionTotalVotes(marketId, user1Option);
    const user2TotalVotes = await pm.getOptionTotalVotes(marketId, user2Option);
    expect(user1TotalVotes).to.equal(BigInt(VOTE_AMOUNT));
    expect(user2TotalVotes).to.equal(BigInt(VOTE_AMOUNT));
    console.log(`   ✅ 选项${user1Option}总票数：${user1TotalVotes}（预期：${VOTE_AMOUNT}）`);
    console.log(`   ✅ 选项${user2Option}总票数：${user2TotalVotes}（预期：${VOTE_AMOUNT}）`);

    // 验证用户投票记录（从Market获取加密值，解密确认）
    console.log("2.5 验证User1投票记录...");
    const user1VotesEnc = await pm.connect(signers.user1).getUserVotes(marketId, user1Addr);
    const user1VoteDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      user1VotesEnc[user1Option], // 仅解密用户投的选项
      pmAddr,
      signers.user1
    );
    expect(user1VoteDec).to.equal(BigInt(VOTE_AMOUNT));
    console.log(`   ✅ User1 选项${user1Option}投票：${user1VoteDec}（预期：${VOTE_AMOUNT}）`);

    console.log("====== 测试通过：投票功能 ======\n");
  });

  // 测试3：提交结果 + 结算市场（Owner操作，依赖Vote票据分配）
  it("3. 结果提交与结算：Owner操作 + 市场状态更新", async function () {
    console.log("====== 开始测试：结果提交与结算 ======");
    const winningOption = 0; // 获胜选项：Team A

    // 前置：创建市场 + 用户投票（基础依赖）
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    await pm.connect(signers.owner).createMarket(
      "Settlement Test Market",
      "https://settle.url",
      MARKET_OPTIONS,
      MARKET_ODDS,
      blockTime + VOTE_END_DELAY,
      blockTime + RESULT_DELAY
    );
    marketId = (await pm.nextMarketId()) - 1n;
    await prepareUserForVote(signers.user1, token, voting, pm, VOTE_AMOUNT);
    await pm.connect(signers.user1).vote(marketId, winningOption, VOTE_AMOUNT);
    console.log(`3.1 前置准备完成：市场ID=${marketId}，用户已投选项${winningOption}`);

    // 模拟时间流逝到结果公布时间后（关键：触发结算条件）
    console.log("3.2 模拟时间流逝到结果公布时间后...");
    await ethers.provider.send("evm_increaseTime", [RESULT_DELAY + 60]); // 超出结果时间1分钟
    await ethers.provider.send("evm_mine"); // 挖矿确认时间
    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    console.log(`   当前模拟时间：${new Date(currentTime * 1000).toLocaleString()}`);

    // 提交结果（仅Owner可操作）
    console.log(`3.3 Owner 提交获胜选项：${winningOption}（${MARKET_OPTIONS[winningOption]}）`);
    await pm.connect(signers.owner).submitResult(marketId, winningOption);

    // 验证结果已提交
    const marketInfoAfterSubmit = await pm.getMarketInfo(marketId);
    expect(marketInfoAfterSubmit.winningOption).to.equal(BigInt(winningOption));
    console.log("   ✅ 结果提交验证通过");

    // 结算市场（仅Owner可操作，内部调用Vote合约分配票据）
    console.log("3.4 Owner 结算市场...");
    await pm.connect(signers.owner).settleMarket(marketId);

    // 验证市场已结算
    const marketInfoAfterSettle = await pm.getMarketInfo(marketId);
    expect(marketInfoAfterSettle.isSettled).to.be.true;
    console.log("   ✅ 市场结算验证通过");

    console.log("====== 测试通过：结果提交与结算 ======\n");
  });

  // 测试4：取消市场 + 退款（修复变量错误，确保Vote票据返还）
  it("4. 取消市场与退款：权限控制（无需ADDER_ROLE，仅投票者可退）", async function () {
    console.log("====== 开始测试：取消市场与退款（权限验证） ======");
    const user1Addr = await signers.user1.getAddress();
    const user2Addr = await signers.user2.getAddress(); // 非投票用户
    const user1Option = 0; // 投给 Team A

    // 前置：创建市场 + User1投票（User2未投票）
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    await pm.connect(signers.owner).createMarket(
      "Cancel Test Market",
      "https://cancel.url",
      MARKET_OPTIONS,
      MARKET_ODDS,
      blockTime + VOTE_END_DELAY,
      blockTime + RESULT_DELAY
    );
    marketId = (await pm.nextMarketId()) - 1n;
    // User1投票（成为合法退款用户）
    await prepareUserForVote(signers.user1, token, voting, pm, VOTE_AMOUNT);
    await pm.connect(signers.user1).vote(marketId, user1Option, VOTE_AMOUNT);
    // User2未投票（无退款权限）
    console.log(`4.1 前置准备：User1已投票，User2未投票，市场ID=${marketId}`);

    // 取消市场（Owner操作）
    await pm.connect(signers.owner).cancelMarket(marketId);
    console.log("4.2 市场已取消，开始验证退款权限...");

    // 场景1：User1（投票者本人）退款（预期成功，无需ADDER_ROLE）
    console.log("4.3 User1（投票者）尝试退款...");
    await pm.connect(signers.user1).refund(marketId); // 无权限报错的话，这里会失败
    // 验证票据已返还
    const user1NoteBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await voting.getVotingNoteBalance(user1Addr),
      votingAddr,
      signers.user1
    );
    expect(user1NoteBalDec).to.equal(BigInt(VOTE_AMOUNT));
    console.log(`   ✅ User1退款成功，票据余额：${user1NoteBalDec}`);

    // 场景2：User2（非投票者）尝试退款（预期失败，无权限）
    console.log("4.4 User2（非投票者）尝试退款...");
    try {
      await pm.connect(signers.user2).refund(marketId);
      expect.fail("非投票者应无法退款");
    } catch (err: any) {
      expect(err.message).to.include("not a voter"); // 错误信息需与合约一致（如“未参与投票”）
      console.log("   ✅ 非投票者退款失败（正确）");
    }

    // 场景3：验证无需ADDER_ROLE（User1无ADDER_ROLE仍可退款）
    console.log("4.5 验证User1无ADDER_ROLE仍可退款...");
    const hasAdderRole = await pm.hasRole(await pm.ADDER_ROLE(), user1Addr);
    expect(hasAdderRole).to.be.false; // 确认User1无ADDER_ROLE
    console.log(`   ✅ User1无ADDER_ROLE：${!hasAdderRole}`);

    console.log("====== 测试通过：退款权限控制 ======\n");
  });

  // 测试5：领取奖励（启用并修复，适配Vote票据奖励）
  it("5. 领取奖励：获胜用户获得Vote票据奖励 + 不可重复领取", async function () {
    console.log("====== 开始测试：领取奖励 ======");
    const user1Addr = await signers.user1.getAddress();
    const winningOption = 0; // 获胜选项：Team A
    const odds = MARKET_ODDS[winningOption]; // 获胜赔率（150）
    // 核心修复3：BigInt运算适配（避免number×BigInt报错）
    const expectedReward = (BigInt(VOTE_AMOUNT) * BigInt(odds)) / 100n; // 500×150÷100=750

    // 前置：创建市场 → 用户投票 → 提交结果 → 结算（完整流程）
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    await pm.connect(signers.owner).createMarket(
      "Reward Test Market",
      "https://reward.url",
      MARKET_OPTIONS,
      MARKET_ODDS,
      blockTime + VOTE_END_DELAY,
      blockTime + RESULT_DELAY
    );
    marketId = (await pm.nextMarketId()) - 1n;
    // 仅用户1投票（确保获胜后能独占奖励）
    await prepareUserForVote(signers.user1, token, voting, pm, VOTE_AMOUNT);
    await pm.connect(signers.user1).vote(marketId, winningOption, VOTE_AMOUNT);

    // 模拟时间流逝 + 提交结果 + 结算
    await ethers.provider.send("evm_increaseTime", [RESULT_DELAY + 60]);
    await ethers.provider.send("evm_mine");
    await pm.connect(signers.owner).submitResult(marketId, winningOption);
    await pm.connect(signers.owner).settleMarket(marketId);
    console.log(`5.1 前置准备完成：市场已结算，获胜选项=${winningOption}`);

    // 领取前：查询User1 Vote票据余额（初始为0，因投票时已锁定）
    const preRewardNoteBalEnc = await voting.getVotingNoteBalance(user1Addr);
    const preRewardNoteBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      preRewardNoteBalEnc,
      votingAddr,
      signers.user1
    );
    console.log(`5.2 领取前票据余额：${preRewardNoteBalDec}（预期：0）`);

    // 用户1领取奖励（从Market获取Vote票据奖励）
    console.log(`5.3 User1 领取奖励（预期：${expectedReward} 票据）`);
    await pm.connect(signers.user1).claimReward(marketId);

    // 验证奖励到账（Vote票据余额增加）
    const postRewardNoteBalEnc = await voting.getVotingNoteBalance(user1Addr);
    const postRewardNoteBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      postRewardNoteBalEnc,
      votingAddr,
      signers.user1
    );
    expect(postRewardNoteBalDec).to.equal(expectedReward);
    console.log(`   ✅ 奖励到账：${postRewardNoteBalDec}（预期：${expectedReward}）`);

    // 验证不可重复领取
    console.log("5.4 验证不可重复领取...");
    try {
      await pm.connect(signers.user1).claimReward(marketId);
      console.error("   ❌ 重复领取未失败！");
      expect.fail("重复领取应被拒绝");
    } catch (err: any) {
      expect(err.message).to.include("already claimed"); // 需与Market合约错误信息对齐
      console.log("   ✅ 重复领取失败（正确）");
    }

    console.log("====== 测试通过：领取奖励 ======\n");
  });

  it("6. 市场详情查询：getMarketInfo 正确性验证", async function () {
    console.log("====== 开始测试：市场详情查询 ======");
    // 1. 创建测试市场（自定义参数）
    const testTitle = "Euro 2024 Final: Germany vs Spain";
    const testImageUrl = "https://euro2024.url";
    const testOptions = ["Germany Win", "Spain Win", "Draw"];
    const testOdds = [180, 200, 350];
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    const testVoteEnd = blockTime + 3600;
    const testResultTime = blockTime + 7200;

    await pm.connect(signers.owner).createMarket(
      testTitle,
      testImageUrl,
      testOptions,
      testOdds,
      testVoteEnd,
      testResultTime
    );
    const marketId = await pm.nextMarketId() - 1n;
    console.log(`1. 已创建测试市场，ID：${marketId}`);

    // 2. 调用getMarketInfo查询详情
    const marketInfo = await pm.getMarketInfo(marketId);

    // 3. 验证详情参数与创建时一致
    expect(marketInfo.title).to.equal(testTitle);
    expect(marketInfo.imageUrl).to.equal(testImageUrl);
    expect(marketInfo.options).to.deep.equal(testOptions);
    expect(marketInfo.odds).to.deep.equal(testOdds.map(BigInt)); // 转BigInt匹配返回类型
    expect(marketInfo.voteEndTime).to.equal(BigInt(testVoteEnd));
    expect(marketInfo.resultTime).to.equal(BigInt(testResultTime));
    console.log(`market 详情 winningOption:${marketInfo.winningOption}`);
    console.log(`market 详情 isSettled:${marketInfo.isSettled}`)
    console.log(`market 详情 isCanceled:${marketInfo.isCanceled}`)

    console.log(`   ✅ 市场详情验证通过：ID=${marketId}，标题=${marketInfo.title}`);
    console.log("====== 测试通过：市场详情查询 ======\n");
  });

  it("7. 市场分页列表：getMarketList 分页逻辑验证", async function () {
    console.log("====== 开始测试：市场分页列表 ======");
    // 1. 先创建5个测试市场（ID：0-4）
    const totalMarkets = 5;
    const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
    for (let i = 0; i < totalMarkets; i++) {
      await pm.connect(signers.owner).createMarket(
        `Test Market ${i + 1}`,
        `https://img-${i + 1}.url`,
        ["Option A", "Option B"],
        [150, 180],
        blockTime + 3600,
        blockTime + 7200
      );
    }

    // 2. 调用分页列表（page=1，pageSize=2，降序：ID4→3）
    const { items: page1Items, totalCount } = await pm.getMarketList(1, 2, true);
    expect(totalCount).to.equal(BigInt(totalMarkets));
    expect(page1Items.length).to.equal(2);
    console.log("第1页列表（降序，page=1，pageSize=2）：", page1Items);
    // 验证第1页ID为4和3
    expect(page1Items[0].marketId).to.equal(BigInt(4));
    expect(page1Items[1].marketId).to.equal(BigInt(3));

    // 3. 调用第3页（page=3，pageSize=2，降序：ID0，仅1条数据）
    const { items: page3Items } = await pm.getMarketList(3, 2, true);
    expect(page3Items.length).to.equal(1);
    expect(page3Items[0].marketId).to.equal(BigInt(0));
    console.log("第3页列表（降序，page=3，pageSize=2）：", page3Items);

    console.log("====== 测试通过：市场分页列表 ======\n");
  });

  it("8. 投票记录与现有逻辑一致性验证", async function () {
    console.log("====== 开始测试：投票记录与现有逻辑 ======");
    // 1. 创建市场并让用户投票2次（同一用户投同一选项）
    await pm.connect(signers.owner).createMarket(
      "Vote Record Compatibility Test",
      "https://compatibility.url",
      ["A", "B"],
      [150, 200],
      Math.floor(Date.now() / 1000) + 3600,
      Math.floor(Date.now() / 1000) + 7200
    );
    const marketId = 0n;
    const user1Addr = await signers.user1.getAddress();

    // 第一次投票：500票
    await prepareUserForVote(signers.user1, token, voting, pm, 500);
    await pm.connect(signers.user1).vote(marketId, 0, 500);

    // 第二次投票：300票（同一用户，同一选项）
    await prepareUserForVote(signers.user1, token, voting, pm, 300);
    await pm.connect(signers.user1).vote(marketId, 0, 300);

    // 2. 验证 totalVotes 与投票记录的 amount 总和一致
    const totalVotesOption0 = await pm.getOptionTotalVotes(marketId, 0);
    expect(totalVotesOption0).to.equal(800); // 500 + 300

    // 3. 验证投票记录（共2条，金额累加正确）
    const { records, totalCount } = await pm.getMarketVoteRecords(marketId, 1, 10);
    expect(totalCount).to.equal(2);
    expect(records[0].amount).to.equal(500);
    expect(records[1].amount).to.equal(300);
    expect(records[0].voter).to.equal(user1Addr);
    expect(records[1].voter).to.equal(user1Addr);

    // 4. 验证用户投票记录（2条）
    const user1Records = await pm.getUserVotesInMarket(marketId, user1Addr);
    expect(user1Records.length).to.equal(2);
    expect(user1Records[0].optionIndex).to.equal(0);
    expect(user1Records[1].optionIndex).to.equal(0);

    console.log("   ✅ 投票记录与现有 totalVotes、用户投票逻辑一致");
    console.log("====== 测试通过：投票记录兼容性 ======\n");
  });
});