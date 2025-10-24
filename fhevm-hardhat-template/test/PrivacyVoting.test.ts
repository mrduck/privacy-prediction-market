import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
// 1. 补充 PrivacyToken 类型导入（关键：之前缺失）
import {
  PrivacyToken,
  PrivacyToken__factory,
  PrivacyVoting,
  PrivacyVoting__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// 2. 业务常量（与你之前的PrivacyToken逻辑对齐）
const INITIAL_MINT_AMOUNT = 10_000; // PrivacyToken初始铸币量
const TOKEN_NAME = "Privacy Token";
const TOKEN_SYMBOL = "PT";
const TOKEN_URI = "https://privacy-token.uri";
const DEPOSIT_AMOUNT = 500;
const WITHDRAW_AMOUNT = 300;
const INITIAL_TOKEN_MINT = 1000;
type Signers = {
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
};

// 3. 角色常量（与合约一致）
const MINTER_ROLE = ethers.id("MINTER_ROLE");
const ADDER_ROLE = ethers.id("ADDER_ROLE");

// 4. 联合部署：同时部署PrivacyVoting + PrivacyToken，并建立关联（核心补充）
async function deployBothContracts(
  owner: HardhatEthersSigner,
  votingNoteName: string,
  votingNoteSymbol: string,
  votingNoteDecimals: number
): Promise<{
  privacyVoting: PrivacyVoting;
  privacyToken: PrivacyToken;
  votingAddr: string;
  tokenAddr: string;
  minterRole: string;
}> {
  console.log("\n📦 开始部署：PrivacyVoting + PrivacyToken");

  // 步骤1：先部署PrivacyVoting（因为Token需要Voting地址）
  const votingFactory = (await ethers.getContractFactory(
    "PrivacyVoting",
    owner
  )) as PrivacyVoting__factory;
  const privacyVoting = await votingFactory.deploy(
    await owner.getAddress(),
    votingNoteName,
    votingNoteSymbol,
    votingNoteDecimals
  );
  await privacyVoting.waitForDeployment();
  const votingAddr = await privacyVoting.getAddress();
  const minterRole = await privacyVoting.MINTER_ROLE(); // 获取Voting的MINTER_ROLE
  console.log(`✅ PrivacyVoting 部署完成：${votingAddr}`);

  // 步骤2：部署PrivacyToken（传入Voting地址，建立关联）
  const tokenFactory = (await ethers.getContractFactory(
    "PrivacyToken",
    owner
  )) as PrivacyToken__factory;
  const privacyToken = await tokenFactory.deploy(
    await owner.getAddress(), // Token的初始Owner
    INITIAL_MINT_AMOUNT,      // Token初始铸币量
    TOKEN_NAME,               // Token名称
    TOKEN_SYMBOL,             // Token符号
    TOKEN_URI,                // Token URI
    votingAddr                // 关联的PrivacyVoting地址（关键）
  );
  await privacyToken.waitForDeployment();
  const tokenAddr = await privacyToken.getAddress();
  console.log(`✅ PrivacyToken 部署完成：${tokenAddr}`);

  //设置token地址
  await privacyVoting.connect(owner).setPrivacyToken(tokenAddr);
  // 步骤3：给PrivacyToken授予Voting的MINTER_ROLE（关键：确保Token能调用Voting的mint）
  await privacyVoting.grantRole(minterRole, tokenAddr);
  const hasRole = await privacyVoting.hasRole(minterRole, tokenAddr);
  await privacyToken.grantRole(MINTER_ROLE, votingAddr);
  console.log(`✅ PrivacyToken 已获得MINTER_ROLE：${hasRole}`);

  return { privacyVoting, privacyToken, votingAddr, tokenAddr, minterRole };
}

// 主测试套件
describe("📝 PrivacyVoting 测试（含PrivacyToken联动）", function () {
  // 5. 补充全局变量：包含Token相关（之前缺失）
  let signers: Signers;
  let privacyVoting: PrivacyVoting;
  let privacyToken: PrivacyToken; // 新增Token全局变量
  let votingAddr: string;
  let tokenAddr: string;         // 新增Token地址全局变量
  let minterRole: string;        // 新增角色变量

  // 测试用元数据（Voting票据的元数据）
  const testVotingName = "Test Privacy Note";
  const testVotingSymbol = "TPN";
  const testVotingDecimals = 0;

  before(async function () {
    console.log("\n======================================");
    console.log("👤 初始化测试账号...");
    const ethSigners = await ethers.getSigners();
    signers = {
      owner: ethSigners[0],
      user1: ethSigners[1],
      user2: ethSigners[2],
    };
    console.log(`- Owner: ${await signers.owner.getAddress()}`);
    console.log(`- User1: ${await signers.user1.getAddress()}`);
    console.log(`- User2: ${await signers.user2.getAddress()}`);
    console.log("======================================\n");
  });

  beforeEach(async function () {
    console.log("======================================");
    console.log("🔄 部署新合约环境（Voting + Token）...");

    if (!fhevm.isMock) {
      console.warn("⚠️ 仅在FHEVM模拟环境运行，跳过测试");
      this.skip();
    }

    // 6. 调用联合部署函数：同时部署两个合约（核心修正）
    const deployResult = await deployBothContracts(
      signers.owner,
      testVotingName,
      testVotingSymbol,
      testVotingDecimals
    );
    privacyVoting = deployResult.privacyVoting;
    privacyToken = deployResult.privacyToken; // 赋值Token全局变量
    votingAddr = deployResult.votingAddr;
    tokenAddr = deployResult.tokenAddr;       // 赋值Token地址
    minterRole = deployResult.minterRole;

    // 验证Voting元数据（原有逻辑保留）
    console.log("2. 验证 PrivacyVoting 元数据...");
    const deployedVotingName = await privacyVoting.getNoteNameString();
    const deployedVotingSymbol = await privacyVoting.getNoteSymbolString();
    const deployedVotingDecimals = await privacyVoting.noteDecimals();
    expect(deployedVotingName).to.equal(testVotingName);
    expect(deployedVotingSymbol).to.equal(testVotingSymbol);
    expect(deployedVotingDecimals).to.equal(testVotingDecimals);
    console.log(`   ✅ Voting元数据：名称=${deployedVotingName}，符号=${deployedVotingSymbol}`);

    // 验证Token元数据（新增：确保Token部署正确）
    console.log("3. 验证 PrivacyToken 元数据...");
    const deployedTokenName = await privacyToken.name();
    const deployedTokenSymbol = await privacyToken.symbol();
    expect(deployedTokenName).to.equal(TOKEN_NAME);
    expect(deployedTokenSymbol).to.equal(TOKEN_SYMBOL);
    console.log(`   ✅ Token元数据：名称=${deployedTokenName}，符号=${deployedTokenSymbol}`);

    console.log("✅ 合约环境部署完成（Voting + Token）");
    console.log("======================================\n");
  });

  // 原有测试1：mint功能（保留，无需修改）
  it("1. mint功能：铸造票据并授权用户", async function () {
    console.log("====== 开始测试：mint功能 ======");
    const user1Addr = await signers.user1.getAddress();
    const mintAmount = 1000;

    await privacyVoting.connect(signers.owner).mint(user1Addr, mintAmount);
    const noteBalEnc = await privacyVoting.getVotingNoteBalance(user1Addr);
    const noteBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      noteBalEnc,
      votingAddr,
      signers.user1
    );

    expect(noteBalDec).to.equal(BigInt(mintAmount));
    console.log(`   ✅ 余额验证通过：解密值=${noteBalDec}，预期=${mintAmount}`);
    console.log("====== 测试通过：mint功能 ======\n");
  });

  // 原有测试2：approve + transferFrom（保留，无需修改）
  it("2. 授权与转移：approve + transferFrom", async function () {
    console.log("====== 开始测试：授权与转移 ======");
    const user1Addr = await signers.user1.getAddress();
    const user2Addr = await signers.user2.getAddress();
    const mintAmount = 2000;
    const transferAmount = 500;

    await privacyVoting.connect(signers.owner).mint(user1Addr, mintAmount);
    await privacyVoting.connect(signers.user1).approve(user2Addr, transferAmount);
    await privacyVoting.connect(signers.user2).transferFrom(user1Addr, user2Addr, transferAmount);

    const user1BalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyVoting.getVotingNoteBalance(user1Addr),
      votingAddr,
      signers.user1
    );
    const user2BalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyVoting.getVotingNoteBalance(user2Addr),
      votingAddr,
      signers.user2
    );

    expect(user1BalDec).to.equal(BigInt(mintAmount - transferAmount));
    expect(user2BalDec).to.equal(BigInt(transferAmount));
    console.log(`   ✅ User1余额：${user1BalDec}，User2余额：${user2BalDec}`);
    console.log("====== 测试通过：授权与转移 ======\n");
  });

  // 原有测试3：burn功能（保留，无需修改）
  it("3. burn功能：销毁票据", async function () {
    console.log("====== 开始测试：burn功能 ======");
    const user1Addr = await signers.user1.getAddress();
    const mintAmount = 1500;
    const burnAmount = 1000;

    await privacyVoting.connect(signers.owner).mint(user1Addr, mintAmount);
    await privacyVoting.connect(signers.user1).burn(burnAmount);

    const user1BalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyVoting.getVotingNoteBalance(user1Addr),
      votingAddr,
      signers.user1
    );

    expect(user1BalDec).to.equal(BigInt(mintAmount - burnAmount));
    console.log(`   ✅ 销毁后余额：${user1BalDec}，预期：${mintAmount - burnAmount}`);
    console.log("====== 测试通过：burn功能 ======\n");
  });

  // 新增测试4：addVotingNote（基于Token deposit，现在可正常运行）
  // 测试4：addVotingNote功能（基于deposit后的已有加密票据余额）
  it("4. addVotingNote功能：用deposit后的加密票据余额调用", async function () {
    console.log("====== 开始测试：addVotingNote（用已有加密票据） ======");
    const user1Addr = await signers.user1.getAddress();
    const tokenDepositAmount = 5000; // 要deposit的Token数量（最终转为加密票据）

    // ------------------------------
    // 步骤1：User1 mint Token → deposit 兑换加密票据
    // ------------------------------
    console.log(`1. User1 mint并deposit ${tokenDepositAmount} Token，获取加密票据`);
    // 1.1 铸Token
    await privacyToken.connect(signers.user1).mint(tokenDepositAmount);
    // 1.2 兑换票据（deposit后，Voting中生成加密票据余额）
    await privacyToken.connect(signers.user1).deposit(tokenDepositAmount);

    // 1.3 获取deposit后的【已有加密票据余额】（核心：这个就是要用来操作的加密值）
    const existingEncryptedNote = await privacyVoting.getVotingNoteBalance(user1Addr);
    console.log(`   ✅ 已获取deposit后的加密票据：`, existingEncryptedNote);
    // 解密验证已有余额（确认是5000）
    const existingNoteDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      existingEncryptedNote,
      votingAddr,
      signers.user1
    );
    expect(existingNoteDec).to.equal(BigInt(tokenDepositAmount));
    console.log(`   ✅ 解密验证已有票据余额：${existingNoteDec}`);


    // ------------------------------
    // 步骤2：直接用【已有加密票据】调用addVotingNote（核心修正）
    // ------------------------------
    console.log(`2. Owner用已有加密票据调用addVotingNote（增加票据）`);
    // 重点：参数直接传deposit后的加密票据余额（existingEncryptedNote），不新生成加密值
    await privacyVoting.connect(signers.owner).addVotingNote(
      user1Addr,
      existingEncryptedNote // 直接用已有加密票据，不是新造的！
    );


    // ------------------------------
    // 步骤3：验证add后余额（已有余额 + 已有余额 = 10000，假设add是累加逻辑）
    // ------------------------------
    const finalEncryptedNote = await privacyVoting.getVotingNoteBalance(user1Addr);
    const finalNoteDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      finalEncryptedNote,
      votingAddr,
      signers.user1
    );
    const expectedBal = BigInt(tokenDepositAmount) * 2n; // 原有5000 + 增加的5000 = 10000
    expect(finalNoteDec).to.equal(expectedBal);
    console.log(`   ✅ add后最终余额：${finalNoteDec}，预期：${expectedBal}`);

    console.log("====== 测试通过：addVotingNote功能 ======\n");
  });

// 测试5：票据权限（用已有加密票据验证非ADDER_ROLE不可操作）
  it("5. 票据权限：非ADDER_ROLE无法用已有加密票据调用addVotingNote", async function () {
    console.log("====== 开始测试：票据权限（用已有加密票据） ======");
    const user1Addr = await signers.user1.getAddress(); // 无ADDER_ROLE
    const user2Addr = await signers.user2.getAddress();
    const tokenDepositAmount = 3000;

    // ------------------------------
    // 步骤1：User2先deposit获取【已有加密票据】
    // ------------------------------
    console.log(`1. User2 mint并deposit ${tokenDepositAmount} Token，获取加密票据`);
    await privacyToken.connect(signers.user2).mint(tokenDepositAmount);
    await privacyToken.connect(signers.user2).deposit(tokenDepositAmount);
    // 获取User2的已有加密票据
    const user2ExistingEncryptedNote = await privacyVoting.getVotingNoteBalance(user2Addr);
    console.log(`   ✅ User2的已有加密票据：`, user2ExistingEncryptedNote);


    // ------------------------------
    // 场景1：User1（非ADDER_ROLE）用已有加密票据调用add，预期失败
    // ------------------------------
    console.log(`2. User1（非ADDER_ROLE）尝试用User2的加密票据调用add`);
    try {
      await privacyVoting.connect(signers.user1).addVotingNote(
        user2Addr,
        user2ExistingEncryptedNote // 用已有加密票据作为参数
      );
      expect.fail("非ADDER_ROLE应被拒绝");
    } catch (err: any) {
      expect(err.message).to.include("AccessControl: account");
      expect(err.message).to.include(ADDER_ROLE);
      console.log(`   ✅ 验证通过：非ADDER_ROLE被拒绝`);
    }


    // ------------------------------
    // 场景2：Owner（ADDER_ROLE）用已有加密票据调用add，预期成功
    // ------------------------------
    console.log(`3. Owner（ADDER_ROLE）用User2的加密票据调用add`);
    await privacyVoting.connect(signers.owner).addVotingNote(
      user2Addr,
      user2ExistingEncryptedNote
    );
    // 验证余额增加
    const finalNoteDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await privacyVoting.getVotingNoteBalance(user2Addr),
      votingAddr,
      signers.user2
    );
    expect(finalNoteDec).to.equal(BigInt(tokenDepositAmount) * 2n);
    console.log(`   ✅ 验证通过：Owner操作后余额=${finalNoteDec}`);

    console.log("====== 测试通过：票据权限 ======\n");
  });

  // 仅展示核心修改部分，其他代码保持不变
  it("6. 正常流程：deposit获取票据 → withdraw提现为代币", async function () {
    console.log("====== 测试正常提现流程 ======");
    const user1Addr = await signers.user1.getAddress();

    // 步骤1：User1 铸造代币（验证余额）
    await privacyToken.connect(signers.user1).mint(INITIAL_TOKEN_MINT);
    console.log(`用户1:${user1Addr}mint代币金额:${INITIAL_TOKEN_MINT}`);
    const preDepositTokenBalEnc = await privacyToken.getConfidentialBalance(user1Addr); // 修正：使用get方法
    const preDepositTokenBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      preDepositTokenBalEnc,
      tokenAddr,
      signers.user1
    );
    console.log(`用户1:${user1Addr}代币余额:${preDepositTokenBalDec}`)
    expect(preDepositTokenBalDec).to.equal(BigInt(INITIAL_TOKEN_MINT));

    // 步骤2：User1 deposit代币（验证代币余额减少）
    await privacyToken.connect(signers.user1).deposit(DEPOSIT_AMOUNT);
    console.log(`用户1:${user1Addr}充值余额:${DEPOSIT_AMOUNT}`)
    const postDepositTokenBalEnc = await privacyToken.getConfidentialBalance(user1Addr); // 修正：使用get方法
    const postDepositTokenBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      postDepositTokenBalEnc,
      tokenAddr,
      signers.user1
    );
    console.log(`用户1:${user1Addr}充值余额:${DEPOSIT_AMOUNT}后还剩余token:${postDepositTokenBalDec}`)
    expect(postDepositTokenBalDec).to.equal(BigInt(INITIAL_TOKEN_MINT - DEPOSIT_AMOUNT));
    const withdrawAmount = await fhevm.createEncryptedInput(votingAddr,user1Addr)
      .add64(postDepositTokenBalDec)
      .encrypt();
    await privacyVoting.connect(signers.user1).withdrawNoteToToken(withdrawAmount.handles[0],withdrawAmount.inputProof);
    // 步骤3：提现后验证代币余额增加
    const postWithdrawTokenBalEnc = await privacyToken.getConfidentialBalance(user1Addr); // 修正：使用get方法
    const postWithdrawTokenBalDec = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      postWithdrawTokenBalEnc,
      tokenAddr,
      signers.user1
    );
    console.log(`用户1:${user1Addr}预提现金额:${postDepositTokenBalDec}--成功提现金额:${postWithdrawTokenBalDec}`)
    const expectedTokenBal = BigInt(INITIAL_TOKEN_MINT - DEPOSIT_AMOUNT + WITHDRAW_AMOUNT);
    console.log(`提现成功`);
    expect(postWithdrawTokenBalDec).to.equal(expectedTokenBal);

    console.log("====== 正常提现流程测试通过 ======\n");
  });
});