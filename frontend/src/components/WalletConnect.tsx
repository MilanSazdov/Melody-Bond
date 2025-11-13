"use client"

import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { useEffect, useState, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'

function shortAddress(addr?: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function WalletConnect() {
  const { address, isConnected, chain } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: ensName } = useEnsName({ address, chainId: sepolia.id })
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { login: privyLogin, logout: privyLogout, ready: privyReady, authenticated } = usePrivy()
  const [privyError, setPrivyError] = useState<string | null>(null)

  // Wrong network detection
  const wrongNetwork = chain && chain.id !== sepolia.id

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDisconnect(false)
      }
    }

    if (showDisconnect) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDisconnect])

  const handleConnect = async () => {
    const connector = connectors[0]
    if (!connector) return
    try {
      await connect({ connector, chainId: sepolia.id })
    } catch (e) {
      console.error('Connection failed:', e)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setShowDisconnect(false)
  }

  const handleSwitchToSepolia = () => {
    if (switchChain) {
      switchChain({ chainId: sepolia.id })
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-sm">
        <div className="w-20 h-4 bg-zinc-800 animate-pulse rounded" />
      </div>
    )
  }

  if (!isConnected) {
    const metaMaskConnector = connectors.find(
      (c) => c.id === 'injected' || c.name.toLowerCase().includes('metamask')
    )
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <button
            onClick={handleConnect}
            disabled={isPending || !metaMaskConnector}
            className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isPending ? 'Connecting…' : 'Connect MetaMask'}
          </button>
          <button
            onClick={async () => {
              setPrivyError(null)
              try {
                await privyLogin()
              } catch (e: any) {
                const msg = String(e?.message || e)
                if (msg.toLowerCase().includes('not allowed') || msg.includes('403')) {
                  setPrivyError('Enable Google and whitelist http://127.0.0.1:3000 in Privy app settings.')
                } else {
                  setPrivyError('Login failed. Please try again.')
                }
              }
            }}
            disabled={!privyReady}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
            title={privyReady ? '' : 'Initializing login…'}
          >
            Continue with Google
          </button>
          {privyError && (
            <span className="text-xs text-red-400 self-center">{privyError}</span>
          )}
        </div>
        {error && (
          <span className="text-xs text-red-400">
            {error.message?.includes('rejected') ? 'Connection rejected' : 'Connection failed'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDisconnect(!showDisconnect)}
        className={`px-4 py-2 rounded-md text-sm transition-colors shadow-md ${
          wrongNetwork 
            ? 'bg-orange-900/50 border border-orange-600 hover:border-orange-500' 
            : 'bg-zinc-900 border border-emerald-800/50 hover:border-emerald-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wrongNetwork ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="font-medium">{ensName || shortAddress(address)}</span>
          <span className={`text-xs ${wrongNetwork ? 'text-orange-400' : 'text-zinc-500'}`}>
            {wrongNetwork ? '⚠ Wrong Net' : 'Sepolia'}
          </span>
        </div>
      </button>
      {wrongNetwork && (
        <button
          onClick={handleSwitchToSepolia}
          className="absolute top-full mt-1 right-0 px-3 py-2 bg-orange-600 hover:bg-orange-500 border border-orange-500 rounded text-xs text-white font-medium whitespace-nowrap shadow-lg transition-colors"
        >
          ⚠ Switch to Sepolia Network
        </button>
      )}
      {showDisconnect && (
        <div className="absolute top-full mt-2 right-0 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl overflow-hidden min-w-[180px] z-[100]">
          <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
            <div className="text-xs text-zinc-400">Connected to</div>
            <div className="text-sm font-medium text-emerald-400">
              {wrongNetwork ? (
                <span className="text-orange-400">⚠ Wrong Network</span>
              ) : (
                'Sepolia Testnet'
              )}
            </div>
          </div>
          {wrongNetwork && (
            <button
              onClick={handleSwitchToSepolia}
              className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-800 text-orange-400 hover:text-orange-300 transition-colors border-b border-zinc-800"
            >
              Switch to Sepolia
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
          >
            <span>🔓</span>
            <span>Logout Wallet</span>
          </button>
          {authenticated && (
            <button
              onClick={() => { setShowDisconnect(false); privyLogout() }}
              className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 border-t border-zinc-800"
            >
              <span>🔒</span>
              <span>Logout Google</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}