import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { getRelayerWallet } from '@/lib/relayer';
import { publicClient } from '@/lib/clients';
import { RWAGOVERNOR_ABI } from '@/contracts';

export async function POST(request: NextRequest) {
  try {
    const { userAddress, rwaGovernorAddress, proposalId, support } = await request.json();

    if (!userAddress || !rwaGovernorAddress || proposalId === undefined || support === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const relayer = getRelayerWallet();

    // Cast vote on RWA Governor through relayer
    const hash = await relayer.writeContract({
      address: rwaGovernorAddress as Address,
      abi: RWAGOVERNOR_ABI,
      functionName: 'castVote',
      args: [BigInt(proposalId), support],
      account: relayer.account,
      chain: relayer.chain,
    });

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      txHash: hash,
      success: receipt.status === 'success',
    });
  } catch (error: any) {
    console.error('Relayer vote RWA error:', error);
    return NextResponse.json(
      { error: error.message || 'Relayer failed' },
      { status: 500 }
    );
  }
}
