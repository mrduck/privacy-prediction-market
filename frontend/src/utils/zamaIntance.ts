let fheInstance: any = null;

/**
 * Initialize FHEVM instance
 * Uses CDN for browser environments to avoid bundling issues
 */
export async function initializeFheInstance() {
    console.log(`initializeFheInstance window.ethereum:`,window.ethereum);
    console.log(`initializeFheInstance window.relayerSDK:`,window.relayerSDK);
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.');
    }

    // Check for both uppercase and lowercase versions of RelayerSDK
    let sdk = (window as any).RelayerSDK || (window as any).relayerSDK;
    console.log(`initialize sdk:`,sdk);
    if (!sdk) {
        throw new Error('RelayerSDK not loaded. Please include the script tag in your HTML:\n<script src="https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs"></script>');
    }

    const { initSDK, createInstance, SepoliaConfig } = sdk;
    console.log(`initialize sdk2:`,sdk);
    await initSDK(); // Loads WASM
    const config = { ...SepoliaConfig, network: window.ethereum };

    try {
        fheInstance = await createInstance(config);
        return fheInstance;
    } catch (err) {
        console.error('initialize FHEVM instance creation failed:', err);
        throw err;
    }
}