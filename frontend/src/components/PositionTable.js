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
                    // 新增：打印 pos 详细信息
                    console.log("当前pos对象：", pos);
                    console.log("pos.amount是否存在：", pos.amount);

                    // 计算占比（修复：累加 `amount` 而非 `totalAmount`）
                    const totalAll = positions.reduce((sum, p) => sum + (p.amount || 0), 0);
                    const percentage = totalAll > 0 ? ((pos.amount || 0) / totalAll) * 100 : 0;

                    return (
                        <tr key={idx} className="border-b border-gray-800">
                            <td className="py-3 text-white">{pos.option}</td>
                            <td className="px-4 py-2">
                                {pos.userId
                                    ? `${pos.userId.slice(0, 6)}...${pos.userId.slice(-4)}`
                                    : '未知用户'}
                            </td>
                            {/* 修复：将 totalAmount 改为 amount */}
                            <td className="py-3 text-white">${(pos.amount || 0).toFixed(2)}</td>
                            <td className="py-3">
                                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500"
                                        style={{width: `${percentage.toFixed(1)}%`}}
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