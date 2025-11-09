"use client"

import { ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { injected } from 'wagmi/connectors'

// Stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// RPC with fallback
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/f0cf3284818e47609886fab853477aaa'

// Wagmi config - pure setup without Privy
const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected({
      shimDisconnect: true,
      target: 'metaMask',
    }),
  ],
  transports: {
    [sepolia.id]: http(rpcUrl, {
      batch: true,
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
  ssr: false,
})

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}