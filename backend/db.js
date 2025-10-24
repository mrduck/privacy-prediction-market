const sqlite3 = require('sqlite3').verbose();

// 连接数据库（文件不存在则自动创建）
const db = new sqlite3.Database('user_data.db');

// ====================== 1. 创建数据表（含新增和调整） ======================

// 🔹 用户表：存储钱包地址、昵称等
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    walletAddress TEXT UNIQUE,  -- 钱包地址（唯一约束）
    nickname TEXT,             -- 用户昵称
    registrationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 注册时间（默认当前时间）
  );
`, (err) => {
  if (err) console.error('创建 users 表失败:', err.message);
  else console.log('✅ users 表初始化成功');
});

// 🔹 用户余额表：存储USDT等资产余额
db.run(`
  CREATE TABLE IF NOT EXISTS user_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,        -- 关联 users.walletAddress
    asset TEXT NOT NULL DEFAULT 'USDT', -- 资产类型（默认USDT）
    balance DECIMAL(10, 2) DEFAULT 0,   -- 余额（精确到2位小数）
    FOREIGN KEY (userId) REFERENCES users(walletAddress) ON DELETE CASCADE,
    UNIQUE(userId, asset)  -- 同一用户同一资产只存1条记录
  );
`, (err) => {
  if (err) console.error('创建 user_balances 表失败:', err.message);
  else console.log('✅ user_balances 表初始化成功');
});

// 🔹 充值记录表：记录用户充值明细（核心新增表）
db.run(`
  CREATE TABLE IF NOT EXISTS recharges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,        -- 关联用户钱包地址
    amount DECIMAL(10, 2) NOT NULL, -- 充值金额
    asset TEXT NOT NULL DEFAULT 'USDT', -- 充值资产（默认USDT）
    txHash TEXT UNIQUE,          -- 区块链交易哈希（唯一，防重复充值）
    status TEXT NOT NULL DEFAULT 'pending', -- 状态：pending/completed/failed
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 充值发起时间
    completedAt TIMESTAMP,       -- 充值完成时间（成功时更新）
    FOREIGN KEY (userId) REFERENCES users(walletAddress) ON DELETE CASCADE
  );
`, (err) => {
  if (err) console.error('创建 recharges 表失败:', err.message);
  else console.log('✅ recharges 表初始化成功（充值记录）');
});

// 🔹 Nonce 表：存储登录用随机数（防重放攻击）
db.run(`
  CREATE TABLE IF NOT EXISTS nonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    walletAddress TEXT NOT NULL,  -- 关联用户钱包地址
    nonce TEXT NOT NULL,          -- 随机字符串
    createdAt INTEGER NOT NULL,   -- 创建时间（毫秒时间戳）
    expiresAt INTEGER NOT NULL,   -- 过期时间（毫秒时间戳，默认15分钟）
    used INTEGER DEFAULT 0        -- 是否已使用（0=未用，1=已用）
  );
`, (err) => {
  if (err) console.error('创建 nonces 表失败:', err.message);
  else console.log('✅ nonces 表初始化成功');
});

// 🔹 预测市场主表：存储市场标题、分类等（调整 volume 为小数类型）
db.run(`
  CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,          -- 市场标题
    description TEXT,             -- 市场描述
    creatorAddress TEXT NOT NULL, -- 创建者钱包地址（关联 users）
    category TEXT NOT NULL,       -- 分类（如 Politics/Sports/Tech）
    endTime TIMESTAMP NOT NULL,   -- 预测结束时间
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    status TEXT DEFAULT 'active',  -- 状态（active/ended/settled）
    volume DECIMAL(10, 2) DEFAULT 0,  -- 总交易量（小数类型，支持两位小数）
    coverUrl TEXT  -- 新增：封面图片URL（TEXT类型，允许为NULL）
  );
`, (err) => {
  if (err) {
    // 表已存在 → 尝试通过 ALTER TABLE 添加 coverUrl 字段
    db.run(`
      ALTER TABLE markets
      ADD COLUMN coverUrl TEXT
    `, (alterErr) => {
      if (alterErr) {
        // 字段已存在或添加失败（打印提示，不中断流程）
        console.log('⚠️ markets 表已存在 coverUrl 字段，或添加失败：', alterErr.message);
      } else {
        console.log('✅ markets 表成功添加 coverUrl 字段');
      }
    });
  } else {
    // 表不存在 → 已创建含 coverUrl 的新表
    console.log('✅ markets 表初始化成功（含 coverUrl 字段）');
  }
});

// 🔹 市场选项表：存储每个市场的选项（与 markets 表关联）
db.run(`
  CREATE TABLE IF NOT EXISTS market_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketId INTEGER NOT NULL,    -- 关联 markets 表的 id
    label TEXT NOT NULL,          -- 选项标签（如“上涨”“下跌”）
    percent DECIMAL(5, 2) DEFAULT 0.00, -- 选项比例（默认0）
    FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE
  );
`, (err) => {
  if (err) console.error('创建 market_options 表失败:', err.message);
  else console.log('✅ market_options 表初始化成功');
});

// 🔹 投注表：存储用户投注记录（用于统计市值、持仓等）
db.run(`
  CREATE TABLE IF NOT EXISTS market_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketId INTEGER NOT NULL,        -- 关联的市场ID
    optionId INTEGER NOT NULL,        -- 关联的选项ID（来自 market_options）
    userId TEXT NOT NULL,             -- 投注用户的钱包地址
    betAmount DECIMAL(10, 2) NOT NULL,-- 投注金额（支持两位小数）
    betTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 投注时间
    -- 外键约束：市场/选项删除时，关联投注也删除
    FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE,
    FOREIGN KEY (optionId) REFERENCES market_options(id) ON DELETE CASCADE
  );
`, (err) => {
  if (err) console.error('创建 market_bets 表失败:', err.message);
  else console.log('✅ market_bets 表初始化成功');
});

// 🔹 每日交易量统计表：按市场+选项+日期统计当日数据
db.run(`
  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketId INTEGER NOT NULL,        -- 关联市场ID
    optionId INTEGER NOT NULL,        -- 关联选项ID
    statDate DATE NOT NULL,           -- 统计日期（格式：YYYY-MM-DD）
    dailyVolume DECIMAL(10, 2) DEFAULT 0, -- 当日该选项的交易量
    -- 联合唯一约束：同一市场+选项+日期只存1条记录
    UNIQUE(marketId, optionId, statDate),
    -- 外键关联：市场/选项删除时，统计数据也删除
    FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE,
    FOREIGN KEY (optionId) REFERENCES market_options(id) ON DELETE CASCADE
  );
`, (err) => {
  if (err) console.error('创建 daily_stats 表失败:', err.message);
  else console.log('✅ daily_stats 表初始化成功（用于每日交易量统计）');
});


// ====================== 2. 用户相关操作 ======================

// 添加用户
function addUser(walletAddress, nickname, callback) {
  const sql = 'INSERT INTO users (walletAddress, nickname) VALUES (?, ?)';
  db.run(sql, [walletAddress, nickname], function (err) {
    if (err) {
      console.error('添加用户失败:', err.message);
      callback(err, null);
    } else {
      console.log(`✅ 用户 ${walletAddress} 添加成功，ID: ${this.lastID}`);
      callback(null, this.lastID);
    }
  });
}

// 通过钱包地址查询用户
function getUserByWallet(walletAddress, callback) {
  const sql = 'SELECT * FROM users WHERE walletAddress = ?';
  db.get(sql, [walletAddress], (err, row) => {
    if (err) {
      console.error('查询用户失败:', err.message);
      callback(err, null);
    } else {
      console.log(`query db users :${row}`);
      callback(null, row);
    }
  });
}


// ====================== 3. Nonce 相关操作（登录防重放） ======================

// 生成并存储 Nonce
function createNonce(walletAddress, callback) {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const createdAt = Date.now();
  const expiresAt = createdAt + 15 * 60 * 1000; // 15分钟后过期

  // 先清理该地址已过期的 Nonce
  db.run(`DELETE FROM nonces WHERE walletAddress = ? AND expiresAt < ?`, [walletAddress, Date.now()], (err) => {
    if (err) return callback(err, null);

    // 插入新 Nonce
    const sql = `INSERT INTO nonces (walletAddress, nonce, createdAt, expiresAt) VALUES (?, ?, ?, ?)`;
    db.run(sql, [walletAddress, nonce, createdAt, expiresAt], function (err) {
      if (err) {
        console.error('存储 Nonce 失败:', err.message);
        return callback(err, null);
      }
      callback(null, { nonce, createdAt, expiresAt });
    });
  });
}

// 查询有效的 Nonce（未使用、未过期）
function getValidNonce(walletAddress, nonce, callback) {
  const now = Date.now();
  const sql = `
    SELECT * FROM nonces 
    WHERE walletAddress = ? AND nonce = ? AND used = 0 AND expiresAt > ?
  `;
  db.get(sql, [walletAddress, nonce, now], (err, row) => {
    if (err) {
      console.error('查询 Nonce 失败:', err.message);
      return callback(err, null);
    }
    callback(null, row);
  });
}

// 标记 Nonce 为已使用
function markNonceAsUsed(nonceId, callback) {
  const sql = `UPDATE nonces SET used = 1 WHERE id = ?`;
  db.run(sql, [nonceId], function (err) {
    if (err) {
      console.error('标记 Nonce 失败:', err.message);
      return callback(err);
    }
    callback(null);
  });
}


// ====================== 4. 预测市场相关操作（列表+基础功能） ======================

// 创建预测市场（含选项）
function createMarket(marketData, callback) {
  const { title, description, creatorAddress, category, endTime, options,coverUrl } = marketData;
  console.log(`create market param:${title}|${description}|${creatorAddress}|${category}|${endTime}|${options}|${coverUrl}`);
  // 1. 先插入 markets 表
  const marketSql = `
    INSERT INTO markets (title, description, creatorAddress, category, endTime,coverUrl)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.run(marketSql, [title, description, creatorAddress, category, endTime,coverUrl], function (err) {
    if (err) {
      console.error('创建市场失败:', err.message);
      return callback(err, null);
    }
    const marketId = this.lastID; // 刚创建的市场ID

    // 2. 再批量插入 market_options 表
    const optionSql = `INSERT INTO market_options (marketId, label, percent) VALUES (?, ?, ?)`;
    let parsedOptions;
    try {
      // 把 JSON 字符串解析成数组（假设 options 是如 "[\"是\",\"否\"]" 的格式）
      parsedOptions = JSON.parse(options);
    } catch (err) {
      console.error('解析 options 失败：', err);
      parsedOptions = []; // 解析失败时设为空数组，避免后续报错
    }

    // 现在 parsedOptions 是数组，可安全调用 map
    const optionValues = parsedOptions.map(option => [marketId, option, 0]);

    db.serialize(() => {
      const stmt = db.prepare(optionSql);
      optionValues.forEach(values => stmt.run(values));
      stmt.finalize((err) => {
        if (err) return callback(err, null);
        callback(null, marketId); // 返回市场 ID
      });
    });
  });
}

// 分页查询市场列表（含选项、市值）
function getMarkets(page = 1, limit = 10, callback) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const sql = `
    SELECT 
      m.*,
      -- 拼接选项：格式为 "label1:percent1|label2:percent2"
      GROUP_CONCAT(o.label || ':' || o.percent, '|') AS optionsStr,
      -- 计算市值（该市场总投注量）
      COALESCE(SUM(b.betAmount), 0) AS marketCap 
    FROM markets m
    LEFT JOIN market_options o ON m.id = o.marketId
    LEFT JOIN market_bets b ON m.id = b.marketId
    WHERE m.status = 'active'
    GROUP BY m.id
    ORDER BY m.createdAt DESC
    LIMIT ? OFFSET ?
  `;
  db.all(sql, [limitNum, offset], (err, markets) => {
    if (err) {
      console.error('查询市场列表失败:', err.message);
      return callback(err, null);
    }
    callback(null, markets);
  });
}

// 查询市场总条数（用于分页计算）
function getMarketsTotalCount(callback) {
  const sql = `SELECT COUNT(*) as total FROM markets WHERE status = 'active'`;
  db.get(sql, (err, result) => {
    if (err) {
      console.error('查询市场总条数失败:', err.message);
      return callback(err, null);
    }
    callback(null, result ? result.total : 0);
  });
}

function checkMarketTitleExists(title,callback){
  // 注意：使用 LOWER() 可实现“大小写不敏感”的校验（如 "Title" 和 "title" 视为重复）
  const sql = `
    SELECT COUNT(*) as count 
    FROM markets 
    WHERE LOWER(title) = LOWER(?)
  `;
  db.get(sql, [title], (err, row) => {
    if (err) return callback(err);
    // 若 count > 0，说明标题已存在
    callback(null, row.count > 0);
  });
}


// ====================== 5. 市场详情相关操作（支撑详情页） ======================

const marketDetail = {
  // 获取单个市场的完整信息（基础信息+选项+概率+市值）
  getById: (marketId, callback) => {
    const sql = `
      -- 主查询：市场基础信息 + 总市值
      SELECT 
        m.*,
        COALESCE(SUM(b.betAmount), 0) AS marketCap  -- 市值=该市场总投注量
      FROM markets m
      LEFT JOIN market_bets b ON m.id = b.marketId
      WHERE m.id = ?
      GROUP BY m.id;
    `;
    db.get(sql, [marketId], (err, market) => {
      if (err) return callback(err, null);
      if (!market) return callback(null, null); // 市场不存在

      // 子查询：该市场的所有选项 + 每个选项的总投注量 + 概率
      const optionsSql = `
        SELECT 
          o.id,
          o.label,
          o.percent,
          COALESCE(SUM(b.betAmount), 0) AS optionTotal  -- 选项总投注量
        FROM market_options o
        LEFT JOIN market_bets b ON o.id = b.optionId
        WHERE o.marketId = ?
        GROUP BY o.id;
      `;
      db.all(optionsSql, [marketId], (optErr, options) => {
        if (optErr) return callback(optErr, null);

        // 计算每个选项的概率（选项总投注 / 市场总投注 * 100）
        const total = market.marketCap;
        const optionsWithChance = options.map(opt => ({
          ...opt,
          chance: total > 0 ? ((opt.optionTotal / total) * 100).toFixed(2) : 0
        }));

        callback(null, {
          ...market,
          options: optionsWithChance
        });
      });
    });
  },

  // 获取市场的每日交易量（按选项+日期）
  getDailyVolume: (marketId, callback) => {
    const sql = `
      SELECT 
        s.statDate,
        o.label AS optionLabel,
        s.dailyVolume
      FROM daily_stats s
      JOIN market_options o ON s.optionId = o.id
      WHERE s.marketId = ?
      ORDER BY s.statDate DESC, o.id;
    `;
    db.all(sql, [marketId], (err, stats) => {
      if (err) return callback(err, null);
      callback(null, stats);
    });
  },

  // 获取用户在该市场的持仓（对每个选项的总投注）
  getUserPositions: (marketId, walletAddress, callback) => {
    const sql = `
      SELECT 
        o.label AS optionLabel,
        b.userId,
        COALESCE(SUM(b.betAmount), 0) AS totalAmount  -- 用户对该选项的总投注
      FROM market_options o
      LEFT JOIN market_bets b ON o.id = b.optionId
        AND LOWER(b.userId) = LOWER(?)  -- 关联用户的投注
      WHERE o.marketId = ?
      GROUP BY o.id;
    `;
    db.all(sql, [walletAddress, marketId], (err, positions) => {
      if (err) return callback(err, null);
      callback(null, positions);
    });
  },

  // 用户投注（核心：写入投注记录 + 更新每日统计 + 更新市场总交易量）
  // 用户投注（含余额扣除）
  placeBet: (betData, callback) => {
    const { marketId, optionId, userId, betAmount } = betData;
    const today = new Date().toISOString().split('T')[0];

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return callback(err);

      // 1. 扣除用户余额
      const deductSql = `
        UPDATE user_balances 
        SET balance = balance - ? 
        WHERE LOWER(userId) = LOWER(?) AND asset = 'USDT' AND balance >= ?;
      `;
      db.run(deductSql, [betAmount, userId, betAmount], function (deductErr) {
        if (deductErr) {
          db.run('ROLLBACK', () => callback(deductErr));
          return;
        }
        if (this.changes === 0) {
          db.run('ROLLBACK', () => callback(new Error('余额不足')));
          return;
        }

        // 2. 写入投注记录
        const betSql = `
          INSERT INTO market_bets (marketId, optionId, userId, betAmount)
          VALUES (?, ?, ?, ?);
        `;
        db.run(betSql, [marketId, optionId, userId, betAmount], function (betErr) {
          if (betErr) {
            db.run('ROLLBACK', () => callback(betErr));
            return;
          }

          // 3. 更新市场总交易量
          const updateMarketSql = `
            UPDATE markets 
            SET volume = volume + ? 
            WHERE id = ?;
          `;
          db.run(updateMarketSql, [betAmount, marketId], (marketErr) => {
            if (marketErr) {
              db.run('ROLLBACK', () => callback(marketErr));
              return;
            }

            // 4. 更新每日统计
            const upsertStatsSql = `
              INSERT INTO daily_stats (marketId, optionId, statDate, dailyVolume)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(marketId, optionId, statDate) 
              DO UPDATE SET dailyVolume = dailyVolume + ?;
            `;
            db.run(
                upsertStatsSql,
                [marketId, optionId, today, betAmount, betAmount],
                (statsErr) => {
                  if (statsErr) {
                    db.run('ROLLBACK', () => callback(statsErr));
                    return;
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) callback(commitErr);
                    else callback(null, { betId: this.lastID });
                  });
                }
            );
          });
        });
      });
    });
  }
};

function create(rechargeData, callback) {
  const { userId, amount, asset = 'USDT', txHash } = rechargeData;
  const sql = `
      INSERT INTO recharges (userId, amount, asset, txHash, status)
      VALUES (?, ?, ?, ?, 'pending')
    `;
  db.run(sql, [userId, amount, asset, txHash], function (err) {
    if (err) {
      // 若txHash重复（唯一约束冲突），返回错误
      if (err.message.includes('UNIQUE constraint failed: recharges.txHash')) {
        return callback(new Error('该交易已记录，请勿重复提交'), null);
      }
      console.error('创建充值记录失败:', err.message);
      return callback(err, null);
    }
    console.log(`✅ 充值记录创建成功，ID: ${this.lastID}`);
    callback(null, { rechargeId: this.lastID, status: 'pending' });
  });
}

function updateRechargeStatus(rechargeId, status, callback){
  // 成功时记录完成时间
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  const sql = `
      UPDATE recharges 
      SET status = ?, completedAt = ? 
      WHERE id = ?
    `;
  db.run(sql, [status, completedAt, rechargeId], function (err) {
    if (err) {
      console.error('更新充值状态失败:', err.message);
      return callback(err);
    }
    if (this.changes === 0) {
      return callback(new Error('充值记录不存在'));
    }

    // 若充值成功，增加用户余额
    if (status === 'completed') {
      const getRechargeSql = `SELECT userId, amount, asset FROM recharges WHERE id = ?`;
      db.get(getRechargeSql, [rechargeId], (getErr, recharge) => {
        if (getErr) return callback(getErr);
        // 累加余额（无记录则新增）
        const updateBalanceSql = `
            INSERT INTO user_balances (userId, asset, balance)
            VALUES (?, ?, ?)
            ON CONFLICT(userId, asset) 
            DO UPDATE SET balance = user_balances.balance + ?;
          `;
        db.run(
            updateBalanceSql,
            [recharge.userId, recharge.asset, recharge.amount, recharge.amount],
            (balanceErr) => {
              if (balanceErr) return callback(balanceErr);
              callback(null, { success: true, status });
            }
        );
      });
    } else {
      callback(null, { success: true, status });
    }
  });
}

function rechargeHistory(userId, callback){
  const sql = `
      SELECT * FROM recharges 
      WHERE LOWER(userId) = LOWER(?) 
      ORDER BY createdAt DESC
    `;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error('查询充值历史失败:', err.message);
      return callback(err, null);
    }
    callback(null, rows);
  });
}

function depositUSDT(walletAddress, amount, callback) {
  const sql = `
    INSERT INTO user_balances (userId, asset, balance) 
    VALUES (?, 'USDT', ?)
    ON CONFLICT(userId, asset) 
    DO UPDATE SET balance = user_balances.balance + ?;
  `;
  db.run(sql, [walletAddress, amount, amount], (err) => {
    if (err) callback(err);
    else callback(null, { success: true, amount });
  });
}

function getTopHolders (marketId, page = 1, limit = 10, callback) {
  const offset = (page - 1) * limit; // 计算偏移量
  const sql = `
    SELECT walletAddress, amount, option 
    FROM market_bets 
    WHERE marketId = ? 
    ORDER BY amount DESC 
    LIMIT ? OFFSET ?
  `;
  db.all(sql, [marketId, limit, offset], (err, rows) => {
    callback(err, rows); // 通过回调返回结果/错误
  });
}

function getTopHoldersTotal(marketId,callback) {
  const sql = 'SELECT COUNT(*) as total FROM bets WHERE marketId = ?';
  db.get(sql, [marketId], (err, row) => {
    callback(err, row ? row.total : 0); // 若无记录，total 为 0
  });
}

// ====================== 6. 导出所有方法（按模块分组） ======================
module.exports = {
  user: {
    add: addUser,
    getByWallet: getUserByWallet
  },
  nonce: {
    create: createNonce,
    getValid: getValidNonce,
    markAsUsed: markNonceAsUsed
  },
  market: {
    create: createMarket,
    getList: getMarkets,
    getTotalCount: getMarketsTotalCount,
    checkTitle: checkMarketTitleExists
  },
  marketDetail: marketDetail,  // 新增：市场详情相关方法
  recharge: {
    addRecord: create,
    updateStatus: updateRechargeStatus,
    history: rechargeHistory,
    depositBalance: depositUSDT
  },
  holder: {
    topHolder: getTopHolders,
    topHolderTotal: getTopHoldersTotal
  }
};