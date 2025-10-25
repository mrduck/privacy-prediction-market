const { createClient } = require('@libsql/client');

// Initialize Turso client with environment variables
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// ====================== 1. Create Tables (Reuse existing SQL) ======================

/**
 * Initialize database tables. Tables will be created if they don't exist.
 */
async function initTables() {
  try {
    // Users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        walletAddress TEXT UNIQUE,
        nickname TEXT,
        registrationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User Balances table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        asset TEXT NOT NULL DEFAULT 'USDT',
        balance DECIMAL(10, 2) DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(walletAddress) ON DELETE CASCADE,
        UNIQUE(userId, asset)
      );
    `);

    // Recharges table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS recharges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        asset TEXT NOT NULL DEFAULT 'USDT',
        txHash TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completedAt TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(walletAddress) ON DELETE CASCADE
      );
    `);

    // Nonces table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS nonces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        walletAddress TEXT NOT NULL,
        nonce TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        used INTEGER DEFAULT 0
      );
    `);

    // Markets table
    const marketsTableResult = await client.execute(`
      CREATE TABLE IF NOT EXISTS markets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        creatorAddress TEXT NOT NULL,
        category TEXT NOT NULL,
        endTime TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        volume DECIMAL(10, 2) DEFAULT 0,
        coverUrl TEXT
      );
    `);
    if (marketsTableResult.rowsAffected === 0) {
      // If table exists, try to add coverUrl column if missing
      try {
        await client.execute(`
          ALTER TABLE markets
          ADD COLUMN coverUrl TEXT
        `);
        console.log('✅ Successfully added coverUrl column to markets table');
      } catch (alterErr) {
        console.log('⚠️ markets table already has coverUrl column or alter failed:', alterErr.message);
      }
    } else {
      console.log('✅ markets table initialized successfully (with coverUrl column)');
    }

    // Market Options table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS market_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marketId INTEGER NOT NULL,
        label TEXT NOT NULL,
        percent DECIMAL(5, 2) DEFAULT 0.00,
        FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE
      );
    `);

    // Market Bets table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS market_bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marketId INTEGER NOT NULL,
        optionId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        betAmount DECIMAL(10, 2) NOT NULL,
        betTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE,
        FOREIGN KEY (optionId) REFERENCES market_options(id) ON DELETE CASCADE
      );
    `);

    // Daily Stats table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marketId INTEGER NOT NULL,
        optionId INTEGER NOT NULL,
        statDate DATE NOT NULL,
        dailyVolume DECIMAL(10, 2) DEFAULT 0,
        UNIQUE(marketId, optionId, statDate),
        FOREIGN KEY (marketId) REFERENCES markets(id) ON DELETE CASCADE,
        FOREIGN KEY (optionId) REFERENCES market_options(id) ON DELETE CASCADE
      );
    `);

    console.log('✅ All tables initialized successfully (Turso Serverless SQLite)');
  } catch (err) {
    console.error('❌ Failed to initialize tables:', err.message);
  }
}

// Initialize tables on module load
initTables();

// ====================== 2. User-Related Operations ======================

/**
 * Add a new user
 * @param {string} walletAddress - User's wallet address
 * @param {string} nickname - User's nickname
 * @returns {Promise<number>} User ID
 */
async function addUser(walletAddress, nickname) {
  try {
    const sql = 'INSERT INTO users (walletAddress, nickname) VALUES (?, ?)';
    const result = await client.execute({
      sql,
      args: [walletAddress, nickname]
    });
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Failed to add user:', err.message);
    throw err;
  }
}

/**
 * Get user by wallet address
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByWallet(walletAddress) {
  try {
    const sql = 'SELECT * FROM users WHERE walletAddress = ?';
    const result = await client.execute({
      sql,
      args: [walletAddress]
    });
    return result.rows[0] || null;
  } catch (err) {
    console.error('Failed to get user by wallet:', err.message);
    throw err;
  }
}

// ====================== 3. Nonce-Related Operations (Anti-Replay for Authentication) ======================

/**
 * Generate and store a nonce for a wallet address
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<{nonce: string, createdAt: number, expiresAt: number}>} Nonce data
 */
async function createNonce(walletAddress) {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const createdAt = Date.now();
  const expiresAt = createdAt + 15 * 60 * 1000; // Expires in 15 minutes

  try {
    // Clean up expired nonces for this wallet
    await client.execute({
      sql: 'DELETE FROM nonces WHERE walletAddress = ? AND expiresAt < ?',
      args: [walletAddress, Date.now()]
    });

    // Insert new nonce
    const result = await client.execute({
      sql: 'INSERT INTO nonces (walletAddress, nonce, createdAt, expiresAt) VALUES (?, ?, ?, ?)',
      args: [walletAddress, nonce, createdAt, expiresAt]
    });

    return { nonce, createdAt, expiresAt };
  } catch (err) {
    console.error('Failed to store nonce:', err.message);
    throw err;
  }
}

/**
 * Get valid nonce (not used, not expired)
 * @param {string} walletAddress - User's wallet address
 * @param {string} nonce - Nonce to verify
 * @returns {Promise<Object|null>} Nonce record or null
 */
async function getValidNonce(walletAddress, nonce) {
  try {
    const now = Date.now();
    const sql = `
      SELECT * FROM nonces 
      WHERE walletAddress = ? AND nonce = ? AND used = 0 AND expiresAt > ?
    `;
    const result = await client.execute({
      sql,
      args: [walletAddress, nonce, now]
    });
    return result.rows[0] || null;
  } catch (err) {
    console.error('Failed to get valid nonce:', err.message);
    throw err;
  }
}

/**
 * Mark nonce as used
 * @param {number} nonceId - Nonce ID
 * @returns {Promise<void>}
 */
async function markNonceAsUsed(nonceId) {
  try {
    await client.execute({
      sql: 'UPDATE nonces SET used = 1 WHERE id = ?',
      args: [nonceId]
    });
  } catch (err) {
    console.error('Failed to mark nonce as used:', err.message);
    throw err;
  }
}

// ====================== 4. Prediction Market Operations (List + Basic Functions) ======================

/**
 * Create a new prediction market with options
 * @param {Object} marketData - Market data
 * @param {string} marketData.title - Market title
 * @param {string} marketData.description - Market description
 * @param {string} marketData.creatorAddress - Creator's wallet address
 * @param {string} marketData.category - Market category
 * @param {string} marketData.endTime - Market end time
 * @param {string} marketData.options - JSON string of options array
 * @param {string} marketData.coverUrl - Cover image URL
 * @returns {Promise<number>} Market ID
 */
async function createMarket(marketData) {
  const { title, description, creatorAddress, category, endTime, options, coverUrl } = marketData;
  console.log(`create market param:${title}|${description}|${creatorAddress}|${category}|${endTime}|${options}|${coverUrl}`);

  try {
    // Insert into markets table
    const marketResult = await client.execute({
      sql: 'INSERT INTO markets (title, description, creatorAddress, category, endTime, coverUrl) VALUES (?, ?, ?, ?, ?, ?)',
      args: [title, description, creatorAddress, category, endTime, coverUrl]
    });
    const marketId = marketResult.lastInsertRowid;

    // Parse options
    let parsedOptions;
    try {
      parsedOptions = JSON.parse(options);
    } catch (err) {
      console.error('Failed to parse options:', err);
      parsedOptions = [];
    }

    // Insert options into market_options table
    const optionSql = 'INSERT INTO market_options (marketId, label, percent) VALUES (?, ?, ?)';
    const optionValues = parsedOptions.map(option => [marketId, option, 0]);

    for (const values of optionValues) {
      await client.execute({
        sql: optionSql,
        args: values
      });
    }

    return marketId;
  } catch (err) {
    console.error('Failed to create market:', err.message);
    throw err;
  }
}

/**
 * Get paginated market list with options and market cap
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Promise<Array>} Market list
 */
async function getMarkets(page = 1, limit = 10) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  try {
    const sql = `
      SELECT 
        m.*,
        GROUP_CONCAT(o.label || ':' || o.percent, '|') AS optionsStr,
        COALESCE(SUM(b.betAmount), 0) AS marketCap 
      FROM markets m
      LEFT JOIN market_options o ON m.id = o.marketId
      LEFT JOIN market_bets b ON m.id = b.marketId
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY m.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    const result = await client.execute({
      sql,
      args: [limitNum, offset]
    });
    return result.rows;
  } catch (err) {
    console.error('Failed to get market list:', err.message);
    throw err;
  }
}

/**
 * Get total count of active markets
 * @returns {Promise<number>} Total count
 */
async function getMarketsTotalCount() {
  try {
    const sql = 'SELECT COUNT(*) as total FROM markets WHERE status = \'active\'';
    const result = await client.execute({ sql });
    return result.rows[0]?.total || 0;
  } catch (err) {
    console.error('Failed to get total market count:', err.message);
    throw err;
  }
}

/**
 * Check if market title exists (case-insensitive)
 * @param {string} title - Market title
 * @returns {Promise<boolean>} True if title exists
 */
async function checkMarketTitleExists(title) {
  try {
    const sql = `
      SELECT COUNT(*) as count 
      FROM markets 
      WHERE LOWER(title) = LOWER(?)
    `;
    const result = await client.execute({
      sql,
      args: [title]
    });
    return result.rows[0]?.count > 0;
  } catch (err) {
    console.error('Failed to check market title existence:', err.message);
    throw err;
  }
}

// ====================== 5. Market Detail Operations (Support Detail Page) ======================

const marketDetail = {
  /**
   * Get full market details (basic info + options + odds + market cap)
   * @param {number} marketId - Market ID
   * @returns {Promise<Object|null>} Market details
   */
  async getById(marketId) {
    try {
      // Main query: market basic info + total market cap
      const marketSql = `
        SELECT 
          m.*,
          COALESCE(SUM(b.betAmount), 0) AS marketCap 
        FROM markets m
        LEFT JOIN market_bets b ON m.id = b.marketId
        WHERE m.id = ?
        GROUP BY m.id;
      `;
      const marketResult = await client.execute({
        sql: marketSql,
        args: [marketId]
      });
      const market = marketResult.rows[0];
      if (!market) return null;

      // Subquery: all options for the market + total bets per option + odds
      const optionsSql = `
        SELECT 
          o.id,
          o.label,
          o.percent,
          COALESCE(SUM(b.betAmount), 0) AS optionTotal 
        FROM market_options o
        LEFT JOIN market_bets b ON o.id = b.optionId
        WHERE o.marketId = ?
        GROUP BY o.id;
      `;
      const optionsResult = await client.execute({
        sql: optionsSql,
        args: [marketId]
      });
      const options = optionsResult.rows;

      // Calculate odds for each option
      const total = market.marketCap;
      const optionsWithChance = options.map(opt => ({
        ...opt,
        chance: total > 0 ? ((opt.optionTotal / total) * 100).toFixed(2) : 0
      }));

      return {
        ...market,
        options: optionsWithChance
      };
    } catch (err) {
      console.error('Failed to get market detail:', err.message);
      throw err;
    }
  },

  /**
   * Get daily trading volume by market and option
   * @param {number} marketId - Market ID
   * @returns {Promise<Array>} Daily volume data
   */
  async getDailyVolume(marketId) {
    try {
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
      const result = await client.execute({
        sql,
        args: [marketId]
      });
      return result.rows;
    } catch (err) {
      console.error('Failed to get daily volume:', err.message);
      throw err;
    }
  },

  /**
   * Get user positions in a market (total bets per option)
   * @param {number} marketId - Market ID
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<Array>} User positions
   */
  async getUserPositions(marketId, walletAddress) {
    try {
      const sql = `
        SELECT 
          o.label AS optionLabel,
          b.userId,
          COALESCE(SUM(b.betAmount), 0) AS totalAmount 
        FROM market_options o
        LEFT JOIN market_bets b ON o.id = b.optionId
          AND LOWER(b.userId) = LOWER(?) 
        WHERE o.marketId = ?
        GROUP BY o.id;
      `;
      const result = await client.execute({
        sql,
        args: [walletAddress, marketId]
      });
      return result.rows;
    } catch (err) {
      console.error('Failed to get user positions:', err.message);
      throw err;
    }
  },

  /**
   * Place a bet (deduct balance, record bet, update stats)
   * @param {Object} betData - Bet data
   * @param {number} betData.marketId - Market ID
   * @param {number} betData.optionId - Option ID
   * @param {string} betData.userId - User's wallet address
   * @param {number} betData.betAmount - Bet amount
   * @returns {Promise<{betId: number}>} Bet ID
   */
  async placeBet(betData) {
    const { marketId, optionId, userId, betAmount } = betData;
    const today = new Date().toISOString().split('T')[0];

    try {
      await client.execute('BEGIN TRANSACTION');

      // 1. Deduct user balance
      const deductResult = await client.execute({
        sql: `
          UPDATE user_balances 
          SET balance = balance - ? 
          WHERE LOWER(userId) = LOWER(?) AND asset = 'USDT' AND balance >= ?
        `,
        args: [betAmount, userId, betAmount]
      });
      if (deductResult.rowsAffected === 0) {
        await client.execute('ROLLBACK');
        throw new Error('Insufficient balance');
      }

      // 2. Record bet
      const betResult = await client.execute({
        sql: `
          INSERT INTO market_bets (marketId, optionId, userId, betAmount)
          VALUES (?, ?, ?, ?)
        `,
        args: [marketId, optionId, userId, betAmount]
      });
      const betId = betResult.lastInsertRowid;

      // 3. Update market total volume
      await client.execute({
        sql: `
          UPDATE markets 
          SET volume = volume + ? 
          WHERE id = ?
        `,
        args: [betAmount, marketId]
      });

      // 4. Update daily stats
      await client.execute({
        sql: `
          INSERT INTO daily_stats (marketId, optionId, statDate, dailyVolume)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(marketId, optionId, statDate) 
          DO UPDATE SET dailyVolume = dailyVolume + ?
        `,
        args: [marketId, optionId, today, betAmount, betAmount]
      });

      await client.execute('COMMIT');
      return { betId };
    } catch (err) {
      await client.execute('ROLLBACK');
      console.error('Failed to place bet:', err.message);
      throw err;
    }
  }
};

// ====================== 6. Recharge-Related Operations ======================

/**
 * Create a recharge record
 * @param {Object} rechargeData - Recharge data
 * @param {string} rechargeData.userId - User's wallet address
 * @param {number} rechargeData.amount - Recharge amount
 * @param {string} rechargeData.asset - Recharge asset (default: 'USDT')
 * @param {string} rechargeData.txHash - Transaction hash
 * @returns {Promise<{rechargeId: number, status: string}>} Recharge record
 */
async function createRecharge(rechargeData) {
  const { userId, amount, asset = 'USDT', txHash } = rechargeData;
  try {
    const result = await client.execute({
      sql: `
        INSERT INTO recharges (userId, amount, asset, txHash, status)
        VALUES (?, ?, ?, ?, 'pending')
      `,
      args: [userId, amount, asset, txHash]
    });
    return { rechargeId: result.lastInsertRowid, status: 'pending' };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: recharges.txHash')) {
      throw new Error('This transaction is already recorded, please do not submit again');
    }
    console.error('Failed to create recharge record:', err.message);
    throw err;
  }
}

/**
 * Update recharge status
 * @param {number} rechargeId - Recharge ID
 * @param {string} status - New status (pending/completed/failed)
 * @returns {Promise<{success: boolean, status: string}>} Update result
 */
async function updateRechargeStatus(rechargeId, status) {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  try {
    const updateResult = await client.execute({
      sql: `
        UPDATE recharges 
        SET status = ?, completedAt = ? 
        WHERE id = ?
      `,
      args: [status, completedAt, rechargeId]
    });
    if (updateResult.rowsAffected === 0) {
      throw new Error('Recharge record does not exist');
    }

    if (status === 'completed') {
      const rechargeResult = await client.execute({
        sql: 'SELECT userId, amount, asset FROM recharges WHERE id = ?',
        args: [rechargeId]
      });
      const recharge = rechargeResult.rows[0];
      if (!recharge) throw new Error('Recharge record not found');

      await client.execute({
        sql: `
          INSERT INTO user_balances (userId, asset, balance)
          VALUES (?, ?, ?)
          ON CONFLICT(userId, asset) 
          DO UPDATE SET balance = user_balances.balance + ?
        `,
        args: [recharge.userId, recharge.asset, recharge.amount, recharge.amount]
      });
    }

    return { success: true, status };
  } catch (err) {
    console.error('Failed to update recharge status:', err.message);
    throw err;
  }
}

/**
 * Get user recharge history
 * @param {string} userId - User's wallet address
 * @returns {Promise<Array>} Recharge history
 */
async function getRechargeHistory(userId) {
  try {
    const sql = `
      SELECT * FROM recharges 
      WHERE LOWER(userId) = LOWER(?) 
      ORDER BY createdAt DESC
    `;
    const result = await client.execute({
      sql,
      args: [userId]
    });
    return result.rows;
  } catch (err) {
    console.error('Failed to get recharge history:', err.message);
    throw err;
  }
}

/**
 * Deposit USDT to user balance
 * @param {string} walletAddress - User's wallet address
 * @param {number} amount - Deposit amount
 * @returns {Promise<{success: boolean, amount: number}>} Deposit result
 */
async function depositUSDT(walletAddress, amount) {
  try {
    await client.execute({
      sql: `
        INSERT INTO user_balances (userId, asset, balance) 
        VALUES (?, 'USDT', ?)
        ON CONFLICT(userId, asset) 
        DO UPDATE SET balance = user_balances.balance + ?
      `,
      args: [walletAddress, amount, amount]
    });
    return { success: true, amount };
  } catch (err) {
    console.error('Failed to deposit USDT:', err.message);
    throw err;
  }
}

// ====================== 7. Top Holders Operations ======================

/**
 * Get top holders for a market
 * @param {number} marketId - Market ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Promise<Array>} Top holders list
 */
async function getTopHolders(marketId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  try {
    const sql = `
      SELECT walletAddress, betAmount, optionId 
      FROM market_bets 
      WHERE marketId = ? 
      ORDER BY betAmount DESC 
      LIMIT ? OFFSET ?
    `;
    const result = await client.execute({
      sql,
      args: [marketId, limit, offset]
    });
    return result.rows;
  } catch (err) {
    console.error('Failed to get top holders:', err.message);
    throw err;
  }
}

/**
 * Get total count of top holders for a market
 * @param {number} marketId - Market ID
 * @returns {Promise<number>} Total count
 */
async function getTopHoldersTotal(marketId) {
  try {
    const sql = 'SELECT COUNT(*) as total FROM market_bets WHERE marketId = ?';
    const result = await client.execute({
      sql,
      args: [marketId]
    });
    return result.rows[0]?.total || 0;
  } catch (err) {
    console.error('Failed to get top holders total:', err.message);
    throw err;
  }
}

// ====================== 8. Export All Methods (Grouped by Module) ======================
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
  marketDetail: marketDetail,
  recharge: {
    addRecord: createRecharge,
    updateStatus: updateRechargeStatus,
    history: getRechargeHistory,
    depositBalance: depositUSDT
  },
  holder: {
    topHolder: getTopHolders,
    topHolderTotal: getTopHoldersTotal
  }
};