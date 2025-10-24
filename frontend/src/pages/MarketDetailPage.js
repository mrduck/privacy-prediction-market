import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {getMarketDetail,getMarketVoteRecords,vote} from "../chainApi";
import { useAppContext } from "../context/AppContext";
import MarketHeader from '../components/MarketHeader';
import MarketChart from '../components/MarketChart';
import TradePanel from '../components/TradePanel';
import PositionTable from '../components/PositionTable';
import toast from 'react-hot-toast';

const CATEGORY_MAP = {
    '1': 'Politics',
    '2': 'Sports',
    '3': 'Tech',
    '4': 'Economy',
    '5': 'Entertainment'
};

const MarketDetailPage = () => {
    const { id: marketId } = useParams();
    const [market, setMarket] = useState(null);
    const [dailyVolume, setDailyVolume] = useState([]);
    const [userPositions, setUserPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 从上下文获取状态：登录态、钱包地址、连接方法等
    const {
        walletAddress,
        isLoggedIn,
        connectWallet,
        isConnecting,
        setIsLoginOpen
    } = useAppContext();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                // 1. 获取市场基础信息
                const marketInfo = await getMarketDetail(marketId);
                if (!marketInfo.success) {
                    setError('市场不存在');
                    return;
                }
                const marketData = {
                    ...marketInfo.data,
                    categoryName: CATEGORY_MAP[marketInfo.data.category.toString()] || 'Unknown',
                };
                setMarket(marketData);
                const currentMarket = marketData;
                // 2. 获取每日交易量
                let records = [];
                try {
                    const voteRes = await getMarketVoteRecords(marketId, 1, 100);
                    console.log('voteRes:', voteRes);
                    records = voteRes.records || [];
                } catch (voteErr) {
                    console.warn('获取投票记录失败（不影响页面核心功能）：', voteErr);
                    records = [];
                }

                const volumeMap = {}; // 结构：{ "日期": { "选项索引": 交易量, ... }, ... }
                records.forEach(record => {
                    const date = new Date(Number(record.timestamp) * 1000).toLocaleDateString();
                    const optionIndex = record.optionIndex; // 选项索引（0,1,2...）
                    const amount = Number(record.amount);

                    // 初始化日期对象
                    if (!volumeMap[date]) {
                        volumeMap[date] = { date }; // 每个日期对象默认包含date字段
                    }
                    // 按选项索引累加交易量（用选项索引作为临时key）
                    volumeMap[date][optionIndex] = (volumeMap[date][optionIndex] || 0) + amount;
                });
                console.log(`获取每日交易量数据结束:${volumeMap}`);
                console.log(`市场选项:${currentMarket}`,currentMarket);
                const formattedVolume = Object.values(volumeMap).map(dateData => {
                    const item = { ...dateData };
                    // 遍历市场选项，将索引替换为选项名称
                    currentMarket.options.forEach((optionLabel, index) => {
                        if (item[index] !== undefined) {
                            item[optionLabel] = item[index]; // 用选项名称作为key
                            delete item[index]; // 删除临时的索引key
                        }
                    });
                    return item;
                });
                setDailyVolume(formattedVolume);
                console.log(`格式化交易量数据:${formattedVolume}`);
                // 3. 计算用户持仓（仅当登录且有地址时）
                if (isLoggedIn && walletAddress) {
                    // 筛选当前用户的投票记录
                    const userVotes = records.filter(
                        record => record.voter.toLowerCase() === walletAddress.toLowerCase()
                    );

                    // 累加用户的所有投注，确保每个对象都包含 userId
                    const positions = userVotes.reduce((acc, vote) => {
                        const optionIndex = Number(vote.optionIndex);
                        const amount = Number(vote.amount);
                        const optionLabel = marketData.options[optionIndex] || `选项 ${optionIndex}`;

                        // 若该选项已有持仓，累加金额（保留 userId）
                        if (acc[optionIndex]) {
                            acc[optionIndex] = {
                                ...acc[optionIndex],
                                amount: acc[optionIndex].amount + amount // 累加金额
                            };
                        }
                        // 若该选项无持仓，新建对象（强制包含 userId）
                        else {
                            acc[optionIndex] = {
                                userId: walletAddress, // 核心：添加用户地址
                                optionIndex: optionIndex,
                                option: optionLabel,
                                amount: amount
                            };
                        }
                        return acc;
                    }, {});

                    // 若用户无任何投票记录，仍返回包含 userId 的空持仓对象
                    if (Object.keys(positions).length === 0) {
                        positions["empty"] = {
                            userId: walletAddress, // 确保有用户地址
                            option: "暂无持仓",
                            amount: 0,
                            optionIndex: -1 // 标记为无实际选项
                        };
                    }

                    // 更新状态，传递给 PositionTable
                    setUserPositions(Object.values(positions));
                }

            } catch (err) {
                setError('数据加载失败：' + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [marketId, walletAddress, isLoggedIn]);

    // 加载/错误状态提示
    if (loading) return <div className="text-center py-8">加载中...</div>;
    if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
    if (!market) return <div className="text-center py-8">市场不存在</div>;

    // 投注处理：先登录，再连接钱包
    const handleBet = async (betData) => {
        if (!isLoggedIn) {
            toast.error('请先登录');
            setIsLoginOpen(true);
            return;
        }

        if (!walletAddress) {
            toast.error('请先连接钱包');
            connectWallet();
            return;
        }

        try {
            const {optionIndex, betAmount } = betData;
            // 验证参数有效性
            if (isNaN(optionIndex) || optionIndex < 0) {
                throw new Error("无效的选项索引");
            }
            if (isNaN(betAmount) || betAmount <= 0) {
                throw new Error("投注金额必须为正数");
            }

            // 调用链上 vote 方法（正确传递参数）
            const txHash = await vote(Number(marketId), Number(optionIndex), Number(betAmount));
            toast.loading(`投注交易处理中... 哈希：${txHash.slice(0, 6)}...`);

            // 等待交易确认后刷新数据（核心修正）
            setTimeout(async () => {
                try {
                    // 重新获取投票记录
                    const { records } = await getMarketVoteRecords(marketId, 1, 99);
                    // 重新计算用户持仓
                    const userVotes = records.filter(r => r.voter.toLowerCase() === walletAddress.toLowerCase());
                    const positions = userVotes.reduce((acc, vote) => {
                        const idx = Number(vote.optionIndex);
                        const amt = Number(vote.amount);
                        acc[idx] = acc[idx] ? { ...acc[idx], amount: acc[idx].amount + amt } : {
                            optionIndex: idx,
                            option: market.options[idx] || `选项 ${idx}`,
                            amount: amt
                        };
                        return acc;
                    }, {});
                    setUserPositions(Object.values(positions));
                    toast.success('投注成功！持仓已更新');
                } catch (refreshErr) {
                    toast.error(`投注成功，但刷新持仓失败：${refreshErr.message}`);
                }
            }, 15000);


        } catch (err) {
            toast.error('投注失败：' + err.message);
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen p-6">
            <MarketHeader
                market={{
                    ...market,
                    // 补充链上字段到头部组件
                    totalMarketCap: market.totalMarketCap,
                    totalVolume: market.totalVolume,
                    categoryName: market.categoryName
                }}
                CATEGORY_MAP={CATEGORY_MAP}
            />

            {/* 未登录：提示登录 */}
            {!isLoggedIn && !isConnecting && (
                <div className="text-center py-6 bg-gray-800 rounded-lg mb-6">
                    <button
                        onClick={() => setIsLoginOpen(true)}
                        className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        请先登录以查看持仓和投注
                    </button>
                </div>
            )}

            {/* 已登录但未连钱包：提示连接钱包 */}
            {isLoggedIn && !walletAddress && !isConnecting && (
                <div className="text-center py-6 bg-gray-800 rounded-lg mb-6">
                    <button
                        onClick={connectWallet}
                        className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        连接钱包以查看持仓和投注
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 mt-8">
                <div className="flex-1">
                    <MarketChart
                        data={dailyVolume}
                        options={market.options}
                        totalVolume={market.totalVolume}
                    />
                    {/* 已登录且钱包连接：显示持仓 */}
                    {isLoggedIn && walletAddress && <PositionTable positions={userPositions} />}
                </div>

                <div className="w-full md:w-80">
                    <TradePanel
                        market={market}
                        onBet={handleBet}
                        isLoggedIn={isLoggedIn} // 传递登录态给子组件
                        isConnected={!!walletAddress}
                        isConnecting={isConnecting}
                    />
                </div>
            </div>
        </div>
    );
};

export default MarketDetailPage;