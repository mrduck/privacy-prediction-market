// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;
/**
 * @title UUPSProxy
 * @notice 通用代理合约，转发所有调用到逻辑合约，支持升级
 */
contract UUPSProxy{
    // 存储插槽（避免与逻辑合约冲突）
    address private _implementation; // 逻辑合约地址
    address private _admin;         // 管理员地址（控制升级）

    // 事件：逻辑合约地址更新
    event ImplementationUpdated(address indexed newImplementation);

    /**
     * @param initialImpl 初始逻辑合约地址
     * @param initialAdmin 初始管理员地址
     */
    constructor(address initialImpl, address initialAdmin) {
        require(initialImpl != address(0), "Invalid implementation");
        require(initialAdmin != address(0), "Invalid admin");
        _implementation = initialImpl;
        _admin = initialAdmin;
    }

    /**
     * @notice 获取当前逻辑合约地址
     */
    function implementation() external view returns (address) {
        return _implementation;
    }

    /**
     * @notice 获取管理员地址
     */
    function admin() external view returns (address) {
        return _admin;
    }

    /**
     * @notice 仅管理员可更新逻辑合约地址（升级核心）
     * @param newImpl 新逻辑合约地址
     */
    function setImplementation(address newImpl) external {
        require(msg.sender == _admin, "Not admin");
        require(newImpl != address(0), "Invalid new implementation");
        _implementation = newImpl;
        emit ImplementationUpdated(newImpl);
    }

    /**
     * @notice 转发所有外部调用到逻辑合约（核心逻辑）
     */
    fallback() external payable {
        address impl = _implementation;
        //  delegatecall 转发调用，保留代理的上下文（状态、msg.sender等）
        assembly {
            calldatacopy(0, 0, calldatasize()) // 复制输入数据到内存
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0) // 转发调用
            returndatacopy(0, 0, returndatasize()) // 复制返回数据到内存
            switch result
            case 0 { revert(0, returndatasize()) } // 调用失败则回滚
            default { return(0, returndatasize()) } // 调用成功则返回
        }
    }

    // 接收ETH
    receive() external payable {}
}