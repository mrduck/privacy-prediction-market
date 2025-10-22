import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { CoinbaseWalletConnector } from "@web3-react/coinbase-wallet-connector";

// 支持的链（以 Sepolia 测试网为例）
const SUPPORTED_CHAIN_IDS = [11155111]; // Sepolia 链ID

// 1. 注入式钱包（MetaMask、OKX、Brave等）
export const injectedConnector = new InjectedConnector({
    supportedChainIds: SUPPORTED_CHAIN_IDS,
});

// 2. WalletConnect 钱包（支持移动端钱包，如Trust Wallet、imToken）
export const walletConnectConnector = new WalletConnectConnector({
    rpc: {
        11155111: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY", // 替换为你的Infura/Alchemy RPC
    },
    bridge: "https://bridge.walletconnect.org",
    qrcode: true, // 显示二维码
    supportedChainIds: SUPPORTED_CHAIN_IDS,
});

// 3. Coinbase Wallet
export const coinbaseWalletConnector = new CoinbaseWalletConnector({
    appName: "你的应用名称",
    jsonRpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY", // 替换为你的RPC
    chainId: 11155111,
});

// 统一管理所有钱包（用于UI展示）
export const connectors = [
    {
        id: "injected",
        name: "MetaMask/OKX",
        connector: injectedConnector,
        icon: "🍊", // 可替换为实际图标
    },
    {
        id: "walletConnect",
        name: "WalletConnect",
        connector: walletConnectConnector,
        icon: "🔗",
    },
    {
        id: "coinbase",
        name: "Coinbase Wallet",
        connector: coinbaseWalletConnector,
        icon: "🔵",
    },
];