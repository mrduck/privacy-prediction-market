import { useEffect, useState } from 'react';
import { getMarketListFromChain } from '../chainApi';
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
    const [rawMarkets, setRawMarkets] = useState([]);
    const [markets, setMarkets] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [filters, setFilters] = useState({
        category: 'all',
        search: '',
    });

    const categories = [
        { id: 'all', name: 'All' },
        { id: '1', name: CATEGORY_MAP['1'] },
        { id: '2', name: CATEGORY_MAP['2'] },
        { id: '3', name: CATEGORY_MAP['3'] },
        { id: '4', name: CATEGORY_MAP['4'] },
        { id: '5', name: CATEGORY_MAP['5'] }
    ];

    const fetchMarkets = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const { items: chainMarkets, totalCount } = await getMarketListFromChain(
                pagination.page,
                pagination.limit,
                true
            );

            const totalPages = Math.ceil(totalCount / pagination.limit);
            setPagination(prev => ({
                ...prev,
                totalCount,
                totalPages
            }));

            setRawMarkets(chainMarkets);
        } catch (error) {
            setErrorMsg(`Loading failed: ${error.message}`);
            console.error('On-chain data fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (rawMarkets.length === 0) return;

        const filtered = rawMarkets.filter(market => {
            const matchSearch = market.title.toLowerCase().includes(filters.search.toLowerCase());
            const matchCategory = filters.category === 'all'
                ? true
                : market.category.toString() === filters.category;
            return matchSearch && matchCategory;
        });

        setMarkets(filtered);
    }, [rawMarkets, filters.search, filters.category]);

    useEffect(() => {
        fetchMarkets();
    }, [pagination.page, pagination.limit]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        setPagination(prev => ({ ...prev, page: newPage }));
        window.scrollTo(0, 0);
    };

    const handleCategoryChange = (category) => {
        setFilters(prev => ({ ...prev, category }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleSearch = (search) => {
        setFilters(prev => ({ ...prev, search }));
        setPagination(prev => ({ ...prev, page: 1 }));
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

            {loading && (
                <div className="text-center py-10 text-gray-600">
                    Loading prediction markets...
                </div>
            )}

            {errorMsg && (
                <div className="text-center py-10 text-red-500">
                    {errorMsg}
                </div>
            )}

            {!loading && !errorMsg && (
                <>
                    {markets.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No matching prediction market data
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                            {markets.map((market) => (
                                <MarketCard
                                    key={market.marketId}
                                    market={market}
                                    categoryMap={CATEGORY_MAP}
                                />
                            ))}
                        </div>
                    )}

                    {pagination.totalCount > 0 && (
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-3 py-1 mr-2 border rounded disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-gray-700">
                                Page {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1 ml-2 border rounded disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HomePage;