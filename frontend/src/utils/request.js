import axios from 'axios';
import toast from 'react-hot-toast';

// 创建 axios 实例（避免污染全局 axios）
const request = axios.create({
    baseURL: 'http://localhost:3001/api', // 后端接口基础地址
    timeout: 10000, // 超时时间
});

// 1. 请求拦截器：添加 Token 到请求头（保持你的现有逻辑）
request.interceptors.request.use(
    (config) => {
        // 🌟 核心：只有 config.needToken 不是 false 时，才携带 Token
        if (config.needToken !== false) {
            const token = localStorage.getItem('zamaToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        toast.error('请求发送失败，请检查网络');
        return Promise.reject(error);
    }
);

// 2. 响应拦截器：处理后端返回的错误（核心新增）
request.interceptors.response.use(
    (response) => {
        // 响应成功：直接返回数据（如果后端统一包装了 { success, data, error }，可在此处解构）
        return response.data;
    },
    (error) => {
        const { response } = error;

        // 情况 1：后端返回 401（Token 无效/过期/未登录）
        if (response && response.status === 401) {
            // 清除本地 Token 和登录状态
            localStorage.removeItem('zamaToken');
            // 提示用户登录过期
            toast.error('登录已过期，请重新登录');
            // 可选：跳转到登录页（如果有单独登录页）
            // window.location.href = '/login';
            // 刷新页面，让 AppContext 重新识别登录状态
            setTimeout(() => window.location.reload(), 1000);
        }

        // 情况 2：其他错误（404/500/业务错误等）：只提示错误，不清除登录态
        else if (response) {
            // 后端返回的错误信息（根据你的后端格式调整）
            const errorMsg = response.data?.error || `请求失败（${response.status}）`;
            toast.error(errorMsg);
        }

        // 情况 3：无响应（如断网）
        else {
            toast.error('网络连接失败，请检查网络');
        }

        // 将错误继续抛出，方便组件内捕获处理
        return Promise.reject(error);
    }
);

export default request;