import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMarketDetail, getMarketVoteRecords, vote } from "../chainApi";
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

    // Get states from context: login status, wallet address, connection method, etc.
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
                // 1. Fetch basic market information
                const marketInfo = await getMarketDetail(marketId);
                if (!marketInfo.success) {
                    setError('Market does not exist');
                    return;
                }
                const marketData = {
                    ...marketInfo.data,
                    categoryName: CATEGORY_MAP[marketInfo.data.category.toString()] || 'Unknown',
                };
                setMarket(marketData);
                const currentMarket = marketData;
                // 2. Fetch daily trading volume
                let records = [];
                try {
                    const voteRes = await getMarketVoteRecords(marketId, 1, 100);
                    console.log('voteRes:', voteRes);
                    records = voteRes.records || [];
                } catch (voteErr) {
                    console.warn('Failed to fetch vote records (does not affect core page functionality):', voteErr);
                    records = [];
                }

                const volumeMap = {}; // Structure: { "date": { "optionIndex": tradingVolume, ... }, ... }
                records.forEach(record => {
                    const date = new Date(Number(record.timestamp) * 1000).toLocaleDateString();
                    const optionIndex = record.optionIndex; // Option index (0,1,2...)
                    const amount = Number(record.amount);

                    // Initialize date object
                    if (!volumeMap[date]) {
                        volumeMap[date] = { date }; // Each date object contains 'date' field by default
                    }
                    // Accumulate trading volume by option index (use option index as temporary key)
                    volumeMap[date][optionIndex] = (volumeMap[date][optionIndex] || 0) + amount;
                });
                console.log(`Daily trading volume data fetch completed: ${volumeMap}`);
                console.log(`Market options: ${currentMarket}`, currentMarket);
                const formattedVolume = Object.values(volumeMap).map(dateData => {
                    const item = { ...dateData };
                    // Iterate through market options, replace index with option name
                    currentMarket.options.forEach((optionLabel, index) => {
                        if (item[index] !== undefined) {
                            item[optionLabel] = item[index]; // Use option name as key
                            delete item[index]; // Delete temporary index key
                        }
                    });
                    return item;
                });
                setDailyVolume(formattedVolume);
                console.log(`Formatted trading volume data: ${formattedVolume}`);
                // 3. Calculate user positions (only when logged in and wallet address exists)
                if (isLoggedIn && walletAddress) {
                    // Filter vote records of current user
                    const userVotes = records.filter(
                        record => record.voter.toLowerCase() === walletAddress.toLowerCase()
                    );

                    // Accumulate all user bets, ensure each object contains userId
                    const positions = userVotes.reduce((acc, vote) => {
                        const optionIndex = Number(vote.optionIndex);
                        const amount = Number(vote.amount);
                        const optionLabel = marketData.options[optionIndex] || `Option ${optionIndex}`;

                        // If position for this option already exists, accumulate amount (retain userId)
                        if (acc[optionIndex]) {
                            acc[optionIndex] = {
                                ...acc[optionIndex],
                                amount: acc[optionIndex].amount + amount // Accumulate amount
                            };
                        }
                        // If no position for this option, create new object (force include userId)
                        else {
                            acc[optionIndex] = {
                                userId: walletAddress, // Core: Add user address
                                optionIndex: optionIndex,
                                option: optionLabel,
                                amount: amount
                            };
                        }
                        return acc;
                    }, {});

                    // If user has no vote records, still return empty position object with userId
                    if (Object.keys(positions).length === 0) {
                        positions["empty"] = {
                            userId: walletAddress, // Ensure user address exists
                            option: "No positions",
                            amount: 0,
                            optionIndex: -1 // Mark as no actual option
                        };
                    }

                    // Update state and pass to PositionTable
                    setUserPositions(Object.values(positions));
                }

            } catch (err) {
                setError('Failed to load data: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [marketId, walletAddress, isLoggedIn]);

    // Loading/error state prompts
    if (loading) return <div className="text-center py-8">Loading...</div>;
    if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
    if (!market) return <div className="text-center py-8">Market does not exist</div>;

    // Bet handling: Log in first, then connect wallet
    const handleBet = async (betData) => {
        if (!isLoggedIn) {
            toast.error('Please log in first');
            setIsLoginOpen(true);
            return;
        }

        if (!walletAddress) {
            toast.error('Please connect your wallet first');
            connectWallet();
            return;
        }

        try {
            const { optionIndex, betAmount } = betData;
            // Validate parameter validity
            if (isNaN(optionIndex) || optionIndex < 0) {
                throw new Error("Invalid option index");
            }
            if (isNaN(betAmount) || betAmount <= 0) {
                throw new Error("Bet amount must be a positive number");
            }

            // Call on-chain vote method (pass parameters correctly)
            const txHash = await vote(Number(marketId), Number(optionIndex), Number(betAmount));
            toast.loading(`Bet transaction in progress... Hash: ${txHash.slice(0, 6)}...`);

            // Refresh data after transaction confirmation (core fix)
            setTimeout(async () => {
                try {
                    // Re-fetch vote records
                    const { records } = await getMarketVoteRecords(marketId, 1, 99);
                    // Re-calculate user positions
                    const userVotes = records.filter(r => r.voter.toLowerCase() === walletAddress.toLowerCase());
                    const positions = userVotes.reduce((acc, vote) => {
                        const idx = Number(vote.optionIndex);
                        const amt = Number(vote.amount);
                        acc[idx] = acc[idx] ? { ...acc[idx], amount: acc[idx].amount + amt } : {
                            optionIndex: idx,
                            option: market.options[idx] || `Option ${idx}`,
                            amount: amt
                        };
                        return acc;
                    }, {});
                    setUserPositions(Object.values(positions));
                    toast.success('Bet successful! Positions updated');
                } catch (refreshErr) {
                    toast.error(`Bet successful, but failed to refresh positions: ${refreshErr.message}`);
                }
            }, 15000);


        } catch (err) {
            toast.error('Bet failed: ' + err.message);
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen p-6">
            <MarketHeader
                market={{
                    ...market,
                    // Supplement on-chain fields to header component
                    totalMarketCap: market.totalMarketCap,
                    totalVolume: market.totalVolume,
                    categoryName: market.categoryName
                }}
                CATEGORY_MAP={CATEGORY_MAP}
            />

            {/* Not logged in: Prompt to log in */}
            {!isLoggedIn && !isConnecting && (
                <div className="text-center py-6 bg-gray-800 rounded-lg mb-6">
                    <button
                        onClick={() => setIsLoginOpen(true)}
                        className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        Please log in first to view positions and place bets
                    </button>
                </div>
            )}

            {/* Logged in but wallet not connected: Prompt to connect wallet */}
            {isLoggedIn && !walletAddress && !isConnecting && (
                <div className="text-center py-6 bg-gray-800 rounded-lg mb-6">
                    <button
                        onClick={connectWallet}
                        className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        Connect wallet to view positions and place bets
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
                    {/* Logged in and wallet connected: Show positions */}
                    {isLoggedIn && walletAddress && <PositionTable positions={userPositions} />}
                </div>

                <div className="w-full md:w-80">
                    <TradePanel
                        market={market}
                        onBet={handleBet}
                        isLoggedIn={isLoggedIn} // Pass login status to child component
                        isConnected={!!walletAddress}
                        isConnecting={isConnecting}
                    />
                </div>
            </div>
        </div>
    );
};

export default MarketDetailPage;