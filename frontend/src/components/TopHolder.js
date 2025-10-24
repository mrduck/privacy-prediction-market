// components/TopHolder.jsx
import React, { useEffect, useState } from 'react';
import { getTopHolders } from '../api'; // Backend API needs to be encapsulated

// components/TopHolder.jsx
const TopHolder = ({ marketId }) => {
    const [holders, setHolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0); // Added: Store total number of records

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await getTopHolders(marketId, page, limit);
                if (res.success) {
                    setHolders(res.data);
                    setTotal(res.total); // 🔴 Receive and store total records
                }
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch top bettors list:', err);
                setLoading(false);
            }
        };
        fetchData();
    }, [marketId, page, limit]);

    // Calculate total number of pages
    const totalPages = Math.ceil(total / limit);

    // Page switching logic (Added: Judge boundaries based on totalPages)
    const handlePrevPage = () => {
        if (page > 1) setPage(page - 1);
    };
    const handleNextPage = () => {
        if (page < totalPages) setPage(page + 1);
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">Top Bettors by Bet Amount</h3>
            {/* Table content (kept unchanged) */}

            {/* Pagination control area (Added: Display total pages) */}
            <div className="flex justify-center mt-4 gap-2">
                <button
                    onClick={handlePrevPage}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                >
                    Previous
                </button>
                <span className="text-white">{`Page ${page}/${totalPages} (Total ${total} records)`}</span>
                <button
                    onClick={handleNextPage}
                    disabled={page >= totalPages}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default TopHolder;