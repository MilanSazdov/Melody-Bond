"use client"

import PageHeader from '@/components/PageHeader'
import Proposals from '@/components/Proposals'
import ProposeMintRWA from '@/components/ProposeMintRWA'
import PaymasterStatus from '@/components/PaymasterStatus'
import GovTokenInfo from '@/components/GovTokenInfo'
import Link from 'next/link'
import RWACatalog from '@/components/RWACatalog'
import { useAccount } from 'wagmi'
import { DAO_ABI, DAO_ADDRESS, MARKET_ADDRESS, VOTING_PAYMASTER_ADDRESS } from '../../constants'
import { useState } from 'react'
import { keccak256, parseAbiItem, parseEther, toHex } from 'viem'
import { publicClient } from '@/lib/clients'

const MARKET_ABI_MIN = [
  { type: 'function', name: 'assetsCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'pendingRevenue', stateMutability: 'view', inputs: [
    { name: 'assetId', type: 'uint256' },
    { name: 'user', type: 'address' },
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'claimRevenue', stateMutability: 'nonpayable', inputs: [
    { name: 'assetId', type: 'uint256' }
  ], outputs: [] },
  { type: 'function', name: 'depositRevenue', stateMutability: 'payable', inputs: [
    { name: 'assetId', type: 'uint256' }
  ], outputs: [] },
] as const

const PAYMASTER_ABI_MIN = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'getDeposit', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default function DemoPage() {
  const { address } = useAccount()
  const [fundAmt, setFundAmt] = useState('0.01')
  const [depositTx, setDepositTx] = useState<string | null>(null)
  const [depositErr, setDepositErr] = useState<string | null>(null)
  const [claimBusy, setClaimBusy] = useState<number | null>(null)
  const [claimErr, setClaimErr] = useState<string | null>(null)
  const [claimTx, setClaimTx] = useState<string | null>(null)
  const [streamAmt, setStreamAmt] = useState('0.002')
  const [streamAsset, setStreamAsset] = useState(0)
  const [streamTx, setStreamTx] = useState<string | null>(null)
  const [streamErr, setStreamErr] = useState<string | null>(null)
  const [endPid, setEndPid] = useState<string>('')
  const [endBusy, setEndBusy] = useState(false)
  const [endMsg, setEndMsg] = useState<string | null>(null)
  const [endErr, setEndErr] = useState<string | null>(null)

  const fundPaymaster = async () => {
    // TODO: Update to use useWriteContract hook
    setDepositErr('Demo feature temporarily disabled. Please use the Paymaster page.')
  }

  const claimRevenue = async (assetId: number) => {
    // TODO: Update to use useWriteContract hook
    setClaimErr('Demo feature temporarily disabled.')
  }

  const depositRevenue = async () => {
    // TODO: Update to use useWriteContract hook
    setStreamErr('Demo feature temporarily disabled.')
  }

  // End Session: finalize a proposal. If Succeeded -> queue (if needed) then try execute.
  const endSession = async () => {
    // TODO: Update to use useWriteContract hook
    // For now, use the Governance page to Queue/Execute proposals
    setEndErr('Please use the Governance page to Queue and Execute proposals.')
  }

  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle="Unified demo: create proposals, fund gasless voting, view transactions, revenue & assets."
      />
      <section className="py-10">
        <div className="container space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GovTokenInfo />
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold">Gasless Voting Paymaster</h2>
              <p className="text-xs text-zinc-400">Fund the paymaster deposit so castVote() calls are covered.</p>
              <div className="flex items-center gap-2">
                <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm w-28" value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
                <button className="btn btn-primary" disabled={!address} onClick={fundPaymaster}>Add Funds</button>
              </div>
              {depositTx && <a target="_blank" href={`https://sepolia.etherscan.io/tx/${depositTx}`} className="text-xs text-emerald-400 underline">View deposit tx (Sepolia)</a>}
              {depositErr && <div className="text-xs text-red-400">{depositErr}</div>}
              <PaymasterStatus />
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-sm font-semibold">Create Proposal</h2>
            <ProposeMintRWA />
            <p className="text-xs text-zinc-500">After voting period you can queue and execute successful proposals.</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Proposals</h2>
            <Proposals />
          </div>

          <div className="card space-y-3">
            <h2 className="text-sm font-semibold">End Session (Finalize Proposal)</h2>
            <p className="text-xs text-zinc-400">Enter a proposal ID. If it passed, we will queue it (if needed) and attempt to execute it. If timelock delay hasn’t elapsed, try again later.</p>
            <div className="flex items-center gap-2">
              <input
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm w-40"
                placeholder="Proposal ID"
                value={endPid}
                onChange={(e) => setEndPid(e.target.value)}
              />
              <button className="btn btn-primary" disabled={!address || !endPid || endBusy} onClick={endSession}>
                {endBusy ? 'Processing…' : 'End Session'}
              </button>
            </div>
            {endMsg && <div className="text-xs text-emerald-400">{endMsg}</div>}
            {endErr && <div className="text-xs text-red-400">{endErr}</div>}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">RWA Revenue & Claim</h2>
            <p className="text-xs text-zinc-400">Claim simulated streaming revenue distributed pro‑rata every deposit. (Deploy marketplace & revenue deposits off‑chain). </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Reuse catalog visual but add claim buttons */}
              <RWACatalog />
            </div>
            {/* Claim interactions per asset would be separate visual, simplified for brevity */}
            {claimTx && <a target="_blank" href={`https://sepolia.etherscan.io/tx/${claimTx}`} className="text-xs text-emerald-400 underline">View claim tx (Sepolia)</a>}
            {claimErr && <div className="text-xs text-red-400">{claimErr}</div>}
            <div className="card flex flex-wrap items-center gap-2">
              <div className="text-xs text-zinc-400">Simulate revenue tick (demo)</div>
              <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm" value={streamAsset} onChange={(e) => setStreamAsset(Number(e.target.value))}>
                <option value={0}>Asset #0</option>
                <option value={1}>Asset #1</option>
                <option value={2}>Asset #2</option>
              </select>
              <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm w-24" value={streamAmt} onChange={(e) => setStreamAmt(e.target.value)} />
              <button className="btn btn-secondary" disabled={!address} onClick={depositRevenue}>Deposit Revenue</button>
              {streamTx && <a target="_blank" href={`https://sepolia.etherscan.io/tx/${streamTx}`} className="text-xs text-emerald-400 underline">View revenue tx (Sepolia)</a>}
              {streamErr && <div className="text-xs text-red-400">{streamErr}</div>}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Activity Explorer</h2>
            <p className="text-xs text-zinc-400">Recent on-chain transactions for protocol contracts.</p>
            <Link href="/activity" className="btn btn-secondary w-fit">Open Activity Page</Link>
          </div>
        </div>
      </section>
    </main>
  )
}