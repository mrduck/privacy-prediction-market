// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {FHE, euint64, ebool,externalEuint32,externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./interfaces/IPrivacyVoting.sol";
import "./PrivacyToken.sol";

contract PrivacyVoteTicket is SepoliaConfig, Ownable2Step, AccessControl, IPrivacyVoting {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADDER_ROLE = keccak256("ADDER_ROLE");
    bytes32 public immutable noteName;
    bytes32 public immutable noteSymbol;
    uint8 public immutable noteDecimals;
    // 1. 将原有的 immutable 改为普通变量（允许后续修改）
    PrivacyToken public privacyToken;
    // 2. 新增“是否已设置Token地址”的标记（防止重复设置）
    bool public isPrivacyTokenSet;
    euint64 private immutable _encryptedZero; // 不可变的加密0值

    mapping(address => euint64) private _votingNoteBalances; // 用户票据余额（加密）

    mapping(address => mapping(address => euint64)) private _allowance;

    // 事件
    event NoteMinted(address indexed to, uint64 indexed amount);
    event NoteAdded(address indexed to, euint64 indexed encryptedAmount);
    event NoteBurned(address indexed from, uint64 indexed amount);
    event NoteApproved(address indexed owner, address indexed spender, euint64 indexed amount);
    event NoteTransferredFrom(address indexed from, address indexed to, euint64 indexed amount);
    event NoteWithdrawn(address indexed user, euint64 indexed noteAmount);
    event PrivacyTokenSet(address indexed privacyToken);

    // 修正：构造函数传递 Ownable 所需的 initialOwner 参数
    constructor(
        address initialOwner,
        string memory _noteName,    // 传入明文名称
        string memory _noteSymbol,  // 传入明文符号
        uint8 _noteDecimals
    ) Ownable(initialOwner) {
        // 元数据校验+转换（解决bytes→bytes32类型错误）
        require(bytes(_noteName).length > 0 && bytes(_noteName).length <= 32, "Name: 1-32 chars");
        require(bytes(_noteSymbol).length > 0 && bytes(_noteSymbol).length <= 32, "Symbol: 1-32 chars");
        require(_noteDecimals <= 18, "Decimals too large");

        // 显式转换：string→bytes→bytes32（核心修复）
        noteName = bytes32(bytes(_noteName));
        noteSymbol = bytes32(bytes(_noteSymbol));
        noteDecimals = _noteDecimals;

        // 初始化加密零值+授权
        _encryptedZero = FHE.asEuint64(0);
        FHE.allowThis(_encryptedZero);

        // 授权初始角色（保留你的逻辑）
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _grantRole(ADDER_ROLE, initialOwner);

    }

    function setPrivacyToken(address _privacyToken) external onlyOwner {
        require(!isPrivacyTokenSet, "Token address already set");
        require(_privacyToken != address(0), "Invalid token address");
        privacyToken = PrivacyToken(_privacyToken);
        isPrivacyTokenSet = true;
        emit PrivacyTokenSet(_privacyToken);
    }

    function mint(address to, uint64 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be positive");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allow(encryptedAmount, address(this)); // 授权合约访问加密金额

        euint64 currentBalance = _votingNoteBalances[to];
        if (!FHE.isInitialized(currentBalance)) {
            currentBalance = FHE.asEuint64(0);
            FHE.allow(currentBalance, to); // 授权用户解密初始0值
            FHE.allow(currentBalance, address(this)); // 授权用户解密初始0值
        }

        euint64 newBalance = FHE.add(currentBalance, encryptedAmount);
        _votingNoteBalances[to] = newBalance;

        // 核心修正：授权用户解密自己的余额 + 授权调用方（PrivacyToken）临时访问
        FHE.allow(newBalance, to); // 用户自己可解密
        FHE.allow(newBalance, msg.sender); // msg.sender 是 PrivacyToken 合约，允许其访问
        FHE.allow(newBalance, address(this));
    }

    function authorizeBalanceAccess(address user) external {
        euint64 balance = _votingNoteBalances[user];

        // 给调用者（PredictionMarket）授权访问余额
        FHE.allow(balance, msg.sender);

        // 未初始化时，授权加密零值
        if (!FHE.isInitialized(balance)) {
            FHE.allow(_encryptedZero, msg.sender);
        }
    }

    function getVotingNoteBalance(address user) external view returns (euint64) {
        euint64 balance = _votingNoteBalances[user];

        if (!FHE.isInitialized(balance)) {
            return _encryptedZero;
        }

        return balance;
    }

    // 用户授权第三方扣减票据
    function approve(address spender, uint64 amount) external override {
        require(spender != address(0), "Invalid spender");

        euint64 encryptedAmt = FHE.asEuint64(amount);
        _allowance[msg.sender][spender] = encryptedAmt;
        FHE.allow(_allowance[msg.sender][spender], spender);
        FHE.allow(_allowance[msg.sender][spender], msg.sender);

        FHE.allowThis(encryptedAmt);
        FHE.allow(encryptedAmt,msg.sender);
        emit NoteApproved(msg.sender, spender, encryptedAmt);
    }

    // 授权方扣减用户票据
    function transferFrom(
        address from,
        address to,
        uint64 amount
    ) external override returns (euint64) {
        require(from != address(0) && to != address(0), "Invalid address");
        require(amount > 0, "Amount > 0");

        // 1. 加密转移金额 + 合约授权
        euint64 encryptedAmt = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmt); // 确认合约是新值所有者
        FHE.allow(encryptedAmt, address(this));
        FHE.allow(encryptedAmt, msg.sender);

        // ------------------------------
        // 处理转出方（from）余额
        // ------------------------------
        euint64 fromBalance = _votingNoteBalances[from];
        if (!FHE.isInitialized(fromBalance)) fromBalance = _encryptedZero;
        // 确认合约对原始余额有权限（来自mint的授权）
        FHE.allow(fromBalance, address(this));

        // 验证余额充足
        ebool balanceEnough = FHE.ge(fromBalance, encryptedAmt);
        FHE.allowThis(balanceEnough);
        FHE.allow(balanceEnough, address(this));

        // 生成新余额 + 确认合约权限
        euint64 newFromBalance = FHE.sub(fromBalance, encryptedAmt);
        FHE.allowThis(newFromBalance); // 核心：确认合约是新值所有者
        FHE.allow(newFromBalance, address(this));

        // 更新存储 + 授权用户
        _votingNoteBalances[from] = newFromBalance;
        FHE.allow(newFromBalance, from);

        // ------------------------------
        // 处理授权额度
        // ------------------------------
        euint64 allowed = _allowance[from][msg.sender];
        if (!FHE.isInitialized(allowed)) allowed = _encryptedZero;
        FHE.allow(allowed, address(this));

        // 验证授权充足
        ebool allowanceEnough = FHE.ge(allowed, encryptedAmt);
        FHE.allowThis(allowanceEnough);
        FHE.allow(allowanceEnough, address(this));

        // 生成新额度 + 确认合约权限
        euint64 newAllowed = FHE.sub(allowed, encryptedAmt);
        FHE.allowThis(newAllowed);
        FHE.allow(newAllowed, address(this));

        // 更新存储 + 授权相关方
        _allowance[from][msg.sender] = newAllowed;
        FHE.allow(newAllowed, from);
        FHE.allow(newAllowed, msg.sender);

        // ------------------------------
        // 处理接收方（to）余额
        // ------------------------------
        euint64 toBalance = _votingNoteBalances[to];
        if (!FHE.isInitialized(toBalance)) toBalance = _encryptedZero;
        FHE.allow(toBalance, address(this));

        // 生成新余额 + 确认合约权限
        euint64 newToBalance = FHE.add(toBalance, encryptedAmt);
        FHE.allowThis(newToBalance);
        FHE.allow(newToBalance, address(this));

        // 更新存储 + 授权用户
        _votingNoteBalances[to] = newToBalance;
        FHE.allow(newToBalance, to);

        // ------------------------------
        // 回滚校验
        // ------------------------------
        FHE.sub(
            _encryptedZero,
            FHE.select(
                FHE.and(balanceEnough, allowanceEnough),
                _encryptedZero,
                FHE.asEuint64(1)
            )
        );

        emit NoteTransferredFrom(from, to, encryptedAmt);

        FHE.allow(encryptedAmt, msg.sender);
        return encryptedAmt;
    }

    function addVotingNote(address to, euint64 encryptedAmount) external onlyRole(ADDER_ROLE) override returns (euint64){
        require(to != address(0), "Invalid recipient"); // 明文地址可正常用require

        // 1. 确认合约对加密金额的所有权（核心：避免权限错误）
        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, address(this));

        // 2. 加密条件校验：金额不能为零（修正核心！用FHE.select+FHE.sub回滚）
        ebool isZero = FHE.eq(encryptedAmount, _encryptedZero); // 加密判断：金额是否为零
        FHE.allowThis(isZero); // 确认合约对条件的所有权

        // 逻辑：如果isZero为true（金额为零），则返回1；否则返回0
        euint64 rollbackTrigger = FHE.select(isZero, FHE.asEuint64(1), _encryptedZero);
        FHE.allowThis(rollbackTrigger);

        // 触发回滚：如果rollbackTrigger=1，FHE.sub(0,1)会溢出回滚；否则正常执行
        FHE.sub(_encryptedZero, rollbackTrigger);

        // 3. 读取用户当前余额（复用你原有的逻辑）
        euint64 currentBalance = _votingNoteBalances[to];
        if (!FHE.isInitialized(currentBalance)) {
            currentBalance = _encryptedZero;
            FHE.allow(currentBalance, address(this)); // 授权合约操作零值
        }

        // 4. 计算新余额（加密加法，和transferFrom的减法逻辑对称）
        euint64 newBalance = FHE.add(currentBalance, encryptedAmount);
        FHE.allowThis(newBalance); // 确认合约对新余额的所有权
        FHE.allow(newBalance, address(this));

        // 5. 更新用户余额存储
        _votingNoteBalances[to] = newBalance;

        // 6. 授权用户解密自己的新余额（必须！否则用户查不到）
        FHE.allow(newBalance, to);

        // 7. 触发事件（便于前端监听）
        emit NoteAdded(to, encryptedAmount);

        return newBalance;
    }

    // 销毁票据
    function burn(uint64 amount) external override {
        require(amount > 0, "Amount > 0");
        address user = msg.sender;

        // 1. 加密销毁金额 + 确认合约所有权
        euint64 encryptedAmt = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmt); // 确认合约是新值所有者
        FHE.allow(encryptedAmt, address(this)); // 授权合约访问

        // 2. 读取用户原始余额 + 确保合约有权限（来自mint的授权）
        euint64 userBalance = _votingNoteBalances[user];
        if (!FHE.isInitialized(userBalance)) {
            userBalance = _encryptedZero;
            FHE.allow(userBalance, address(this)); // 兜底：未初始化时授权合约
        }
        FHE.allow(userBalance, address(this)); // 强化合约对原始余额的权限

        // 3. 验证余额充足 + 确认合约所有权
        ebool hasEnough = FHE.ge(userBalance, encryptedAmt);
        FHE.allowThis(hasEnough);
        FHE.allow(hasEnough, address(this));

        // 4. 生成扣减后的新余额 + 完整权限确认（核心修正）
        euint64 newBalance = FHE.sub(userBalance, encryptedAmt);
        FHE.allowThis(newBalance); // 关键：确认合约是新余额的所有者
        FHE.allow(newBalance, address(this)); // 授权合约访问新余额

        // 5. 回滚校验（余额不足则回滚）
        FHE.sub(
            _encryptedZero,
            FHE.select(hasEnough, _encryptedZero, FHE.asEuint64(1))
        );

        // 6. 更新存储 + 授权用户解密新余额（核心修正）
        _votingNoteBalances[user] = newBalance;
        FHE.allow(newBalance, user); // 授权用户解密扣减后的余额

        emit NoteBurned(user, amount);
    }

    // 修正：只保留一个 getAllowance 函数
    function getAllowance(address owner, address spender) external view override returns (euint64) {
        require(owner != address(0) && spender != address(0), "Invalid address");
        return FHE.isInitialized(_allowance[owner][spender])
            ? _allowance[owner][spender]
            : _encryptedZero;
    }

    // 检查是否为铸币者
    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    function getNoteNameString() external view returns (string memory) {
        bytes memory nameBytes = abi.encodePacked(noteName);
        uint256 length = 0;
        // 遍历找到第一个空字符的位置（有效长度）
        while (length < nameBytes.length && nameBytes[length] != 0) {
            length++;
        }
        // 截取有效部分（去除尾部空字符）
        bytes memory trimmed = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            trimmed[i] = nameBytes[i];
        }
        return string(trimmed);
    }

    function getNoteSymbolString() external view returns (string memory) {
        bytes memory symbolBytes = abi.encodePacked(noteSymbol);
        uint256 length = 0;
        while (length < symbolBytes.length && symbolBytes[length] != 0) {
            length++;
        }
        bytes memory trimmed = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            trimmed[i] = symbolBytes[i];
        }
        return string(trimmed);
    }

    function withdrawNoteToToken(externalEuint64 inputEuint64, bytes calldata inputProof) external {
        address user = msg.sender;
        euint64 withdrawAmount = FHE.fromExternal(inputEuint64,inputProof);
        FHE.allow(withdrawAmount, address(privacyToken));
        // 2. 获取用户票据余额（_balances 需为 euint64 类型的加密存储）
        euint64 userBalance = _votingNoteBalances[user];
        FHE.allow(userBalance, address(this)); // 授权合约访问用户余额

        // 3. 加密校验 1：用户余额 > 0（避免零余额提现）
        ebool hasBalance = FHE.gt(userBalance, _encryptedZero);
        FHE.allow(hasBalance, address(this)); // 授权合约访问加密布尔值
        // 若条件不满足（hasBalance 为 false），则 rollback = 1，触发 FHE.sub 溢出回滚
        euint64 rollback1 = FHE.select(hasBalance, _encryptedZero, FHE.asEuint64(1));
        FHE.sub(_encryptedZero, rollback1); // 条件不满足时回滚（相当于 require）

        // 4. 加密校验 2：用户余额 ≥ 提现金额（避免超额提现）
        ebool balanceEnough = FHE.ge(userBalance, withdrawAmount);
        FHE.allow(balanceEnough, address(this)); // 授权合约访问加密布尔值
        euint64 rollback2 = FHE.select(balanceEnough, _encryptedZero, FHE.asEuint64(1));
        FHE.sub(_encryptedZero, rollback2); // 条件不满足时回滚

        // 5. 销毁用户的加密票据（从余额中扣除）
        _votingNoteBalances[user] = FHE.sub(userBalance, withdrawAmount);
        FHE.allow(_votingNoteBalances[user], user); // 授权用户访问更新后的余额

        privacyToken.confidentialMint(user, withdrawAmount);

        // 7. 触发提现事件
        emit NoteWithdrawn(user, withdrawAmount);
    }
}