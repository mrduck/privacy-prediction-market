import React from "react";
import { Link } from "react-router-dom"; // Import Link component

const MarketCard = ({ market, categoryMap }) => {
    // Null value fallback: set default empty object if market is undefined; also set default values for fields
    const {
        title = "",
        description = "",
        category = "",
        totalMarketCap = 0,
        totalVolume = 0,
        options = [], // Set default empty array for options to avoid map errors
        imageUrl = ""
    } = market || {};

    const categoryName = categoryMap[category.toString()] || "Unknown";

    return (
        <div className="bg-zama-card rounded-xl p-6 market-card-hover">
            {/* Category Tag + Trading Volume + Market Cap */}
            <div className="flex items-center mb-4">
                <span
                    className={`text-xs py-1 px-2 rounded-full ${
                        category === 1 ? "bg-blue-600/20 text-blue-400" :
                            category === 2 ? "bg-green-600/20 text-green-400" :
                                category === 3 ? "bg-purple-600/20 text-purple-400" :
                                    category === 4 ? "bg-yellow-600/20 text-yellow-400" :
                                        category === 5 ? "bg-red-600/20 text-red-400" :
                                            "bg-gray-600/20 text-gray-400"
                    }`}
                >
                    {categoryName}
                </span>
                <span className="text-xs text-gray-400">Cap: {market.totalMarketCap.toLocaleString()} USDT</span>
                <span className="text-xs text-gray-400">Vol: {market.totalVolume.toLocaleString()}</span>
            </div>

            {/* Title + Description */}
            <div className="flex items-center mb-2">
                {imageUrl && ( // Render only when imageUrl exists
                    <img
                        src={imageUrl}
                        alt={title}
                        className="w-12 h-12 rounded-md object-cover mr-3" // Control image size
                    />
                )}
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">{description}</p>

            {/* Option List: Use optional chaining ?. to prevent errors if options is undefined */}
            <div className="space-y-3 mb-4">
                {options?.map((opt, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span
                                className={`w-6 h-6 rounded-full ${
                                    idx === 0 ? "bg-green-500" : "bg-red-500"
                                } mr-2`}
                            ></span>
                            <span className="text-sm">{opt.label}</span>
                        </div>
                        <div className="text-right">
                            <span
                                className={`text-lg font-bold ${
                                    idx === 0 ? "text-green-400" : "text-red-400"
                                }`}
                            >{opt.percent}</span>
                            {/* Remove opt.type: Backend doesn't have this field, no need to render */}
                        </div>
                    </div>
                ))}
            </div>

            {/* Trade + Favorite Buttons */}
            <div className="flex items-center justify-between">
                <Link
                    to={`/market/${market.marketId}`} // Route parameter: Market ID
                    className="text-sm text-zama-primary hover:underline"
                >
                    Trade
                </Link>
                <button className="text-sm text-gray-400 hover:text-white">
                    <i className="fa fa-bookmark-o"></i>
                </button>
            </div>
        </div>
    );
};

export default MarketCard;