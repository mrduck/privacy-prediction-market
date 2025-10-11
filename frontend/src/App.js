import React, { useState } from "react";
import { Toaster } from "react-hot-toast";
import { AppWrapper } from "./context/AppContext"; // 使用 AppWrapper 替代 AppProvider
import Navbar from "./components/Navbar";
import SearchFilter from "./components/SearchFilter";
import CategoryTabs from "./components/CategoryTabs";
import MarketCard from "./components/MarketCard";
import LoginModal from "./components/LoginModal";
import WalletComponent from "./components/WalletComponent"; // 引入 WalletComponent

function App() {
    // 登录弹窗状态（默认关闭）
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    // 模拟预测市场数据（后续可从接口获取）
    const mockMarkets = [
        {
            title: "New York City Mayoral Election",
            description: "Who will be the next Mayor of New York City?",
            category: "Politics",
            volume: "$141m",
            type: "Politics",
            options: [
                { label: "Zohran Mamdani", percent: "87%", type: "Yes" },
                { label: "Andrew Cuomo", percent: "12%", type: "No" },
            ],
        },
        {
            title: "World Series Champion 2025",
            description: "Which team will win the 2025 World Series?",
            category: "Sports",
            volume: "$64m",
            type: "Sports",
            options: [
                { label: "Los Angeles Dodgers", percent: "33%", type: "Yes" },
                { label: "Toronto Blue Jays", percent: "23%", type: "No" },
            ],
        },
        {
            title: "Will Tesla (TSLA) beat quarterly earnings?",
            description: "Q3 2025 earnings report prediction",
            category: "Tech",
            volume: "$159k",
            type: "Tech",
            options: [
                { label: "Yes", percent: "60%", type: "Chance" },
                { label: "No", percent: "40%", type: "Chance" },
            ],
        },
    ];

    return (
        <AppWrapper> {/* 替换为 AppWrapper */}
            <div className="min-h-screen">
                {/* 顶部导航 */}
                <Navbar />

                {/* 主内容区容器 */}
                <div className="container mx-auto px-4 py-6">
                    {/* 搜索 + 筛选 */}
                    <SearchFilter />

                    {/* 分类标签 */}
                    <CategoryTabs />

                    {/* 预测市场卡片列表 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mockMarkets.map((market, index) => (
                            <MarketCard key={index} market={market} />
                        ))}
                    </div>

                    {/* 钱包连接组件 */}
                    <WalletComponent /> {/* 添加钱包连接组件 */}

                    {/* 消息提示组件 */}
                    <Toaster position="top-right" />

                    {/*/!* 登录弹窗 *!/*/}
                    {/*<LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />*/}
                </div>
            </div>
        </AppWrapper>
    );
}

export default App;