"use client"

import Link from 'next/link'
import { useState } from 'react'
import PageHeader from '@/components/PageHeader'

export default function RwaIndexPage() {
  const [id, setId] = useState<string>('0')
  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle="Explore token-bound accounts (ERC-6551) backing real-world asset NFTs."
      />
      <section className="py-10">
        <div className="container space-y-6">
          <div className="card flex items-center gap-3">
            <label className="text-sm">Open TBA for NFT ID</label>
            <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm w-24" value={id} onChange={(e) => setId(e.target.value)} />
            <Link href={`/rwa/${id}`} className="btn btn-secondary">Open</Link>
            <div className="text-xs text-zinc-500">Try <Link className="underline" href="/rwa/0">RWA #0</Link></div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Mint an RWA NFT</div>
                <div className="text-xs text-zinc-400">Owner-only direct mint (demo) or use Governance to propose a mint.</div>
              </div>
              <Link className="btn btn-primary" href="/rwa/mint">Go to Mint</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}