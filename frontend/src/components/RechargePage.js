// src/pages/RechargePage.js（重构后）
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { depositTokens, getTokenBalance } from '../chainApi';
import toast from 'react-hot-toast';

const RechargePage = () => {
    const navigate = useNavigate();
    const { userAddress, isConnected, isConnecting } = useAppContext();
    const [amount, setAmount] = useState(0); // 要兑换的数量
    const [userBalance, setUserBalance] = useState(0); // 用户的代币余额
    const [isLoadingBalance, setIsLoadingBalance] = useState(false); // 余额加载状态

    const {fheInstance,fheInitStatus} = useAppContext();

    useEffect(() => {
        console.log("=== 组件当前状态 ===");
        console.log("正在连接中：isConnecting =", isConnecting);
        console.log("用户地址：userAddress =", userAddress);
        console.log("Zama初始化状态：fheInitStatus =", fheInitStatus);
        console.log("用户余额：userBalance =", userBalance);
        console.log("兑换数量：amount =", amount);
        console.log("余额加载中：isLoadingBalance =", isLoadingBalance);
        console.log("按钮禁用条件：");
        console.log("  - amount <= 0：", amount <= 0);
        console.log("  - isConnecting：", isConnecting);
        console.log("  - isLoadingBalance：", isLoadingBalance);
        console.log("  - amount > userBalance：", amount > userBalance);
        console.log("  → 最终disabled：",
            amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance
        );
        console.log("===================");
    });
    // 页面加载时自动查询用户余额
    // src/pages/RechargePage.js（添加调试日志）
    useEffect(() => {
        console.log("触发余额查询条件：", {
            isConnected: isConnected,
            userAddress: userAddress,
            shouldFetch: isConnected && userAddress
        }); // 新增日志：检查是否满足触发条件
        if (userAddress) {
            fetchUserBalance();
        }
    }, [isConnected, userAddress]);

    // 查询用户代币余额
    const fetchUserBalance = async () => {
        setIsLoadingBalance(true);
        try {
            if (fheInitStatus !== "success" || !fheInstance) {
                toast.error("Zama 实例未就绪，请等待初始化完成");
                return;
            }
            console.log(`开始查询用户代币余额`);
            const balance = await getTokenBalance(fheInstance);
            console.log(`查询全部代币余额:${balance}`);
            // setUserBalance(balance);
            // setAmount(balance); // 初始默认填充全部余额
            setUserBalance(10);
            setAmount(10); // 初始默认填充全部余额
        } catch (err) {
            toast.error(`查询余额失败：${err.message}`);
        } finally {
            setIsLoadingBalance(false);
        }
    };

    // 兑换票据逻辑
    const handleDeposit = async () => {
        if (isConnecting || isLoadingBalance) return;
        if (amount <= 0 || amount > userBalance) {
            toast.error(`兑换数量需在 1~${userBalance} 之间`);
            return;
        }

        try {
            toast.loading('兑换票据中...');
            const tx = await depositTokens(amount);
            await tx.wait();
            toast.dismiss();
            toast.success(`成功兑换 ${amount} 票据！`);
            setAmount(0);
            fetchUserBalance(); // 兑换后刷新余额
        } catch (err) {
            toast.dismiss();
            toast.error(`兑换失败：${err.message}`);
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen p-6">
            <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">代币兑换票据</h2>
                <p className="text-gray-400 mb-6">
                    将 PrivacyToken 兑换为投票票据，用于参与预测市场投注：
                </p>

                {/* 新增：显示用户当前代币余额 */}
                <div className="mb-4">
                    <p className="text-gray-400">
                        你的代币余额：{isLoadingBalance ? '加载中...' : userBalance}
                    </p>
                </div>

                {/* 兑换数量输入 */}
                <div className="flex items-center gap-3 mb-6">
                    <label className="text-white">兑换数量：</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) =>
                            setAmount(Math.max(0, Math.min(Number(e.target.value), userBalance)))
                        }
                        className="px-3 py-2 bg-gray-700 text-white rounded w-full"
                        min="0"
                        max={userBalance} // 限制最大输入为用户余额
                        step="0.01"
                        disabled={isConnecting || !isConnected || isLoadingBalance}
                    />
                </div>

                {/* 快捷金额按钮（自动限制不超过余额） */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {[10, 50, 100].map((val) => (
                        <button
                            key={val}
                            onClick={() =>
                                setAmount(prev => Math.min(prev + val, userBalance))
                            }
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded"
                            disabled={isConnecting || !isConnected || isLoadingBalance || val > userBalance}
                        >
                            +{val}
                        </button>
                    ))}
                </div>

                {/* 兑换按钮（禁用逻辑：数量无效、未连接钱包、加载中） */}
                <button
                    onClick={handleDeposit}
                    className={`w-full py-3 rounded text-white font-medium ${
                        (amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance)
                            ? 'bg-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance}
                    title={`当前disabled：${amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance}`}
                >
                    {isConnecting || isLoadingBalance ? '处理中...' : `兑换 ${amount} 票据`}
                </button>

                {/* 说明文本 */}
                <div className="mt-6 text-sm text-gray-400 space-y-2">
                    <p>• 没有代币？点击导航栏「领测试代币」获取</p>
                    <p>• 1 代币 = 1 票据，兑换后代币将被销毁</p>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                >
                    返回首页
                </button>
            </div>
        </div>
    );
};

export default RechargePage;