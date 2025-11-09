"use client";

import { 
  Address, 
  type WalletClient,
} from 'viem';
import { CONTRACTS, DAO_ABI, RWAGOVERNOR_ABI } from '@/contracts';

export async function gaslessVoteDAO(
  walletClient: WalletClient,
  userAddress: Address,
  proposalId: bigint,
  support: number
): Promise<string> {
  try {
    const response = await fetch('/api/relay/vote-dao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        proposalId: proposalId.toString(),
        support,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Relayer failed');
    }

    return result.txHash;
  } catch (error) {
    console.error('Gasless vote DAO failed:', error);
    throw error;
  }
}

export async function gaslessVoteRWA(
  walletClient: WalletClient,
  userAddress: Address,
  rwaGovernorAddress: Address,
  proposalId: bigint,
  support: number
): Promise<string> {
  try {
    const response = await fetch('/api/relay/vote-rwa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        rwaGovernorAddress,
        proposalId: proposalId.toString(),
        support,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Relayer failed');
    }

    return result.txHash;
  } catch (error) {
    console.error('Gasless vote RWA failed:', error);
    throw error;
  }
}

export async function gaslessFinalize(
  proposalId: bigint
): Promise<string> {
  try {
    const response = await fetch('/api/relay/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: proposalId.toString(),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Relayer failed');
    }

    return result.txHash;
  } catch (error) {
    console.error('Gasless finalize failed:', error);
    throw error;
  }
}

export async function getRelayerBalance(): Promise<bigint> {
  try {
    const response = await fetch('/api/relay/balance');
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Relayer balance API error:', result);
      throw new Error(result.error || 'Failed to get relayer balance');
    }
    
    if (!result.balance) {
      console.error('No balance in response:', result);
      return BigInt(0);
    }
    
    return BigInt(result.balance);
  } catch (error) {
    console.error('Failed to get relayer balance:', error);
    return BigInt(0);
  }
}

