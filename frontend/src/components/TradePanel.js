import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { getNoteBalance } from '../chainApi';

const TradePanel = ({ market, onBet, isConnected, isConnecting }) => {
    const navigate = useNavigate();
    const { userAddress } = useAppContext();
    const { options = [] } = market || {};

    // State management: bet amount, selected option, note balance, balance loading state
    const [amount, setAmount] = useState(0);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);
    const [noteBalance, setNoteBalance] = useState(0); // Note balance
    const [isLoadingBalance, setIsLoadingBalance] = useState(false); // Balance loading state

    // Automatically load note balance when entering the page
    useEffect(() => {
        if (isConnected && userAddress) {
            fetchNoteBalance();
        }
    }, [isConnected, userAddress]);

    // Logic to get note balance
    const fetchNoteBalance = async () => {
        setIsLoadingBalance(true);
        try {
            const balance = await getNoteBalance(userAddress);
            // setNoteBalance(balance);
            setNoteBalance(10);
            console.log(`Current note balance: ${balance}`);
        } catch (err) {
            toast.error(`Failed to query note balance: ${err.message}`);
        } finally {
            setIsLoadingBalance(false);
        }
    };

    // Quickly increase bet amount
    const addAmount = (value) => {
        setAmount(prev => Math.max(0, prev + value));
    };

    // Betting logic (including balance verification)
    const handleBet = async () => {
        console.log("Amount when triggering bet:", amount);
        if (isConnecting) return;
        if (!isConnected) {
            toast.error('Please connect your wallet first');
            return;
        }
        if (amount <= 0) {
            toast.error('Please enter a valid bet amount');
            return;
        }
        if (selectedOptionIndex === -1) {
            toast.error('Please select a betting option');
            return;
        }
        if (selectedOptionIndex >= options.length) {
            toast.error('Selected option is invalid');
            return;
        }
        if (noteBalance < amount) {
            toast.error('Insufficient note balance, please exchange notes first');
            navigate('/recharge');
            return;
        }

        // Execute bet
        onBet({
            optionIndex: selectedOptionIndex,
            betAmount: amount
        });

        setAmount(0);
        setSelectedOptionIndex(-1);
    };

    // Option button styles (cycle through colors for visual distinction)
    const OPTION_COLORS = [
        "bg-green-600 hover:bg-green-700",
        "bg-red-600 hover:bg-red-700",
        "bg-blue-600 hover:bg-blue-700",
        "bg-purple-600 hover:bg-purple-700",
        "bg-yellow-600 hover:bg-yellow-700",
    ];

    return (
        <div className="bg-gray-800 rounded-lg p-6 flex flex-col gap-6">
            {/* 1. Note Balance Display Area */}
            <div className="flex justify-between items-center">
                <p className="text-white font-medium">Note Balance</p>
                <p className={`text-white ${isLoadingBalance ? 'opacity-50' : ''}`}>
                    {isLoadingBalance ? 'Loading...' : noteBalance}
                </p>
            </div>

            {/* 2. Betting Options Area */}
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
                    <p className="text-gray-400 text-sm">No option data available</p>
                )}
            </div>

            {/* 3. Amount Input Area */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <label className="text-white w-24">Bet Amount ($):</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            console.log("Input value changed, new value:", val); // Added log
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

            {/* 4. Bet Button Area */}
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
                    ? "Processing..."
                    : selectedOptionIndex === -1
                        ? "Please select an option"
                        : `Bet on ${options[selectedOptionIndex] || ''}`
                }
            </button>
        </div>
    );
};

export default TradePanel;