// backend/server.js
const express = require('express');
const db = require('./db');
const { ethers } = require('ethers');
// backend/server.js (Added Content)
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors'); // Import cors
const authMiddleware = require('./middleware/auth');
const path = require('path');
const fs = require('fs');
const JWT_SECRET = 'zama_president_key'; // Replace with a strong secret in production
const JWT_EXPIRES_IN = '7d'; // Token validity period: 7 days

const app = express();
const PORT = 3001;

// 🔴 Add multer configuration here
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

// 🔥 Configure CORS: Allow cross-origin requests from localhost:3000
app.use(cors({
  origin: 'http://localhost:3000', // Domain + port where the frontend is running
  methods: ['GET', 'POST'], // Allowed HTTP methods
  credentials: true, // Allow credentials (e.g., cookies)
}));

app.use(express.json());

const userRouter = require('./routes/user');
app.use('/api/user', userRouter); // All requests to /api/user are handled by userRouter

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API 1: Add User (POST Request)
app.post('/api/users', (req, res) => {
  const { walletAddress, nickname } = req.body;
  if (!walletAddress || !nickname) {
    return res.status(400).json({ error: 'Wallet address and nickname cannot be empty' });
  }

  db.user.add(walletAddress, nickname, (err, userId) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, userId });
  });
});

// API 2: Get User (GET Request)
app.get('/api/users/:walletAddress', (req, res) => {
  const walletAddress = req.params.walletAddress;
  db.user.getByWallet(walletAddress, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }
    res.json({ success: true, user });
  });
});

app.get('/api/get-nonce', (req, res) => {
  const { walletAddress } = req.query;

  // Parameter validation failed: Return success: false + error message
  if (!walletAddress) {
    return res.json({
      success: false,
      error: 'Wallet address cannot be empty'
    });
  }

  // Generate and store nonce
  db.nonce.create(walletAddress, (err, data) => {
    // Database/business error: Return success: false + error message
    if (err) {
      return res.json({
        success: false,
        error: 'Failed to generate nonce'
      });
    }

    // Successful response: Return in the format expected by the frontend (wrapped in success: true + data)
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

// API 4: Verify Signature and Generate Token (POST)
app.post('/api/verify-signature', async (req, res) => {
  const { address, signature, nonce, chainId } = req.body;
  console.log('------------------- Signature Verification Parameters -------------------');
  console.log('Received address:', address);
  console.log('Received signature:', signature);
  console.log('Received nonce:', nonce);
  console.log('Received chainId:', chainId);

  // 1. Parameter validation (Failed: Uniformly return success: false + error)
  if (!address || !signature || !nonce || !chainId) {
    return res.json({
      success: false,
      error: 'Incomplete parameters (address/signature/nonce/chainId)'
    });
  }

  try {
    // 2. Query valid nonce
    db.nonce.getValid(address, nonce, async (err, nonceRecord) => {
      // Database query failed
      if (err) {
        console.error('Failed to query nonce:', err);
        return res.json({
          success: false,
          error: 'Failed to query nonce'
        });
      }

      // Invalid nonce (does not exist/expired/used)
      if (!nonceRecord) {
        console.error('Invalid nonce: Does not exist/used/expired');
        return res.json({
          success: false,
          error: 'Invalid nonce (may be expired or used)'
        });
      }

      // 3. Assemble signature message
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

      console.log('\n------------------- Signature Message Assembled by Backend -------------------');
      console.log(message);
      console.log('--------------------------------------------------------\n');

      // 4. Verify signature
      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        console.log('Address obtained from signature verification:', recoveredAddress);
        console.log('Original address (lowercase):', address.toLowerCase());
        console.log('Verify if addresses match:', recoveredAddress.toLowerCase() === address.toLowerCase());

        // Signature address mismatch
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          console.error('Signature verification failed: Address mismatch');
          return res.json({
            success: false,
            error: 'Signature verification failed (address mismatch)'
          });
        }

        // 5. Mark nonce as used
        db.nonce.markAsUsed(nonceRecord.id, (err) => {
          // Failed to mark nonce
          if (err) {
            console.error('Failed to mark nonce as used:', err);
            return res.json({
              success: false,
              error: 'Failed to mark nonce as used'
            });
          }

          db.user.getByWallet(address, (userErr, existingUser) => {
            if (userErr) {
              console.error('Failed to query user:', userErr);
              return res.json({ success: false, error: 'Failed to query user' });
            }

            // 5.1 If user does not exist, create a new user
            if (!existingUser) {
              const nickname = `user_${address.slice(0, 6)}`; // Generate default nickname
              db.user.add(address, nickname, (addErr, newUser) => {
                if (addErr) {
                  console.error('Failed to create user:', addErr);
                  return res.json({ success: false, error: 'Failed to create user' });
                }
                // Generate Token after successful creation
                const token = jwt.sign({ walletAddress: address }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
                console.log('User created successfully, generated Token:', token);
                res.json({
                  success: true,
                  data: {  // Key: Wrap result in data
                    token,
                    user: { walletAddress: address }
                  }
                });
              });
            } else {
              const token = jwt.sign({ walletAddress: address }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
              console.log('User created successfully, generated Token:', token);
              res.json({
                success: true,
                data: {  // Key: Wrap result in data
                  token,
                  user: { walletAddress: address }
                }
              });
            }
          });
        });

      } catch (verifyErr) {
        // Error during signature verification (format error, etc.)
        console.error('Error during signature verification:', verifyErr);
        return res.json({
          success: false,
          error: 'Signature verification failed (invalid format or signature)'
        });
      }
    });
  } catch (error) {
    // Error in overall process
    console.error('Error in overall process:', error);
    res.json({
      success: false,
      error: 'Failed to verify signature'
    });
  }
});

// 1. First add JWT authentication middleware (ensure only logged-in users can create markets)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // Attach user information (walletAddress) to req
    next();
  });
};

app.post('/api/create-market', authenticateToken, upload.single('cover'), (req, res) => {
  const { title, description, category, endTime, options } = req.body;
  const creatorAddress = req.user.walletAddress; // Get creator address from token

  // Verify required fields
  if (!title || !category || !endTime || options.length < 2) {
    return res.status(400).json({ error: 'Required fields missing (title/category/end time/at least 2 options)' });
  }

  db.market.checkTitle(title, (err, exists) => {
    if (err) {
      console.error('Failed to check for duplicate titles:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    // If title already exists, return error directly
    if (exists) {
      return res.status(400).json({ error: 'This market title already exists, please change the title' });
    }

    // Process cover URL: Generate access path if upload is successful, otherwise null
    let coverUrl = null;
    if (req.file) {
      coverUrl = `/uploads/market-covers/${req.file.filename}`; // Relative path accessible by frontend
    }

    // Call db method to create market
    db.market.create({
      title,
      description,
      creatorAddress,
      category,
      endTime, // Pass end time
      options,
      coverUrl // New cover address field
    }, (err, marketId) => {
      if (err) return res.status(500).json({ error: 'Failed to create market' });
      res.json({ success: true, data: { marketId: marketId } });
    });
  });
});

app.get('/api/markets', (req, res) => {
  // Get pagination information from query parameters (default: page 1, 10 items per page)
  const { page = 1, limit = 10 } = req.query;

  // First query total count, then query current page data
  db.market.getTotalCount((countErr, totalCount) => {
    if (countErr) {
      return res.status(500).json({ error: 'Failed to query total number of markets' });
    }

    // Query current page data
    db.market.getList(page, limit, (err, markets) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to query market list' });
      }

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / limit);

      // Return pagination data
      res.json({
        success: true,
        data: {
          markets, // Current page market list
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalCount, // Total number of items
            totalPages // Total number of pages
          }
        }
      });
    });
  });
});

userRouter.get('/', authMiddleware, (req, res) => {
  // authMiddleware attaches user information to req.user
  res.json({
    success: true,
    data: {
      walletAddress: req.user.walletAddress, // Assume user table stores wallet address
    },
  });
});

app.get('/api/market/:id/positions', (req, res) => {
  const { id: marketId } = req.params; // Get market ID from route parameters
  const { userId } = req.query; // Get user wallet address from query parameters (e.g., ?userId=0x...)

  // Parameter validation
  if (!marketId || !userId) {
    return res.status(400).json({ error: 'Missing parameters: marketId or userId' });
  }

  // Call getUserPositions method from db.js
  db.marketDetail.getUserPositions(marketId, userId, (err, positions) => {
    if (err) {
      console.error('Failed to get positions:', err);
      return res.status(500).json({ error: 'Failed to get position data' });
    }
    // Return position data on success
    res.json({
      success: true,
      data: positions // Format: [{ optionLabel: "Option 1", totalAmount: 100 }, ...]
    });
  });
});

// Added: User Bet API (POST method, submit bet data)
app.post('/api/market/bet', (req, res) => {
  // Get bet data from request body
  const { marketId, optionId, userId, betAmount } = req.body;

  console.log(`Bet parameters:${marketId}|${optionId}|${betAmount}|${userId}`);
  // 1. Parameter validation (ensure necessary fields exist)
  if (!marketId || !optionId || !userId || !betAmount) {
    return res.status(400).json({
      error: 'Missing parameters: marketId, optionId, userId, and betAmount are required'
    });
  }

  // Verify bet amount is positive
  if (parseFloat(betAmount) <= 0) {
    return res.status(400).json({ error: 'Bet amount must be greater than 0' });
  }

  // 2. Call placeBet method from db.js to process bet logic
  db.marketDetail.placeBet(
      { marketId, optionId, userId, betAmount },
      (err, result) => {
        if (err) {
          // Handle specific errors (e.g., insufficient balance)
          const errorMsg = err.message === 'Insufficient balance'
              ? 'Bet failed: Insufficient balance, please recharge first'
              : 'Server processing failed, please try again later';
          console.error('Bet failed:', err);
          return res.status(500).json({ error: errorMsg });
        }

        // 3. Successful response (return bet ID)
        res.json({
          success: true,
          message: 'Bet successful',
          data: { betId: result.betId }
        });
      }
  );
});

// Added 1: Get Market Details (including options, probabilities, market cap)
app.get('/api/market/:id/detail', (req, res) => {
  const { id: marketId } = req.params; // Get market ID from route parameters
  console.log(`market detail id: ${marketId}`);
  // Parameter validation
  if (!marketId) {
    return res.status(400).json({ error: 'Missing parameter: marketId' });
  }

  // Call getById method from db.marketDetail
  db.marketDetail.getById(marketId, (err, market) => {
    if (err) {
      console.error('Failed to get market details:', err);
      return res.status(500).json({ error: 'Failed to get market details' });
    }
    if (!market) {
      return res.status(404).json({ error: 'Market does not exist' });
    }
    // Return market details on success (including options, probabilities, market cap)
    res.json({
      success: true,
      data: market
    });
  });
});

// Added 2: Get Market Daily Trading Volume (for K-line chart)
app.get('/api/market/:id/daily-volume', (req, res) => {
  const { id: marketId } = req.params; // Get market ID from route parameters

  // Parameter validation
  if (!marketId) {
    return res.status(400).json({ error: 'Missing parameter: marketId' });
  }

  // Call getDailyVolume method from db.marketDetail
  db.marketDetail.getDailyVolume(marketId, (err, volumeData) => {
    if (err) {
      console.error('Failed to get daily trading volume:', err);
      return res.status(500).json({ error: 'Failed to get trading volume data' });
    }
    // Return daily trading volume data on success
    res.json({
      success: true,
      data: volumeData
    });
  });
});

app.get('/api/user/me', authMiddleware, (req, res) => {
  const walletAddress = req.user.walletAddress; // authMiddleware attaches user info to req.user
  console.log(`get user info :${walletAddress}`);
  // Call db.user.getByWallet to query user
  db.user.getByWallet(walletAddress, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }
    res.json({ success: true, data: user });
  });
});

app.get("/api/market/:id/top-holders", (req, res) => {
  const marketId = req.params.id;
  const page = parseInt(req.query.page) || 1; // Default: Page 1
  const limit = parseInt(req.query.limit) || 10; // Default: 10 items per page

  db.holder.topHolder(marketId, page, limit, (err, rows) => {
    if (err) {
      return res.json({ success: false, error: err.message });
    }

    db.getTopHoldersTotal(marketId, (totalErr, total) => {
      if (totalErr) {
        console.error('Failed to get total count:', totalErr);
      }
      // Return pagination data + pagination meta info (for frontend display)
      res.json({
        success: true,
        data: rows,
        page,
        limit,
        total: total || 0 /* Optional: Query total count (requires additional SQL) */
      });
    });
  });
})


app.listen(PORT, () => {
  console.log(`🚀 Backend service started successfully: http://localhost:${PORT}`);
});