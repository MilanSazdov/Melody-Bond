"use client"

import { ReactNode } from 'react'
import { http } from 'wagmi'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { injected } from 'wagmi/connectors'
import { PrivyProvider } from '@privy-io/react-auth'

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

// Privy app id (required for Google + embedded wallets)
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

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
    <PrivyProvider
      appId={privyAppId || ''}
      config={{
        loginMethods: ['wallet', 'google'],
        defaultChain: sepolia,
        supportedChains: [sepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        appearance: {
          theme: 'dark',
          accentColor: '#22c55e',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}