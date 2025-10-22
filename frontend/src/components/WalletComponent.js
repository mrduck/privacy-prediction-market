import { useAppContext } from "../context/AppContext";

const WalletComponent = () => {
    const { walletAddress, isConnecting, connectWallet, disconnectWallet } = useAppContext();

    return (
        <div>
            {isConnecting ? (
                <p>连接中...</p>
            ) : walletAddress ? (
                <div>
                    <p>地址: {walletAddress}</p>
                    <button onClick={disconnectWallet}>断开连接</button>
                </div>
            ) : (
                <button onClick={connectWallet}>连接钱包</button>
            )}
        </div>
    );
};

export default WalletComponent;