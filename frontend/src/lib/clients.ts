import { createPublicClient, createWalletClient, custom, http, type PublicClient, type WalletClient } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_CONFIG, CONTRACTS } from '@/contracts';

// RPC configuration
export const rpcUrl = CHAIN_CONFIG.rpcUrl;
export const bundlerUrl = CHAIN_CONFIG.bundlerUrl;
export const entryPoint = CONTRACTS.ENTRYPOINT;

// Shared public client with batching and retry
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl, {
    batch: true,
    retryCount: 3,
    retryDelay: 1000,
  }),
});

// Create wallet client for signing transactions (requires browser wallet)
export function getWalletClient(): WalletClient | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  
  return createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });
}

// Helper to get current connected address
export async function getConnectedAddress(): Promise<`0x${string}` | null> {
  const walletClient = getWalletClient();
  if (!walletClient) return null;
  
  const [address] = await walletClient.getAddresses();
  return address || null;
}

// Helper to ensure wallet is connected
export async function ensureWalletConnected(): Promise<`0x${string}`> {
  const address = await getConnectedAddress();
  if (!address) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  return address;
}

// Helper to switch to Sepolia if needed
export async function ensureCorrectNetwork() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CHAIN_CONFIG.id.toString(16)}` }],
    });
  } catch (error: any) {
    // Chain not added, try to add it
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${CHAIN_CONFIG.id.toString(16)}`,
          chainName: CHAIN_CONFIG.name,
          rpcUrls: [CHAIN_CONFIG.rpcUrl],
        }],
      });
    } else {
      throw error;
    }
  }
}

// Helper: sleep for retry logic
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));