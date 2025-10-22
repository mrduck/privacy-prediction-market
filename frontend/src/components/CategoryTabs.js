import React from "react";

const CategoryTabs = ({ categories, currentCategory, onCategoryChange }) => {
    return (
        <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`px-4 py-2 rounded ${
                        currentCategory === cat.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                >
                    {cat.name}
                </button>
            ))}
        </div>
    );
};

export default CategoryTabs;