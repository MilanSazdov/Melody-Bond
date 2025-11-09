"use client"

import { usePrivy } from '@privy-io/react-auth'

export function LoginButton() {
  const { login, logout, authenticated, ready } = usePrivy()
  const hasPrivy = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

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
      <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={login}>
        Login
      </button>
    )

  return (
    <button className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-800 text-white text-sm" onClick={logout}>
      Logout
    </button>
  )
}