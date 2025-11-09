import { NextRequest, NextResponse } from 'next/server';
import { getRelayerWallet } from '@/lib/relayer';
import { publicClient } from '@/lib/clients';
import { CONTRACTS, DAO_ABI } from '@/contracts';

export async function POST(request: NextRequest) {
  try {
    const { userAddress, proposalId, support } = await request.json();

    if (!userAddress || proposalId === undefined || support === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const relayer = getRelayerWallet();

    console.log('[Relayer] Processing vote request:');
    console.log('  User:', userAddress);
    console.log('  Proposal:', proposalId);
    console.log('  Support:', support);
    console.log('  Relayer address:', relayer.account.address);

    // NOTE: This casts the vote using the RELAYER's address, not the user's address.
    // The DAO will record the vote as coming from the relayer.
    // For vote attribution to the user's address, you would need to implement
    // a meta-transaction pattern or use ERC-4337 account abstraction.
    const hash = await relayer.writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: 'castVote',
      args: [BigInt(proposalId), support],
      account: relayer.account,
      chain: relayer.chain,
    });

    console.log('[Relayer] Vote transaction submitted:', hash);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('[Relayer] Transaction mined. Status:', receipt.status);
    console.log('[Relayer] Gas used:', receipt.gasUsed.toString());

    return NextResponse.json({
      txHash: hash,
      success: receipt.status === 'success',
      gasUsed: receipt.gasUsed.toString(),
      relayerAddress: relayer.account.address,
    });
  } catch (error: any) {
    console.error('[Relayer] Vote DAO error:', error);
    return NextResponse.json(
      { error: error.message || 'Relayer failed' },
      { status: 500 }
    );
  }
}
