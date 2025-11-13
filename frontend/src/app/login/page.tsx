"use client"

import { LoginButton } from '@/components/LoginButton'
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