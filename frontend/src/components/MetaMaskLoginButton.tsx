"use client"

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function MetaMaskLoginButton() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (!isConnected) {
    const metaMaskConnector = connectors.find(
      (c) => c.id === 'injected' || c.name.toLowerCase().includes('metamask')
    )
    return (
      <button
        onClick={() => metaMaskConnector && connect({ connector: metaMaskConnector })}
        disabled={isPending || !metaMaskConnector}
        className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
      >
        {isPending ? 'Connecting…' : metaMaskConnector ? 'Connect MetaMask' : 'MetaMask unavailable'}
      </button>
    )
  }

  return (
    <button
      onClick={() => disconnect()}
      className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-800 text-white text-xs font-medium"
    >
      Logout {address?.slice(0, 6)}…
    </button>
  )
}
