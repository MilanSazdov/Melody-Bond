"use client"

import { useState } from 'react'
import { addApplication } from '@/lib/applications'

export default function ApplyForFunding({ onCreated }: { onCreated?: () => void }) {
  const [artist, setArtist] = useState('DJ Pera')
  const [song, setSong] = useState('Sepolia Sunrise')
  const [amount, setAmount] = useState('10000')
  const [royalty, setRoyalty] = useState('50')
  const [demoLink, setDemoLink] = useState('https://soundcloud.com/example/sepolia-sunrise')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const royaltyNum = Number(royalty)
      const amountNum = Number(amount)
      if (isNaN(royaltyNum) || royaltyNum <= 0 || royaltyNum > 100) throw new Error('Royalty % must be 1-100')
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Amount must be > 0')
      addApplication({ artist, song, amountUSDC: amountNum, royaltyPercent: royaltyNum, demoLink })
      setMsg('Application submitted. DAO members can now propose funding.')
      if (onCreated) onCreated()
    } catch (e: any) {
      setErr(e?.message || 'Failed to save application')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Apply for Funding</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-400">
        <input className="input" placeholder="Artist Name" value={artist} onChange={e=>setArtist(e.target.value)} />
        <input className="input" placeholder="Song Name" value={song} onChange={e=>setSong(e.target.value)} />
        <input className="input" type="number" placeholder="Amount (USDC)" value={amount} onChange={e=>setAmount(e.target.value)} />
        <input className="input" type="number" placeholder="Royalty % to DAO" value={royalty} onChange={e=>setRoyalty(e.target.value)} />
        <input className="input md:col-span-2" placeholder="Demo Link (SoundCloud)" value={demoLink} onChange={e=>setDemoLink(e.target.value)} />
      </div>
      <button disabled={busy} className="btn btn-primary">{busy ? 'Submitting…' : 'Submit Application'}</button>
      {msg && <div className="text-xs text-emerald-400">{msg}</div>}
      {err && <div className="text-xs text-red-400">{err}</div>}
    </form>
  )
}
