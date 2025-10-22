import React from 'react';

const MarketHeader = ({ market }) => {
    const { title, category, categoryName,voteEndTime,imageUrl} = market;
    console.log(`market header voteEndTime:${voteEndTime}`);
    console.log(`market header voteEndTime type:${typeof voteEndTime}`);
    const formatVoteEndTime = (voteEndTime) => {
        const endTimeNum = Number(voteEndTime);
        if (!isNaN(endTimeNum) && endTimeNum > 0) {
            return new Date(endTimeNum * 1000).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return 'Unknow';
        }
    };
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            {/* 封面图 + 标题 */}
            <div className="flex items-center gap-4">
                <img
                    src={imageUrl || "https://picsum.photos/200/200"} // 优先用链上的imageUrl，为空时用默认占位图
                    alt={title || "Market Cover"} // 用市场标题作为alt文本，更符合语义
                    className="w-20 h-20 rounded-lg object-cover"
                />
                <h1 className="text-3xl font-bold text-white">{title}</h1>
            </div>

            {/* 基础信息标签 */}
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                <span
                    className={`px-4 py-2 rounded-full text-sm ${
                        category === 1 ? "bg-blue-600/20 text-blue-400" :  // Politics
                            category === 2 ? "bg-green-600/20 text-green-400" : // Sports
                                category === 3 ? "bg-purple-600/20 text-purple-400" : // Tech
                                    category === 4 ? "bg-yellow-600/20 text-yellow-400" : // Economy
                                        category === 5 ? "bg-red-600/20 text-red-400" : // Entertainment
                                            "bg-gray-600/20 text-gray-400" // 未知分类
                                    }`}
                                >
                          {categoryName}
                </span>
                <span className="px-4 py-2 rounded-full text-sm bg-gray-800 text-gray-300">
          Cap: ${(market.totalVolume || 0).toLocaleString()}
        </span>
                <span className="px-4 py-2 rounded-full text-sm bg-gray-800 text-gray-300">
          Vol: ${(market.totalVolume || 0).toLocaleString()}
        </span>
                <span className="px-4 py-2 rounded-full text-sm bg-gray-800 text-gray-300">
          End Time: {formatVoteEndTime(voteEndTime)}
        </span>
            </div>
        </div>
    );
};

export default MarketHeader;