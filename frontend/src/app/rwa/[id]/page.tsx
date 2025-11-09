"use client"

import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import { Address } from 'viem'
import { useReadContract } from 'wagmi'
import {
  ERC6551_REGISTRY_ADDRESS,
  ERC6551_IMPLEMENTATION_ADDRESS,
  SEPOLIA_CHAIN_ID,
  RWA_ADDRESS,
  MOCK_USDC_ADDRESS,
  // MOCK_USDC_ABI,
  // ERC6551_REGISTRY_ABI,
} from '../../../constants'

// Minimal ABIs to avoid needing the full artifacts for this page
const ERC20_MIN_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const ERC6551_REGISTRY_MIN_ABI = [
  {
    type: 'function',
    name: 'account',
    stateMutability: 'view',
    inputs: [
      { name: 'implementation', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: 'account', type: 'address' }],
  },
] as const

export default function RwaPage() {
  const params = useParams<{ id: string }>()
  const tokenId = useMemo(() => BigInt(params?.id || '0'), [params])

  const { data: tbaAddress } = useReadContract({
    address: ERC6551_REGISTRY_ADDRESS as Address,
    abi: ERC6551_REGISTRY_MIN_ABI,
    functionName: 'account',
    args: [
      ERC6551_IMPLEMENTATION_ADDRESS as Address,
      BigInt(SEPOLIA_CHAIN_ID),
      RWA_ADDRESS as Address,
      tokenId,
      BigInt(0),
    ],
    query: {
      enabled:
        !String(ERC6551_REGISTRY_ADDRESS).startsWith('0x...') &&
        !String(ERC6551_IMPLEMENTATION_ADDRESS).startsWith('0x...'),
    },
  }) as { data?: Address }

  const { data: balance } = useReadContract({
    address: MOCK_USDC_ADDRESS as Address,
    abi: ERC20_MIN_ABI,
    functionName: 'balanceOf',
    args: [tbaAddress as Address],
    query: {
      enabled: !!tbaAddress && !String(MOCK_USDC_ADDRESS).startsWith('0x...'),
      refetchInterval: 5_000, // live effect
    },
  }) as { data?: bigint }

  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle={`Token-Bound Account view for RWA #${params?.id}`}
      />
      <section className="py-10">
        <div className="container max-w-3xl space-y-6">
          <div className="card space-y-2">
            <div className="text-sm text-zinc-400">TBA Address</div>
            <div className="font-mono break-all">
              {tbaAddress ?? 'Fill ERC6551 addresses in constants.ts'}
            </div>
          </div>
          <div className="card space-y-2">
            <div className="text-sm text-zinc-400">Mock USDC Balance</div>
            <div className="font-mono">
              {typeof balance !== 'undefined' ? balance.toString() : '—'}
            </div>
            <div className="text-xs text-zinc-500">Refreshes every 5s.</div>
          </div>
        </div>
      </section>
    </main>
  )
}