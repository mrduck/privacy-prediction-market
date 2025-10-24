import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { getNoteBalance } from '../chainApi';

const TradePanel = ({ market, onBet, isConnected, isConnecting }) => {
    const navigate = useNavigate();
    const { userAddress } = useAppContext();
    const { options = [] } = market || {};

    // 状态管理：投注金额、选中选项、票据余额、余额加载状态
    const [amount, setAmount] = useState(0);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);
    const [noteBalance, setNoteBalance] = useState(0); // 票据余额
    const [isLoadingBalance, setIsLoadingBalance] = useState(false); // 余额加载状态

    // 进入页面自动加载票据余额
    useEffect(() => {
        if (isConnected && userAddress) {
            fetchNoteBalance();
        }
    }, [isConnected, userAddress]);

    // 获取票据余额逻辑
    const fetchNoteBalance = async () => {
        setIsLoadingBalance(true);
        try {
            const balance = await getNoteBalance(userAddress);
            // setNoteBalance(balance);
            setNoteBalance(10);
            console.log(`当前票据余额: ${balance}`);
        } catch (err) {
            toast.error(`查询票据余额失败：${err.message}`);
        } finally {
            setIsLoadingBalance(false);
        }
    };

    // 快捷增加投注金额
    const addAmount = (value) => {
        setAmount(prev => Math.max(0, prev + value));
    };

    // 投注逻辑（包含余额校验）
    const handleBet = async () => {
        console.log("触发投注时的amount：", amount);
        if (isConnecting) return;
        if (!isConnected) {
            toast.error('请先连接钱包');
            return;
        }
        if (amount <= 0) {
            toast.error('请输入有效的投注金额');
            return;
        }
        if (selectedOptionIndex === -1) {
            toast.error('请选择投注选项');
            return;
        }
        if (selectedOptionIndex >= options.length) {
            toast.error('选中的选项无效');
            return;
        }
        if (noteBalance < amount) {
            toast.error('票据余额不足，请先兑换票据');
            navigate('/recharge');
            return;
        }

        // 执行投注
        onBet({
            optionIndex: selectedOptionIndex,
            betAmount: amount
        });

        setAmount(0);
        setSelectedOptionIndex(-1);
    };

    // 选项按钮样式（循环取色，保证视觉区分）
    const OPTION_COLORS = [
        "bg-green-600 hover:bg-green-700",
        "bg-red-600 hover:bg-red-700",
        "bg-blue-600 hover:bg-blue-700",
        "bg-purple-600 hover:bg-purple-700",
        "bg-yellow-600 hover:bg-yellow-700",
    ];

    return (
        <div className="bg-gray-800 rounded-lg p-6 flex flex-col gap-6">
            {/* 1. 票据余额展示区 */}
            <div className="flex justify-between items-center">
                <p className="text-white font-medium">票据余额</p>
                <p className={`text-white ${isLoadingBalance ? 'opacity-50' : ''}`}>
                    {isLoadingBalance ? '加载中...' : noteBalance}
                </p>
            </div>

            {/* 2. 投注选项区 */}
            <div className="flex flex-wrap gap-3">
                {options.length > 0 ? (
                    options.map((option, index) => (
                        <button
                            key={index}
                            className={`px-5 py-3 rounded transition-colors text-white ${
                                selectedOptionIndex === index
                                    ? OPTION_COLORS[index % OPTION_COLORS.length]
                                    : "bg-gray-600 hover:bg-gray-700"
                            }`}
                            onClick={() => setSelectedOptionIndex(index)}
                            disabled={isConnecting}
                        >
                            {option}
                        </button>
                    ))
                ) : (
                    <p className="text-gray-400 text-sm">暂无选项数据</p>
                )}
            </div>

            {/* 3. 金额输入区 */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <label className="text-white w-24">投注金额 ($):</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            console.log("输入框值变化，新值：", val); // 新增日志
                            setAmount(Math.max(0, val));
                        }}
                        className="px-4 py-2 bg-gray-700 text-white rounded w-full"
                        min="0"
                        step="0.01"
                        disabled={isConnecting}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => addAmount(1)}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$1
                    </button>
                    <button
                        onClick={() => addAmount(20)}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$20
                    </button>
                    <button
                        onClick={() => addAmount(100)}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$100
                    </button>
                </div>
            </div>

            {/* 4. 投注按钮区 */}
            <button
                onClick={handleBet}
                className={`w-full py-3 rounded text-white font-medium transition-colors ${
                    (selectedOptionIndex === -1 || amount <= 0 || isConnecting || noteBalance < amount)
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={selectedOptionIndex === -1 || amount <= 0 || isConnecting || noteBalance < amount}
            >
                {isConnecting
                    ? "处理中..."
                    : selectedOptionIndex === -1
                        ? "请选择选项"
                        : `投注 ${options[selectedOptionIndex] || ''}`
                }
            </button>
        </div>
    );
};

export default TradePanel;