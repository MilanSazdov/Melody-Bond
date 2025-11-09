import { NextRequest, NextResponse } from 'next/server';
import { getRelayerWallet } from '@/lib/relayer';
import { publicClient } from '@/lib/clients';
import { CONTRACTS, DAO_ABI } from '@/contracts';

export async function POST(request: NextRequest) {
  try {
    const { proposalId } = await request.json();

    if (proposalId === undefined) {
      return NextResponse.json(
        { error: 'Missing proposalId' },
        { status: 400 }
      );
    }

    const relayer = getRelayerWallet();

    // Finalize proposal through relayer
    const hash = await relayer.writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: 'finalizeProposal',
      args: [BigInt(proposalId)],
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
    console.error('Relayer finalize error:', error);
    return NextResponse.json(
      { error: error.message || 'Relayer failed' },
      { status: 500 }
    );
  }
}
