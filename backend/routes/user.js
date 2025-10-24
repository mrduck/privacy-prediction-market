const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // 认证中间件（验证 Token）

// 获取当前登录用户的信息（需携带有效 Token）
router.get('/', authMiddleware, (req, res) => {
    // authMiddleware 会将解析后的用户信息挂载到 req.user
    res.json({
        success: true,
        data: {
            walletAddress: req.user.walletAddress, // Token 中包含的钱包地址
        },
    });
});

module.exports = router;