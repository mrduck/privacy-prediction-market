// backend/server.js
const express = require('express');
const db = require('./db');
const { ethers } = require('ethers');
// backend/server.js（新增内容）
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors'); // 引入 cors
const authMiddleware = require('./middleware/auth');
const path = require('path');
const fs = require('fs');
const JWT_SECRET = 'zama_president_key'; // 生产环境需更换为强密钥
const JWT_EXPIRES_IN = '7d'; // token 有效期 7 天

const app = express();
const PORT = 3001;

// 🔴 在这里添加 multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'market-covers');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1000000);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// 🔥 配置 CORS：允许 localhost:3000 跨域请求
app.use(cors({
  origin: 'http://localhost:3000', // 前端运行的域名+端口
  methods: ['GET', 'POST'], // 允许的 HTTP 方法
  credentials: true, // 允许携带凭证（如 cookies）
}));

app.use(express.json());

const userRouter = require('./routes/user');
app.use('/api/user', userRouter); // 所有 /api/user 的请求由 userRouter 处理

// 接口 1：添加用户（POST 请求）
app.post('/api/users', (req, res) => {
  const { walletAddress, nickname } = req.body;
  if (!walletAddress || !nickname) {
    return res.status(400).json({ error: '钱包地址和昵称不能为空' });
  }

  db.user.add(walletAddress, nickname, (err, userId) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, userId });
  });
});

// 接口 2：查询用户（GET 请求）
app.get('/api/users/:walletAddress', (req, res) => {
  const walletAddress = req.params.walletAddress;
  db.user.getByWallet(walletAddress, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, user });
  });
});

app.get('/api/get-nonce', (req, res) => {
  const { walletAddress } = req.query;

  // 参数校验失败：返回 success: false + 错误信息
  if (!walletAddress) {
    return res.json({
      success: false,
      error: '钱包地址不能为空'
    });
  }

  // 生成并存储 nonce
  db.nonce.create(walletAddress, (err, data) => {
    // 数据库/业务错误：返回 success: false + 错误信息
    if (err) {
      return res.json({
        success: false,
        error: '生成 nonce 失败'
      });
    }

    // 成功响应：按照前端预期格式返回（success: true + data 包裹）
    res.json({
      success: true,
      data: {
        nonce: data.nonce,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt
      }
    });
  });
});

// 接口 4：验证签名并生成 token（POST）
app.post('/api/verify-signature', async (req, res) => {
  const { address, signature, nonce, chainId } = req.body;
  console.log('------------------- 签名验证参数 -------------------');
  console.log('接收的address:', address);
  console.log('接收的signature:', signature);
  console.log('接收的nonce:', nonce);
  console.log('接收的chainId:', chainId);

  // 1. 参数校验（失败：统一返回 success: false + error）
  if (!address || !signature || !nonce || !chainId) {
    return res.json({
      success: false,
      error: '参数不完整（address/signature/nonce/chainId）'
    });
  }

  try {
    // 2. 查询有效的nonce
    db.nonce.getValid(address, nonce, async (err, nonceRecord) => {
      // 数据库查询失败
      if (err) {
        console.error('查询nonce失败:', err);
        return res.json({
          success: false,
          error: '查询nonce失败'
        });
      }

      // nonce无效（不存在/已过期/已使用）
      if (!nonceRecord) {
        console.error('无效的nonce：不存在/已使用/已过期');
        return res.json({
          success: false,
          error: '无效的nonce（可能已过期或已使用）'
        });
      }

      // 3. 拼装签名消息
      const message = [
        `ZamaPredict wants you to sign in with your Ethereum account:`,
        address,
        '',
        `Welcome to ZamaPredict! Sign to connect.`,
        '',
        `Version: 1`,
        `Chain ID: ${chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date(nonceRecord.createdAt).toISOString()}`,
        `Expiration Time: ${new Date(nonceRecord.expiresAt).toISOString()}`
      ].join('\n');

      console.log('\n------------------- 后端拼装的签名消息 -------------------');
      console.log(message);
      console.log('--------------------------------------------------------\n');

      // 4. 验证签名
      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        console.log('签名验证得到的地址:', recoveredAddress);
        console.log('原始地址（小写）:', address.toLowerCase());
        console.log('验证地址是否匹配:', recoveredAddress.toLowerCase() === address.toLowerCase());

        // 签名地址不匹配
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          console.error('签名验证失败：地址不匹配');
          return res.json({
            success: false,
            error: '签名验证失败（地址不匹配）'
          });
        }

        // 5. 标记nonce为已使用
        db.nonce.markAsUsed(nonceRecord.id, (err) => {
          // 标记nonce失败
          if (err) {
            console.error('标记nonce失败:', err);
            return res.json({
              success: false,
              error: '标记nonce失败'
            });
          }

          db.user.getByWallet(address, (userErr, existingUser) => {
            if (userErr) {
              console.error('查询用户失败:', userErr);
              return res.json({ success: false, error: '查询用户失败' });
            }

            // 5.1 若用户不存在，创建新用户
            if (!existingUser) {
              const nickname = `user_${address.slice(0, 6)}`; // 生成默认昵称
              db.user.add(address, nickname, (addErr, newUser) => {
                if (addErr) {
                  console.error('创建用户失败:', addErr);
                  return res.json({ success: false, error: '创建用户失败' });
                }
                // 创建成功后生成Token
                const token = jwt.sign({ walletAddress: address }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
                console.log('用户创建成功，生成Token:', token);
                res.json({
                  success: true,
                  data: {  // 关键：将结果包裹在 data 中
                    token,
                    user: { walletAddress: address }
                  }
                });
              });
            }else {
              const token = jwt.sign({ walletAddress: address }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
              console.log('用户创建成功，生成Token:', token);
              res.json({
                success: true,
                data: {  // 关键：将结果包裹在 data 中
                  token,
                  user: { walletAddress: address }
                }
              });
            }
          });
        });

      } catch (verifyErr) {
        // 签名验证过程报错（格式错误等）
        console.error('签名验证过程报错:', verifyErr);
        return res.json({
          success: false,
          error: '签名验证失败（格式错误或无效签名）'
        });
      }
    });
  } catch (error) {
    // 整体流程报错
    console.error('整体流程报错:', error);
    res.json({
      success: false,
      error: '验证签名失败'
    });
  }
});

// 1. 先添加 JWT 验证中间件（确保只有登录用户能创建市场）
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ error: '未登录' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'token无效' });
    req.user = user; // 将用户信息（walletAddress）挂载到req
    next();
  });
};

app.post('/api/create-market', authenticateToken, upload.single('cover'), (req, res) => {
  const { title, description, category, endTime, options } = req.body;
  const creatorAddress = req.user.walletAddress; // 从token中获取创建者地址

  // 验证必填字段
  if (!title || !category || !endTime || options.length < 2) {
    return res.status(400).json({ error: '必填字段缺失（标题/分类/结束时间/至少2个选项）' });
  }

  db.market.checkTitle(title, (err, exists) => {
    if (err) {
      console.error('查询标题重复失败：', err);
      return res.status(500).json({error: '服务器错误'});
    }

    // 若标题已存在，直接返回错误
    if (exists) {
      return res.status(400).json({error: '该市场标题已存在，请更换标题'});
    }

    // 处理封面 URL：上传成功则生成访问路径，否则为 null
    let coverUrl = null;
    if (req.file) {
      coverUrl = `/uploads/market-covers/${req.file.filename}`; // 前端可访问的相对路径
    }

    // 调用db方法创建市场
    db.market.create({
      title,
      description,
      creatorAddress,
      category,
      endTime, // 传递结束时间
      options,
      coverUrl // 新增封面地址字段
    }, (err, marketId) => {
      if (err) return res.status(500).json({ error: '创建市场失败' });
      res.json({ success: true, data:{marketId:marketId} });
    });
  });
});

app.get('/api/markets', (req, res) => {
  // 从查询参数获取分页信息（默认第1页，每页10条）
  const { page = 1, limit = 10 } = req.query;

  // 先查询总条数，再查询当前页数据
  db.market.getTotalCount((countErr, totalCount) => {
    if (countErr) {
      return res.status(500).json({ error: '查询市场总数失败' });
    }

    // 查询当前页数据
    db.market.getList(page, limit, (err, markets) => {
      if (err) {
        return res.status(500).json({ error: '查询市场列表失败' });
      }

      // 计算总页数
      const totalPages = Math.ceil(totalCount / limit);

      // 返回分页数据
      res.json({
        success: true,
        data: {
          markets, // 当前页市场列表
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalCount, // 总条数
            totalPages // 总页数
          }
        }
      });
    });
  });
});

userRouter.get('/', authMiddleware, (req, res) => {
  // authMiddleware 会将用户信息挂载到 req.user
  res.json({
    success: true,
    data: {
      walletAddress: req.user.walletAddress, // 假设用户表存储了钱包地址
    },
  });
});

app.get('/api/market/:id/positions', (req, res) => {
  const { id: marketId } = req.params; // 从路由参数取市场ID
  const { userId } = req.query; // 从查询参数取用户钱包地址（如 ?userId=0x...）

  // 参数校验
  if (!marketId || !userId) {
    return res.status(400).json({ error: '缺少参数：marketId 或 userId' });
  }

  // 调用 db.js 的 getUserPositions 方法
  db.marketDetail.getUserPositions(marketId, userId, (err, positions) => {
    if (err) {
      console.error('获取持仓失败:', err);
      return res.status(500).json({ error: '获取持仓数据失败' });
    }
    // 成功返回持仓数据
    res.json({
      success: true,
      data: positions // 格式：[{ optionLabel: "选项1", totalAmount: 100 }, ...]
    });
  });
});

// 新增：用户下注接口（POST方法，提交投注数据）
app.post('/api/market/bet', (req, res) => {
  // 从请求体中获取投注数据
  const { marketId, optionId, userId, betAmount } = req.body;

  console.log(`投注参数:${marketId}|${optionId}|${betAmount}|${userId}`);
  // 1. 参数校验（确保必要字段存在）
  if (!marketId || !optionId || !userId || !betAmount) {
    return res.status(400).json({
      error: '缺少参数：marketId、optionId、userId、betAmount 为必填项'
    });
  }

  // 校验投注金额是否为正数
  if (parseFloat(betAmount) <= 0) {
    return res.status(400).json({ error: '投注金额必须大于0' });
  }

  // 2. 调用 db.js 的 placeBet 方法处理下注逻辑
  db.marketDetail.placeBet(
      { marketId, optionId, userId, betAmount },
      (err, result) => {
        if (err) {
          // 处理具体错误（如余额不足）
          const errorMsg = err.message === '余额不足'
              ? '投注失败：余额不足，请先充值'
              : '服务器处理失败，请稍后重试';
          console.error('下注失败:', err);
          return res.status(500).json({ error: errorMsg });
        }

        // 3. 成功响应（返回投注ID）
        res.json({
          success: true,
          message: '投注成功',
          data: { betId: result.betId }
        });
      }
  );
});

// 新增1：获取市场详情（含选项、概率、市值）
app.get('/api/market/:id/detail', (req, res) => {
  const { id: marketId } = req.params; // 从路由参数取市场ID
  console.log(`market detail id: ${marketId}`);
  // 参数校验
  if (!marketId) {
    return res.status(400).json({ error: '缺少参数：marketId' });
  }

  // 调用 db.js 的 marketDetail.getById 方法
  db.marketDetail.getById(marketId, (err, market) => {
    if (err) {
      console.error('获取市场详情失败:', err);
      return res.status(500).json({ error: '获取市场详情失败' });
    }
    if (!market) {
      return res.status(404).json({ error: '市场不存在' });
    }
    // 成功返回市场详情（含选项、概率、市值）
    res.json({
      success: true,
      data: market
    });
  });
});

// 新增2：获取市场每日交易量（用于K线图）
app.get('/api/market/:id/daily-volume', (req, res) => {
  const { id: marketId } = req.params; // 从路由参数取市场ID

  // 参数校验
  if (!marketId) {
    return res.status(400).json({ error: '缺少参数：marketId' });
  }

  // 调用 db.js 的 marketDetail.getDailyVolume 方法
  db.marketDetail.getDailyVolume(marketId, (err, volumeData) => {
    if (err) {
      console.error('获取每日交易量失败:', err);
      return res.status(500).json({ error: '获取交易量数据失败' });
    }
    // 成功返回每日交易量数据
    res.json({
      success: true,
      data: volumeData
    });
  });
});

app.get('/api/user/me', authMiddleware, (req, res) => {
  const walletAddress = req.user.walletAddress; // authMiddleware 已将用户信息挂载到 req.user
  console.log(`get user info :${walletAddress}`);
  // 调用 db.user.getByWallet 查询用户
  db.user.getByWallet(walletAddress, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, data: user });
  });
});

app.get("/api/market/:id/top-holders", (req, res) =>{
  const marketId = req.params.id;
  const page = parseInt(req.query.page) || 1; // 默认第 1 页
  const limit = parseInt(req.query.limit) || 10; // 默认每页 10 条

  db.holder.topHolder(marketId, page, limit, (err, rows) => {
    if (err) {
      return res.json({ success: false, error: err.message });
    }

    db.getTopHoldersTotal(marketId, (totalErr, total) => {
      if (totalErr) {
        console.error('获取总条数失败:', totalErr);
      }
    // 返回分页数据 + 分页元信息（便于前端展示）
      res.json({
          success: true,
          data: rows,
          page,
          limit,
          total: total || 0 /* 可选：查询总条数，需额外 SQL */
        });
    });
  });
})


app.listen(PORT, () => {
  console.log(`🚀 后端服务启动成功：http://localhost:${PORT}`);
});
