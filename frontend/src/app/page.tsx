"use client";

import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import Vote from "@/components/Vote";
import Proposals from "@/components/Proposals";
import ProposeMintRWA from "@/components/ProposeMintRWA";
import GovTokenInfo from "@/components/GovTokenInfo";
import PaymasterStatus from "@/components/PaymasterStatus";
import RWACatalog from "@/components/RWACatalog";

export default function HomePage() {
  return (
    <main className="min-h-dvh">
      <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 py-16">
        <div className="container">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 text-xs font-medium mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sepolia Testnet
            </div>
            <h1 className="text-3xl font-bold">RWA DAO - Melody Bond</h1>
            <p className="text-zinc-300">Decentralized governance for Real World Assets on Sepolia testnet. Invest in tokenized assets and participate in gasless voting via Pimlico Paymaster.</p>
            <div className="flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/projects">View Projects</Link>
              <Link className="btn btn-secondary" href="/governance">Governance</Link>
              <Link className="btn btn-ghost" href="/portfolio">My Portfolio</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10">
        <div className="container space-y-6">
          <h2 className="text-lg font-semibold">Available RWAs</h2>
          <RWACatalog />
        </div>
      </section>
    </main>
  );
}
