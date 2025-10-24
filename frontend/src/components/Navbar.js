import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import LoginModal from "./LoginModal";
import { requestFaucet } from "../chainApi";
import toast from "react-hot-toast";
import logoImg from "../assets/Zama  DApp-logo.png";
import { Link } from 'react-router-dom';
const Navbar = () => {
    const navigate = useNavigate();
    const {
        isLoginOpen,
        setIsLoginOpen,
        isLoggedIn,
        userAddress,
        setIsLoggedIn,
        setUserAddress,
        isConnecting, // 新增：假设上下文有连接中状态（可选）
    } = useAppContext();

    // 点击“Log In”按钮：打开登录弹窗（保持原有）
    const handleLogin = () => {
        setIsLoginOpen(true);
    };

    // 退出登录：重置全局状态 + 清除 Token（保持原有）
    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserAddress("");
        localStorage.removeItem("zamaToken");
        toast.success("已退出登录"); // 优化：用toast替代alert，更友好
    };

    // 新增：领取Faucet（测试票据）
    const handleFaucet = async () => {
        if (!userAddress) {
            toast.error("请先连接钱包");
            return;
        }
        try {
            toast.loading("领取代币中...");
            await requestFaucet(); // 调用链上领取方法
            toast.dismiss();
            toast.success("测试代币领取成功！");
        } catch (err) {
            toast.dismiss();
            toast.error(`领取失败：${err.message}`);
        }
    };

    // 新增：跳转充值页面
    const handleRecharge = () => {
        navigate("/recharge"); // 跳转到充值页面
    };

    return (
        <>
            {/* 导航栏 UI（保持原有结构，新增按钮） */}
            <header className="sticky top-0 z-40 bg-zama-dark/90 backdrop-blur-md border-b border-zama-primary/20">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    {/* 品牌 Logo（保持不变） */}
                    <div className="flex items-center space-x-2">
                        <Link to="/" className="flex items-center space-x-2">
                            <div
                                className="w-10 h-10 rounded-lg bg-gradient-to-r from-zama-primary to-zama-secondary flex items-center justify-center p-1">
                                {/* 用img标签显示logo */}
                                <img
                                    src={logoImg}
                                    alt="AegisPredict Logo"
                                    className="w-full h-full object-contain" // 确保图片适应容器，保持比例
                                />
                            </div>
                            <h1 className="text-xl font-bold gradient-text">Zama<span
                                className="text-white ml-1">Predict</span></h1>
                        </Link>
                    </div>

                    {/* 桌面端导航链接（保持不变） */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <a href="#" className="nav-link">Politics</a>
                        <a href="#" className="nav-link">Sports</a>
                        <a href="#" className="nav-link">Tech</a>
                        <a href="#" className="nav-link">Economy</a>
                        <a href="#" className="nav-link">Entertainment</a>
                    </nav>

                    {/* 登录/注册 按钮区域（核心调整：新增Faucet和充值按钮） */}
                    <div className="flex items-center space-x-4">
                        {isLoggedIn ? (
                            // 已登录：显示「Faucet + 充值 + 用户地址 + 退出」
                            <div className="flex items-center space-x-3 flex-wrap">
                                {/* 新增：Faucet按钮（测试网专用） */}
                                <button
                                    onClick={handleFaucet}
                                    disabled={isConnecting} // 连接中禁用
                                    className="px-3 py-1.5 text-sm rounded bg-purple-600 hover:bg-purple-700 text-white transition"
                                >
                                    {isConnecting ? "领取中..." : "Faucet"}
                                </button>

                                {/* 新增：充值按钮 */}
                                <button
                                    onClick={handleRecharge}
                                    className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                                >
                                    Deposit
                                </button>

                                {/* 用户地址（保持原有，调整样式适配新增按钮） */}
                                <span className="text-white text-sm hidden sm:inline-block">
                                    {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                                </span>

                                {/* 退出按钮（保持原有） */}
                                <button
                                    className="text-white text-sm hover:text-gray-300"
                                    onClick={handleLogout}
                                >
                                    退出
                                </button>
                            </div>
                        ) : (
                            // 未登录：显示「Log In + Sign Up」按钮（保持原有）
                            <>
                                <button className="hidden md:block btn-outline" onClick={handleLogin}>Log In</button>
                                <button className="btn-primary">Sign Up</button>
                            </>
                        )}

                        {/* 移动端菜单按钮（保持原有） */}
                        <button className="md:hidden text-white text-xl">
                            <i className="fa fa-bars"></i>
                        </button>
                    </div>
                </div>
            </header>

            {/* 登录弹窗（保持原有） */}
            <LoginModal />
        </>
    );
};

export default Navbar;