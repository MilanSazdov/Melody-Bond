"use client"

import { useEffect, useState } from 'react'
import { Address, Hex } from 'viem'
import { DAO_ADDRESS } from '../constants'
import { publicClient } from '@/lib/clients'
import ProposalItem from './ProposalItem'

export type Proposal = {
  id: bigint
  proposer: Address
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
  startBlock: bigint
  endBlock: bigint
  description: string
}

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let isMounted = true

    const fetchProposals = async () => {
      try {
        setLoading(true)
        setError(null)

        const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || '0')
        const currentBlock = await publicClient.getBlockNumber()
        const fromBlock = DEPLOY_BLOCK

        const logs = await publicClient.getLogs({
          address: DAO_ADDRESS,
          event: {
            type: 'event',
            name: 'ProposalCreated',
            inputs: [
              { type: 'uint256', name: 'proposalId', indexed: false },
              { type: 'address', name: 'proposer', indexed: false },
              { type: 'address[]', name: 'targets', indexed: false },
              { type: 'uint256[]', name: 'values', indexed: false },
              { type: 'string[]', name: 'signatures', indexed: false },
              { type: 'bytes[]', name: 'calldatas', indexed: false },
              { type: 'uint256', name: 'startBlock', indexed: false },
              { type: 'uint256', name: 'endBlock', indexed: false },
              { type: 'string', name: 'description', indexed: false },
            ],
          },
          fromBlock,
          toBlock: 'latest',
        })

        if (!logs || logs.length === 0) {
          if (isMounted) {
            setProposals([])
          }
          return
        }

        const parsed: Proposal[] = logs.map((log: any) => ({
          id: BigInt(log.args.proposalId),
          proposer: log.args.proposer as Address,
          targets: log.args.targets as Address[],
          values: (log.args.values as any[])?.map((v) => BigInt(v)) || [],
          calldatas: log.args.calldatas as Hex[],
          startBlock: BigInt(log.args.startBlock),
          endBlock: BigInt(log.args.endBlock),
          description: String(log.args.description || ''),
        }))

        if (isMounted) {
          // Sort by ID descending (newest first)
          setProposals(parsed.sort((a, b) => (b.id > a.id ? 1 : -1)))
        }
      } catch (e: any) {
        console.error('Failed to fetch proposals:', e)
        if (isMounted) {
          setError(e?.message || 'Failed to load proposals')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchProposals()
    return () => {
      isMounted = false
    }
  }, [mounted])

  if (loading) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Proposals</h2>
        <p className="text-sm text-zinc-400">Loading proposals...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Proposals</h2>
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
          {error}
        </div>
      </section>
    )
  }

  if (proposals.length === 0) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Proposals</h2>
        <p className="text-sm text-zinc-400">
          No proposals yet. Create the first one above!
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Proposals</h2>
      <div className="space-y-3">
        {proposals.map((proposal) => (
          <ProposalItem key={proposal.id.toString()} proposal={proposal} />
        ))}
      </div>
    </section>
  )
}
