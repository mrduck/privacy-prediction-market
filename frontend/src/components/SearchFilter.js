// src/components/SearchFilter.js
import React from "react";
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext'; // Import context Hook

const SearchFilter = () => {
    const navigate = useNavigate();
    // Get login status and modal control method from context
    const { isLoggedIn, setIsLoginOpen } = useAppContext();

    // Logic for clicking "Create Market"
    const handleCreateMarket = () => {
        if (isLoggedIn) {
            // Logged in → Navigate to create page
            navigate('/create-market');
        } else {
            // Not logged in → Open login modal
            setIsLoginOpen(true);
        }
    };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            {/* Search Box */}
            <div className="relative w-full md:w-1/2 mb-4 md:mb-0">
                <input
                    type="text"
                    placeholder="Search AegisPredict..."
                    className="input-dark pl-10"
                />
                <i className="fa fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>

            {/* Filter/Sort/Create Button Group */}
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