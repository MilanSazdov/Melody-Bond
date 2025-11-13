"use client"

import { LoginButton } from '@/components/LoginButton'
import { MetaMaskLoginButton } from '@/components/MetaMaskLoginButton'
import PageHeader from '@/components/PageHeader'

export default function LoginPage() {
  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Access"
        subtitle="Choose how to connect: MetaMask or Google-based smart account."
      />
      <section className="py-10">
        <div className="container space-y-6">
          {/* MetaMask / EOA */}
          <div className="card flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">MetaMask Wallet</div>
              <div className="text-xs text-zinc-400">Connect a standard wallet (EOA).</div>
            </div>
            <MetaMaskLoginButton />
          </div>

          {/* Google + AA via Privy */}
          <div className="card flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Google Smart Wallet</div>
              <div className="text-xs text-zinc-400">Sign in with Google, use an embedded smart account (AA).</div>
            </div>
            <LoginButton />
          </div>
        </div>
      </section>
    </main>
  )
}