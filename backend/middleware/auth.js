// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
// 注意：JWT_SECRET 必须和 server.js 中一致！
const JWT_SECRET = 'zama_president_key';

// 认证中间件（验证 Token 有效性）
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    // 检查是否有 Authorization 头，格式是否为 "Bearer Token"
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '未登录：缺少 Token' });
    }

    // 验证 Token 有效性
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token 无效或已过期' });
        }
        // 将 Token 中的用户信息（walletAddress）挂载到 req.user
        req.user = user;
        next(); // 验证通过，继续执行后续接口逻辑
    });
};

// 关键：导出中间件（CommonJS 规范，和 require 对应）
module.exports = authMiddleware;