"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ActivityItem = {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: number
  status: string
  source: string
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/activity?limit=${limit}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Request failed')
        if (mounted) setData(json.data || [])
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load activity')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [limit])

  return (
    <main className="min-h-dvh py-10">
      <div className="container space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Protocol Activity</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Aggregated recent transactions touching the core contracts (DAO, Governance Token, RWA, Timelock, Paymaster) on Sepolia. Data fetched from Etherscan and cached briefly. Status reflects on-chain receipt status; click any hash for full details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400">Limit</label>
          <select
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[25,50,100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {loading && <span className="text-xs text-zinc-400">Loading…</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        <ul className="space-y-2">
          {data.map((tx) => {
            const ts = new Date(tx.timeStamp * 1000)
            const age = ts.toLocaleString()
            const shortHash = `${tx.hash.slice(0,10)}…${tx.hash.slice(-6)}`
            const shortFrom = `${tx.from.slice(0,6)}…${tx.from.slice(-4)}`
            const shortTo = `${tx.to.slice(0,6)}…${tx.to.slice(-4)}`
            const statusColor = tx.status === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            const valueEth = tx.value && tx.value !== '0' ? (Number(tx.value) / 1e18).toFixed(4) : '0'
            return (
              <li key={tx.hash} className="card p-4">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Link target="_blank" href={`https://sepolia.etherscan.io/tx/${tx.hash}`} className="font-mono text-[11px] text-cyan-400 hover:underline">
                      {shortHash}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${statusColor}`}>{tx.status}</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px]">{tx.source.replace(/0x.{6}$/,'…')}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <span>From: <span className="font-mono text-zinc-300">{shortFrom}</span></span>
                    <span>To: <span className="font-mono text-zinc-300">{shortTo}</span></span>
                    <span>Value: {valueEth} Sepolia ETH</span>
                    <span>Time: {age}</span>
                  </div>
                </div>
              </li>
            )
          })}
          {!loading && !error && data.length === 0 && (
            <li className="text-sm text-zinc-500">No transactions found.</li>
          )}
        </ul>
      </div>
    </main>
  )
}