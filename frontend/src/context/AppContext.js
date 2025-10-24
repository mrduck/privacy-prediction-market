import { createContext, useContext, useState, useEffect } from "react";
import { Web3ReactProvider, useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { getUser, addUser } from "../api"; // Added: Import API for fetching current user info
import { initializeFheInstance } from "../utils/zamaIntance";

// Configure connector (supports injected wallets: MetaMask, OKX, etc.)
const injectedConnector = new InjectedConnector({
    supportedChainIds: [11155111], // Sepolia Testnet
});

// Fix getLibrary to return MinimalProvider instance
const getLibrary = (provider) => {
    if (provider) {
        return new ethers.BrowserProvider(provider);
    } else {
        return new ethers.JsonRpcProvider("https://rpc.sepolia.org");
    }
};

// Create context
const AppContext = createContext();

// Contract configuration (replace with actual address and ABI)
const CONTRACT_ADDRESS = "0xYourActualContractAddress";
const CONTRACT_ABI = [
    "function createEvent(string calldata _question, uint256 _endTime) external",
    "function submitVote(uint256 _eventId, bytes calldata _encryptedVote) external",
    "function settleEvent(uint256 _eventId) external returns (uint256, uint256)",
    "event EventCreated(uint256 indexed eventId, string question, uint256 endTime)",
];

export const AppProvider = ({ children }) => {
    // web3-react state
    const { activate, deactivate, account, provider, chainId } = useWeb3React();

    // Core user state
    const [userAddress, setUserAddress] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('zamaToken'));
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [userInfo, setUserInfo] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [contract, setContract] = useState(null);
    const [signer, setSigner] = useState(null);
    const [currentEventId, setCurrentEventId] = useState(null);
    const [view, setView] = useState("list");

    // Zama instance related states
    const [fheInstance, setFheInstance] = useState(null); // Store Zama instance
    const [fheInitStatus, setFheInitStatus] = useState('idle'); // Instance initialization status: idle/loading/success/error
    const [fheErrorMsg, setFheErrorMsg] = useState(null); // Instance initialization error message


    // Fetch user info via token (executed on page load)
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
                        toast.success("User info synced successfully");
                    } else {
                        localStorage.removeItem('zamaToken');
                        setIsLoggedIn(false);
                        setUserAddress('');
                        toast.error("Invalid user info, please log in again");
                    }
                } catch (err) {
                    console.error("Failed to fetch user info via token:", err);
                    localStorage.removeItem('zamaToken');
                    setIsLoggedIn(false);
                    setUserAddress('');
                    toast.error("Login session expired, please log in again");
                }
            };
            fetchUserByToken();
        }
    }, [isLoggedIn, userAddress]);

    // Sync wallet address (executed when wallet connects)
    useEffect(() => {
        if (account) {
            setUserAddress(account);
            if (isLoggedIn) {
                syncUserData(account); // Sync user info when logged in
            }
        }
    }, [account, isLoggedIn]);

    // Restore wallet connection on page load
    useEffect(() => {
        const token = localStorage.getItem('zamaToken');
        if (token && isLoggedIn && !account) {
            console.log("Page refreshed, attempting to restore wallet connection...");
            activate(injectedConnector, undefined, { reloadOnDisconnect: false })
                .catch(err => {
                    console.log("Silent activation failed, user needs to connect manually:", err);
                });
        }
    }, [isLoggedIn, account, activate]);

    // Initialize signer and contract (original logic)
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
                console.error("Failed to initialize signer/contract:", err);
                toast.warning("Contract initialization failed");
            }
        };

        initEthers();
    }, [provider, account]);

    useEffect(() => {
        // Initialization condition: Wallet connected (account exists) + Zama not initialized (fheInitStatus is idle)
        if (!account || fheInitStatus !== 'idle') return;

        const initZamaInstance = async () => {
            setFheInitStatus('loading');
            setFheErrorMsg(null);
            try {
                // Call Zama initialization function (pass wallet provider, adjust based on actual parameters in your zamaIntance.js)
                const zamaInstance = await initializeFheInstance();
                setFheInstance(zamaInstance); // Store in Context
                setFheInitStatus('success');
                console.log('✅ Zama FHEVM instance initialized successfully');
                toast.success("Zama privacy computing instance is ready");
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : "Zama instance initialization failed";
                setFheErrorMsg(errMsg);
                setFheInitStatus('error');
                console.error("Zama initialization failed:", error);
                toast.error(errMsg);
            }
        };

        initZamaInstance();
    }, [account]); // Depends on wallet address, triggered after successful wallet connection

    // 4. Added: Zama instance reinitialization method (for components to call, e.g., retry after initialization failure)
    const reinitZamaInstance = async () => {
        if (fheInitStatus === 'loading') return; // Prevent duplicate requests
        setFheInitStatus('loading');
        setFheErrorMsg(null);
        try {
            const zamaInstance = await initializeFheInstance();
            setFheInstance(zamaInstance);
            setFheInitStatus('success');
            toast.success("Zama instance reinitialized successfully");
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Zama instance reinitialization failed";
            setFheErrorMsg(errMsg);
            setFheInitStatus('error');
            toast.error(errMsg);
        }
    };

    // Connect wallet (original logic)
    const connectWallet = async () => {
        setIsConnecting(true);
        try {
            await activate(injectedConnector, undefined, { reloadOnDisconnect: false });

            if (account) {
                toast.success(`Wallet connected successfully: ${account.slice(0, 6)}...${account.slice(-4)}`);
                setUserAddress(account);
                await syncUserData(account);
            }
        } catch (err) {
            console.error("Connection failed:", err);
            if (err.name === "UnsupportedChainIdError") {
                toast.loading("Switching to Sepolia Testnet...");
                try {
                    const TARGET_CHAIN_HEX = "0xaa36a7";
                    await window.ethereum.send("wallet_switchEthereumChain", [{ chainId: TARGET_CHAIN_HEX }]);
                    await activate(injectedConnector, undefined, { reloadOnDisconnect: false });
                    if (account) {
                        toast.success(`Wallet connected successfully: ${account.slice(0, 6)}...${account.slice(-4)}`);
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
                        toast.error("Please switch your wallet to Sepolia Testnet first");
                    }
                }
            } else {
                const errorMsg = err.message.includes("User rejected")
                    ? "You rejected wallet authorization"
                    : `Connection failed: ${err.message || "Unknown error"}`;
                toast.error(errorMsg);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    // Auto-attempt wallet connection after login
    useEffect(() => {
        if (isLoggedIn && !account && !isConnecting) {
            console.log("Logged in but wallet not connected, auto-attempting connection...");
            connectWallet();
        }
    }, [isLoggedIn, account, isConnecting, connectWallet]);

    // Disconnect wallet (fixed: retain login state)
    const disconnectWallet = () => {
        deactivate();
        setUserInfo(null);
        setSigner(null);
        setContract(null);
        setUserAddress('');
        toast.error("Wallet disconnected");
    };

    // Sync user data (original logic)
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
            console.error("Failed to sync user data:", err);
            toast.warning("Wallet connected, but user data sync failed");
        }
    };

    // Network switch logic (original)
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
                        console.error("Failed to add network:", addErr);
                        toast.error("Please add Sepolia Testnet manually");
                    }
                } else {
                    toast.error("Please switch to Sepolia Testnet manually");
                }
            }
        };

        switchNetwork();
    }, [chainId, provider]);

    // View switch (original)
    const switchView = (newView, eventId = null) => {
        setView(newView);
        if (eventId !== null) setCurrentEventId(eventId);
    };

    // Expose states and methods
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
        // Zama FHEVM added content
        fheInstance, // Zama instance (for components to call encryption/decryption methods)
        fheInitStatus, // Instance initialization status (for components to check availability)
        fheErrorMsg, // Instance initialization error (for components to display error info)
        reinitZamaInstance // Reinitialization method (for components to retry)
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// Custom Hook (for components to get context)
export const useAppContext = () => useContext(AppContext);

// Root component wrapper (used in index.js)
export const AppWrapper = ({ children }) => (
    <Web3ReactProvider getLibrary={getLibrary}>
        <AppProvider>
            {children}
        </AppProvider>
    </Web3ReactProvider>
);