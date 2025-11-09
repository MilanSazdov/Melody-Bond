import { NextResponse } from 'next/server';
import { getRelayerWallet } from '@/lib/relayer';
import { publicClient } from '@/lib/clients';

export async function GET() {
  try {
    console.log('[Relayer Balance] Fetching relayer wallet...');
    const relayer = getRelayerWallet();
    console.log('[Relayer Balance] Relayer address:', relayer.account.address);
    
    const balance = await publicClient.getBalance({
      address: relayer.account.address,
    });
    
    console.log('[Relayer Balance] Balance:', balance.toString());

    return NextResponse.json({
      balance: balance.toString(),
      address: relayer.account.address,
    });
  } catch (error: any) {
    console.error('[Relayer Balance] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance' },
      { status: 500 }
    );
  }
}
