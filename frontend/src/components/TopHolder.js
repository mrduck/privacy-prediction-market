// components/TopHolder.jsx
import React, { useEffect, useState } from 'react';
import { getTopHolders } from '../api'; // 需封装后端接口

// components/TopHolder.jsx
const TopHolder = ({ marketId }) => {
    const [holders, setHolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0); // 新增：存储总记录数

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await getTopHolders(marketId, page, limit);
                if (res.success) {
                    setHolders(res.data);
                    setTotal(res.total); // 🔴 接收并存储总记录数
                }
                setLoading(false);
            } catch (err) {
                console.error('获取投注榜失败:', err);
                setLoading(false);
            }
        };
        fetchData();
    }, [marketId, page, limit]);

    // 计算总页数
    const totalPages = Math.ceil(total / limit);

    // 页码切换逻辑（新增：基于 totalPages 判断边界）
    const handlePrevPage = () => {
        if (page > 1) setPage(page - 1);
    };
    const handleNextPage = () => {
        if (page < totalPages) setPage(page + 1);
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">投注量靠前用户</h3>
            {/* 表格内容（保持不变） */}

            {/* 分页控制区（新增：显示总页数） */}
            <div className="flex justify-center mt-4 gap-2">
                <button
                    onClick={handlePrevPage}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                >
                    上一页
                </button>
                <span className="text-white">{`第 ${page}/${totalPages} 页（共 ${total} 条记录）`}</span>
                <button
                    onClick={handleNextPage}
                    disabled={page >= totalPages}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                >
                    下一页
                </button>
            </div>
        </div>
    );
};

export default TopHolder;