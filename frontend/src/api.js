// src/api.js
import request from './utils/request'; // 导入封装的 axios 实例

// 添加用户
export const addUser = async (walletAddress, nickname) => {
    try {
        const response = await request.post(`/users`, {
            walletAddress,
            nickname,
        });
        return response.data; // { success: true, userId }
    } catch (error) {
        console.error("添加用户失败:", error.response?.data?.error || error.message);
        throw error; // 抛出错误，让调用方处理
    }
};

// 查询用户
export const getUser = async () => {
    try {
        const response = await request.get(`/user/me`);
        return response; // { success: true, user }
    } catch (error) {
        console.error("查询用户失败:", error.response?.data?.error || error.message);
        if (error.response?.status === 404) {
            return { success: false, error: "用户不存在" };
        }
        throw error;
    }
};

// 新增：获取登录用的 nonce
export const getNonce = async (walletAddress) => {
    try {
        const response = await request.get(`/get-nonce`, {
            params: { walletAddress }, // 作为查询参数传递
            needToken: false
        });
        // 响应拦截器已经返回了 response.data，所以直接返回 response
        return response; // { nonce: "随机字符串", createdAt, expiresAt }
    } catch (error) {
        console.error("获取 nonce 失败:", error.response?.data?.error || error.message);
        throw error;
    }
};

// 新增：验证签名并获取 token
export const verifySignature = async (address, signature, nonce, chainId) => {
    try {
        const response = await request.post(`/verify-signature`, {
            address,
            signature,
            nonce,
            chainId
        },{needToken: false});
        // 响应拦截器已经返回了 response.data，所以直接返回 response
        return response; // { success: true, data: { token, user } }
    } catch (error) {
        console.error("验证签名失败:", error.response?.data?.error || error.message);
        throw error;
    }
};

// src/api.js（新增创建市场接口）
export const createMarket = async (marketData) => {
    try {
        console.log(marketData);
        const token = localStorage.getItem('zamaToken');
        const response = await request.post(`/create-market`, marketData, {
            headers: {
                Authorization: `Bearer ${token}` // 携带登录token
            }
        });
        return response.data; // { success: true, marketId }
    } catch (error) {
        console.error('创建市场失败:', error.response?.data?.error || error.message);
        throw error;
    }
};

// src/api.js 正确实现
export const getMarkets = async (params) => {
    try {
        // 发起请求，获取完整响应体（{ success, data }）
        const result = await request.get('/markets', {
            params: params,
            needToken: false // 市场列表通常无需登录，公开访问
        });

        // 🌟 关键：判断接口是否成功，成功则返回 result.data（包含 markets 和 pagination）
        if (result.success) {
            return result.data; // 此时返回的是 { markets: [...], pagination: {...} }
        } else {
            // 接口返回 success: false 时，抛出错误（被拦截器或调用方捕获）
            throw new Error(result.error || '获取市场列表失败');
        }
    } catch (error) {
        console.error("获取市场列表失败:", error.response?.data?.error || error.message);
        throw error;
    }
};
// 新增：获取用户在某个市场的持仓
export const getUserPositions = async (marketId, walletAddress) => {
    try {
        const response = await request.get(
            `/market/${marketId}/positions`,
            { params: { userId: walletAddress } } // 传递用户钱包地址作为查询参数
        );
        return response; // 返回持仓数据数组
    } catch (error) {
        console.error('获取持仓失败:', error.response?.data?.error || error.message);
        throw new Error('获取持仓数据失败，请稍后重试');
    }
};

// 新增：用户下注请求
export const placeBet = async (betData) => {
    try {
        const response = await request.post(
            `/market/bet`,
            betData // 请求体：{ marketId, optionId, userId, betAmount }
        );
        return response;
    } catch (error) {
        // 提取后端返回的错误信息（若有）
        const errorMsg = error.response?.data?.error || '下注失败，请稍后重试';
        console.error('下注请求失败:', errorMsg);
        throw new Error(errorMsg); // 抛给前端组件处理（如显示toast）
    }
};

// 1. 获取市场详情（含选项、概率、市值）
export const getMarketDetail = async (marketId) => {
    try {
        const response = await request.get(`/market/${marketId}/detail`);
        console.log(response);
        return response; // 返回市场详情对象
    } catch (error) {
        const errorMsg = error.response?.data?.error || '获取市场详情失败';
        console.error('市场详情请求失败:', errorMsg);
        throw new Error(errorMsg);
    }
};

// 2. 获取市场每日交易量（用于K线图）
export const getDailyVolume = async (marketId) => {
    try {
        const response = await request.get(`/market/${marketId}/daily-volume`);
        return response; // 返回交易量数组（按日期+选项分组）
    } catch (error) {
        const errorMsg = error.response?.data?.error || '获取交易量数据失败';
        console.error('交易量请求失败:', errorMsg);
        throw new Error(errorMsg);
    }
};