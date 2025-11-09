"use client"

import React from 'react'

export default function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-b from-zinc-950/80 via-zinc-900/50 to-transparent py-10">
      <div className="container flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              {title}
            </span>
          </h1>
          {subtitle && <p className="text-sm text-zinc-300 max-w-2xl">{subtitle}</p>}
        </div>
        {right && <div className="hidden md:block">{right}</div>}
      </div>
    </section>
  )
}