// chainApi.js - Encapsulates methods for interacting with on-chain contracts (replaces SQLite reading logic in original api.js)
/* global BigInt */
import { ethers } from 'ethers';

// -------------------------- On-chain Configuration (must match your contract and network) --------------------------
// 1. Contract Addresses (your PredictionMarket contract address)
export const MARKET_CONTRACT_ADDRESS = '0x0babE07D6C6aCaa7d9E9C18D59bf4324172468e0';
export const PRIVACY_TOKEN_ADDRESS = '0x0892d63C1bc130d39A129a23696f87dDd763cEb4';
export const PRIVACY_VOTE_ADDRESS = '0x88d458415D2110f8ec373De5Ac1878b837BE900a';

// 2. RPC Node (Sepolia Testnet, can be replaced with other nodes like Alchemy)
const RPC_URL = 'https://sepolia.infura.io/v3/6f7297d3a3b3445190b7b33caed682e9';
// const instance = await createInstance(SepoliaConfig);
// 3. Contract ABI (contains only required view methods, simplified version)
const MARKET_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "page", "type": "uint256" },
            { "internalType": "uint256", "name": "pageSize", "type": "uint256" },
            { "internalType": "bool", "name": "isDesc", "type": "bool" }
        ],
        "name": "getMarketList",
        "outputs": [
            {
                // First return value: MarketListResult struct
                "components": [
                    {
                        // items field in struct: MarketListItem[] array
                        "components": [
                            // 7 fields of MarketListItem (order and type must match contract exactly!)
                            { "internalType": "uint256", "name": "marketId", "type": "uint256" },    // 1. Correct
                            { "internalType": "string", "name": "title", "type": "string" },        // 2. Correct
                            { "internalType": "string", "name": "description", "type": "string" },  // 3. Correct
                            { "internalType": "string", "name": "imageUrl", "type": "string" },
                            { "internalType": "bool", "name": "isSettled", "type": "bool" },        // 4. Correct
                            { "internalType": "bool", "name": "isCanceled", "type": "bool" },       // 5. Correct
                            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" }, // 6. Correct
                            { "internalType": "uint8", "name": "optionCount", "type": "uint8" },     // 7. Key fix: it's uint8!
                            { "internalType": "uint8", "name": "category", "type": "uint8" }, // Category (1-5)
                            { "internalType": "uint64", "name": "totalMarketCap", "type": "uint64" }, // Total Market Cap
                            { "internalType": "uint64", "name": "totalVolume", "type": "uint64" }
                        ],
                        "internalType": "struct PredictionMarket.MarketListItem[]",
                        "name": "items",
                        "type": "tuple[]"
                    },
                    { "internalType": "uint256", "name": "totalCount", "type": "uint256" }      // Second return value: total count
                ],
                "internalType": "struct PredictionMarket.MarketListResult",
                "name": "",  // Struct return value name can be empty, but components must be correct
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "imageUrl", "type": "string" },
            { "internalType": "uint8", "name": "category", "type": "uint8" },
            { "internalType": "string[]", "name": "options", "type": "string[]" },
            { "internalType": "uint64[]", "name": "odds", "type": "uint64[]" },
            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
            { "internalType": "uint256", "name": "resultTime", "type": "uint256" }
        ],
        "name": "createMarket",
        "outputs": [
            { "internalType": "uint256", "name": "marketId", "type": "uint256" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "marketId", "type": "uint256" },
            { "indexed": false, "internalType": "string", "name": "title", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "creator", "type": "address" }
        ],
        "name": "MarketCreated",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            }
        ],
        "name": "getMarketInfo",
        "outputs": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "uint8", "name": "category", "type": "uint8" },
            { "internalType": "string", "name": "imageUrl", "type": "string" },
            { "internalType": "string[]", "name": "options", "type": "string[]" },
            { "internalType": "uint64[]", "name": "odds", "type": "uint64[]" },
            { "internalType": "uint256", "name": "voteEndTime", "type": "uint256" },
            { "internalType": "uint256", "name": "resultTime", "type": "uint256" },
            { "internalType": "bool", "name": "isSettled", "type": "bool" },
            { "internalType": "bool", "name": "isCanceled", "type": "bool" },
            { "internalType": "uint8", "name": "winningOption", "type": "uint8" },
            { "internalType": "uint64", "name": "totalMarketCap", "type": "uint64" },
            { "internalType": "uint64", "name": "totalVolume", "type": "uint64" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            },
            {
                "internalType": "uint8",
                "name": "optionIndex",
                "type": "uint8"
            }
        ],
        "name": "getOptionTotalVotes",
        "outputs": [
            {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "page",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "pageSize",
                "type": "uint256"
            }
        ],
        "name": "getMarketVoteRecords",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "voter",
                        "type": "address"
                    },
                    {
                        "internalType": "uint8",
                        "name": "optionIndex",
                        "type": "uint8"
                    },
                    {
                        "internalType": "uint64",
                        "name": "amount",
                        "type": "uint64"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct PredictionMarket.VoteRecord[]",
                "name": "records",
                "type": "tuple[]"
            },
            {
                "internalType": "uint256",
                "name": "totalCount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "marketId", "type": "uint256" },
            { "internalType": "uint8", "name": "optionIndex", "type": "uint8" },
            { "internalType": "uint64", "name": "amount", "type": "uint64" }
        ],
        "name": "vote",
        "outputs": [], // No return value (transaction hash obtained via tx.hash)
        "stateMutability": "nonpayable", // Requires transaction (gas consumption)
        "type": "function"
    },
];

const TOKEN_ABI = [
    {
        "inputs": [
            { "internalType": "uint64", "name": "amount", "type": "uint64" }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "user", "type": "address" }
        ],
        "name": "getConfidentialBalance",
        "outputs": [
            { "internalType": "bytes", "name": "", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint64", "name": "tokenAmount", "type": "uint64" }
        ],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const VOTE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "user", "type": "address" }
        ],
        "name": "getVotingNoteBalance",
        "outputs": [
            { "internalType": "euint64", "name": "", "type": "bytes" } // euint64 encrypted type is represented as bytes in ABI
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
// --------------------------------------------------------------------------

// Initialize contract instance (read-only, no signature required, for reading on-chain data only)
let marketContract;
function initContract() {
    if (!marketContract) {
        // Connect to RPC node (read-only mode, no user wallet required)
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        // Create contract instance
        marketContract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            provider  // Use provider instead of signer (signature not needed for reading data)
        );
    }
    return marketContract;
}

/**
 * Read market list from on-chain (pagination)
 * @param {number} page - Page number (starts from 1)
 * @param {number} pageSize - Items per page (1-100)
 * @param {boolean} isDesc - Whether to sort in descending order (true: newest first, false: oldest first)
 * @returns {Promise<{ items: MarketListItem[], totalCount: number }>} Market list data
 */
export async function getMarketListFromChain(page, pageSize, isDesc = true) {
    try {
        // 1. Initialize contract
        const contract = initContract();

        // 2. Call contract's getMarketList method (on-chain reading, no transaction fee required)
        const [items, totalCount] = await contract.getMarketList(page, pageSize, isDesc);

        // 3. Convert data format (convert BigInt to number/string for frontend display)
        const formattedItems = items.map(item => ({
            marketId: item.marketId.toString(),  // Market ID (convert to string to avoid precision loss)
            title: item.title,                   // Title
            description: item.description,       // Description
            imageUrl: item.imageUrl,
            isSettled: item.isSettled,           // Whether settled
            isCanceled: item.isCanceled,         // Whether canceled
            voteEndTime: new Date(Number(item.voteEndTime) * 1000).toLocaleString(), // Convert to local time
            optionCount: Number(item.optionCount), // Number of options
            category: Number(item.category), // Category (1-5)
            totalMarketCap: Number(item.totalMarketCap), // Total Market Cap
            totalVolume: Number(item.totalVolume) // Total Trading Volume
        }));

        console.log(`formattedItems:${formattedItems}`);
        console.log('formattedItems:', formattedItems);
        console.log(`count:${totalCount}`);
        // 4. Return formatted data
        return {
            items: formattedItems,
            totalCount: Number(totalCount)  // Total number of markets
        };
    } catch (error) {
        console.error('❌ Failed to read market list from on-chain:', error.message);
        throw new Error(`Failed to get market list: ${error.message}`); // Throw to frontend for handling
    }
}

/**
 * Create new market on-chain (requires user wallet signature)
 * @param {string} title - Market title (must be unique)
 * @param {string} description - Market description
 * @param {string} imageUrl - Cover image URL
 * @param {string[]} options - Voting options array (at least 2 items)
 * @param {number[]} odds - Odds array corresponding to options (length matches options)
 * @param {number} voteEndTime - Voting end time (timestamp in seconds)
 * @param {number} resultTime - Result announcement time (timestamp in seconds, must be later than voteEndTime)
 * @returns {Promise<string>} Newly created market ID
 */
export async function createMarketFromChain(title, description, imageUrl, category, options, odds, voteEndTime, resultTime) {
    try {
        // 1. Check if wallet exists (e.g., MetaMask)
        if (!window.ethereum) {
            throw new Error("Please install MetaMask wallet and connect");
        }

        // 2. Connect wallet and get signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        console.log("Current wallet address:", await signer.getAddress());

        // 3. Initialize writable contract instance (use signer to support transaction signing)
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 4. Send "create market" transaction (set sufficient gas limit)
        const tx = await contract.createMarket(
            title,
            description,
            imageUrl,
            category,
            options,
            odds,
            voteEndTime,
            resultTime,
            { gasLimit: 3000000 } // Higher gas required for FHE contracts
        );
        console.log("Transaction sent, hash:", tx.hash);

        // 5. Wait for transaction confirmation (on-chain)
        const receipt = await tx.wait();
        console.log("Transaction confirmed, block number:", receipt.blockNumber);

        // 6. Extract market ID from event (more reliable via MarketCreated event)
        let marketCreatedEvent = null;
        for (const log of receipt.logs) {
            // Filter: process only logs from current contract
            if (log.address.toLowerCase() !== MARKET_CONTRACT_ADDRESS.toLowerCase()) {
                continue;
            }
            try {
                // Manually parse log with contract ABI (consistent with test script logic)
                const parsedEvent = contract.interface.parseLog(log);
                if (parsedEvent.name === "MarketCreated") {
                    marketCreatedEvent = parsedEvent;
                    break; // Target event found, exit loop
                }
            } catch (err) {
                // Ignore unparseable logs (non-target events)
                continue;
            }
        }

        if (!marketCreatedEvent) {
            throw new Error("MarketCreated event not found, unable to get market ID");
        }
        const marketId = marketCreatedEvent.args.marketId.toString();

        console.log("Market created successfully, ID:", marketId);
        return marketId;
    } catch (error) {
        console.error("❌ Failed to create market:", error.message);
        throw new Error(`Failed to create market: ${error.message}`);
    }
}

export const getMarketDetail = async (marketId) => {
    try {
        if (!window.ethereum) {
            throw new Error('Please connect wallet first');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        console.log("Current wallet address:", await signer.getAddress());

        // 3. Initialize writable contract instance (use signer to support transaction signing)
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 3. Convert marketId to number (contract requires uint256 type)
        const marketIdNum = Number(marketId);
        console.log(`convert market id:${marketId}`);
        if (isNaN(marketIdNum)) {
            throw new Error('Invalid market ID');
        }

        // 4. Call contract's getMarketInfo (view function, no gas required)
        const [title, description, category, imageUrl, options, odds, voteEndTime, resultTime, isSettled, isCanceled, winningOption, totalMarketCap, totalVolume] = await contract.getMarketInfo(marketIdNum);
        console.log(`title:${title}`);
        console.log(`description:${description}`);
        console.log(`imageUrl:${imageUrl}`);
        console.log(`options:${options}`);
        console.log(`odds:${odds}`);
        console.log(`voteEndTime:${voteEndTime}`);
        console.log(`resultTime:${resultTime}`);
        console.log(`isSettled:${isSettled}`);
        console.log(`isCanceled:${isCanceled}`);
        console.log(`winningOption:${winningOption}`);
        console.log(`category:${category}`);
        console.log(`totalMarketCap:${totalMarketCap}`);
        console.log(`totalVolume:${totalVolume}`);
        // 5. Organize data (handle BigNumber type, convert to string/number)
        const marketData = {
            marketId: marketIdNum, // Add market ID manually (not included in contract return value)
            title,
            description,
            imageUrl, // Key: include image URL
            category: Number(category),
            options: options.map(opt => opt), // Convert to regular array
            odds: odds.map(odd => Number(odd)), // Convert uint64 to number
            voteEndTime: voteEndTime.toString(), // Convert timestamp to string (avoid big number issues)
            resultTime: resultTime.toString(),
            isSettled,
            isCanceled,
            winningOption: Number(winningOption), // Convert uint8 to number
            totalMarketCap: Number(totalMarketCap), // Total Market Cap
            totalVolume: Number(totalVolume)
        };

        return { success: true, data: marketData };

    } catch (error) {
        console.error('Failed to get market details:', error);
        // Handle contract revert errors (e.g., "Market does not exist")
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        return { success: false, error: errorMsg };
    }
}

export async function vote(marketId, optionIndex, amount) {
    try {
        // 1. Check if wallet exists (e.g., MetaMask)
        if (!window.ethereum) {
            throw new Error("Please install MetaMask wallet and connect");
        }

        // 2. Connect wallet and get signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const voterAddress = await signer.getAddress();
        console.log(`Current voter address: ${voterAddress}`);

        // 3. Parameter validation
        if (isNaN(marketId) || marketId < 0) {
            throw new Error("Invalid market ID (must be non-negative integer)");
        }
        if (isNaN(optionIndex) || optionIndex < 0) {
            throw new Error("Invalid option index (must be non-negative integer)");
        }
        if (isNaN(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
            throw new Error("Bet amount must be positive and within safe integer range");
        }

        // 4. Initialize writable contract instance (use signer to support transaction signing)
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            signer
        );

        // 5. Send bet transaction (set sufficient gas limit, higher gas required for FHE contracts)
        console.log(`Sending bet transaction: marketId=${marketId}, optionIndex=${optionIndex}, amount=${amount}`);
        const tx = await contract.vote(
            marketId,       // Market ID (uint256)
            optionIndex,    // Option index (uint8)
            amount,         // Bet amount (uint64)
            { gasLimit: 2000000 } // Adjust gas limit to avoid transaction failure
        );

        console.log(`Bet transaction sent, hash: ${tx.hash}`);

        // 6. Wait for transaction confirmation (on-chain)
        const receipt = await tx.wait();
        console.log(`Bet transaction confirmed, block number: ${receipt.blockNumber}`);

        // 7. Verify if transaction was successful
        if (receipt.status !== 1) {
            throw new Error("Bet transaction failed (status code not 1)");
        }

        // 8. Extract bet info from event (optional, for frontend display)
        let voteEvent = null;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== MARKET_CONTRACT_ADDRESS.toLowerCase()) {
                continue;
            }
            try {
                const parsedEvent = contract.interface.parseLog(log);
                if (parsedEvent.name === "Voted") {
                    voteEvent = parsedEvent;
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        if (voteEvent) {
            console.log(`Bet successful: voter=${voteEvent.args.voter}, marketId=${voteEvent.args.marketId}, option=${voteEvent.args.optionIndex}, amount=${voteEvent.args.amount}`);
        }

        return tx.hash; // Return transaction hash for frontend tracking

    } catch (error) {
        console.error("❌ Bet failed:", error.message);
        // Extract contract revert error message (e.g., "Voting closed")
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`Bet failed: ${errorMsg}`);
    }
}

/**
 * Get market vote records from on-chain (pagination)
 * @param {number} marketId - Market ID (uint256)
 * @param {number} page - Page number (starts from 1, uint256)
 * @param {number} pageSize - Items per page (1-100, uint256)
 * @returns {Promise<{ records: Array<{voter: string, optionIndex: number, amount: number, timestamp: number}>, totalCount: number }>}
 *          Vote records list and total count
 */
export async function getMarketVoteRecords(marketId, page, pageSize) {
    try {
        // 1. Check if wallet is connected (read-only connection at minimum)
        if (!window.ethereum) {
            throw new Error("Please connect wallet first");
        }

        // 2. Initialize provider and contract instance (read-only mode, no signature required)
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
            MARKET_CONTRACT_ADDRESS,
            MARKET_ABI,
            provider // Provider is sufficient for reading data, no signer needed
        );

        // 3. Parameter validation (prevent invalid calls)
        if (isNaN(marketId) || marketId < 0) {
            throw new Error("Invalid market ID (must be non-negative integer)");
        }
        if (isNaN(page) || page < 1) {
            throw new Error("Page number must be ≥ 1");
        }
        if (isNaN(pageSize) || pageSize < 1) {
            throw new Error("Items per page must be 1-100");
        }

        // 4. Call contract's getMarketVoteRecords method
        const [records, totalCount] = await contract.getMarketVoteRecords(
            marketId,    // Market ID (converted to uint256)
            page,        // Page number (converted to uint256)
            pageSize     // Items per page (converted to uint256)
        );

        // 5. Format return data (convert BigInt to Number for frontend handling)
        const formattedRecords = records.map(record => ({
            voter: record.voter, // Voter address (string)
            optionIndex: Number(record.optionIndex), // Option index (uint8 → number)
            amount: Number(record.amount), // Vote amount (uint64 → number)
            timestamp: Number(record.timestamp) // Vote timestamp (uint256 → number in seconds)
        }));

        // 6. Return formatted result
        return {
            records: formattedRecords,
            totalCount: Number(totalCount) // Total record count (uint256 → number)
        };

    } catch (error) {
        console.error(`Failed to get vote records for market ${marketId}:`, error);
        // Extract contract revert error message (e.g., "Market does not exist")
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`Failed to get vote records: ${errorMsg}`);
    }
}

// New method added to chainApi.js
export async function requestFaucet(amount = 100) {
    try {
        // 1. Check wallet connection
        if (!window.ethereum) {
            throw new Error("Please connect wallet first");
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();

        // 2. Initialize contract instance (use PrivacyToken contract address and ABI)
        const tokenContract = new ethers.Contract(
            PRIVACY_TOKEN_ADDRESS, // Replace with your PrivacyToken contract address
            TOKEN_ABI,     // ABI containing mint method
            signer
        );

        // 3. Parameter validation (matches contract uint64 type, max value 18446744073709551615)
        if (amount <= 0 || amount > 1e18) {
            throw new Error("Claim amount must be positive and not exceed 1e18");
        }

        // 4. Call contract's mint method (mint tokens to current user)
        const tx = await tokenContract.mint(amount); // mint method in contract accepts uint64 amount
        await tx.wait(); // Wait for transaction confirmation

        console.log(`Faucet claimed successfully for address:${userAddress} - ${amount} tokens, transaction hash: ${tx.hash}`);
        return { success: true, txHash: tx.hash };

    } catch (error) {
        console.error("Faucet claim failed:", error);
        // Extract contract revert error message (e.g., total supply exceeded)
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`Claim failed: ${errorMsg}`);
    }
}

// New method added to chainApi.js
/**
 * Convert tokens to notes (call PrivacyToken.deposit method)
 * @param {number} amount - Conversion amount (uint64 type)
 */
export async function depositTokens(amount) {
    try {
        if (!window.ethereum) throw new Error("Please connect wallet");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Initialize PrivacyToken contract instance
        const tokenContract = new ethers.Contract(
            PRIVACY_TOKEN_ADDRESS, // PrivacyToken contract address
            TOKEN_ABI,     // ABI containing deposit method
            signer
        );

        // Call contract's deposit method (accepts uint64 amount)
        const tx = await tokenContract.deposit(amount);
        return tx; // Return transaction object, caller waits for confirmation
    } catch (error) {
        console.error("Token to note conversion failed:", error);
        const errorMsg = error.message.includes('reverted:')
            ? error.message.split('reverted: ')[1]
            : error.message;
        throw new Error(`Conversion failed: ${errorMsg}`);
    }
}

export async function getNoteBalance(zamaInstance) {
    try {
        if (!window.ethereum) throw new Error("Please connect wallet");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        const votingContract = new ethers.Contract(
            PRIVACY_VOTE_ADDRESS, // PrivacyVoting contract address
            VOTE_ABI,
            signer
        );

        // Call contract method to get encrypted balance (euint64)
        const iface = new ethers.Interface(VOTE_ABI);
        const callData = iface.encodeFunctionData('getVotingNoteBalance', [userAddress]);
        // const encryptedBalance = await votingContract.getVotingNoteBalance(userAddress);
        console.log(`Getting voting balance:${callData}`);

        const encryptedBalanceBytes = await provider.call({
            to: PRIVACY_VOTE_ADDRESS, // Contract address
            data: callData             // Manually encoded call data
        });
        console.log("Raw encrypted ciphertext returned by contract:", encryptedBalanceBytes);

        const keypair = zamaInstance.generateKeypair();
        console.log("Generated key pair:", {
            publicKey: keypair.publicKey.slice(0, 20) + "...",
            privateKey: keypair.privateKey.slice(0, 20) + "..."
        });

        const handleContractPairs = [
            {
                handle: encryptedBalanceBytes,
                contractAddress: PRIVACY_VOTE_ADDRESS,
            },
        ];

        const startTimeStamp = Math.floor(Date.now() / 1000).toString(); // Timestamp in seconds
        const durationDays = '10'; // 10-day validity (string format)
        const contractAddresses = [PRIVACY_VOTE_ADDRESS];

        const eip712 = zamaInstance.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimeStamp,
            durationDays,
        );
        console.log("Generated EIP712 data:", eip712);

        // 8. Sign with wallet (note: specify type as UserDecryptRequestVerification)
        const signature = await signer.signTypedData(
            eip712.domain,
            {
                UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
            },
            eip712.message,
        );
        console.log("Signature result:", signature.slice(0, 20) + "...");

        // 9. Call userDecrypt for decryption (remove 0x prefix from signature, consistent with your code)
        const result = await zamaInstance.userDecrypt(
            handleContractPairs,
            keypair.privateKey,
            keypair.publicKey,
            signature.replace('0x', ''), // Remove 0x prefix
            contractAddresses,
            userAddress, // signer.address is current user address
            startTimeStamp,
            durationDays,
        );

        // // 10. Extract decryption result
        const decryptedValue = result[encryptedBalanceBytes];
        if (decryptedValue === undefined) {
            throw new Error("Decryption result is empty, ciphertext may be invalid or no permission");
        }

        // 11. Format result (assuming 18 decimals, adjust based on your token)
        // const readableValue = ethers.formatUnits(BigInt(decryptedValue), 18);
        console.log("Decrypted raw value:", decryptedValue);
        // Note: Encrypted balance needs to be decrypted with FHE client library
        // Example (requires @fhevm/client):
        // const decryptedBalance = await fheClient.decrypt(encryptedBalance);
        // return Number(decryptedBalance);

        // return callData; // Raw encrypted data (bytes) without decryption
        return decryptedValue;
    } catch (error) {
        console.error("Failed to query note balance:", error);
        throw error;
    }
}

export const getTokenBalance = async (zamaInstance) => {
    try {
        // 1. Connect provider (read-only operation doesn't need signer, provider is lighter)
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        console.log(`Starting to query token balance for user ${userAddress}`);

        // 2. Manually encode function call data (bypass ethers automatic handling entirely)
        const iface = new ethers.Interface(TOKEN_ABI); // Generate interface with ABI
        // Encode call data for getConfidentialBalance(address)
        const callData = iface.encodeFunctionData("getConfidentialBalance", [userAddress]);
        console.log("Manually encoded call data:", callData);

        // 3. Use provider.call to get raw ciphertext (without contract instance decoding logic)
        const encryptedBalanceBytes = await provider.call({
            to: PRIVACY_TOKEN_ADDRESS, // Contract address
            data: callData             // Manually encoded call data
        });
        console.log("Raw encrypted ciphertext returned by contract:", encryptedBalanceBytes);

        const keypair = zamaInstance.generateKeypair();
        console.log("Generated key pair:", {
            publicKey: keypair.publicKey.slice(0, 20) + "...",
            privateKey: keypair.privateKey.slice(0, 20) + "..."
        });

        const handleContractPairs = [
            {
                handle: encryptedBalanceBytes,
                contractAddress: PRIVACY_TOKEN_ADDRESS,
            },
        ];

        const startTimeStamp = Math.floor(Date.now() / 1000).toString(); // Timestamp in seconds
        const durationDays = '10'; // 10-day validity (string format)
        const contractAddresses = [PRIVACY_TOKEN_ADDRESS];

        const eip712 = zamaInstance.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimeStamp,
            durationDays,
        );
        console.log("Generated EIP712 data:", eip712);

        // 8. Sign with wallet (note: specify type as UserDecryptRequestVerification)
        const signature = await signer.signTypedData(
            eip712.domain,
            {
                UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
            },
            eip712.message,
        );
        console.log("Signature result:", signature.slice(0, 20) + "...");

        // 9. Call userDecrypt for decryption (remove 0x prefix from signature, consistent with your code)
        const result = await zamaInstance.userDecrypt(
            handleContractPairs,
            keypair.privateKey,
            keypair.publicKey,
            signature.replace('0x', ''), // Remove 0x prefix
            contractAddresses,
            userAddress, // signer.address is current user address
            startTimeStamp,
            durationDays,
        );

        // // 10. Extract decryption result
        const decryptedValue = result[encryptedBalanceBytes];
        if (decryptedValue === undefined) {
            throw new Error("Decryption result is empty, ciphertext may be invalid or no permission");
        }

        // 11. Format result (assuming 18 decimals, adjust based on your token)
        // const readableValue = ethers.formatUnits(BigInt(decryptedValue), 18);
        console.log("Decrypted raw value:", decryptedValue);
        // console.log("Readable balance:", readableValue);
        // const instance = await init();
        // const instance = await createInstance(SepoliaConfig);
        // console.log(`relayer instan:${instance}`);
        // let fhe = getFheInstance();
        // if (!fhe) throw new Error('Failed to initialize FHE instance');
        // initializeFheInstance();

        // const decryptBalance = await decryptValue(encryptedBalanceBytes);
        // console.log(`Decrypted amount:${decryptBalance}`);
        // const fhe = await init();
        // console.log(`fhe init compile`);
        // return callData;
        return decryptedValue;
        // 4. Decrypt (using Zama instance)
        // const relayer = await getZamaInstance();
        // const decrypted = await relayer.userDecrypt({
        //     ciphertext: encryptedBalanceBytes,
        //     userAddress: userAddress,
        //     dataType: "euint64",
        //     contractAddress: PRIVACY_TOKEN_ADDRESS,
        // });
        //
        // console.log("Decrypted balance:", decrypted.plaintext);
        // return Number(decrypted.plaintext);
    } catch (error) {
        console.error("Failed to query balance (detailed error):", error);
        throw new Error(`Failed to query balance: ${error.message}`);
    }
};

// export const decryptNoteBalance = async (encryptedBalance) => {
//     if (!window.ethereum) throw new Error("Please connect wallet");
//     const provider = new ethers.BrowserProvider(window.ethereum);
//     const signer = await provider.getSigner();
//     const userAddress = await signer.getAddress();
//     const result = await getZamaInstance().userDecrypt({
//         ciphertext: encryptedBalance,      // Encrypted data returned by contract
//         userAddress: userAddress,         // Address of user authorized for decryption
//         dataType: 'euint64',              // Data type (matches contract)
//         contractAddress: PRIVACY_VOTE_ADDRESS, // Optional: verify data source
//     });
//     return Number(result.plaintext);    // Convert plaintext balance to number
// };