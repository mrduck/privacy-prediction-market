// Type declarations for window object extensions
declare global {
    interface Window {
        ethereum?: any;
        relayerSDK?: any;
        RelayerSDK?: any;
    }
}

let fheInstance: any = null;

/**
 * Initialize FHEVM instance
 * Uses CDN for browser environments to avoid bundling issues
 */
export async function initializeFheInstance() {
    // Return existing instance if already initialized
    if (fheInstance) {
        console.log('FHEVM instance already initialized, returning existing instance');
        return fheInstance;
    }

    console.log(`initializeFheInstance window.ethereum:`, window.ethereum);
    console.log(`initializeFheInstance window.relayerSDK:`, window.relayerSDK);

    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.');
    }

    // Check for both uppercase and lowercase versions of RelayerSDK
    let sdk = window.RelayerSDK || window.relayerSDK;
    console.log(`initialize sdk:`, sdk);

    if (!sdk) {
        throw new Error('RelayerSDK not loaded. Please include the script tag in your HTML:\n<script src="https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs"></script>');
    }

    const { initSDK, createInstance, SepoliaConfig } = sdk;
    console.log(`initialize sdk2:`, sdk);

    try {
        await initSDK(); // Loads WASM
        const config = { ...SepoliaConfig, network: window.ethereum };
        fheInstance = await createInstance(config);
        console.log('✅ FHEVM instance created successfully');
        return fheInstance;
    } catch (err) {
        console.error('initialize FHEVM instance creation failed:', err);
        throw err;
    }
}

/**
 * Get the current FHEVM instance
 * Returns null if not initialized
 */
export function getFheInstance() {
    return fheInstance;
}