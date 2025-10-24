// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./interfaces/IPrivacyVoting.sol";
import "./PrivacyToken.sol";

/**
 * @title PredictionMarket
 * @notice Privacy-preserving prediction market: Users vote with encrypted notes, personal votes are private, total votes are transparent.
 * @dev Integrates with PrivacyVoting (voting notes) and PrivacyToken (rewards/refunds) to cover the full market lifecycle.
 */
contract PredictionMarket is SepoliaConfig, Ownable2Step {
    using Strings for uint256;

    // 移除 immutable 声明，改为普通状态变量
    euint64 private DEFAULT_ENCRYPTED_ZERO;

    bytes32 public constant ADDER_ROLE = keccak256("ADDER_ROLE");
    mapping(bytes32 => bool) private _existingTitles;

    // ============================
    // Data Structures: Simplified comments, highlight core fields
    // ============================
    struct Market {
        string title;          // Market theme (e.g., "Team A vs Team B Outcome")
        string description;
        string imageUrl;       // Cover image URL
        uint8 category;
        string[] options;      // Voting options (e.g., "Team A Win / Team B Win")
        uint64[] odds;         // Odds (scaled by 100, e.g., 150 = 1.5x)
        uint256 voteEndTime;   // Voting deadline (timestamp)
        uint256 resultTime;    // Result announcement time (must be after voteEndTime)
        address creator;       // Market creator
        uint8 winningOption;   // Winning option (default: type(uint8).max = unset)
        bool isSettled;        // Whether rewards have been settled
        bool isCanceled;       // Whether market is canceled (refunds available if canceled)
        uint64 totalMarketCap;
        uint64 totalVolume;
        mapping(uint8 => uint64) totalVotes;          // Total votes per option (plaintext, public)
        mapping(address => mapping(uint8 => euint64)) userVotes; // User votes per option (encrypted, private)
        mapping(address => bool) hasVoted;            // Whether user has voted
        mapping(address => bool) hasClaimed;          // Whether user has claimed rewards
        address[] voters;      // List of voters (used for settlement iteration)
        VoteRecord[] voteRecords;
    }

    struct MarketListItem {
        uint256 marketId;        // 市场ID（关键标识）
        string title;            // 市场标题（列表页展示）
        string description;
        string imageUrl;
        uint8 category;
        bool isSettled;          // 是否已结算（状态标识）
        bool isCanceled;         // 是否已取消（状态标识）
        uint256 voteEndTime;     // 投票截止时间（判断是否可投票）
        uint8 optionCount;       // 选项数量（简化展示）
        uint64 totalMarketCap;
        uint64 totalVolume;
    }

    struct MarketListResult {
        MarketListItem[] items;    // 分页数据
        uint256 totalCount;        // 总市场数
    }

    // ============================
    // Core State Variables: Keep immutable for gas optimization
    // ============================
    mapping(uint256 => Market) public markets;  // Market ID → Market data
    uint256 public nextMarketId;                // Next available market ID (auto-increments, starts at 0)
    PrivacyToken public immutable token;        // Privacy token for rewards/refunds
    IPrivacyVoting public immutable votingNote; // Privacy note contract for voting

    // ============================
    // Events: Simplified comments, highlight indexed fields
    // ============================
    event MarketCreated(uint256 indexed marketId, string title, uint256 voteEndTime, address indexed creator);
    event Voted(uint256 indexed marketId, address indexed voter, uint8 optionIndex, uint64 amount);
    event ResultSubmitted(uint256 indexed marketId, uint8 winningOption);
    event MarketSettled(uint256 indexed marketId, uint8 winningOption);
    event MarketCanceled(uint256 indexed marketId);
    event RewardClaimed(address indexed user, uint256 indexed marketId, euint64 indexed reward);
    event VotesBurned(uint256 indexed marketId, uint64 amount);
    event RefundCompleted(uint256 indexed marketId,address indexed, euint64 indexed totalNote);
    // ============================
    // Constructor: Clarify contract dependencies, validate parameters
    // ============================
    constructor( address _token, address _votingNote ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_votingNote != address(0), "Invalid voting note address");
        token = PrivacyToken(_token);
        votingNote = IPrivacyVoting(_votingNote);

        DEFAULT_ENCRYPTED_ZERO = FHE.asEuint64(0);
        FHE.allowThis(DEFAULT_ENCRYPTED_ZERO);
    }

    // ============================
    // 1. Market Creation: Logic unchanged, improve readability of array copying
    // ============================
    function createMarket(string calldata title,string calldata description, string calldata imageUrl,uint8 category, string[] calldata options, uint64[] calldata odds, uint256 voteEndTime, uint256 resultTime) external returns (uint256 marketId) {
        // Basic validation: Ensure parameters are valid
        require(bytes(title).length > 0, "Title cannot be empty");
        bytes32 titleHash = keccak256(bytes(title)); // 计算标题哈希
        require(!_existingTitles[titleHash], "Title already exists"); // 核心：校验标题未被使用
        require(category >= 1 && category <= 5, "Invalid category (must be 1-5)");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(options.length >= 2, "At least 2 voting options required");
        require(options.length == odds.length, "Options count must match odds count");
        require(voteEndTime > block.timestamp, "Vote end time must be in the future");
        require(resultTime > voteEndTime, "Result time must be after vote end time");

        // Initialize market: Auto-increment ID, assign basic fields
        marketId = nextMarketId++;
        Market storage market = markets[marketId];
        market.title = title;
        market.description = description;
        market.imageUrl = imageUrl;
        market.category = category;
        market.voteEndTime = voteEndTime;
        market.resultTime = resultTime;
        market.creator = msg.sender;
        market.totalMarketCap = 0;
        market.totalVolume = 0;
        market.winningOption = type(uint8).max; // Unset initially

        // Copy options and odds: Loop logic unchanged, improve variable name readability
        _copyOptionsAndOdds(market,options,odds);
        _existingTitles[titleHash] = true;
        emit MarketCreated(marketId, title, voteEndTime, msg.sender);
    }

    function _copyOptionsAndOdds(Market storage market, string[] calldata options, uint64[] calldata odds) internal {
        market.options = new string[](options.length);
        market.odds = new uint64[](odds.length);
        for (uint256 i = 0; i < options.length; i++) {
            market.options[i] = options[i];
            market.odds[i] = odds[i];
        }
    }

    // 新增：获取加密 0 值（第一次调用时初始化）
    function _getEncryptedZero() internal view returns (euint64) {
        return DEFAULT_ENCRYPTED_ZERO;
    }

    // ============================
    // 2. User Voting: Core optimization! Split validation into helpers to fix stack overflow
    // ============================
    function vote( uint256 marketId,uint8 optionIndex,uint64 amount ) external {
        Market storage market = markets[marketId];

        // ① 基础验证
        _checkMarketBaseValidity(market, marketId, optionIndex, amount);

        // ② 加密金额 + 确认所有权 + 授权（核心修正：恢复这两行！）
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmount); // 1. 确认合约是加密值的所有者（必需）
        FHE.allow(encryptedAmount, address(this)); // 2. 授权合约访问加密值（必需）

        // 后续逻辑保持不变
        _checkUserAllowance(msg.sender, encryptedAmount);
        _checkUserNoteBalance(msg.sender, encryptedAmount);
        euint64 deductedAmount = _deductVotingNote(msg.sender, amount);
        _checkDeductionValidity(deductedAmount, encryptedAmount);
        _recordUserVote(market, msg.sender, optionIndex, deductedAmount, amount);

        emit Voted(marketId, msg.sender, optionIndex, amount);
    }

    // ============================
    // 4. Result Submission / Market Settlement / Cancellation: Logic unchanged, keep concise
    // ============================
    function submitResult(uint256 marketId, uint8 winningOption) external onlyOwner {
        Market storage market = markets[marketId];
        require(marketId < nextMarketId, "Market does not exist");
        require(!market.isSettled, "Market already settled");
        require(!market.isCanceled, "Market is canceled");
        require(block.timestamp > market.resultTime, "Too early to submit result");
        require(winningOption < market.options.length, "Invalid winning option");

        market.winningOption = winningOption;
        emit ResultSubmitted(marketId, winningOption);
    }

    function settleMarket(uint256 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        require(marketId < nextMarketId, "Market does not exist");
        require(!market.isSettled, "Market already settled");
        require(!market.isCanceled, "Market is canceled");
        require(market.winningOption != type(uint8).max, "Winning option not set");

        market.isSettled = true;
        emit MarketSettled(marketId, market.winningOption);
    }

    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        require(marketId < nextMarketId, "Market does not exist");
        require(!market.isSettled, "Market already settled");
        require(!market.isCanceled, "Market already canceled");

        market.isCanceled = true;
        emit MarketCanceled(marketId);
    }

    // ============================
    // 5. Reward Claim / Refund: Optimize variable reuse, reduce duplicate encryption
    // ============================
    function claimReward(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(marketId < nextMarketId, "Market does not exist");
        require(market.isSettled, "Market not settled");
        require(market.winningOption != type(uint8).max, "Winning option not set");
        require(!market.hasClaimed[msg.sender], "Reward already claimed");

        // Calculate reward: Encrypted votes × odds ÷ 100 (revert scaled odds)
        uint8 winner = market.winningOption;
        euint64 userVote = market.userVotes[msg.sender][winner];
        FHE.allow(userVote, address(this));

        euint64 oddsEnc = FHE.asEuint64(market.odds[winner]);
        euint64 reward = FHE.mul(userVote, oddsEnc);
        reward = FHE.div(reward, 100);

        // Reset vote + mark as claimed to prevent double claiming
        market.userVotes[msg.sender][winner] = _getEncryptedZero();
        FHE.allow(market.userVotes[msg.sender][winner], address(this));
        market.hasClaimed[msg.sender] = true;

        // Transfer reward: Grant token contract access to encrypted amount
        FHE.allow(reward, address(token));
        FHE.allow(reward,address(votingNote));
        votingNote.addVotingNote(msg.sender,reward);

        emit RewardClaimed(msg.sender, marketId, reward);
    }

    function refund(uint256 marketId) external {
        Market storage market = markets[marketId];
        // 状态校验（不变，确保退款前提）
        require(marketId < nextMarketId, "Market does not exist");
        require(market.isCanceled, "Market not canceled");
        require(!market.isSettled, "Market already settled");
        require(market.hasVoted[msg.sender], "No votes to refund");
        require(!market.hasClaimed[msg.sender], "Already refunded");

        // 2. 计算用户锁定的票据总额（逻辑不变，仍是累加 userVotes）
        euint64 totalNote = _getEncryptedZero();
        uint256 optionCount = market.options.length;
        for (uint8 i = 0; i < optionCount; i++) {
            totalNote = FHE.add(totalNote, market.userVotes[msg.sender][i]);
            FHE.allowThis(totalNote); // 确认合约对票据总额的所有权（关键）

            // 重置用户投票记录（避免重复退款）
            market.userVotes[msg.sender][i] = _getEncryptedZero();
            FHE.allow(market.userVotes[msg.sender][i], msg.sender);
        }

        // 3. 核心修复：用票据合约退票据，而非隐私代币
        // ① 授权票据合约访问 totalNote（票据转移需要权限）
        FHE.allow(totalNote, address(votingNote));
        // ② 调用票据合约的机密转账：从市场合约→用户（退票据）
        // 注意：票据合约必须有 `confidentialTransfer` 函数（或类似接口，如 transfer）
        votingNote.addVotingNote(msg.sender, totalNote);

        // 4. 更新用户状态（不变）
        market.hasVoted[msg.sender] = false;
        market.hasClaimed[msg.sender] = true;

        emit RefundCompleted(marketId, msg.sender, totalNote);
    }

    // ============================
    // 6. Query Interfaces: Keep transparent, optimize parameter validation
    // ============================
    function getMarketCount() external view returns (uint256) {
        return nextMarketId;
    }

    function getMarketInfo(uint256 marketId) external view returns (
        string memory title,
        string memory description,
        uint8 category,
        string memory imageUrl,
        string[] memory options,
        uint64[] memory odds,
        uint256 voteEndTime,
        uint256 resultTime,
        bool isSettled,
        bool isCanceled,
        uint8 winningOption,
        uint64 totalMarketCap,
        uint64 totalVolume
    ) {
        require(marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[marketId];
        return (
            market.title,
            market.description,
            market.category,
            market.imageUrl,
            market.options,
            market.odds,
            market.voteEndTime,
            market.resultTime,
            market.isSettled,
            market.isCanceled,
            market.winningOption,
            market.totalMarketCap,
            market.totalVolume
        );
    }

    function getOptionTotalVotes(uint256 marketId, uint8 optionIndex) external view returns (uint64) {
        require(marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[marketId];
        require(optionIndex < market.options.length, "Invalid option index");
        return market.totalVotes[optionIndex];
    }

    function getUserVotes(uint256 marketId, address user) external view returns (euint64[] memory) {
        require(msg.sender == user, "Only user can view own votes");
        require(marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[marketId];

        uint256 optionCount = market.options.length;
        euint64[] memory userVotes = new euint64[](optionCount);

        for (uint8 i = 0; i < optionCount; i++) {
            euint64 userVote = market.userVotes[user][i];
            // 未初始化的投票值 → 赋值为已授权的加密零值
            if (!FHE.isInitialized(userVote)) {
                userVote = _getEncryptedZero();
            }
            userVotes[i] = userVote;
            // 👉 删掉授权逻辑！：FHE.allow(...) 已在 _recordUserVote 中完成
        }

        return userVotes;
    }

    function getUserNoteAllowanceForMarket(address user) external view returns (euint64) {
        require(user != address(0), "Invalid user address");
        return votingNote.getAllowance(user, address(this));
    }

    // ============================
    // Internal Helpers: Split complex logic to reduce stack usage (core optimization)
    // ============================
    /**
     * @dev Validate basic market validity (quick filter before voting)
     */
    function _checkMarketBaseValidity(
        Market storage market,
        uint256 marketId,
        uint8 optionIndex,
        uint64 amount
    ) internal view {
        require(marketId < nextMarketId, "Market does not exist");
        require(!market.isCanceled, "Market is canceled");
        require(block.timestamp < market.voteEndTime, "Voting closed");
        require(optionIndex < market.options.length, "Invalid option index");
        require(amount > 0, "Vote amount must be greater than 0");
    }

    /**
     * @dev Validate user's note allowance for the market
     */
    function _checkUserAllowance(address user, euint64 encryptedAmount) internal {
        // 1. 从 PrivacyVoting 获取授权额度（此时已被授权访问）
        euint64 allowance = votingNote.getAllowance(user, address(this));
        // 👉 删掉这行！：FHE.allow(allowance, address(this)); （已无需，且会报错）

        // 2. 未初始化时赋值为加密零值（零值已授权）
        if (!FHE.isInitialized(allowance)) {
            allowance = _getEncryptedZero();
            // 👉 删掉这行！：FHE.allow(allowance, address(this)); （_getEncryptedZero 已授权）
        }

        // 3. 加密校验（正常执行，因为 allowance 已有权限）
        ebool isEnough = FHE.ge(allowance, encryptedAmount);
        FHE.allow(isEnough, address(this)); // 这行没问题：isEnough 是当前合约生成的，所有权在自己
        euint64 rollback = FHE.select(isEnough, _getEncryptedZero(), FHE.asEuint64(1));
        FHE.sub(_getEncryptedZero(), rollback);
    }

    /**
     * @dev Validate user's note balance
     */
    function _checkUserNoteBalance(address user, euint64 encryptedAmount) internal {
        votingNote.authorizeBalanceAccess(user);
        // 1. 获取已授权的 balance（来自 getVotingNoteBalance，已授权）
        euint64 balance = votingNote.getVotingNoteBalance(user);
        // 👉 删掉这行！：FHE.allow(balance, address(this)); （冗余且无效）

        // 2. 未初始化时赋值加密零值（零值已在 _getEncryptedZero 中授权）
        if (!FHE.isInitialized(balance)) {
            balance = _getEncryptedZero();
            // 👉 删掉这行！：FHE.allow(balance, address(this)); （冗余）
        }

        // 3. 此时 balance 有权限，FHE.ge 可正常执行
        ebool isEnough = FHE.ge(balance, encryptedAmount);
        FHE.allow(isEnough, address(this)); // isEnough 是当前合约生成的，所有权没问题

        // 后续回滚逻辑保持不变...
        euint64 rollback = FHE.select(isEnough, _getEncryptedZero(), FHE.asEuint64(1));
        FHE.sub(_getEncryptedZero(), rollback);
    }

    /**
     * @dev Deduct user's voting notes (call to note contract)
     */
    function _deductVotingNote(address user, uint64 amount) internal returns (euint64) {
        euint64 deducted = votingNote.transferFrom(user, address(this), amount);
        return deducted;
    }

    /**
     * @dev Validate if deducted amount matches expected amount
     */
    function _checkDeductionValidity(euint64 deducted, euint64 expected) internal {
        ebool isSuccess = FHE.eq(deducted, expected);
        FHE.allow(isSuccess, address(this));
        euint64 rollback = FHE.select(isSuccess, _getEncryptedZero(), FHE.asEuint64(1));
        FHE.sub(_getEncryptedZero(), rollback);
    }

    /**
     * @dev Record user's vote (private storage + public total vote count)
     */
    function _recordUserVote(
        Market storage market,
        address user,
        uint8 optionIndex,
        euint64 deductedAmount,
        uint64 amount
    ) internal {
        // 1. 处理已投票选项的投票值（原逻辑不变，新增所有权确认）
        euint64 currentVote = market.userVotes[user][optionIndex];
        if (!FHE.isInitialized(currentVote)) {
            currentVote = _getEncryptedZero();
        }
        euint64 newVote = FHE.add(currentVote, deductedAmount);
        FHE.allowThis(newVote); // 确认合约所有权
        market.userVotes[user][optionIndex] = newVote;
        FHE.allow(newVote, user); // 授权用户访问已投票选项

        // 2. 【核心新增】提前授权所有未投票选项的零值
        uint256 totalOptions = market.options.length;
        for (uint8 i = 0; i < totalOptions; i++) {
            // 跳过已处理的投票选项，只处理未投票的
            if (i == optionIndex) continue;

            euint64 unvoted = market.userVotes[user][i];
            // 未投票选项：授权用户访问加密零值
            if (!FHE.isInitialized(unvoted)) {
                FHE.allow(_getEncryptedZero(), user);
            } else {
                // 若有历史未授权的投票值（极少情况），补充授权
                FHE.allow(unvoted, user);
            }
        }

        // 3. 原逻辑：更新明文票数和选民记录
        market.totalVotes[optionIndex] += amount;

        market.totalVolume += amount;
        market.totalMarketCap += amount;
        if (!market.hasVoted[user]) {
            market.hasVoted[user] = true;
            market.voters.push(user);
        }

        market.voteRecords.push(VoteRecord({
            voter: user,
            optionIndex: optionIndex,
            amount: amount, // 用明文 amount（与 totalVotes 一致，确保统计准确）
            timestamp: block.timestamp // 记录投票时间
        }));
    }

    struct VoteRecord {
        address voter;       // 投票者地址（明文，公开可见）
        uint8 optionIndex;   // 投票选项索引（明文，与市场选项对应）
        uint64 amount;       // 投票数量（明文，与 totalVotes 保持一致）
        uint256 timestamp;   // 投票时间戳（明文，记录投票时间）
    }

    function getMarketList(
        uint256 page,
        uint256 pageSize,
        bool isDesc
    ) external view returns (MarketListResult memory) {
        require(page > 0, "Page must start from 1");
        require(pageSize > 0 && pageSize <= 100, "Page size must be 1-100");

        uint256 totalMarkets = nextMarketId;
        MarketListResult memory result;
        result.totalCount = totalMarkets;

        if (totalMarkets == 0) {
            result.items = new MarketListItem[](0);
            return result;
        }

        // 计算分页索引
        uint256 startIndex;
        unchecked {
            startIndex = (page - 1) * pageSize;
        }
        if (startIndex >= totalMarkets) {
            result.items = new MarketListItem[](0);
            return result;
        }

        uint256 endIndex = startIndex + pageSize;
        if (endIndex > totalMarkets) {
            endIndex = totalMarkets;
        }
        uint256 returnLength = endIndex - startIndex;
        result.items = new MarketListItem[](returnLength);

        // 按排序逻辑填充数据（升序/降序）
        for (uint256 i = 0; i < returnLength; i++) {
            uint256 marketId;
            if (isDesc) {
                // 降序：从最大ID开始（totalMarkets-1 - startIndex - i）
                marketId = (totalMarkets - 1) - startIndex - i;
            } else {
                // 升序：从最小ID开始（startIndex + i）
                marketId = startIndex + i;
            }
            Market storage market = markets[marketId];

            result.items[i] = MarketListItem({
                marketId: marketId,
                title: market.title,
                description: market.description,
                imageUrl: market.imageUrl,
                category: market.category,
                isSettled: market.isSettled,
                isCanceled: market.isCanceled,
                voteEndTime: market.voteEndTime,
                optionCount: uint8(market.options.length),
                totalMarketCap: market.totalMarketCap,
                totalVolume: market.totalVolume
            });
        }

        return result;
    }

    /**
     * @dev 分页查询市场的所有投票记录（按投票时间升序）
     * @param marketId 市场ID
     * @param page 页码（从1开始）
     * @param pageSize 每页数量（最大100，控制gas消耗）
     * @return records 分页的投票记录
     * @return totalCount 该市场的总投票次数（可能大于选民数，支持重复投票场景）
     */
    function getMarketVoteRecords(
        uint256 marketId,
        uint256 page,
        uint256 pageSize
    ) external view returns (VoteRecord[] memory records, uint256 totalCount) {
        require(marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[marketId];
        totalCount = market.voteRecords.length;

        // 参数校验（防止无效请求）
        require(page >= 1, "Page must be >= 1");
        require(pageSize > 0, "Page size must be > 0");
        require(pageSize <= 100, "Page size cannot exceed 100");

        // 计算分页范围（与现有市场列表分页逻辑一致）
        uint256 startIndex = (page - 1) * pageSize;
        uint256 endIndex = page * pageSize;
        if (startIndex >= totalCount) {
            records = new VoteRecord[](0);
            return (records, totalCount);
        }
        if (endIndex > totalCount) {
            endIndex = totalCount;
        }

        // 提取分页记录
        uint256 recordCount = endIndex - startIndex;
        records = new VoteRecord[](recordCount);
        for (uint256 i = 0; i < recordCount; i++) {
            records[i] = market.voteRecords[startIndex + i];
        }
    }

/**
 * @dev 查询用户在特定市场的所有投票记录（适配 userVotes 加密逻辑）
 * @param marketId 市场ID
 * @param user 目标用户（仅用户本人或授权者可查，可选加权限控制）
 * @return 用户在该市场的所有投票记录
 */
    function getUserVotesInMarket(uint256 marketId, address user) external view returns (VoteRecord[] memory) {
        require(marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[marketId];

        // 统计用户的投票次数（避免创建过大数组浪费gas）
        uint256 count = 0;
        for (uint256 i = 0; i < market.voteRecords.length; i++) {
            if (market.voteRecords[i].voter == user) {
                count++;
            }
        }

        // 提取用户的投票记录
        VoteRecord[] memory userRecords = new VoteRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < market.voteRecords.length; i++) {
            if (market.voteRecords[i].voter == user) {
                userRecords[index] = market.voteRecords[i];
                index++;
            }
        }
        return userRecords;
    }
}