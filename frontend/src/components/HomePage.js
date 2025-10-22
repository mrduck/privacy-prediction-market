import { useEffect, useState } from 'react';
// 移除旧的 api 导入，只保留链上接口
import { getMarketListFromChain,calculateMarketCap, calculateDailyVolume } from '../chainApi';
import SearchFilter from '../components/SearchFilter';
import CategoryTabs from '../components/CategoryTabs';
import MarketCard from '../components/MarketCard';

const CATEGORY_MAP = {
    '1': 'Politics',
    '2': 'Sports',
    '3': 'Tech',
    '4': 'Economy',
    '5': 'Entertainment'
};

const HomePage = () => {
    // 市场数据（存储链上获取的原始数据）
    const [rawMarkets, setRawMarkets] = useState([]);
    // 过滤后的市场数据（用于搜索/分类展示）
    const [markets, setMarkets] = useState([]);
    // 分页信息（page/limit 控制链上请求，totalCount/totalPages 由链上数据计算）
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
    });
    // 加载状态
    const [loading, setLoading] = useState(true);
    // 错误提示
    const [errorMsg, setErrorMsg] = useState('');
    // 筛选条件
    const [filters, setFilters] = useState({
        category: 'all', // 若合约无分类字段，暂只做前端占位
        search: '',      // 按市场标题搜索
    });

    const categories = [
        { id: 'all', name: '全部' },
        { id: '1', name: CATEGORY_MAP['1'] },
        { id: '2', name: CATEGORY_MAP['2'] },
        { id: '3', name: CATEGORY_MAP['3'] },
        { id: '4', name: CATEGORY_MAP['4'] },
        { id: '5', name: CATEGORY_MAP['5'] }
    ];
    // 核心：从链上获取数据 + 前端筛选
    const fetchMarkets = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            // 1. 调用链上接口：传递分页参数（page/limit）和排序（降序）
            const { items: chainMarkets, totalCount } = await getMarketListFromChain(
                pagination.page,    // 链上分页：当前页（从1开始）
                pagination.limit,   // 链上分页：每页数量
                true                // 排序：降序（最新市场在前）
            );

            // 2. 计算总页数（修复分页控件的 totalPages 为空问题）
            const totalPages = Math.ceil(totalCount / pagination.limit);
            // 更新分页状态（包含链上返回的总数量和计算的总页数）
            setPagination(prev => ({
                ...prev,
                totalCount,
                totalPages
            }));

            // 3. 存储链上原始数据
            setRawMarkets(chainMarkets);
        } catch (error) {
            // 修复：用 errorMsg 状态显示错误，替代 alert（更友好）
            setErrorMsg(`加载失败：${error.message}`);
            console.error('链上数据获取报错:', error);
        } finally {
            setLoading(false);
        }
    };

    // 4. 前端筛选：根据搜索词过滤（链上接口无搜索参数时，前端补全）
    useEffect(() => {
        if (rawMarkets.length === 0) return;

        // 筛选逻辑：按标题模糊搜索（忽略大小写）
        const filtered = rawMarkets.filter(market => {
            // 1. 搜索筛选（标题模糊匹配）
            const matchSearch = market.title.toLowerCase().includes(filters.search.toLowerCase());
            // 2. 分类筛选（"all" 显示全部，否则匹配数字分类）
            const matchCategory = filters.category === 'all'
                ? true
                : market.category.toString() === filters.category; // 转为字符串匹配（避免类型问题）
            return matchSearch && matchCategory;
        });

        // 若后续合约支持分类，可在此添加分类筛选逻辑（如：market.category === filters.category）
        setMarkets(filtered);
    }, [rawMarkets, filters.search, filters.category]); // 筛选条件变化时重新过滤

    // 5. 触发链上数据请求（依赖分页和筛选的“重置页码”操作）
    useEffect(() => {
        fetchMarkets();
    }, [pagination.page, pagination.limit]); // 页码/每页数量变化时，重新请求链上数据

    // 切换页码（修复越界判断，依赖计算后的 totalPages）
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        setPagination(prev => ({ ...prev, page: newPage }));
        window.scrollTo(0, 0);
    };

    // 分类切换（重置页码为1，触发重新请求）
    const handleCategoryChange = (category) => {
        setFilters(prev => ({ ...prev, category }));
        setPagination(prev => ({ ...prev, page: 1 })); // 切换分类时，从第1页重新加载
    };

    // 搜索（重置页码为1，触发前端重新筛选）
    const handleSearch = (search) => {
        setFilters(prev => ({ ...prev, search }));
        setPagination(prev => ({ ...prev, page: 1 })); // 搜索时，从第1页展示
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <SearchFilter onSearch={handleSearch} />
            <CategoryTabs
                categories={categories}
                currentCategory={filters.category}
                onCategoryChange={handleCategoryChange}
                className="my-6"
            />

            {/* 加载状态 */}
            {loading && (
                <div className="text-center py-10 text-gray-600">
                    正在加载预测市场...
                </div>
            )}

            {/* 错误提示 */}
            {errorMsg && (
                <div className="text-center py-10 text-red-500">
                    {errorMsg}
                </div>
            )}

            {/* 市场列表（修复 key 和数据匹配问题） */}
            {!loading && !errorMsg && (
                <>
                    {markets.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            暂无匹配的预测市场数据
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                            {/* 修复：key 用链上返回的 marketId（原 id 不存在） */}
                            {markets.map((market) => (
                                <MarketCard
                                    key={market.marketId} // 关键修复：链上数据是 marketId，不是 id
                                    market={market}
                                    categoryMap={CATEGORY_MAP}
                                />
                            ))}
                        </div>
                    )}

                    {/* 分页控件（只有总数量>0时显示） */}
                    {pagination.totalCount > 0 && (
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-3 py-1 mr-2 border rounded disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1 text-gray-700">
                                第 {pagination.page} / {pagination.totalPages} 页
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1 ml-2 border rounded disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                下一页
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HomePage;