"use client"

import { usePrivy } from '@privy-io/react-auth'
import { useMemo, useState } from 'react'

function truncate(addr?: string, size = 4) {
  if (!addr) return ''
  return addr.slice(0, 2 + size) + '…' + addr.slice(-size)
}

export default function UserWalletButton() {
  const { user, authenticated, ready } = usePrivy()
  const [copied, setCopied] = useState(false)

  const address = useMemo(() => {
    if (!user) return undefined
    const linked = (user.linkedAccounts || []) as any[]
    const wallet = linked.find((a) => a.type?.includes('wallet') && a.address)?.address || (user as any)?.wallet?.address
    return wallet as string | undefined
  }, [user])

  const copy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  if (!ready || !authenticated) return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copy}
        className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono"
        title={address}
      >
        {address ? truncate(address, 6) : 'Wallet'}{copied ? ' ✓' : ''}
      </button>
      <a
        className="px-2 py-2 rounded text-xs text-zinc-300 hover:text-white"
        href={address ? `https://sepolia.etherscan.io/address/${address}` : '#'}
        target="_blank"
        rel="noreferrer"
      >
        View
      </a>
    </div>
  )
}