"use client"

import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { gaslessVoteDAO } from '@/lib/accountAbstraction'

type VoteProps = {
  proposalId: bigint
  onSuccess?: () => void
}

export default function Vote({ proposalId, onSuccess }: VoteProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const castVote = async (support: number) => {
    if (!isConnected || !address) {
      setStatus('error')
      setMessage('Please connect your wallet')
      return
    }

    if (!walletClient) {
      setStatus('error')
      setMessage('Wallet client not ready')
      return
    }

    try {
      setStatus('pending')
      setMessage(null)
      setTxHash(null)

      // Use relayer gasless flow
      const hash = await gaslessVoteDAO(walletClient, address, proposalId, support)
      setStatus('success')
      setMessage(`Vote cast successfully!`)
      setTxHash(hash)
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess()
        setStatus('idle')
        setMessage(null)
      }, 5000)
    } catch (err: any) {
      console.error('Vote error:', err)
      setStatus('error')
      setMessage(err.message || 'Failed to cast vote')
      setTimeout(() => {
        setStatus('idle')
        setMessage(null)
      }, 5000)
    }
  }

  if (!isConnected) {
    return (
      <div className="card bg-zinc-900/50">
        <p className="text-sm text-zinc-400">Connect your wallet to vote</p>
      </div>
    )
  }

  return (
    <section className="card">
      <h3 className="text-lg font-semibold mb-4">Cast Your Vote (Gasless)</h3>
      
      <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded">
        <div className="text-xs text-purple-300 mb-1">⚡ Relayer-Powered Gasless Voting</div>
        <div className="text-xs text-zinc-400">
          Gas fees are paid by the relayer wallet 🎉
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => castVote(1)}
          disabled={status === 'pending'}
          className="btn-primary flex-1"
        >
          {status === 'pending' ? '⏳ Processing...' : '✓ For'}
        </button>
        <button
          onClick={() => castVote(0)}
          disabled={status === 'pending'}
          className="btn-secondary flex-1"
        >
          {status === 'pending' ? '⏳ Processing...' : '✗ Against'}
        </button>
        <button
          onClick={() => castVote(2)}
          disabled={status === 'pending'}
          className="btn-secondary flex-1"
        >
          {status === 'pending' ? '⏳ Processing...' : '○ Abstain'}
        </button>
      </div>

      {status === 'error' && message && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded">
          <p className="text-sm text-red-400">✗ {message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500/50 rounded">
          <p className="text-sm text-green-400">✓ Vote submitted successfully!</p>
          {txHash && (
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      )}

      {status === 'pending' && (
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/50 rounded animate-pulse">
          <p className="text-sm text-blue-400">
            🔄 Submitting vote via relayer...
          </p>
        </div>
      )}
    </section>
  )
}
