import React from "react";
import { useAppContext } from "../context/AppContext";
import { connectors } from "../wallet/connectors";

const WalletSelector = () => {
    const { walletAddress, isConnecting, connectWallet, disconnectWallet, currentWallet } = useAppContext();

    // Connected: Show current wallet and address
    if (walletAddress) {
        return (
            <div className="flex items-center gap-2">
                <span>{currentWallet?.icon} {currentWallet?.name}</span>
                <span className="text-sm">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </span>
                <button onClick={disconnectWallet} className="text-red-500">
                    Disconnect
                </button>
            </div>
        );
    }

    // Not connected: Show wallet selection buttons
    return (
        <div className="flex gap-2">
            {connectors.map(({ id, name, icon, connector }) => (
                <button
                    key={id}
                    onClick={() => connectWallet(id)} // Pass connector ID to connect corresponding wallet
                    disabled={isConnecting}
                    className="px-3 py-1 border rounded"
                >
                    {icon} {name}
                </button>
            ))}
        </div>
    );
};

export default WalletSelector;