import React,{ useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppWrapper } from "./context/AppContext";
import Navbar from "./components/Navbar";
import HomePage from "./components/HomePage";
import CreateMarketPage from "./pages/CreateMarketPage";
import MarketDetailPage from "./pages/MarketDetailPage"; // 新增：导入市场详情页组件
import RechargePage from "./components/RechargePage";
import {initializeFheInstance} from "./utils/zamaIntance";

function App() {
    // const { setFheInstance, setInitStatus, setErrorMsg } = useAppContext();
    //
    // // 组件挂载后自动执行初始化（仅一次）
    // useEffect(() => {
    //     const startInit = async () => {
    //         try {
    //             setInitStatus('loading');
    //             const instance = await initializeFheInstance(); // 获取初始化后的实例
    //             setFheInstance(instance); // 存入 Context，供其他组件使用
    //             setInitStatus('success');
    //             console.log('✅ FHEVM initialized for React!');
    //         } catch (error) {
    //             setInitStatus('error');
    //             setErrorMsg(error.message || 'initialize faild');
    //         }
    //     };
    //
    //     startInit();
    // }, [setFheInstance, setInitStatus, setErrorMsg]); // 空依赖数组 → 仅执行一次

    return (
        <AppWrapper>
            <Router>
                <div className="min-h-screen">
                    {/* Navbar 是 AppWrapper 的后代，可正常使用 useAppContext */}
                    <Navbar />

                    <div className="container mx-auto px-4 py-6">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/create-market" element={<CreateMarketPage />} />
                            {/* 新增：市场详情页路由，动态接收 marketId */}
                            <Route path="/market/:id" element={<MarketDetailPage />} />
                            <Route path="/recharge" element={<RechargePage />} />
                        </Routes>

                        <Toaster position="top-right" />
                    </div>
                </div>
            </Router>
        </AppWrapper>
    );
}

export default App;