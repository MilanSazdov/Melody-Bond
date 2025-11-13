"use client"

import { usePrivy } from '@privy-io/react-auth'
import { useState } from 'react'

export function LoginButton() {
  const { login, logout, authenticated, ready } = usePrivy()
  const hasPrivy = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)
  const [err, setErr] = useState<string | null>(null)

  if (!hasPrivy) {
    return (
      <button className="px-4 py-2 rounded bg-gray-700 text-white" disabled title="Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local and restart the dev server">
        Configure Privy to Login
      </button>
    )
  }

  if (!ready) return <button className="px-4 py-2 rounded bg-gray-700 text-white" disabled>Loading…</button>
  if (!authenticated)
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          onClick={async () => {
            setErr(null)
            try {
              await login()
            } catch (e: any) {
              const msg = String(e?.message || e)
              if (msg.toLowerCase().includes('not allowed') || msg.includes('403')) {
                setErr('Google login is disabled or origin not whitelisted in Privy. Enable Google + add http://127.0.0.1:3000 in Privy dashboard.')
              } else {
                setErr('Login failed. Please try again.')
              }
            }
          }}
          disabled={!ready}
        >
          Continue with Google (Smart Wallet)
        </button>
        {err && <span className="text-xs text-red-400 max-w-[280px] text-right">{err}</span>}
      </div>
    )

  return (
    <button className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-800 text-white text-sm" onClick={logout}>
      Logout Google / Smart Wallet
    </button>
  )
}