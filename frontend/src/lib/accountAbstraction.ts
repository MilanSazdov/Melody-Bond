"use client";

import { 
  Address, 
  type WalletClient,
} from 'viem';
import { CONTRACTS, DAO_ABI, RWAGOVERNOR_ABI } from '@/contracts';



/**
 * REMOVED: Gasless invest doesn't work
 * 
 * The DAO.invest() function does transferFrom(msg.sender, ...) which means it needs
 * to transfer USDC from the caller's wallet. If the relayer calls it, the contract
 * tries to take USDC from the relayer, not the user.
 * 
 * Solution: Users must call invest() directly and pay gas themselves.
 * They need to approve USDC anyway, so they're already making a transaction.
 */

/**
 * Gasless vote on main DAO proposal - relayer pays gas
 */
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

/**
 * Gasless vote on RWAGovernor proposal - relayer pays gas
 */
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

/**
 * Gasless finalize proposal - relayer pays gas
 */
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

/**
 * Get relayer balance for display purposes
 */
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

