'use client'

import { useState } from 'react'
import { Address } from 'viem'
import { useWalletClient, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { RWAProposal } from '@/lib/rwaGovernance'
import { RWA_GOVERNOR_ABI } from '@/constants'
import { VoteSupport } from '@/contracts'

type RWAVoteProps = {
  proposal: RWAProposal
  governorAddress: Address
  userShares: bigint
  onVoteSuccess?: () => void
}

export default function RWAVote({ proposal, governorAddress, userShares, onVoteSuccess }: RWAVoteProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [voting, setVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes
  const forPercentage = totalVotes > 0n ? Number((proposal.forVotes * 100n) / totalVotes) : 0
  const againstPercentage = totalVotes > 0n ? Number((proposal.againstVotes * 100n) / totalVotes) : 0
  const abstainPercentage = totalVotes > 0n ? Number((proposal.abstainVotes * 100n) / totalVotes) : 0

  const isActive = proposal.state === 1 // Active state
  const isExecuted = proposal.executed

  const castVote = async (support: VoteSupport) => {
    if (!walletClient || !address) {
      alert('Please connect your wallet')
      return
    }

    if (userShares === 0n) {
      alert('You have no voting power for this RWA')
      return
    }

    setVoting(true)
    try {
      const hash = await walletClient.writeContract({
        address: governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'castVote',
        args: [BigInt(proposal.proposalId), support],
      })

      // Wait for transaction confirmation
      const { createPublicClient, http } = await import('viem')
      const publicClient = createPublicClient({
        transport: http(process.env.NEXT_PUBLIC_RPC_URL),
      })
      
      await publicClient.waitForTransactionReceipt({ hash })
      
      setHasVoted(true)
      alert('Vote cast successfully!')
      
      if (onVoteSuccess) {
        onVoteSuccess()
      }
    } catch (error: any) {
      console.error('Error casting vote:', error)
      if (error.message?.includes('already voted')) {
        alert('You have already voted on this proposal')
        setHasVoted(true)
      } else if (error.code === 4001) {
        // User rejected
        return
      } else {
        alert('Failed to cast vote: ' + (error.message || 'Unknown error'))
      }
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 mb-4 hover:border-gray-600 transition-colors">
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{proposal.description}</h3>
            <div className="flex gap-2 mt-2">
              <span className={`inline-block px-2 py-1 text-xs rounded ${getStateColor(proposal.state)}`}>
                {getStateText(proposal.state)}
              </span>
              {proposal.type && (
                <span className="inline-block px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                  {formatProposalType(proposal.type)}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-500">RWA #{proposal.nftId.toString()}</span>
        </div>

        <p className="text-xs text-gray-500 mt-2">Proposal ID: {proposal.proposalId}</p>
      </div>

      {/* Vote Distribution */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Vote Distribution</span>
          <span className="text-gray-400">Total: {formatUnits(totalVotes, 18)} votes</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{forPercentage.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">For</div>
            <div className="text-xs font-semibold text-gray-300">{formatUnits(proposal.forVotes, 18)}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{againstPercentage.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Against</div>
            <div className="text-xs font-semibold text-gray-300">{formatUnits(proposal.againstVotes, 18)}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{abstainPercentage.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Abstain</div>
            <div className="text-xs font-semibold text-gray-300">{formatUnits(proposal.abstainVotes, 18)}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500"
            style={{ width: `${forPercentage}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${againstPercentage}%` }}
          />
          <div
            className="bg-gray-500"
            style={{ width: `${abstainPercentage}%` }}
          />
        </div>
      </div>

      {/* Your Voting Power */}
      <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-800/50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-300">Your Voting Power:</span>
          <span className="font-bold text-emerald-400">{formatUnits(userShares, 18)} shares</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Your vote will be weighted by your share ownership
        </p>
      </div>

      {/* Voting Buttons */}
      {isActive && !hasVoted && !isExecuted && (
        <div className="flex gap-2">
          <button
            onClick={() => castVote(VoteSupport.For)}
            disabled={voting || userShares === 0n}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {voting ? 'Voting...' : 'Vote For'}
          </button>
          <button
            onClick={() => castVote(VoteSupport.Against)}
            disabled={voting || userShares === 0n}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {voting ? 'Voting...' : 'Vote Against'}
          </button>
          <button
            onClick={() => castVote(VoteSupport.Abstain)}
            disabled={voting || userShares === 0n}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {voting ? 'Voting...' : 'Abstain'}
          </button>
        </div>
      )}

      {hasVoted && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-center">
          <p className="text-green-300 font-semibold">✓ You have voted on this proposal</p>
        </div>
      )}

      {!isActive && !isExecuted && (
        <div className="p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-center">
          <p className="text-gray-400">Voting is not currently active for this proposal</p>
        </div>
      )}

      {isExecuted && (
        <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-center">
          <p className="text-blue-300 font-semibold">✓ This proposal has been executed</p>
        </div>
      )}
    </div>
  )
}

function getStateText(state: number): string {
  const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
  return states[state] || 'Unknown'
}

function getStateColor(state: number): string {
  const colors = [
    'bg-yellow-900/30 border border-yellow-800/50 text-yellow-400', // Pending
    'bg-green-900/30 border border-green-800/50 text-green-400',   // Active
    'bg-gray-900/30 border border-gray-800/50 text-gray-400',     // Canceled
    'bg-red-900/30 border border-red-800/50 text-red-400',       // Defeated
    'bg-blue-900/30 border border-blue-800/50 text-blue-400',     // Succeeded
    'bg-purple-900/30 border border-purple-800/50 text-purple-400', // Queued
    'bg-orange-900/30 border border-orange-800/50 text-orange-400', // Expired
    'bg-indigo-900/30 border border-indigo-800/50 text-indigo-400', // Executed
  ]
  return colors[state] || 'bg-gray-900/30 border border-gray-800/50 text-gray-400'
}

function formatProposalType(type: string): string {
  const map: Record<string, string> = {
    changeName: 'Change Name',
    changeImage: 'Change Image',
    withdraw: 'Withdraw Funds',
    other: 'Other',
  }
  return map[type] || type
}
