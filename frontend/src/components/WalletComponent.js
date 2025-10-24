import { useAppContext } from "../context/AppContext";

const WalletComponent = () => {
    const { walletAddress, isConnecting, connectWallet, disconnectWallet } = useAppContext();

    return (
        <div>
            {isConnecting ? (
                <p>Connecting...</p>
            ) : walletAddress ? (
                <div>
                    <p>Address: {walletAddress}</p>
                    <button onClick={disconnectWallet}>Disconnect Wallet</button>
                </div>
            ) : (
                <button onClick={connectWallet}>Connect Wallet</button>
            )}
        </div>
    );
};

export default WalletComponent;