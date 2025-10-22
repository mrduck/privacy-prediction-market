import React from "react";
import { useAppContext } from "../context/AppContext";
import { connectors } from "../wallet/connectors";

const WalletSelector = () => {
    const { walletAddress, isConnecting, connectWallet, disconnectWallet, currentWallet } = useAppContext();

    // 已连接：显示当前钱包和地址
    if (walletAddress) {
        return (
            <div className="flex items-center gap-2">
                <span>{currentWallet?.icon} {currentWallet?.name}</span>
                <span className="text-sm">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </span>
                <button onClick={disconnectWallet} className="text-red-500">
                    断开
                </button>
            </div>
        );
    }

    // 未连接：显示钱包选择按钮
    return (
        <div className="flex gap-2">
            {connectors.map(({ id, name, icon, connector }) => (
                <button
                    key={id}
                    onClick={() => connectWallet(id)} // 传入连接器ID，连接对应钱包
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