"use client"

import { useEffect, useState } from 'react'
import { Address, formatEther } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { GOV_TOKEN_ADDRESS } from '../constants'
import { publicClient } from '@/lib/clients'
import { shortAddress } from '@/lib/wallet'

const ERC20VOTES_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getVotes', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'delegates', inputs: [{ type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'delegate', inputs: [{ type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
] as const

type TokenInfo = {
  balance: string
  votes: string
  delegatee: Address | null
}

export default function GovTokenInfo() {
  const { address, isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })
  
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customAddr, setCustomAddr] = useState('')
  const [mounted, setMounted] = useState(false)

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!address || !mounted) {
      setInfo(null)
      return
    }

    let isMounted = true
    const fetch = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const results = await Promise.allSettled([
          publicClient.readContract({
            address: GOV_TOKEN_ADDRESS,
            abi: ERC20VOTES_ABI,
            functionName: 'balanceOf',
            args: [address],
          }),
          publicClient.readContract({
            address: GOV_TOKEN_ADDRESS,
            abi: ERC20VOTES_ABI,
            functionName: 'getVotes',
            args: [address],
          }),
          publicClient.readContract({
            address: GOV_TOKEN_ADDRESS,
            abi: ERC20VOTES_ABI,
            functionName: 'delegates',
            args: [address],
          }),
        ])

        if (!isMounted) return

        // Handle individual failures gracefully
        const balance = results[0].status === 'fulfilled' && results[0].value ? BigInt(results[0].value as any) : BigInt(0)
        const votes = results[1].status === 'fulfilled' && results[1].value ? BigInt(results[1].value as any) : BigInt(0)
        const delegatee = results[2].status === 'fulfilled' ? (results[2].value as Address) : null

        if (isMounted) {
          setInfo({
            balance: formatEther(balance),
            votes: formatEther(votes),
            delegatee,
          })
        }
      } catch (e: any) {
        if (isMounted) {
          console.error('Token info fetch failed:', e)
          setError('Failed to load token info. Contract may not be deployed.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetch()
    return () => { isMounted = false }
  }, [address, mounted])

  const handleDelegate = (to: Address) => {
    if (!address) return
    setError(null)
    
    writeContract({
      address: GOV_TOKEN_ADDRESS,
      abi: ERC20VOTES_ABI,
      functionName: 'delegate',
      args: [to],
      chainId: sepolia.id,
    }, {
      onSuccess: () => {
        window.location.reload()
      },
      onError: (err) => {
        console.error('Delegate failed:', err)
        setError(err.message || 'Delegation failed')
      }
    })
  }

  const isDelegating = isPending || isConfirming

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Governance Token</h2>
        <div className="h-20 bg-zinc-900 animate-pulse rounded" />
      </section>
    )
  }

  if (!isConnected) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Governance Token</h2>
        <p className="text-sm text-zinc-400">Connect your wallet to view token balance and voting power.</p>
      </section>
    )
  }

  if (loading && !info) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Governance Token</h2>
        <p className="text-sm text-zinc-400">Loading...</p>
      </section>
    )
  }

  const isDelegated = info?.delegatee && info.delegatee !== '0x0000000000000000000000000000000000000000'
  const isDelegatedToSelf = isDelegated && info.delegatee?.toLowerCase() === address?.toLowerCase()

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Governance Token</h2>
      
      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {info && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-zinc-400">Balance</div>
              <div className="font-mono">{parseFloat(info.balance).toFixed(2)} GOV</div>
            </div>
            <div>
              <div className="text-zinc-400">Voting Power</div>
              <div className="font-mono">{parseFloat(info.votes).toFixed(2)} votes</div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <div className="text-sm text-zinc-400 mb-2">Delegation</div>
            {!isDelegated && (
              <p className="text-xs text-orange-400 mb-2">⚠ Not delegated - you can't vote yet!</p>
            )}
            {isDelegatedToSelf && (
              <p className="text-xs text-green-400 mb-2">✓ Delegated to yourself</p>
            )}
            {isDelegated && !isDelegatedToSelf && (
              <p className="text-xs text-blue-400 mb-2">
                Delegated to: {shortAddress(info.delegatee!)}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleDelegate(address!)}
                disabled={isDelegating || !address}
                className="btn btn-primary text-xs py-1 px-3"
              >
                {isDelegating ? 'Delegating...' : 'Delegate to Self'}
              </button>
              <input
                type="text"
                placeholder="0x..."
                value={customAddr}
                onChange={(e) => setCustomAddr(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
              />
              <button
                onClick={() => customAddr && handleDelegate(customAddr as Address)}
                disabled={isDelegating || !address || !customAddr}
                className="btn btn-secondary text-xs py-1 px-3"
              >
                Delegate
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}