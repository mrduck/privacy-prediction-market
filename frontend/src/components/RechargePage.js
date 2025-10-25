// src/pages/RechargePage.js (Refactored)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { depositTokens, getTokenBalance } from '../chainApi';
import toast from 'react-hot-toast';

const RechargePage = () => {
    const navigate = useNavigate();
    const { userAddress, isConnected, isConnecting } = useAppContext();
    const [amount, setAmount] = useState(0); // Amount to exchange
    const [userBalance, setUserBalance] = useState(0); // User's token balance
    const [isLoadingBalance, setIsLoadingBalance] = useState(false); // Balance loading state

    const { fheInstance, fheInitStatus } = useAppContext();

    useEffect(() => {
        console.log("=== Current Component State ===");
        console.log("Connecting: isConnecting =", isConnecting);
        console.log("User Address: userAddress =", userAddress);
        console.log("Zama Initialization Status: fheInitStatus =", fheInitStatus);
        console.log("User Balance: userBalance =", userBalance);
        console.log("Exchange Amount: amount =", amount);
        console.log("Balance Loading: isLoadingBalance =", isLoadingBalance);
        console.log("Button Disabled Conditions:");
        console.log("  - amount <= 0:", amount <= 0);
        console.log("  - isConnecting:", isConnecting);
        console.log("  - isLoadingBalance:", isLoadingBalance);
        console.log("  - amount > userBalance:", amount > userBalance);
        console.log("  → Final disabled status:",
            amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance
        );
        console.log("===================");
    });

    // Automatically fetch user balance when page loads
    // src/pages/RechargePage.js (Add debug logs)
    useEffect(() => {
        console.log("Trigger Balance Fetch Conditions:", {
            isConnected: isConnected,
            userAddress: userAddress,
            shouldFetch: isConnected && userAddress
        }); // Added Log: Check if trigger conditions are met
        if (userAddress) {
            fetchUserBalance();
        }
    }, [isConnected, userAddress]);

    // Fetch user token balance
    const fetchUserBalance = async () => {
        setIsLoadingBalance(true);
        try {
            if (fheInitStatus !== "success" || !fheInstance) {
                toast.error("Zama instance not ready, please wait for initialization to complete");
                return;
            }
            console.log(`Start fetching user token balance`);
            const balance = await getTokenBalance(fheInstance);
            console.log(`Fetched total token balance: ${balance}`);
            setUserBalance(balance);
            setAmount(balance); // Initially fill with full balance by default
            // setUserBalance(10);
            // setAmount(10); // Initially fill with full balance by default
        } catch (err) {
            toast.error(`Failed to fetch balance: ${err.message}`);
        } finally {
            setIsLoadingBalance(false);
        }
    };

    // Ticket exchange logic
    const handleDeposit = async () => {
        if (isConnecting || isLoadingBalance) return;
        if (amount <= 0 || amount > userBalance) {
            toast.error(`Exchange amount must be between 1~${userBalance}`);
            return;
        }

        try {
            toast.loading('Exchanging tickets...');
            const tx = await depositTokens(amount);
            await tx.wait();
            toast.dismiss();
            toast.success(`Successfully exchanged ${amount} tickets!`);
            setAmount(0);
            fetchUserBalance(); // Refresh balance after exchange
        } catch (err) {
            toast.dismiss();
            toast.error(`Exchange failed: ${err.message}`);
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen p-6">
            <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Token to Ticket Exchange</h2>
                <p className="text-gray-400 mb-6">
                    Exchange PrivacyToken for voting tickets to participate in prediction market bets:
                </p>

                {/* Added: Display user's current token balance */}
                <div className="mb-4">
                    <p className="text-gray-400">
                        Your Token Balance: {isLoadingBalance ? 'Loading...' : userBalance}
                    </p>
                </div>

                {/* Exchange Amount Input */}
                <div className="flex items-center gap-3 mb-6">
                    <label className="text-white">Exchange Amount:</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) =>
                            setAmount(Math.max(0, Math.min(Number(e.target.value), userBalance)))
                        }
                        className="px-3 py-2 bg-gray-700 text-white rounded w-full"
                        min="0"
                        max={userBalance} // Limit maximum input to user's balance
                        step="0.01"
                        disabled={isConnecting || !isConnected || isLoadingBalance}
                    />
                </div>

                {/* Quick Amount Buttons (automatically limited to not exceed balance) */}
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

                {/* Exchange Button (Disabled logic: invalid amount, wallet not connected, loading) */}
                <button
                    onClick={handleDeposit}
                    className={`w-full py-3 rounded text-white font-medium ${
                        (amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance)
                            ? 'bg-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance}
                    title={`Current disabled status: ${amount <= 0 || isConnecting || isLoadingBalance || amount > userBalance}`}
                >
                    {isConnecting || isLoadingBalance ? 'Processing...' : `Exchange ${amount} Tickets`}
                </button>

                {/* Explanatory Text */}
                <div className="mt-6 text-sm text-gray-400 space-y-2">
                    <p>• Don't have tokens? Click "Claim Test Tokens" in the navbar</p>
                    <p>• 1 Token = 1 Ticket, tokens will be burned after exchange</p>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                >
                    Back to Homepage
                </button>
            </div>
        </div>
    );
};

export default RechargePage;