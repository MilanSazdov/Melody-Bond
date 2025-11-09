"use client"

import { useState } from 'react'
import { useAccount, useSignTypedData, useReadContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { DAO_ADDRESS } from '../constants'

type VoteProps = {
  proposalId: bigint
  onSuccess?: () => void
}

const BALLOT_TYPEHASH = 'Ballot(uint256 proposalId,uint8 support,address voter,uint256 nonce)'

export default function Vote({ proposalId, onSuccess }: VoteProps) {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Get nonce for the voter
  const { data: nonce } = useReadContract({
    address: DAO_ADDRESS,
    abi: [
      {
        type: 'function',
        name: 'nonces',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      }
    ] as const,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  })

  const castVote = async (support: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet')
      return
    }

    if (nonce === undefined) {
      setError('Loading nonce...')
      return
    }

    try {
      setError(null)
      setSuccess(false)
      setIsLoading(true)

      // Sign the vote using EIP-712
      const signature = await signTypedDataAsync({
        domain: {
          name: 'RWA DAO',
          version: '1',
          chainId: sepolia.id,
          verifyingContract: DAO_ADDRESS,
        },
        types: {
          Ballot: [
            { name: 'proposalId', type: 'uint256' },
            { name: 'support', type: 'uint8' },
            { name: 'voter', type: 'address' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        primaryType: 'Ballot',
        message: {
          proposalId: proposalId,
          support: support,
          voter: address,
          nonce: nonce,
        },
      })

      // Submit the signed vote to our gasless relay API
      const response = await fetch('/api/gasless-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposalId.toString(),
          support,
          voter: address,
          signature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit vote')
      }

      setSuccess(true)
      setError(null)
      onSuccess?.()
    } catch (e: any) {
      console.error('Gasless vote failed:', e)
      setError(e?.message || 'Failed to cast vote')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="text-sm text-zinc-400">
        Connect your wallet to vote
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => castVote(1)}
          disabled={isLoading || nonce === undefined}
          className="btn btn-primary text-xs flex-1"
        >
          {isLoading ? 'Signing...' : '👍 For'}
        </button>
        <button
          onClick={() => castVote(0)}
          disabled={isLoading || nonce === undefined}
          className="btn btn-secondary text-xs flex-1"
        >
          {isLoading ? 'Signing...' : '👎 Against'}
        </button>
        <button
          onClick={() => castVote(2)}
          disabled={isLoading || nonce === undefined}
          className="btn btn-ghost text-xs flex-1"
        >
          {isLoading ? 'Signing...' : '🤷 Abstain'}
        </button>
      </div>

      <div className="text-xs text-zinc-500 flex items-center gap-1">
        ⚡ Gasless voting enabled - no gas fees!
      </div>

      {success && (
        <div className="text-xs text-green-400">
          ✓ Vote cast successfully (gasless)!
        </div>
      )}
      {error && (
        <div className="text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}