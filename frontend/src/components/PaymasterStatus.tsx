"use client"

import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { getRelayerBalance } from '@/lib/accountAbstraction'

export default function PaymasterStatus() {
  const [balance, setBalance] = useState<string>('0')
  const [relayerAddress, setRelayerAddress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/relay/balance')
      const data = await response.json()
      if (data.balance) {
        setBalance(formatEther(BigInt(data.balance)))
        setRelayerAddress(data.address || '')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to read relayer balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const estimatedTxs = Math.floor(parseFloat(balance) / 0.003) // ~0.003 ETH per tx

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">⚡ Relayer Wallet Status</h3>
        {relayerAddress && (
          <a 
            href={`https://sepolia.etherscan.io/address/${relayerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            View on Etherscan ↗
          </a>
        )}
        <button
          onClick={refresh}
          className="text-xs text-blue-400 hover:text-blue-300"
          disabled={loading}
        >
          {loading ? '⏳' : '🔄 Refresh'}
        </button>
      </div>
      
      <div className="bg-zinc-900 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-400">Current Balance:</span>
          <span className="text-lg font-bold text-white">{loading ? '...' : balance} ETH</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-400">Estimated Transactions Left:</span>
          <span className="text-sm font-semibold text-emerald-400">~{estimatedTxs} txs</span>
        </div>
        {parseFloat(balance) < 0.01 && !loading && (
          <div className="text-xs text-orange-400 flex items-center gap-1">
            ⚠️ Low balance! Top up the relayer wallet to keep gasless transactions active.
          </div>
        )}
        {relayerAddress && (
          <div className="text-xs text-zinc-500 break-all">
            <span className="text-zinc-400">Address: </span>
            <code className="font-mono">{relayerAddress}</code>
          </div>
        )}
      </div>
      
      {error && (
        <div className="text-xs text-red-400 p-2 bg-red-900/20 border border-red-800 rounded">
          {error}
        </div>
      )}

      <div className="text-xs text-zinc-500 space-y-1">
        <p>💡 <strong>How it works:</strong> The relayer wallet pays gas fees for gasless transactions.</p>
        <p>🔋 Each transaction costs ~0.003 ETH in gas. Fund this wallet directly on Etherscan to enable gasless features!</p>
      </div>
    </div>
  )
}