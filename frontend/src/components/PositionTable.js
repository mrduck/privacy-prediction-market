import React from 'react';

const PositionTable = ({ positions }) => {
    if (positions.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 mt-6">
                暂无持仓记录
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">每日持仓记录</h3>
            <table className="w-full text-left">
                <thead>
                <tr className="border-b border-gray-700">
                    <th className="pb-3 text-gray-400">选项</th>
                    <th className="px-4 py-2 text-left">用户</th>
                    <th className="pb-3 text-gray-400">总投注量 ($)</th>
                    <th className="pb-3 text-gray-400">持仓占比</th>
                </tr>
                </thead>
                <tbody>
                {positions.map((pos, idx) => {
                    // 计算占比（简化：总投注量 / 所有选项总投注量）
                    const totalAll = positions.reduce((sum, p) => sum + p.totalAmount, 0);
                    const percentage = totalAll > 0 ? (pos.totalAmount / totalAll) * 100 : 0;

                    return (
                        <tr key={idx} className="border-b border-gray-800">
                            <td className="py-3 text-white">{pos.optionLabel}</td>
                            <td className="px-4 py-2">
                                {pos.userId
                                    ? `${pos.userId.slice(0, 6)}...${pos.userId.slice(-4)}`
                                    : '未知用户'}
                            </td>
                            <td className="py-3 text-white">${pos.totalAmount.toFixed(2)}</td>
                            <td className="py-3">
                                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500"
                                        style={{width: `${percentage}%`}}
                                    ></div>
                                </div>
                                <span className="text-xs text-gray-400 mt-1 inline-block">
                    {percentage.toFixed(1)}%
                  </span>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};

export default PositionTable;