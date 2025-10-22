// src/components/SearchFilter.js
import React from "react";
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext'; // 引入上下文 Hook

const SearchFilter = () => {
    const navigate = useNavigate();
    // 从上下文获取登录状态和弹窗控制方法
    const { isLoggedIn, setIsLoginOpen } = useAppContext();

    // 点击“Create Market”的逻辑
    const handleCreateMarket = () => {
        if (isLoggedIn) {
            // 已登录 → 跳转到创建页面
            navigate('/create-market');
        } else {
            // 未登录 → 打开登录弹窗
            setIsLoginOpen(true);
        }
    };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            {/* 搜索框 */}
            <div className="relative w-full md:w-1/2 mb-4 md:mb-0">
                <input
                    type="text"
                    placeholder="Search ZamaPredict..."
                    className="input-dark pl-10"
                />
                <i className="fa fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>

            {/* 筛选/排序/创建按钮组 */}
            <div className="flex flex-wrap items-center gap-2">
                <button className="px-4 py-2 rounded-lg bg-zama-card border border-gray-700 hover:border-zama-primary transition">
                    <i className="fa fa-filter mr-2"></i>Filter
                </button>
                <button className="px-4 py-2 rounded-lg bg-zama-card border border-gray-700 hover:border-zama-primary transition">
                    <i className="fa fa-sort mr-2"></i>Sort
                </button>
                <button className="btn-primary" onClick={handleCreateMarket}>Create Market</button>
            </div>
        </div>
    );
};

export default SearchFilter;