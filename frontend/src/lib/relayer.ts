// Server-side only relayer utilities
import { 
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export function getRelayerWallet() {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerKey) {
    throw new Error('RELAYER_PRIVATE_KEY not configured in environment variables');
  }
  
  const account = privateKeyToAccount(relayerKey as Hex);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  
  if (!rpcUrl) {
    throw new Error('NEXT_PUBLIC_RPC_URL not configured');
  }
  
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
}
