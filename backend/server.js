const express = require('express');
const db = require('./db');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const authMiddleware = require('./middleware/auth');
const path = require('path');
const { put } = require('@vercel/blob');

const JWT_SECRET = 'zama_president_key'; // Replace with a strong secret in production
const JWT_EXPIRES_IN = '7d'; // Token validity period: 7 days

const app = express();
const PORT = process.env.PORT || 3001;

// 🔥 Configure CORS
app.use(cors({
  origin: process.env.REACT_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const userRouter = require('./routes/user');
app.use('/api/user', userRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Multer config: Use memory storage (files are uploaded to Vercel Blob)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ====================== API 1: Add User (POST /api/users) ======================
app.post('/api/users', async (req, res) => {
  const { walletAddress, nickname } = req.body;
  if (!walletAddress || !nickname) {
    return res.status(400).json({ error: 'Wallet address and nickname cannot be empty' });
  }

  try {
    const userId = await db.user.add(walletAddress, nickname);
    res.json({ success: true, userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== API 2: Get User (GET /api/users/:walletAddress) ======================
app.get('/api/users/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;
  try {
    const user = await db.user.getByWallet(walletAddress);
    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== API: Get Nonce (GET /api/get-nonce) ======================
app.get('/api/get-nonce', async (req, res) => {
  const { walletAddress } = req.query;
  if (!walletAddress) {
    return res.json({ success: false, error: 'Wallet address cannot be empty' });
  }

  try {
    const data = await db.nonce.create(walletAddress);
    res.json({
      success: true,
      data: {
        nonce: data.nonce,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt
      }
    });
  } catch (err) {
    res.json({ success: false, error: 'Failed to generate nonce' });
  }
});

// ====================== API: Verify Signature & Generate Token (POST /api/verify-signature) ======================
app.post('/api/verify-signature', async (req, res) => {
  const { address, signature, nonce, chainId } = req.body;
  console.log('------------------- Signature Verification Parameters -------------------');
  console.log('Received address:', address);
  console.log('Received signature:', signature);
  console.log('Received nonce:', nonce);
  console.log('Received chainId:', chainId);

  if (!address || !signature || !nonce || !chainId) {
    return res.json({
      success: false,
      error: 'Incomplete parameters (address/signature/nonce/chainId)'
    });
  }

  try {
    const nonceRecord = await db.nonce.getValid(address, nonce);
    if (!nonceRecord) {
      return res.json({
        success: false,
        error: 'Invalid nonce (may be expired or used)'
      });
    }

    // Assemble signature message
    const message = [
      `AegisPredict wants you to sign in with your Ethereum account:`,
      address,
      '',
      `Welcome to AegisPredict! Sign to connect.`,
      '',
      `Version: 1`,
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date(nonceRecord.createdAt).toISOString()}`,
      `Expiration Time: ${new Date(nonceRecord.expiresAt).toISOString()}`
    ].join('\n');

    console.log('\n------------------- Signature Message Assembled by Backend -------------------');
    console.log(message);
    console.log('--------------------------------------------------------\n');

    // Verify signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.json({
          success: false,
          error: 'Signature verification failed (address mismatch)'
        });
      }

      // Mark nonce as used
      await db.nonce.markAsUsed(nonceRecord.id);

      // Create user if not exists
      let existingUser = await db.user.getByWallet(address);
      if (!existingUser) {
        const nickname = `user_${address.slice(0, 6)}`;
        await db.user.add(address, nickname);
      }

      // Generate JWT token
      const token = jwt.sign({ walletAddress: address }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({
        success: true,
        data: {
          token,
          user: { walletAddress: address }
        }
      });

    } catch (verifyErr) {
      return res.json({
        success: false,
        error: 'Signature verification failed (invalid format or signature)'
      });
    }
  } catch (err) {
    res.json({
      success: false,
      error: 'Failed to verify signature'
    });
  }
});

// ====================== Middleware: JWT Authentication ======================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ====================== API: Create Market (POST /api/create-market) ======================
app.post('/api/create-market', authenticateToken, upload.single('cover'), async (req, res) => {
  const { title, description, category, endTime, options } = req.body;
  const creatorAddress = req.user.walletAddress;

  if (!title || !category || !endTime || options.length < 2) {
    return res.status(400).json({ error: 'Required fields missing (title/category/end time/at least 2 options)' });
  }

  try {
    const titleExists = await db.market.checkTitle(title);
    if (titleExists) {
      return res.status(400).json({ error: 'This market title already exists, please change the title' });
    }

    // Handle cover image upload to Vercel Blob
    let coverUrl = null;
    if (req.file) {
      const blob = await put(`market-covers/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
        access: 'public',
      });
      coverUrl = blob.url;
    }

    const marketId = await db.market.create({
      title,
      description,
      creatorAddress,
      category,
      endTime,
      options,
      coverUrl
    });
    res.json({ success: true, data: { marketId } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// ====================== API: Get Markets (GET /api/markets) ======================
app.get('/api/markets', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const totalCount = await db.market.getTotalCount();
    const markets = await db.market.getList(page, limit);

    const totalPages = Math.ceil(totalCount / limit);
    res.json({
      success: true,
      data: {
        markets,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalCount,
          totalPages
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query market data' });
  }
});

// ====================== API: Get User Positions (GET /api/market/:id/positions) ======================
app.get('/api/market/:id/positions', async (req, res) => {
  const { id: marketId } = req.params;
  const { userId } = req.query;

  if (!marketId || !userId) {
    return res.status(400).json({ error: 'Missing parameters: marketId or userId' });
  }

  try {
    const positions = await db.marketDetail.getUserPositions(marketId, userId);
    res.json({
      success: true,
      data: positions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get position data' });
  }
});

// ====================== API: Place Bet (POST /api/market/bet) ======================
app.post('/api/market/bet', async (req, res) => {
  const { marketId, optionId, userId, betAmount } = req.body;

  if (!marketId || !optionId || !userId || !betAmount) {
    return res.status(400).json({
      error: 'Missing parameters: marketId, optionId, userId, and betAmount are required'
    });
  }

  if (parseFloat(betAmount) <= 0) {
    return res.status(400).json({ error: 'Bet amount must be greater than 0' });
  }

  try {
    const result = await db.marketDetail.placeBet({ marketId, optionId, userId, betAmount });
    res.json({
      success: true,
      message: 'Bet successful',
      data: { betId: result.betId }
    });
  } catch (err) {
    const errorMsg = err.message === 'Insufficient balance'
        ? 'Bet failed: Insufficient balance, please recharge first'
        : 'Server processing failed, please try again later';
    res.status(500).json({ error: errorMsg });
  }
});

// ====================== API: Get Market Detail (GET /api/market/:id/detail) ======================
app.get('/api/market/:id/detail', async (req, res) => {
  const { id: marketId } = req.params;
  if (!marketId) {
    return res.status(400).json({ error: 'Missing parameter: marketId' });
  }

  try {
    const market = await db.marketDetail.getById(marketId);
    if (!market) {
      return res.status(404).json({ error: 'Market does not exist' });
    }
    res.json({
      success: true,
      data: market
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get market details' });
  }
});

// ====================== API: Get Daily Volume (GET /api/market/:id/daily-volume) ======================
app.get('/api/market/:id/daily-volume', async (req, res) => {
  const { id: marketId } = req.params;
  if (!marketId) {
    return res.status(400).json({ error: 'Missing parameter: marketId' });
  }

  try {
    const volumeData = await db.marketDetail.getDailyVolume(marketId);
    res.json({
      success: true,
      data: volumeData
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get trading volume data' });
  }
});

// ====================== API: Get Current User (GET /api/user/me) ======================
app.get('/api/user/me', authMiddleware, async (req, res) => {
  const walletAddress = req.user.walletAddress;
  try {
    const user = await db.user.getByWallet(walletAddress);
    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== API: Get Top Holders (GET /api/market/:id/top-holders) ======================
app.get("/api/market/:id/top-holders", async (req, res) => {
  const marketId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const rows = await db.holder.topHolder(marketId, page, limit);
    const total = await db.holder.topHolderTotal(marketId);
    res.json({
      success: true,
      data: rows,
      page,
      limit,
      total: total || 0
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend service started successfully: http://localhost:${PORT}`);
});