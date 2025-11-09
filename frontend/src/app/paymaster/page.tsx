"use client"

import PaymasterStatus from '@/components/PaymasterStatus'
import PageHeader from '@/components/PageHeader'

export default function PaymasterPage() {
  return (
    <main className="min-h-dvh">
      <PageHeader
        title="RWA DAO Demo"
        subtitle="Monitor and fund the Paymaster deposit used to sponsor gas for DAO interactions."
      />
      <section className="py-10">
        <div className="container space-y-6">
          <div className="card">
            <PaymasterStatus />
          </div>
        </div>
      </section>
    </main>
  )
}