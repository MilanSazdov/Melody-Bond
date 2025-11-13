"use client"

import { useAccount, useDisconnect, useEnsName, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePrivy } from '@privy-io/react-auth'

function shortAddress(addr?: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function WalletConnect() {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: ensName } = useEnsName({ address, chainId: sepolia.id })
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const { login: privyLogin, logout: privyLogout, ready: privyReady, authenticated } = usePrivy()
  const [privyError, setPrivyError] = useState<string | null>(null)
  const [privyLoading, setPrivyLoading] = useState(false)

  // Wrong network detection
  const wrongNetwork = chain && chain.id !== sepolia.id

  useEffect(() => {
    setMounted(true)
  }, [])

  // Recompute menu position (fixed, portal) to align with trigger's right edge
  const computeMenuPosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const top = rect.bottom + window.scrollY + 8 // 8px gap
    const right = window.innerWidth - rect.right
    setMenuPos({ top, right })
  }

  useEffect(() => {
    if (showDisconnect) {
      computeMenuPosition()
      const onResize = () => computeMenuPosition()
      const onScroll = () => computeMenuPosition()
      window.addEventListener('resize', onResize)
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        window.removeEventListener('resize', onResize)
        window.removeEventListener('scroll', onScroll)
      }
    }
  }, [showDisconnect])

  // Close dropdown when clicking outside (works with portal)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const menuEl = menuRef.current
      const triggerEl = triggerRef.current
      const clickedMenu = !!(menuEl && menuEl.contains(target))
      const clickedTrigger = !!(triggerEl && triggerEl.contains(target))
      if (!clickedMenu && !clickedTrigger) setShowDisconnect(false)
    }

    if (showDisconnect) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDisconnect])

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

  const loggedIn = authenticated || isConnected

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2 relative z-[10000]">
          <button
            onClick={async () => {
              setPrivyError(null)
              setPrivyLoading(true)
              try {
                await privyLogin({ loginMethods: ['wallet', 'google'] })
              } catch (e: any) {
                const msg = String(e?.message || e)
                if (msg.toLowerCase().includes('not allowed') || msg.includes('403')) {
                  setPrivyError('Enable Google and whitelist http://127.0.0.1:3000 in Privy app settings.')
                } else {
                  setPrivyError('Login failed. Please try again.')
                }
              } finally {
                setPrivyLoading(false)
              }
            }}
            disabled={!privyReady || privyLoading}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg relative z-[10000]"
            title={privyReady ? '' : 'Initializing login…'}
          >
            {privyLoading ? 'Connecting…' : (privyReady ? 'Continue with Google' : 'Initializing…')}
          </button>
          {privyError && (
            <span className="text-xs text-red-400 self-center">{privyError}</span>
          )}
        </div>
      </div>
    )
  }

  // If authenticated via Privy but wagmi hasn't populated address yet, show placeholder
  const displayName = address ? (ensName || `${address.slice(0, 6)}…${address.slice(-4)}`) : (authenticated ? 'Smart Wallet' : '')

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setShowDisconnect(!showDisconnect)}
        className={`px-4 py-2 rounded-md text-sm transition-colors shadow-md ${
          wrongNetwork 
            ? 'bg-orange-900/50 border border-orange-600 hover:border-orange-500' 
            : 'bg-zinc-900 border border-emerald-800/50 hover:border-emerald-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wrongNetwork ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="font-medium">{displayName}</span>
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
      {showDisconnect && mounted && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="bg-zinc-900 border border-zinc-800 rounded-md shadow-xl overflow-hidden min-w-[180px]"
        >
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
            onClick={() => {
              setShowDisconnect(false)
              try { handleDisconnect() } catch {}
              try { if (authenticated) privyLogout() } catch {}
            }}
            className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
          >
            <span>🔓</span>
            <span>Logout</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}