import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * 市场交易量趋势图组件
 * @param {Array} data - 格式化后的每日交易量数据
 *   格式：[{ date: "2025-10-01", "选项A": 100, "选项B": 200 }, ...]
 * @param {Array} options - 市场的选项数组（如 ["选项A", "选项B"]）
 */
const MarketChart = ({ data, options }) => {
    // 颜色映射表（为每个选项分配固定颜色，避免切换顺序导致颜色混乱）
    const OPTION_COLORS = [
        '#FF6B6B', // 红色
        '#06D6A0', // 绿色
        '#118AB2', // 蓝色
        '#FFD166', // 黄色
        '#9B5DE5', // 紫色
        '#F15BB5', // 粉色
    ];

    // 处理空数据情况
    if (!data || data.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-8 mt-6 text-center">
                <p className="text-gray-400">暂无交易数据</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">每日交易量趋势</h3>

            {/* 响应式容器，适配不同屏幕宽度 */}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    {/* 网格线 */}
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#444444" // 深色网格，适配深色主题
                        vertical={false} // 隐藏垂直网格线，减少视觉干扰
                    />

                    {/* X轴（日期） */}
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#aaaaaa' }} // 灰色文字，适配深色背景
                        tickLine={false} // 隐藏刻度线
                        axisLine={{ stroke: '#555555' }} // 轴线颜色
                    />

                    {/* Y轴（交易量） */}
                    <YAxis
                        tick={{ fontSize: 12, fill: '#aaaaaa' }}
                        tickLine={false}
                        axisLine={{ stroke: '#555555' }}
                        // 格式化Y轴数值（千位分隔）
                        tickFormatter={(value) => value >= 1000
                            ? `${(value / 1000).toFixed(1)}k`
                            : value
                        }
                    />

                    {/* 提示框 */}
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#2d2d2d', // 深色背景
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                        }}
                        labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                        itemStyle={{ color: '#ffffff' }}
                        // 格式化提示框数值（显示完整数字）
                        formatter={(value) => [`${value}`, '交易量']}
                    />

                    {/* 图例 */}
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        layout="horizontal"
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingTop: 10 }}
                        textStyle={{ color: '#aaaaaa', fontSize: 12 }}
                    />

                    {/* 为每个选项生成趋势线 */}
                    {options.map((option, index) => (
                        <Line
                            key={index}
                            type="monotone"
                            dataKey={option} // 匹配数据中的选项名称（如"选项A"）
                            stroke={OPTION_COLORS[index % OPTION_COLORS.length]} // 循环使用颜色表
                            strokeWidth={2}
                            dot={false} // 隐藏数据点，突出趋势线
                            activeDot={{ r: 6, strokeWidth: 0 }} // 鼠标悬停时显示圆点
                            connectNulls={true} // 数据为空时连接线条（避免断裂）
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MarketChart;