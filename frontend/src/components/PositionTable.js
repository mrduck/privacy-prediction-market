import React from 'react';

const PositionTable = ({ positions }) => {
    if (positions.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 mt-6">
                No position records available
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Position Records</h3>
            <table className="w-full text-left">
                <thead>
                <tr className="border-b border-gray-700">
                    <th className="pb-3 text-gray-400">Option</th>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="pb-3 text-gray-400">Total Bet Amount ($)</th>
                    <th className="pb-3 text-gray-400">Position Percentage</th>
                </tr>
                </thead>
                <tbody>
                {positions.map((pos, idx) => {
                    // Added: Log pos details
                    console.log("Current pos object: ", pos);
                    console.log("Does pos.amount exist: ", pos.amount);

                    // Calculate percentage (Fixed: Sum `amount` instead of `totalAmount`)
                    const totalAll = positions.reduce((sum, p) => sum + (p.amount || 0), 0);
                    const percentage = totalAll > 0 ? ((pos.amount || 0) / totalAll) * 100 : 0;

                    return (
                        <tr key={idx} className="border-b border-gray-800">
                            <td className="py-3 text-white">{pos.option}</td>
                            <td className="px-4 py-2">
                                {pos.userId
                                    ? `${pos.userId.slice(0, 6)}...${pos.userId.slice(-4)}`
                                    : 'Unknown User'}
                            </td>
                            {/* Fixed: Change totalAmount to amount */}
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