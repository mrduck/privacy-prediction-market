import React from "react";
import { useAppContext } from "../context/AppContext";
import { ethers } from "ethers";
import { getNonce, verifySignature } from "../api";

const LoginModal = () => {
    const {
        isLoginOpen,
        setIsLoginOpen,
        setUserAddress,
        setIsLoggedIn,
    } = useAppContext();
    const [loadingWallet, setLoadingWallet] = React.useState(null);

    const handleWalletConnect = async (walletType) => {
        setLoadingWallet(walletType);
        console.log(`[Step 1] Starting to connect ${walletType}`);

        try {
            let provider;
            if (walletType === "okx" && window.okxwallet) {
                provider = window.okxwallet;
            } else if (walletType === "metamask" && window.ethereum) {
                provider = window.ethereum;
            } else {
                alert(`Wallet ${walletType} not detected. Please install and try again`);
                return;
            }

            const accounts = await provider.request({ method: "eth_requestAccounts" });
            const address = accounts[0];
            setUserAddress(address);
            console.log(`[Step 2] Wallet connected successfully, address: ${address}`);

            const chainIdHex = await provider.request({ method: "eth_chainId" });
            const chainId = parseInt(chainIdHex, 16);
            console.log(`[Step 2] Current chain ID: ${chainId}`);

            const nonceData = await getNonce(address);
            console.log(`[Step 3] nonceData response:`, nonceData);

            const actualData = nonceData.data || nonceData;
            const { nonce, createdAt, expiresAt } = actualData;

            if (!nonce) {
                console.error("nonceData structure:", nonceData);
                throw new Error("Failed to get nonce. Response data format is incorrect");
            }
            console.log(`[Step 3] Got nonce: ${nonce}`);

            const message = [
                "AegisPredict wants you to sign in with your Ethereum account:",
                address,
                "",
                "Welcome to AegisPredict! Sign to connect.",
                "",
                "Version: 1",
                `Chain ID: ${chainId}`,
                `Nonce: ${nonce}`,
                `Issued At: ${new Date(createdAt).toISOString()}`,
                `Expiration Time: ${new Date(expiresAt).toISOString()}`,
            ].join("\n");
            console.log(`[Step 4] Signature message:\n${message}`);

            const signature = await provider.request({
                method: "personal_sign",
                params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address],
            });
            console.log(`[Step 5] Signature result: ${signature}`);

            const verifyResult = await verifySignature(address, signature, nonce, chainId);
            console.log(`[Step 6] Verification result:`, verifyResult);

            if (verifyResult.success) {
                const tokenData = verifyResult.data || verifyResult;
                const token = tokenData.token;

                if (!token) {
                    throw new Error("Failed to get token. Response data format is incorrect");
                }

                localStorage.setItem("zamaToken", token);
                setIsLoggedIn(true);
                setIsLoginOpen(false);
                alert("Login successful!");
            } else {
                throw new Error(verifyResult.error || "Login verification failed");
            }
        } catch (error) {
            console.error("Process failed:", error);
            alert(`Operation failed: ${error.message || "Please try again"}`);
        } finally {
            setLoadingWallet(null);
        }
    };

    const handleCloseModal = () => {
        setIsLoginOpen(false);
    };

    if (!isLoginOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/50"
                onClick={handleCloseModal}
            />

            <div
                className="fixed z-60 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden p-4"
                style={{ zIndex: 999 }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-900 text-center mb-4">Welcome to AegisPredict</h2>

                <div className="max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        <button
                            className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-all"
                            onClick={() => handleWalletConnect("okx")}
                            disabled={loadingWallet === "okx"}
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                                {loadingWallet === "okx" ? (
                                    <i className="fa fa-spinner fa-spin text-blue-500"></i>
                                ) : (
                                    <img
                                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAABcCAMAAADUMSJqAAAANlBMVEWa7SwAAACe8y1jmRyP2ykwSg4sRA1hlhyR3ilmnR15uiIRGwSg9y5nnx1xrh96vCIoPgxuqR+oN6FZAAAAtklEQVRoge2YSw6DMAwF0wTyI5T2/pftOraQrKipoJpZP4/MhhfZOQAAgMvhJUORE0roSFWN+pr6TLHuvT8kWWayihTb7j6oyUVmFhUJyJEjR/6v8jQiT0b5IQc31/raaW6TGV0oJ/a89LhnXDvi24lItvecoEW556uNuvSnrFIehxdFjhw58vvLv/nLnVkWvso9LTV3XKGg7/tuQY4cOfIZ8qImDWeo3Vp8Ew9ok09/AAAAP+MDNgkNlwLcfBsAAAAASUVORK5CYII="
                                        className="w-6 h-6"
                                        alt="OKX"
                                    />
                                )}
                            </div>
                            <span className="text-xs text-gray-700">OKX</span>
                        </button>

                        <button
                            className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-orange-500 transition-all"
                            onClick={() => handleWalletConnect("metamask")}
                            disabled={loadingWallet === "metamask"}
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                                {loadingWallet === "metamask" ? (
                                    <i className="fa fa-spinner fa-spin text-orange-500"></i>
                                ) : (
                                    <i className="text-orange-500 text-xl">🦊</i>
                                )}
                            </div>
                            <span className="text-xs text-gray-700">MetaMask</span>
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                    <div className="text-xs text-gray-500">
                        <a href="#" className="hover:text-gray-700">Terms</a> ·{" "}
                        <a href="#" className="hover:text-gray-700">Privacy</a>
                    </div>
                    <button
                        onClick={handleCloseModal}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
                    >
                        <i className="fa fa-times"></i>
                    </button>
                </div>
            </div>
        </>
    );
};

export default LoginModal;