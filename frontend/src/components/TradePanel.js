import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 新增：用于跳转
import { useAppContext } from '../context/AppContext'; // 新增：获取用户地址
import toast from 'react-hot-toast';
import { getNoteBalance } from '../chainApi';

const TradePanel = ({ market, onBet, isConnected, isConnecting }) => {
    const navigate = useNavigate(); // 初始化导航
    const { userAddress } = useAppContext(); // 获取当前用户地址（查询余额需要）
    const { options = [] } = market || {};

    const [amount, setAmount] = useState(0);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);

    const addAmount = (value) => {
        setAmount(prev => Math.max(0, prev + value));
    };

    // 关键：将 handleBet 声明为 async，支持 await
    const handleBet = async () => {
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

        // 核心：在投注前校验票据余额（移到这里）
        try {
            // 传入用户地址查询余额（假设 getNoteBalance 需要用户地址参数）
            const noteBalance = await getNoteBalance(userAddress);
            // const decBalance = decryptNoteBalance(noteBalance);
            console.log(`获取加密票据余额:${noteBalance}`);
            // console.log(`获取解密票据余额:${decBalance}`);
            if (noteBalance < amount) {
                toast.error('票据余额不足，请先兑换票据');
                navigate('/recharge'); // 跳转充值页
                return;
            }
        } catch (err) {
            toast.error(`查询票据余额失败：${err.message}`);
            return;
        }

        // 余额足够，执行投注
        onBet({
            marketId: market.id,
            optionIndex: selectedOptionIndex,
            betAmount: amount
        });

        setAmount(0);
        setSelectedOptionIndex(-1);
    };

    const OPTION_COLORS = [
        "bg-green-600 hover:bg-green-700",
        "bg-red-600 hover:bg-red-700",
        "bg-blue-600 hover:bg-blue-700",
        "bg-purple-600 hover:bg-purple-700",
        "bg-yellow-600 hover:bg-yellow-700",
    ];

    return (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
            {/* 选项按钮 */}
            <div className="flex gap-2 flex-wrap">
                {options.length > 0 ? (
                    options.map((option, index) => (
                        <button
                            key={index}
                            className={`px-4 py-2 rounded transition-colors text-white ${
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

            {/* 金额输入 */}
            <div className="flex items-center gap-3 flex-wrap">
                <label className="text-white">投注金额 ($):</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                    className="px-3 py-2 bg-gray-700 text-white rounded w-32"
                    min="0"
                    step="0.01"
                    disabled={isConnecting}
                />
                <div className="flex gap-1">
                    <button
                        onClick={() => addAmount(1)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$1
                    </button>
                    <button
                        onClick={() => addAmount(20)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$20
                    </button>
                    <button
                        onClick={() => addAmount(100)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        disabled={isConnecting}
                    >
                        +$100
                    </button>
                </div>
            </div>

            {/* 投注按钮 */}
            <button
                onClick={handleBet}
                className={`px-6 py-3 rounded text-white font-medium transition-colors ${
                    (selectedOptionIndex === -1 || amount <= 0 || !isConnected || isConnecting)
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={selectedOptionIndex === -1 || amount <= 0 || !isConnected || isConnecting}
            >
                {isConnecting
                    ? "处理中..."
                    : `投注 ${options[selectedOptionIndex] || ''}`
                }
            </button>
        </div>
    );
};

export default TradePanel;