"use client"

import { useEffect, useState } from 'react'
import { publicClient } from '@/lib/clients'
import { RWA_ADDRESS, ERC6551_REGISTRY_ABI, ERC20_ABI, MOCK_USDC_ADDRESS, ERC6551_REGISTRY_ADDRESS, ERC6551_IMPLEMENTATION_ADDRESS } from '../constants'
import { Address, formatUnits } from 'viem'

type RWAView = {
  tokenId: number
  tokenURI: string
  tba: string
  usdcBalance: string
}

// Assumptions: salt = 0, initData empty, chainId constant matches deployed chain.
const SALT = BigInt(0)

export default function RWACatalog() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RWAView[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        // Read totalSupply from RWA
        const totalSupply = await publicClient.readContract({
          address: RWA_ADDRESS,
          abi: [
            { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
            { type: 'function', name: 'tokenURI', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
          ] as const,
          functionName: 'totalSupply'
        }) as bigint

        const decimals = !MOCK_USDC_ADDRESS.startsWith('0x...') ? await publicClient.readContract({
          address: MOCK_USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }) as number : 6

        const views: RWAView[] = []
  for (let i = BigInt(0); i < totalSupply; i++) {
          const tokenURI = await publicClient.readContract({
            address: RWA_ADDRESS,
            abi: [
              { type: 'function', name: 'tokenURI', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
            ] as const,
            functionName: 'tokenURI',
            args: [i]
          }) as string

          // Derive TBA address via registry.account(...) if registry addresses provided
          let tba: Address = '0x0000000000000000000000000000000000000000'
          if (!ERC6551_REGISTRY_ADDRESS.startsWith('0x...') && !ERC6551_IMPLEMENTATION_ADDRESS.startsWith('0x...')) {
            tba = await publicClient.readContract({
              address: ERC6551_REGISTRY_ADDRESS,
              abi: ERC6551_REGISTRY_ABI,
              functionName: 'account',
              args: [
                ERC6551_IMPLEMENTATION_ADDRESS,
                BigInt(publicClient.chain!.id),
                RWA_ADDRESS,
                i,
                SALT,
              ]
              }) as Address
          }

          // USDC balance
          let usdcBalanceStr = '0'
            if (!MOCK_USDC_ADDRESS.startsWith('0x...') && tba !== '0x0000000000000000000000000000000000000000') {
              const bal = await publicClient.readContract({
                address: MOCK_USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [tba as Address]
              }) as bigint
              usdcBalanceStr = formatUnits(bal, decimals)
            }

          views.push({ tokenId: Number(i), tokenURI, tba, usdcBalance: usdcBalanceStr })
        }
        setItems(views)
      } catch (e: any) {
        setError(e?.message || 'Failed to load RWAs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div>Loading RWAs…</div>
  if (error) return <div className="text-red-400 text-sm">{error}</div>
  if (items.length === 0) return <div>No RWAs minted yet. Submit a governance proposal to mint the first one.</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map(item => (
        <div key={item.tokenId} className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">RWA #{item.tokenId}</div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800">TBA
              {item.tba.slice(0,6)}…{item.tba.slice(-4)}</span>
          </div>
          <div className="text-xs break-all text-zinc-400">URI: {item.tokenURI}</div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-zinc-300">USDC Balance</div>
            <div className="font-mono">{item.usdcBalance}</div>
          </div>
          <div className="text-[10px] text-zinc-500">Revenue accumulates in the Token Bound Account. Use governance to extract.</div>
        </div>
      ))}
    </div>
  )
}