import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  PrivacyToken,
  PrivacyToken__factory,
  PrivacyVoting,
  PrivacyVoting__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// 1. 补充Vote合约所需的票据元数据（适配新构造函数）
const VOTE_NOTE_NAME = "Test Voting Note"; // 票据名称
const VOTE_NOTE_SYMBOL = "TVN";            // 票据符号
const VOTE_NOTE_DECIMALS = 0;              // 票据小数位（加密票据通常用0）
const TEST_MINT_AMOUNT = 100;              // 补充未定义变量

// 2. 业务常量（不变）
const MAX_TOTAL_SUPPLY = 1_000_000n;
const INITIAL_MINT_AMOUNT = 10_000;
const TOKEN_NAME = "Privacy Token";
const TOKEN_SYMBOL = "PT";
const TOKEN_URI = "https://privacy-token.uri";

// 3. 修正Signers类型（统一账号命名，避免冲突）
type Signers = {
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner; // 作为minter角色+测试用户
  user2: HardhatEthersSigner;
};

// 角色常量
const MINTER_ROLE = ethers.id("MINTER_ROLE");

// ============================
// 修正1：部署PrivacyVoting（传全构造参数+后续绑定Token）
// ============================
async function deployPrivacyVoting(owner: HardhatEthersSigner): Promise<PrivacyVoting> {
  console.log("\n📦 部署 PrivacyVoting 合约...");
  const votingFactory = (await ethers.getContractFactory(
    "PrivacyVoting",
    owner
  )) as PrivacyVoting__factory;

  // 关键：传全4个构造参数（适配Vote合约新构造）
  const voting = await votingFactory.deploy(
    await owner.getAddress(), // initialOwner
    VOTE_NOTE_NAME,           // _noteName
    VOTE_NOTE_SYMBOL,         // _noteSymbol
    VOTE_NOTE_DECIMALS        // _noteDecimals
  );
  await voting.waitForDeployment();
  const votingAddr = await voting.getAddress();
  console.log(`✅ PrivacyVoting 地址：${votingAddr}`);

  // 初始授权：给owner授予MINTER/ADMIN角色（合约内已做，此处可省略）
  return voting;
}

// ============================
// 修正2：部署PrivacyToken + 绑定Vote（含双向权限）
// ============================
async function deployAndLinkContracts(owner: HardhatEthersSigner): Promise<{
  privacyVoting: PrivacyVoting;
  privacyToken: PrivacyToken;
  votingAddr: string;
  tokenAddr: string;
}> {
  // 步骤1：先部署Vote（无Token地址，后续绑定）
  const privacyVoting = await deployPrivacyVoting(owner);
  const votingAddr = await privacyVoting.getAddress();

  // 步骤2：部署Token（传入Vote地址，适配Token的deposit逻辑）
  console.log("\n📦 部署 PrivacyToken 合约...");
  const tokenFactory = (await ethers.getContractFactory(
    "PrivacyToken",
    owner
  )) as PrivacyToken__factory;
  const privacyToken = await tokenFactory.deploy(
    await owner.getAddress(),  // Token初始owner
    INITIAL_MINT_AMOUNT,       // Token初始铸币量（给owner）
    TOKEN_NAME,                // Token名称
    TOKEN_SYMBOL,              // Token符号
    TOKEN_URI,                 // Token URI
    votingAddr                 // 关联的Vote地址（Token的deposit需调用Vote的mint）
  );
  await privacyToken.waitForDeployment();
  const tokenAddr = await privacyToken.getAddress();
  console.log(`✅ PrivacyToken 地址：${tokenAddr}`);

  // 步骤3：给Vote绑定Token地址（关键！解决Vote的withdraw依赖）
  await privacyVoting.connect(owner).setPrivacyToken(tokenAddr);
  const isTokenSet = await privacyVoting.isPrivacyTokenSet();
  expect(isTokenSet).to.be.true;
  console.log(`✅ PrivacyVoting 已绑定Token地址：${await privacyVoting.privacyToken()}`);

  // 步骤4：双向权限授权
  // - 给Vote授予Token的MINTER_ROLE（Vote的withdraw需调用Token的confidentialMint）
  await privacyToken.grantRole(MINTER_ROLE, votingAddr);
  const voteHasTokenMinter = await privacyToken.hasRole(MINTER_ROLE, votingAddr);
  console.log(`✅ PrivacyVoting 获Token的MINTER_ROLE：${voteHasTokenMinter}`);

  // - 给Token授予Vote的MINTER_ROLE（Token的deposit需调用Vote的mint）
  const voteMinterRole = await privacyVoting.MINTER_ROLE();
  await privacyVoting.grantRole(voteMinterRole, tokenAddr);
  const tokenHasVoteMinter = await privacyVoting.hasRole(voteMinterRole, tokenAddr);
  console.log(`✅ PrivacyToken 获Vote的MINTER_ROLE：${tokenHasVoteMinter}`);

  return { privacyVoting, privacyToken, votingAddr, tokenAddr };
}

// ============================
// 主测试套件（修正用例变量和逻辑）
// ============================
describe("📝 PrivacyToken + PrivacyVoting 整合测试（修正部署）", function () {
  let signers: Signers;
  let privacyVoting: PrivacyVoting;
  let privacyToken: PrivacyToken;
  let votingAddr: string;
  let tokenAddr: string;

  before(async function () {
    console.log("\n👤 初始化测试账号...");
    const ethSigners = await ethers.getSigners();
    signers = {
      owner: ethSigners[0],
      user1: ethSigners[1], // 复用为minter角色+测试用户
      user2: ethSigners[2],
    };
    console.log(`👤 Owner: ${(await signers.owner.getAddress()).slice(0, 10)}...`);
    console.log(`👤 User1 (Minter): ${(await signers.user1.getAddress()).slice(0, 10)}...`);
    console.log(`👤 User2: ${(await signers.user2.getAddress()).slice(0, 10)}...`);

    // 初始化FHEVM模拟环境
    if (!fhevm.isMock) {
      console.warn("⚠️ 仅在FHEVM模拟环境运行");
      this.skip();
    }
  });

  beforeEach(async function () {
    console.log("\n======================================");
    console.log("🔄 部署新合约环境（Vote + Token）...");

    // 调用修正后的部署函数（含绑定和权限）
    const deployResult = await deployAndLinkContracts(signers.owner);
    privacyVoting = deployResult.privacyVoting;
    privacyToken = deployResult.privacyToken;
    votingAddr = deployResult.votingAddr;
    tokenAddr = deployResult.tokenAddr;

    console.log("✅ 合约环境部署完成");
    console.log("======================================\n");
  });

  // 测试1：初始化验证（修正余额查询方法）
  it("1. 初始化验证：合约绑定+初始余额", async function () {
    console.log("\n🚀 测试初始化...");
    const ownerAddr = await signers.owner.getAddress();

    // 验证Token关联的Vote地址
    const linkedVoting = await privacyToken.privacyVoting();
    expect(linkedVoting).to.equal(votingAddr);
    console.log(`📌 Token关联Vote：${linkedVoting.slice(0, 10)}...（正确）`);

    // 验证Owner的Token初始余额（用ERC7984内置的confidentialBalanceOf）
    const ownerBalEnc = await privacyToken.confidentialBalanceOf(ownerAddr);
    const ownerBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      ownerBalEnc,
      tokenAddr,
      signers.owner
    );
    expect(ownerBalDec).to.equal(BigInt(INITIAL_MINT_AMOUNT));
    console.log(`📌 Owner初始Token余额：${ownerBalDec}（正确）`);

    // 验证Vote的票据元数据
    const voteName = await privacyVoting.getNoteNameString();
    const voteSymbol = await privacyVoting.getNoteSymbolString();
    const voteDecimals = await privacyVoting.noteDecimals();
    expect(voteName).to.equal(VOTE_NOTE_NAME);
    expect(voteSymbol).to.equal(VOTE_NOTE_SYMBOL);
    expect(voteDecimals).to.equal(VOTE_NOTE_DECIMALS);
    console.log(`📌 Vote票据元数据：${voteName}(${voteSymbol})（正确）`);

    console.log("✅ 初始化测试通过\n");
  });

  // 测试2：mint功能（修正超量判断）
  it("2. mint功能：总量控制", async function () {
    console.log("\n🚀 测试mint功能...");
    const user1Addr = await signers.user1.getAddress();
    const mintAmount = 50_000;
    const overAmount = Number(MAX_TOTAL_SUPPLY) - INITIAL_MINT_AMOUNT + 100; // 超总量

    // 给User1授予Token的MINTER_ROLE
    await privacyToken.grantRole(MINTER_ROLE, user1Addr);

    // 正常铸币
    await privacyToken.connect(signers.user1).mint(mintAmount);
    const user1BalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyToken.confidentialBalanceOf(user1Addr),
      tokenAddr,
      signers.user1
    );
    expect(user1BalDec).to.equal(BigInt(mintAmount));
    console.log(`📌 User1正常铸币${mintAmount}（余额正确）`);

    // 超量铸币（预期失败）
    try {
      await privacyToken.connect(signers.user1).mint(overAmount);
      expect.fail("超量铸币应回滚");
    } catch (err: any) {
      expect(err.message).to.include("Panic");
      console.log(`📌 超量铸币${overAmount}（回滚正确）`);
    }

    console.log("✅ mint测试通过\n");
  });

  // 测试3：deposit功能（修正票据余额查询）
  it("3. deposit功能：代币兑换票据", async function () {
    console.log("\n🚀 测试deposit功能...");
    const user1Addr = await signers.user1.getAddress();
    const depositAmount = 5_000;

    // 前置：User1铸币并授权
    await privacyToken.connect(signers.user1).mint(depositAmount);

    // 执行deposit
    await privacyToken.connect(signers.user1).deposit(depositAmount);

    // 验证Token余额清零
    const tokenBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyToken.confidentialBalanceOf(user1Addr),
      tokenAddr,
      signers.user1
    );
    expect(tokenBalDec).to.equal(BigInt(0));
    console.log(`📌 deposit后Token余额：0（正确）`);

    // 验证Vote票据余额增加
    const noteBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyVoting.getVotingNoteBalance(user1Addr),
      votingAddr,
      signers.user1
    );
    expect(noteBalDec).to.equal(BigInt(depositAmount));
    console.log(`📌 deposit后票据余额：${noteBalDec}（正确）`);

    console.log("✅ deposit测试通过\n");
  });

  // 测试4：burn功能（不变）
  it("4. burn功能：owner销毁指定地址代币", async function () {
    console.log("\n🚀 测试burn功能...");
    const user2Addr = await signers.user2.getAddress();
    const burnAmount = 3_000;

    // 前置：User2铸币
    await privacyToken.connect(signers.user2).mint(burnAmount);

    // Owner执行burn
    await privacyToken.connect(signers.owner).burn(user2Addr, burnAmount);

    // 验证余额清零
    const user2BalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyToken.confidentialBalanceOf(user2Addr),
      tokenAddr,
      signers.user2
    );
    expect(user2BalDec).to.equal(BigInt(0));
    console.log(`📌 burn后User2余额：0（正确）`);

    console.log("✅ burn测试通过\n");
  });

  // 测试5：总供应量权限（不变）
  it("5. 总供应量权限：仅owner可解密", async function () {
    console.log("\n🚀 测试总供应量权限...");
    const mintAmount = 100_000;
    await privacyToken.connect(signers.user1).mint(mintAmount);

    // Owner可解密
    const ownerDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyToken.getTotalSupply(),
      tokenAddr,
      signers.owner
    );
    expect(ownerDec).to.equal(BigInt(INITIAL_MINT_AMOUNT + mintAmount));
    console.log(`📌 Owner解密总供应量：${ownerDec}（正确）`);

    // User1不可解密
    try {
      await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await privacyToken.getTotalSupply(),
        tokenAddr,
        signers.user1
      );
      expect.fail("User1不应解密总供应量");
    } catch (err: any) {
      console.log(`📌 User1解密失败（正确）`);
    }

    console.log("✅ 总供应量权限测试通过\n");
  });

});