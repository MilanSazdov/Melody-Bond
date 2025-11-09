import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { getRelayerWallet } from '@/lib/relayer';
import { publicClient } from '@/lib/clients';
import { CONTRACTS, DAO_ABI } from '@/contracts';

export async function POST(request: NextRequest) {
  try {
    const { userAddress, proposalId, amount } = await request.json();

    if (!userAddress || !proposalId || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const relayer = getRelayerWallet();

    console.log('[Relayer] Processing invest request:');
    console.log('  User:', userAddress);
    console.log('  Proposal:', proposalId);
    console.log('  Amount:', amount);
    console.log('  Relayer address:', relayer.account.address);

    // NOTE: This invests using the RELAYER's address, not the user's address.
    // The user must have already approved USDC to the DAO contract.
    const hash = await relayer.writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: 'invest',
      args: [BigInt(proposalId), BigInt(amount)],
      account: relayer.account,
      chain: relayer.chain,
    });

    console.log('[Relayer] Invest transaction submitted:', hash);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('[Relayer] Transaction mined. Status:', receipt.status);
    console.log('[Relayer] Gas used:', receipt.gasUsed.toString());

    return NextResponse.json({
      txHash: hash,
      success: receipt.status === 'success',
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error: any) {
    console.error('Relayer invest error:', error);
    return NextResponse.json(
      { error: error.message || 'Relayer failed' },
      { status: 500 }
    );
  }
}
