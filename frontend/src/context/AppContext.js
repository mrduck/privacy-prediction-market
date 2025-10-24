import { createContext, useContext, useState, useEffect } from "react";
import { Web3ReactProvider, useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { getUser, addUser } from "../api"; // 新增：导入获取当前用户信息的接口
import {initializeFheInstance} from "../utils/zamaIntance";

// 配置连接器（支持注入式钱包：MetaMask、OKX等）
const injectedConnector = new InjectedConnector({
    supportedChainIds: [11155111], // Sepolia 测试网
});

// 修正 getLibrary，返回 MinimalProvider 实例
const getLibrary = (provider) => {
    if (provider) {
        return new ethers.BrowserProvider(provider);
    } else {
        return new ethers.JsonRpcProvider("https://rpc.sepolia.org");
    }
};

// 创建上下文
const AppContext = createContext();

// 合约配置（替换为实际地址和ABI）
const CONTRACT_ADDRESS = "0x你的实际合约地址";
const CONTRACT_ABI = [
    "function createEvent(string calldata _question, uint256 _endTime) external",
    "function submitVote(uint256 _eventId, bytes calldata _encryptedVote) external",
    "function settleEvent(uint256 _eventId) external returns (uint256, uint256)",
    "event EventCreated(uint256 indexed eventId, string question, uint256 endTime)",
];

export const AppProvider = ({ children }) => {
    // web3-react 状态
    const { activate, deactivate, account, provider, chainId } = useWeb3React();

    // 用户核心状态
    const [userAddress, setUserAddress] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('zamaToken'));
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [userInfo, setUserInfo] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [contract, setContract] = useState(null);
    const [signer, setSigner] = useState(null);
    const [currentEventId, setCurrentEventId] = useState(null);
    const [view, setView] = useState("list");

    const [fheInstance, setFheInstance] = useState(null); // 存储 Zama 实例
    const [fheInitStatus, setFheInitStatus] = useState('idle'); // 实例初始化状态：idle/loading/success/error
    const [fheErrorMsg, setFheErrorMsg] = useState(null); // 实例初始化错误信息


    // 通过 token 拉取用户信息（页面加载时执行）
    useEffect(() => {
        const token = localStorage.getItem('zamaToken');
        if (token && !isLoggedIn) {
            setIsLoggedIn(true);
        }

        if (isLoggedIn && !userAddress) {
            const fetchUserByToken = async () => {
                try {
                    const res = await getUser();
                    if (res.success && res.data.walletAddress) {
                        setUserAddress(res.data.walletAddress);
                        toast.success("用户信息同步成功");
                    } else {
                        localStorage.removeItem('zamaToken');
                        setIsLoggedIn(false);
                        setUserAddress('');
                        toast.error("用户信息无效，请重新登录");
                    }
                } catch (err) {
                    console.error("通过 token 获取用户信息失败:", err);
                    localStorage.removeItem('zamaToken');
                    setIsLoggedIn(false);
                    setUserAddress('');
                    toast.error("登录状态失效，请重新登录");
                }
            };
            fetchUserByToken();
        }
    }, [isLoggedIn, userAddress]);

    // 同步钱包地址（钱包连接时执行）
    useEffect(() => {
        if (account) {
            setUserAddress(account);
            if (isLoggedIn) {
                syncUserData(account); // 已登录时同步用户信息
            }
        }
    }, [account, isLoggedIn]);

    // 页面加载时恢复钱包连接
    useEffect(() => {
        const token = localStorage.getItem('zamaToken');
        if (token && isLoggedIn && !account) {
            console.log("页面刷新，尝试恢复钱包连接...");
            activate(injectedConnector, undefined, { reloadOnDisconnect: false })
                .catch(err => {
                    console.log("静默激活失败，需用户手动连接：", err);
                });
        }
    }, [isLoggedIn, account, activate]);

    // 初始化 signer 和合约（原有逻辑）
    useEffect(() => {
        if (!provider || !account) {
            setSigner(null);
            setContract(null);
            return;
        }

        const initEthers = async () => {
            try {
                const ethersProvider = new ethers.BrowserProvider(provider);
                const signerInstance = await ethersProvider.getSigner();
                setSigner(signerInstance);

                const contractInstance = new ethers.Contract(
                    CONTRACT_ADDRESS,
                    CONTRACT_ABI,
                    signerInstance
                );
                setContract(contractInstance);
            } catch (err) {
                console.error("初始化signer/合约失败:", err);
                toast.warning("合约初始化失败");
            }
        };

        initEthers();
    }, [provider, account]);

    useEffect(() => {
        // 初始化条件：钱包已连接（account 存在）+ Zama 未初始化（fheInitStatus 为 idle）
        if (!account || fheInitStatus !== 'idle') return;

        const initZamaInstance = async () => {
            setFheInitStatus('loading');
            setFheErrorMsg(null);
            try {
                // 调用 Zama 初始化函数（需传入钱包 provider，按你的 zamaIntance.js 实际参数调整）
                const zamaInstance = await initializeFheInstance();
                setFheInstance(zamaInstance); // 存入 Context
                setFheInitStatus('success');
                console.log('✅ Zama FHEVM 实例初始化成功');
                toast.success("Zama 隐私计算实例已就绪");
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : "Zama 实例初始化失败";
                setFheErrorMsg(errMsg);
                setFheInitStatus('error');
                console.error("Zama 初始化失败:", error);
                toast.error(errMsg);
            }
        };

        initZamaInstance();
    }, [account]); // 依赖钱包地址，钱包连接成功后触发

    // 4. 新增：Zama 实例重新初始化方法（供组件调用，比如初始化失败后重试）
    const reinitZamaInstance = async () => {
        if (fheInitStatus === 'loading') return; // 防止重复请求
        setFheInitStatus('loading');
        setFheErrorMsg(null);
        try {
            const zamaInstance = await initializeFheInstance();
            setFheInstance(zamaInstance);
            setFheInitStatus('success');
            toast.success("Zama 实例重新初始化成功");
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Zama 实例重新初始化失败";
            setFheErrorMsg(errMsg);
            setFheInitStatus('error');
            toast.error(errMsg);
        }
    };

    // 连接钱包（原有逻辑）
    const connectWallet = async () => {
        setIsConnecting(true);
        try {
            await activate(injectedConnector, undefined, { reloadOnDisconnect: false });

            if (account) {
                toast.success(`钱包连接成功：${account.slice(0, 6)}...${account.slice(-4)}`);
                setUserAddress(account);
                await syncUserData(account);
            }
        } catch (err) {
            console.error("连接失败:", err);
            if (err.name === "UnsupportedChainIdError") {
                toast.loading("正在切换到 Sepolia 测试网...");
                try {
                    const TARGET_CHAIN_HEX = "0xaa36a7";
                    await window.ethereum.send("wallet_switchEthereumChain", [{ chainId: TARGET_CHAIN_HEX }]);
                    await activate(injectedConnector, undefined, { reloadOnDisconnect: false });
                    if (account) {
                        toast.success(`钱包连接成功：${account.slice(0, 6)}...${account.slice(-4)}`);
                        setUserAddress(account);
                        await syncUserData(account);
                    }
                } catch (switchErr) {
                    if (switchErr.code === 4902) {
                        await window.ethereum.send("wallet_addEthereumChain", [
                            {
                                chainId: "0xaa36a7",
                                chainName: "Sepolia Testnet",
                                rpcUrls: ["https://rpc.sepolia.org"],
                                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                                blockExplorerUrls: ["https://sepolia.etherscan.io"]
                            }
                        ]);
                        await activate(injectedConnector, undefined, { reloadOnDisconnect: false });
                    } else {
                        toast.error("请先将钱包切换到 Sepolia 测试网");
                    }
                }
            } else {
                const errorMsg = err.message.includes("User rejected")
                    ? "您拒绝了钱包授权"
                    : `连接失败：${err.message || "未知错误"}`;
                toast.error(errorMsg);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    // 登录后自动尝试连接钱包
    useEffect(() => {
        if (isLoggedIn && !account && !isConnecting) {
            console.log("已登录但钱包未连接，自动尝试连接...");
            connectWallet();
        }
    }, [isLoggedIn, account, isConnecting, connectWallet]);

    // 断开连接（修正：保留登录态）
    const disconnectWallet = () => {
        deactivate();
        setUserInfo(null);
        setSigner(null);
        setContract(null);
        setUserAddress('');
        toast.error("钱包已断开");
    };

    // 同步用户数据（原有逻辑）
    const syncUserData = async (address) => {
        try {
            const userRes = await getUser(address);
            if (userRes.success) {
                setUserInfo(userRes.user);
                return;
            }
            const nickname = `user_${address.slice(0, 6)}`;
            const addRes = await addUser(address, nickname);
            if (addRes.success) {
                const newUserRes = await getUser(address);
                setUserInfo(newUserRes.user);
            }
        } catch (err) {
            console.error("用户数据同步失败:", err);
            toast.warning("钱包已连接，但用户数据同步失败");
        }
    };

    // 网络切换逻辑（原有）
    useEffect(() => {
        const TARGET_CHAIN_ID = 11155111;
        const TARGET_CHAIN_HEX = "0xaa36a7";

        if (chainId === TARGET_CHAIN_ID || !provider) return;

        const switchNetwork = async () => {
            try {
                await provider.send("wallet_switchEthereumChain", [{ chainId: TARGET_CHAIN_HEX }]);
            } catch (err) {
                if (err.code === 4902) {
                    try {
                        await provider.send("wallet_addEthereumChain", [
                            {
                                chainId: TARGET_CHAIN_HEX,
                                chainName: "Sepolia Testnet",
                                rpcUrls: ["https://rpc.sepolia.org"],
                                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                                blockExplorerUrls: ["https://sepolia.etherscan.io"]
                            }
                        ]);
                    } catch (addErr) {
                        console.error("添加网络失败:", addErr);
                        toast.error("请手动添加 Sepolia 测试网");
                    }
                } else {
                    toast.error("请手动切换到 Sepolia 测试网");
                }
            }
        };

        switchNetwork();
    }, [chainId, provider]);

    // 视图切换（原有）
    const switchView = (newView, eventId = null) => {
        setView(newView);
        if (eventId !== null) setCurrentEventId(eventId);
    };

    // 暴露状态和方法
    const value = {
        walletAddress: account,
        provider,
        ethersProvider: getLibrary(provider),
        signer,
        contract,
        isConnecting,
        connectWallet,
        disconnectWallet,
        userAddress,
        setUserAddress,
        isLoggedIn,
        setIsLoggedIn,
        isLoginOpen,
        setIsLoginOpen,
        userInfo,
        setUserInfo,
        currentEventId,
        view,
        switchView,
        // Zama FHEVM 新增内容
        fheInstance, // Zama 实例（供组件调用加密/解密方法）
        fheInitStatus, // 实例初始化状态（供组件判断是否可用）
        fheErrorMsg, // 实例初始化错误（供组件显示错误信息）
        reinitZamaInstance // 重新初始化方法（供组件重试）
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// 自定义 Hook（供组件获取上下文）
export const useAppContext = () => useContext(AppContext);

// 根组件包裹（在 index.js 中使用）
export const AppWrapper = ({ children }) => (
    <Web3ReactProvider getLibrary={getLibrary}>
        <AppProvider>
            {children}
        </AppProvider>
    </Web3ReactProvider>
);