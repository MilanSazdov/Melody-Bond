"use client"

import { useEffect, useState } from 'react'
import { Address } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { RWA_ADDRESS } from '../../../constants'
import { publicClient } from '@/lib/clients'
import PageHeader from '@/components/PageHeader'

const RWA_ABI_MIN = [
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
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

export default function MintRwaPage() {
  const { address } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })
  
  const [owner, setOwner] = useState<Address | null>(null)
  const [to, setTo] = useState<string>('')
  const [uri, setUri] = useState<string>('https://example.com/rwa/0.json')
  const [error, setError] = useState<string | null>(null)
  
  const busy = isPending || isConfirming

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const o = (await publicClient.readContract({ address: RWA_ADDRESS, abi: RWA_ABI_MIN as any, functionName: 'owner', args: [] })) as Address
        if (mounted) setOwner(o)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to read owner')
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const canMint = owner && address && owner.toLowerCase() === address.toLowerCase()

  const onMint = () => {
    setError(null)
    writeContract(
      {
        address: RWA_ADDRESS,
        abi: RWA_ABI_MIN as any,
        functionName: 'mint',
        args: [to as Address, uri],
        chainId: sepolia.id,
      },
      {
        onError: (err) => {
          setError(err.message || 'Mint failed')
        },
      }
    )
  }

  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle="Owner-only direct mint pathway for demonstration deployments."
      />
      <section className="py-10">
        <div className="container space-y-6">
          <div className="card space-y-3">
            <div className="text-sm">RWA contract: <span className="text-zinc-300">{RWA_ADDRESS}</span></div>
            <div className="text-sm">Owner: <span className="text-zinc-300">{owner ?? '...'}</span></div>
            {owner && address && owner.toLowerCase() !== address.toLowerCase() && (
              <div className="text-xs text-amber-400">Connected wallet is not the owner. Use governance flow or deploy a demo RWA owned by you.</div>
            )}

            <div className="flex flex-col gap-2 md:flex-row">
              <input className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Recipient address (to)" value={to} onChange={(e) => setTo(e.target.value)} />
              <input className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Token URI (https:// or ipfs://)" value={uri} onChange={(e) => setUri(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" disabled={!address || !canMint || busy || !to || !uri} onClick={onMint}>
                {busy ? 'Minting…' : 'Mint Now'}
              </button>
              {hash && <a className="text-xs text-emerald-400 underline" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View tx (Sepolia)</a>}
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-2">Tip: make it a "real" NFT</h2>
            <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
              <li>Upload an image to IPFS (Pinata, web3.storage, NFT.Storage) and copy the ipfs:// CID.</li>
              <li>Create metadata JSON referencing that image, e.g. {`{"name":"RWA #1","description":"Demo asset","image":"ipfs://<CID>"}`}, and upload it to IPFS too.</li>
              <li>Use the metadata ipfs:// link as Token URI here or in the governance proposal form.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}