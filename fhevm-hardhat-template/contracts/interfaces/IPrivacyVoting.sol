// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import "@fhevm/solidity/lib/FHE.sol";
/**
 * @title IPrivacyVoting
 * @author 你的名称
 * @notice 票据合约（PrivacyVoting）的对外接口定义
 * @dev 仅包含PrivacyToken合约需要调用的核心方法，解耦合约依赖
 */
interface IPrivacyVoting {
    // 已有的方法...
    function mint(address to, uint64 amount) external;
    function getVotingNoteBalance(address user) external returns (euint64);
    function approve(address spender, uint64 amount) external;
    function transferFrom(address from, address to, uint64 amount) external returns (euint64);
    function burn(uint64 amount) external;

    // 新增：补充getAllowance方法声明（关键修复）
    /**
     * @notice 查询用户给第三方的授权额度
     * @param owner 授权方（用户）地址
     * @param spender 被授权方（如Market）地址
     * @return 加密的授权额度（euint64）
     */
    function getAllowance(address owner, address spender) external view returns (euint64);

    function authorizeBalanceAccess(address user) external;

    function addVotingNote(address to, euint64 encryptedAmount) external returns (euint64);
}