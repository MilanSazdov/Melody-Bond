"use client"

import { useEffect, useMemo, useState } from 'react'
import { FundingApplication, loadApplications, markProposed } from '@/lib/applications'
import { useAccount, useWalletClient } from 'wagmi'
import { Address, encodeFunctionData } from 'viem'
import { DAO_ADDRESS, DAO_ABI, MOCK_USDC_ADDRESS, RWA_ADDRESS, TIMELOCK_ADDRESS, ERC6551_REGISTRY_ADDRESS, ERC6551_IMPLEMENTATION_ADDRESS } from '../constants'
import { buildMintAndCreateTBAPayload } from '@/lib/governance'
import { publicClient } from '@/lib/clients'

export default function PendingApplications() {
  const [apps, setApps] = useState<FundingApplication[]>([])
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient({ account: address })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setApps(loadApplications())
  }, [])

  const createProposal = async (app: FundingApplication) => {
    if (!walletClient || !isConnected) return
    try {
      setBusyId(app.id)
      setMsg(null)
      setErr(null)
      // Sanity: require constants set (check for placeholder pattern)
      if (ERC6551_REGISTRY_ADDRESS.startsWith('0x...') || ERC6551_IMPLEMENTATION_ADDRESS.startsWith('0x...')) {
        throw new Error('Please set ERC6551 addresses in constants.ts')
      }
      // Determine next tokenId pre-mint as totalSupply()
      const nextId = await publicClient.readContract({
        address: RWA_ADDRESS,
        abi: [ { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' } ] as const,
        functionName: 'totalSupply'
      }) as bigint

      // Action 1: transfer USDC from Treasury to musician (use configured musician address or app field later)
      // NOTE: MUSICIAN_PERA_ADDRESS was removed. Use app.recipient if available, else throw.
      if (!(app as any).recipient) throw new Error('Missing recipient address in application.');
      const recipient = (app as any).recipient as Address
      const usdcTransfer = encodeFunctionData({
        abi: [ { type: 'function', name: 'transfer', inputs: [ { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [ { type: 'bool' } ] } ] as const,
        functionName: 'transfer',
        args: [recipient, BigInt(app.amountUSDC) * BigInt(1_000_000)]
      })

      // Action 2: mint RWA to Timelock
      const mintData = encodeFunctionData({
        abi: [ { type: 'function', name: 'mint', inputs: [ { name: 'to', type: 'address' }, { name: 'tokenURI', type: 'string' } ], outputs: [ { type: 'uint256' } ] } ] as const,
        functionName: 'mint',
        args: [TIMELOCK_ADDRESS as Address, app.tokenUri || `ipfs://song_${nextId}.json`]
      })

      // Action 3: create TBA for tokenId = nextId
      const createAccount = encodeFunctionData({
        abi: [ { type: 'function', name: 'createAccount', inputs: [
          { name: 'implementation', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
          { name: 'initData', type: 'bytes' },
        ], outputs: [ { type: 'address' } ] } ] as const,
        functionName: 'createAccount',
        args: [
          ERC6551_IMPLEMENTATION_ADDRESS as Address,
          BigInt(publicClient.chain!.id),
          RWA_ADDRESS as Address,
          nextId,
          BigInt(0),
          '0x'
        ]
      })

      const targets = [MOCK_USDC_ADDRESS as Address, RWA_ADDRESS as Address, ERC6551_REGISTRY_ADDRESS as Address]
      const values = [BigInt(0), BigInt(0), BigInt(0)]
      const calldatas = [usdcTransfer, mintData, createAccount]

      const hash = await walletClient.writeContract({
        address: DAO_ADDRESS,
        abi: DAO_ABI as any,
        functionName: 'propose',
        args: [targets, values, calldatas, `Fund ${app.artist} - ${app.song} (${app.amountUSDC} USDC, ${app.royaltyPercent}% royalties)`],
      })
      setMsg(`Proposal created. Tx: ${hash}`)
      markProposed(app.id)
      setApps(loadApplications())
    } catch (e: any) {
      setErr(e?.message || 'Failed to create proposal')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Pending Applications</h2>
      {apps.length === 0 && <div className="text-xs text-zinc-500">No applications yet.</div>}
      <ul className="space-y-2">
        {apps.map(app => (
          <li key={app.id} className="rounded border border-zinc-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">{app.artist} — {app.song}</div>
              <div className="text-xs text-zinc-400">{app.amountUSDC} USDC • {app.royaltyPercent}% to DAO</div>
            </div>
            <div className="text-xs text-zinc-500 truncate">{app.demoLink}</div>
            <div className="mt-2 flex items-center gap-2">
              <button disabled={!isConnected || busyId===app.id || app.proposed} className="btn btn-secondary" onClick={() => createProposal(app)}>
                {app.proposed ? 'Already Proposed' : (busyId===app.id ? 'Creating…' : 'Create Proposal from Application')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {msg && <div className="text-xs text-emerald-400">{msg}</div>}
      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  )
}
