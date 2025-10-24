// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialFungibleToken as ERC7984} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import "./interfaces/IPrivacyVoting.sol";

/**
 * @title PrivacyToken
 * @author 你的名称
 * @notice 隐私代币合约：支持销毁代币兑换票据，关联PrivacyVoting合约
 * @dev 基于ERC7984实现隐私代币，deposit方法触发跨合约铸票
 */
contract PrivacyToken is SepoliaConfig, ERC7984, Ownable2Step,AccessControl {
    // ============================
    // 1. 核心配置
    // ============================
    uint64 public constant MAX_TOTAL_SUPPLY = 1_000_000; // 代币总量上限
    euint64 private _mintedTotal; // 加密的已铸币总量（含销毁后净量）
    IPrivacyVoting public immutable privacyVoting; // 关联的票据合约（通过接口）
    euint64 private immutable _encryptedZero;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============================
    // 2. 事件定义
    // ============================
    event TokensBurned(address indexed from, euint64 indexed amount); // 代币销毁事件
    event TokensDeposited(address indexed user, uint64 indexed noteAmount); // 代币兑换票据事件
    event ConfidentialMinted(address indexed to, euint64 indexed encryptedAmount);
    // ============================
    // 3. 构造函数：初始化代币+关联票据合约
    // ============================
    constructor(address owner, uint64 initialMintAmount, string memory tokenName,
        string memory tokenSymbol, string memory tokenURI, address privacyVotingAddr
    ) ERC7984(tokenName, tokenSymbol, tokenURI) Ownable(owner) {
        // 校验票据合约地址
        require(owner != address(0), "Invalid owner address");
        require(privacyVotingAddr != address(0), "Invalid PrivacyVoting address");
        privacyVoting = IPrivacyVoting(privacyVotingAddr);

        _encryptedZero = FHE.asEuint64(0);
        FHE.allowThis(_encryptedZero); // 授权合约访问零值

        _grantRole(DEFAULT_ADMIN_ROLE, owner); // 管理员角色给部署者
        _grantRole(MINTER_ROLE, owner); // 初始铸币角色给部署者

        // 初始铸币（给部署者）
        if (initialMintAmount > 0) {
            euint64 encryptedInitial = FHE.asEuint64(initialMintAmount);
            _mint(owner, encryptedInitial);
            _mintedTotal = encryptedInitial;
            // 授权部署者解密总量
        }
        FHE.allow(_mintedTotal,address(this));
        FHE.allow(_mintedTotal, owner);
    }

    // 外部可调用的 mint 函数（带权限控制）
    function confidentialMint(address to, euint64 encryptedAmount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Invalid recipient");

        // 1. 授权合约访问加密金额
        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, address(this));

        // 2. 加密校验1：金额≠0（用已初始化的_encryptedZero）
        ebool isZero = FHE.eq(encryptedAmount, _encryptedZero);
        FHE.allowThis(isZero);
        euint64 rollback1 = FHE.select(isZero, FHE.asEuint64(1), _encryptedZero);
        FHE.sub(_encryptedZero, rollback1); // 金额为零则回滚

        // 3. 加密校验2：总供应量≤上限（用已有的_mintedTotal，删除未定义的_confidentialTotalSupply）
        euint64 newTotalSupply = FHE.add(_mintedTotal, encryptedAmount);
        FHE.allowThis(newTotalSupply);

        euint64 maxSupplyEnc = FHE.asEuint64(MAX_TOTAL_SUPPLY);
        FHE.allowThis(maxSupplyEnc);

        ebool withinLimit = FHE.le(newTotalSupply, maxSupplyEnc);
        FHE.allowThis(withinLimit);
        euint64 rollback2 = FHE.select(withinLimit, _encryptedZero, FHE.asEuint64(1));
        FHE.sub(_encryptedZero, rollback2); // 超上限则回滚

        // 4. 调用父合约_mint（无需自定义_confidentialBalances，ERC7984已封装）
        _mint(to, encryptedAmount);

        // 5. 授权用户访问自己的新余额（ERC7984的_mint不会自动授权，需补充）
        euint64 userNewBal = confidentialBalanceOf(to); // 调用父合约方法获取余额
        FHE.allow(userNewBal, to);

        // 6. 更新总供应量
        _mintedTotal = newTotalSupply;
        FHE.allow(_mintedTotal, address(this));
        FHE.allow(_mintedTotal, owner()); // 仅管理员可查看

        // 触发事件
        emit ConfidentialMinted(to, encryptedAmount);
    }

    // ============================
    // 4. 核心功能：代币兑换票据（deposit）
    // ============================
    function deposit(uint64 tokenAmount) external {
        require(tokenAmount > 0, "Deposit amount must be positive");

        // ① 加密兑换金额，授权合约访问
        euint64 encryptedAmount = FHE.asEuint64(tokenAmount);
        FHE.allow(encryptedAmount, address(this));

        // ② 检查用户代币余额是否足够
        euint64 userTokenBalance = confidentialBalanceOf(msg.sender);
        FHE.allow(userTokenBalance, address(this)); // 授权合约访问加密余额

        // 密文判断：余额是否足够（生成ebool）
        ebool hasEnoughToken = FHE.ge(userTokenBalance, encryptedAmount);
        FHE.allow(hasEnoughToken, address(this));

        euint64 rollbackTrigger = FHE.select(hasEnoughToken,FHE.asEuint64(0),FHE.asEuint64(1));
        FHE.allow(rollbackTrigger, address(this));

        FHE.sub(0, rollbackTrigger);

        // ③ 销毁用户的代币
        _burn(msg.sender, encryptedAmount);
        // 更新已铸币总量
        _mintedTotal = FHE.sub(_mintedTotal, encryptedAmount);
        FHE.allow(_mintedTotal , address(this));
        FHE.allow(_mintedTotal, owner());

        // ④ 跨合约调用：让票据合约给用户铸造等额票据
        privacyVoting.mint(msg.sender, tokenAmount);

        // ⑤ 触发事件
        emit TokensDeposited(msg.sender, tokenAmount);
        emit TokensBurned(msg.sender, encryptedAmount);
    }

    // ============================
    // 5. 基础功能：公开铸币（按需使用，可注释）
    // ============================
    // PrivacyToken.sol 的 mint 函数
    function mint(uint64 amount) external {
        require(amount > 0, "Amount must be > 0");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allow(encryptedAmount, address(this));

        euint64 newTotal = FHE.add(_mintedTotal, encryptedAmount);
        FHE.allow(newTotal, address(this));

        ebool withinLimit = FHE.le(newTotal, FHE.asEuint64(MAX_TOTAL_SUPPLY));
        FHE.allow(withinLimit, address(this));

        euint64 rollbackTrigger = FHE.select(
            withinLimit,
            FHE.asEuint64(0),
            FHE.asEuint64(1)
        );
        FHE.allow(rollbackTrigger, address(this));
        FHE.sub(FHE.asEuint64(0), rollbackTrigger);

        // 核心修正1：铸造后授权用户解密自己的代币余额
        _mint(msg.sender, encryptedAmount);
        FHE.allow(confidentialBalanceOf(msg.sender), msg.sender); // 新增：授权用户查看自己的余额

        _mintedTotal = newTotal;
        FHE.allow(_mintedTotal , address(this));
        FHE.allow(_mintedTotal, owner()); // 仅 owner 能看总供应量，用户不能看
    }

    // ============================
    // 6. 管理功能：仅owner销毁指定地址代币
    // ============================
    // PrivacyToken.sol 的 burn 函数（其他修改 _mintedTotal 的函数同理）
    function burn(address from, uint64 amount) external onlyOwner {
        require(from != address(0), "Invalid address");
        require(amount > 0, "Burn amount must be positive");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allow(encryptedAmount, address(this)); // 授权合约访问加密金额

        // 核心修正：先授权合约自身访问当前 _mintedTotal
        FHE.allow(_mintedTotal, address(this));

        // 扣减总供应量
        _mintedTotal = FHE.sub(_mintedTotal, encryptedAmount);

        // 重新授权 owner 解密新的 _mintedTotal
        FHE.allow(_mintedTotal, address(this));
        FHE.allow(_mintedTotal, owner());

        _burn(from, encryptedAmount);
        emit TokensBurned(from, encryptedAmount);
    }

    // ============================
    // 7. 查询功能：获取加密的总供应量
    // ============================
    function getTotalSupply() external view returns (euint64) {
        return _mintedTotal;
    }

    function getConfidentialBalance(address user) external view returns (euint64) {
        require(user != address(0), "Invalid user address");
        // 调用 ERC7984 父合约的 confidentialBalanceOf 方法
        return confidentialBalanceOf(user);
    }
}