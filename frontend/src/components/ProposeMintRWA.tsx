"use client"

import { useState, useEffect } from 'react'
import { Address, encodeFunctionData, isAddress } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { DAO_ADDRESS, RWA_ADDRESS } from '../constants'
import { publicClient } from '@/lib/clients'

const DAO_ABI = [
  {
    type: 'function',
    name: 'propose',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

const RWA_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

export default function ProposeMintRWA() {
  const { address, isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })
  
  const [uri, setUri] = useState<string>('ipfs://')
  const [description, setDescription] = useState<string>('Mint a new RWA NFT to DAO Treasury')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) {
      setError('Please connect your wallet first')
      return
    }

    // Validation
    if (!uri.startsWith('ipfs://')) {
      setError('Token URI must start with ipfs://')
      return
    }
    if (!description.trim()) {
      setError('Description is required')
      return
    }

    setError(null)
    setMessage(null)

    // Mint to DAO address (treasury)
    const calldata = encodeFunctionData({
      abi: RWA_ABI,
      functionName: 'mint',
      args: [DAO_ADDRESS, uri],
    })

    // Include IPFS URI in description so it can be displayed later
    const fullDescription = `${description}\n\nToken URI: ${uri}`

    writeContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: 'propose',
      args: [[RWA_ADDRESS], [BigInt(0)], [calldata], fullDescription],
      chainId: sepolia.id,
    }, {
      onSuccess: () => {
        setMessage('✓ Proposal submitted successfully!')
        // Clear form
        setUri('ipfs://')
        setDescription('Mint a new RWA NFT to DAO Treasury')
      },
      onError: (err) => {
        console.error('Proposal submission failed:', err)
        setError(err.message || 'Failed to submit proposal')
      }
    })
  }

  const isLoading = isPending || isConfirming

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Create Proposal: Mint RWA</h2>
        <div className="h-40 bg-zinc-900 animate-pulse rounded" />
      </section>
    )
  }

  if (!isConnected) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Create Proposal: Mint RWA</h2>
        <p className="text-sm text-zinc-400">Connect your wallet to create proposals.</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Create Proposal: Mint RWA</h2>
      
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded p-3 mb-3">
          <div className="text-xs text-zinc-500 mb-1">Recipient (Treasury)</div>
          <div className="text-sm font-mono text-emerald-400">{DAO_ADDRESS}</div>
          <div className="text-xs text-zinc-500 mt-1">NFT will be minted to the DAO treasury</div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Token URI (IPFS)</label>
          <input
            type="text"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-zinc-700 focus:outline-none"
            placeholder="ipfs://..."
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            required
          />
          <p className="text-xs text-zinc-500 mt-1">Must start with ipfs://</p>
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Proposal Description</label>
          <textarea
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-zinc-700 focus:outline-none"
            placeholder="Describe this proposal..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
          />
        </div>

        <button
          type="submit"
          disabled={!address || isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading ? 'Submitting...' : 'Submit Proposal'}
        </button>

        {message && (
          <div className="p-2 bg-green-900/20 border border-green-800 rounded text-sm text-green-400">
            {message}
          </div>
        )}
        {error && (
          <div className="p-2 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
            {error}
          </div>
        )}
      </form>
    </section>
  )
}