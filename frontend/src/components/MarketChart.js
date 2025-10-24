import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Market Trading Volume Trend Chart Component
 * @param {Array} data - Formatted daily trading volume data
 *   Format: [{ date: "2025-10-01", "Option A": 100, "Option B": 200 }, ...]
 * @param {Array} options - Market options array (e.g., ["Option A", "Option B"])
 */
const MarketChart = ({ data, options }) => {
    // Color mapping table (assign fixed colors to each option to avoid color confusion when order changes)
    const OPTION_COLORS = [
        '#FF6B6B', // Red
        '#06D6A0', // Green
        '#118AB2', // Blue
        '#FFD166', // Yellow
        '#9B5DE5', // Purple
        '#F15BB5', // Pink
    ];

    // Handle empty data scenario
    if (!data || data.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-8 mt-6 text-center">
                <p className="text-gray-400">No transaction data available</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Trading Volume Trend</h3>

            {/* Responsive container, adapts to different screen widths */}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    {/* Grid lines */}
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#444444" // Dark grid, fits dark theme
                        vertical={false} // Hide vertical grid lines to reduce visual clutter
                    />

                    {/* X-axis (Date) */}
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#aaaaaa' }} // Gray text, fits dark background
                        tickLine={false} // Hide tick lines
                        axisLine={{ stroke: '#555555' }} // Axis line color
                    />

                    {/* Y-axis (Trading Volume) */}
                    <YAxis
                        tick={{ fontSize: 12, fill: '#aaaaaa' }}
                        tickLine={false}
                        axisLine={{ stroke: '#555555' }}
                        // Format Y-axis values (with thousand separators)
                        tickFormatter={(value) => value >= 1000
                            ? `${(value / 1000).toFixed(1)}k`
                            : value
                        }
                    />

                    {/* Tooltip */}
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#2d2d2d', // Dark background
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                        }}
                        labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                        itemStyle={{ color: '#ffffff' }}
                        // Format tooltip values (show full number)
                        formatter={(value) => [`${value}`, 'Trading Volume']}
                    />

                    {/* Legend */}
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        layout="horizontal"
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingTop: 10 }}
                        textStyle={{ color: '#aaaaaa', fontSize: 12 }}
                    />

                    {/* Generate trend line for each option */}
                    {options.map((option, index) => (
                        <Line
                            key={index}
                            type="monotone"
                            dataKey={option} // Match option name in data (e.g., "Option A")
                            stroke={OPTION_COLORS[index % OPTION_COLORS.length]} // Reuse color table cyclically
                            strokeWidth={2}
                            dot={false} // Hide data points to highlight trend line
                            activeDot={{ r: 6, strokeWidth: 0 }} // Show dot when mouse hovers
                            connectNulls={true} // Connect lines when data is null (avoid breaks)
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MarketChart;