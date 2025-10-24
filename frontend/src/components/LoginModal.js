// src/components/LoginModal.jsx
import React from "react";
import { useAppContext } from "../context/AppContext";
import { ethers } from "ethers";
import { getNonce, verifySignature } from "../api";

const LoginModal = () => {
    // 从全局上下文获取状态和方法
    const {
        isLoginOpen,
        setIsLoginOpen,
        setUserAddress,
        setIsLoggedIn,
    } = useAppContext();
    // 本地临时状态：标记当前正在连接的钱包
    const [loadingWallet, setLoadingWallet] = React.useState(null);

    // 处理钱包连接与签名登录（核心逻辑）
    const handleWalletConnect = async (walletType) => {
        setLoadingWallet(walletType);
        console.log(`[步骤1] 开始连接 ${walletType}`);

        try {
            // 1. 连接钱包，获取地址和链ID
            let provider;
            if (walletType === "okx" && window.okxwallet) {
                provider = window.okxwallet;
            } else if (walletType === "metamask" && window.ethereum) {
                provider = window.ethereum;
            } else {
                alert(`未检测到 ${walletType} 钱包，请安装后重试`);
                return;
            }

            // 获取用户地址
            const accounts = await provider.request({ method: "eth_requestAccounts" });
            const address = accounts[0];
            setUserAddress(address); // 更新全局地址
            console.log(`[步骤2] 钱包连接成功，地址：${address}`);

            // 获取当前链ID（十进制）
            const chainIdHex = await provider.request({ method: "eth_chainId" });
            const chainId = parseInt(chainIdHex, 16);
            console.log(`[步骤2] 当前链ID：${chainId}`);

            // 2. 调用 API 获取 nonce
            const nonceData = await getNonce(address);
            console.log(`[步骤3] nonceData 响应:`, nonceData);

            // 处理响应数据结构 - 检查是否有嵌套的 data 字段
            const actualData = nonceData.data || nonceData;
            const { nonce, createdAt, expiresAt } = actualData;

            if (!nonce) {
                console.error("nonceData 结构:", nonceData);
                throw new Error("获取 nonce 失败，响应数据格式不正确");
            }
            console.log(`[步骤3] 获取到 nonce：${nonce}`);

            // 3. 拼装签名消息（与后端保持一致）
            const message = [
                "ZamaPredict wants you to sign in with your Ethereum account:",
                address,
                "",
                "Welcome to ZamaPredict! Sign to connect.",
                "",
                "Version: 1",
                `Chain ID: ${chainId}`,
                `Nonce: ${nonce}`,
                `Issued At: ${new Date(createdAt).toISOString()}`,
                `Expiration Time: ${new Date(expiresAt).toISOString()}`,
            ].join("\n");
            console.log(`[步骤4] 签名消息：\n${message}`);

            // 4. 发起签名请求
            const signature = await provider.request({
                method: "personal_sign",
                params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address],
            });
            console.log(`[步骤5] 签名结果：${signature}`);

            // 5. 验证签名并获取 Token
            const verifyResult = await verifySignature(address, signature, nonce, chainId);
            console.log(`[步骤6] 验证结果:`, verifyResult);

            if (verifyResult.success) {
                // 处理响应数据结构 - 检查是否有嵌套的 data 字段
                const tokenData = verifyResult.data || verifyResult;
                const token = tokenData.token;

                if (!token) {
                    throw new Error("获取 token 失败，响应数据格式不正确");
                }

                localStorage.setItem("zamaToken", token); // 存储 Token
                setIsLoggedIn(true); // 更新全局登录状态
                setIsLoginOpen(false); // 关闭弹窗
                alert("登录成功！");
            } else {
                throw new Error(verifyResult.error || "登录验证失败");
            }
        } catch (error) {
            console.error("流程失败：", error);
            alert(`操作失败：${error.message || "请重试"}`);
        } finally {
            setLoadingWallet(null);
        }
    };

    // 关闭弹窗
    const handleCloseModal = () => {
        setIsLoginOpen(false);
    };

    // 弹窗未打开时，不渲染任何内容
    if (!isLoginOpen) return null;

    return (
        <>
            {/* 遮罩层（点击关闭弹窗） */}
            <div
                className="fixed inset-0 z-50 bg-black/50"
                onClick={handleCloseModal}
            />

            {/* 弹窗内容（防止事件冒泡） */}
            <div
                className="fixed z-60 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden p-4"
                style={{ zIndex: 999 }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-900 text-center mb-4">Welcome to ZamaPredict</h2>

                {/* 钱包列表（支持 OKX、MetaMask） */}
                <div className="max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        {/* OKX 钱包 */}
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

                        {/* MetaMask 钱包 */}
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

                {/* 底部条款与关闭按钮 */}
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