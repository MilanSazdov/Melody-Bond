"use client"

import { LoginButton } from '@/components/LoginButton'
import PageHeader from '@/components/PageHeader'

export default function LoginPage() {
  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle="Login to enable embedded wallets and seamless account abstraction features."
      />
      <section className="py-10">
        <div className="container space-y-6">
          <div className="card flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Privy Authentication</div>
              <div className="text-xs text-zinc-400">Social login or embedded wallet</div>
            </div>
            <LoginButton />
          </div>
        </div>
      </section>
    </main>
  )
}