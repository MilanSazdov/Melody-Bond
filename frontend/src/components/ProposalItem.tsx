"use client"

import { useEffect, useState } from 'react'
import { Address, Hex, keccak256, toHex } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { DAO_ADDRESS } from '../constants'
import { publicClient } from '@/lib/clients'
import { shortAddress } from '@/lib/wallet'
import Vote from './Vote'

type Proposal = {
  id: bigint
  proposer: Address
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
  startBlock: bigint
  endBlock: bigint
  description: string
}

const DAO_ABI = [
  {
    type: 'function',
    name: 'state',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proposalVotes',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'againstVotes', type: 'uint256' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proposalNeedsQueuing',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'queue',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'descriptionHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'descriptionHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

const stateLabels: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
}

const stateColors: Record<string, string> = {
  Pending: 'bg-zinc-700',
  Active: 'bg-blue-600',
  Succeeded: 'bg-emerald-600',
  Queued: 'bg-amber-600',
  Executed: 'bg-purple-600',
  Defeated: 'bg-red-600',
  Canceled: 'bg-zinc-600',
  Expired: 'bg-orange-600',
}

export default function ProposalItem({ proposal }: { proposal: Proposal }) {
  const { address } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })
  
  const [state, setState] = useState<number | null>(null)
  const [needsQueue, setNeedsQueue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ipfsData, setIpfsData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [votes, setVotes] = useState<{ against: bigint; for: bigint; abstain: bigint } | null>(null)

  const descriptionHash = keccak256(toHex(proposal.description))

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch proposal state
  useEffect(() => {
    if (!mounted) return
    let isMounted = true

    const fetch = async () => {
      try {
        setLoading(true)
        const [stateResult, queueResult, votesResult] = await Promise.all([
          publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'state',
            args: [proposal.id],
          }) as Promise<number>,
          publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'proposalNeedsQueuing',
            args: [proposal.id],
          }) as Promise<boolean>,
          publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'proposalVotes',
            args: [proposal.id],
          }) as Promise<[bigint, bigint, bigint]>,
        ])

        if (isMounted) {
          setState(Number(stateResult))
          setNeedsQueue(Boolean(queueResult))
          setVotes({
            against: votesResult[0],
            for: votesResult[1],
            abstain: votesResult[2],
          })
        }
      } catch (e: any) {
        console.error('Failed to load proposal state:', e)
        if (isMounted) setError('Failed to load state')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetch()
    return () => {
      isMounted = false
    }
  }, [proposal.id, mounted])

  // Fetch IPFS metadata if description contains ipfs://
  useEffect(() => {
    const ipfsMatch = proposal.description.match(/ipfs:\/\/([a-zA-Z0-9]+)/)
    if (!ipfsMatch) return

    const cid = ipfsMatch[1]
    fetch(`https://ipfs.io/ipfs/${cid}`)
      .then((r) => r.json())
      .then((data) => setIpfsData(data))
      .catch((e) => console.warn('Failed to fetch IPFS data:', e))
  }, [proposal.description])

  const handleQueue = () => {
    if (!address) return
    setError(null)
    
    writeContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: 'queue',
      args: [proposal.targets, proposal.values, proposal.calldatas, descriptionHash],
      chainId: sepolia.id,
    }, {
      onSuccess: () => {
        window.location.reload()
      },
      onError: (err) => {
        console.error('Queue failed:', err)
        setError(err.message || 'Failed to queue')
      }
    })
  }

  const handleExecute = () => {
    if (!address) return
    setError(null)
    
    writeContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: 'execute',
      args: [proposal.targets, proposal.values, proposal.calldatas, descriptionHash],
      value: BigInt(0),
      chainId: sepolia.id,
    }, {
      onSuccess: () => {
        window.location.reload()
      },
      onError: (err) => {
        console.error('Execute failed:', err)
        setError(err.message || 'Failed to execute')
      }
    })
  }

  const isBusy = isPending || isConfirming

  const stateLabel = state !== null ? stateLabels[state] ?? String(state) : 'Loading...'
  const stateColor = stateColors[stateLabel] ?? 'bg-zinc-800'

  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{proposal.id.toString()}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${stateColor}`}>
              {stateLabel}
            </span>
          </div>
          <p className="text-sm text-zinc-400 break-words">{proposal.description}</p>
        </div>
      </div>

      {/* IPFS Metadata Display */}
      {ipfsData && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
          {ipfsData.image && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-950">
              <img 
                src={ipfsData.image.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                alt={ipfsData.name || 'NFT Image'} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {ipfsData.name && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">NFT Name</span>
              <h3 className="text-lg font-semibold text-white mt-1">{ipfsData.name}</h3>
            </div>
          )}
          {ipfsData.description && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Description</span>
              <p className="text-sm text-zinc-300 mt-1">{ipfsData.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Vote Counts */}
      {votes && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Vote Results</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-400">✓ For</span>
              <span className="font-mono text-sm font-semibold text-emerald-400">
                {votes.for.toString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">✗ Against</span>
              <span className="font-mono text-sm font-semibold text-red-400">
                {votes.against.toString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">○ Abstain</span>
              <span className="font-mono text-sm font-semibold text-zinc-400">
                {votes.abstain.toString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Proposer */}
      <div className="text-xs text-zinc-500">
        Proposer: {shortAddress(proposal.proposer)}
      </div>

      {/* Actions */}
      {!loading && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          {state === 1 && <Vote proposalId={proposal.id} onSuccess={() => window.location.reload()} />}
          
          {state === 4 && needsQueue && (
            <button
              onClick={handleQueue}
              disabled={!address || isBusy}
              className="btn btn-primary w-full text-sm"
            >
              {isBusy ? 'Queueing...' : 'Queue Proposal'}
            </button>
          )}

          {state === 5 && (
            <button
              onClick={handleExecute}
              disabled={!address || isBusy}
              className="btn btn-primary w-full text-sm"
            >
              {isBusy ? 'Executing...' : 'Execute Proposal'}
            </button>
          )}

          {error && (
            <div className="text-xs text-red-400 p-2 bg-red-900/20 border border-red-800 rounded">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
