"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900 text-gray-400">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gray-700 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/30 border border-purple-800/50 text-purple-400 text-sm font-medium mb-4">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Powered by Ethereum • Sepolia Testnet
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              MelodyBond
            </h1>
            <p className="text-xl md:text-2xl text-purple-300 font-semibold">
              The DeFi Protocol for Music
            </p>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              A decentralized investment protocol where artists pitch for funding, and fans (as a DAO) collectively finance them in exchange for a share of future royalties.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Link className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors" href="/projects">
                View Artists
              </Link>
              <Link className="px-8 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors" href="/governance">
                Join the DAO
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                The Value Chain is Broken
              </h2>
              <p className="text-lg text-red-400 font-semibold">
                The current music industry model is slow, unfair, and built on intermediaries. It fails both the artist and the fan.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Artist Problem */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
                <div className="text-4xl mb-4">🎤</div>
                <h3 className="text-xl font-bold text-white mb-4">The Artist's Struggle</h3>
                <div className="bg-gray-700/50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-gray-300 italic">
                    "I am a talented artist, but I need $10,000 for my new album. Labels are gatekeepers, and they take up to <span className="text-red-400 font-bold">90% of my future revenue</span>."
                  </p>
                </div>
                <ul className="mt-6 space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Record labels demand majority ownership</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Predatory contracts lock artists for years</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Artists see pennies while labels profit</span>
                  </li>
                </ul>
              </div>

              {/* Fan Problem */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
                <div className="text-4xl mb-4">🎧</div>
                <h3 className="text-xl font-bold text-white mb-4">The Fan's Frustration</h3>
                <div className="bg-gray-700/50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-gray-300 italic">
                    "I discover talent first. I stream my favorite artist 1,000 times, and they earn <span className="text-red-400 font-bold">$3</span>. I want to invest in their success, not just be a consumer."
                  </p>
                </div>
                <ul className="mt-6 space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Early supporters get no reward for discovering talent</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Streaming pays artists almost nothing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">❌</span>
                    <span>Fans can't participate in artist success</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Labels Callout */}
            <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-700/50 rounded-lg p-6 text-center">
              <p className="text-lg text-gray-300">
                <span className="text-red-400 font-bold text-xl">Traditional labels are arrogant gatekeepers</span> — demanding 90% ownership while adding little value in the digital age. Artists deserve better. Fans deserve to participate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 bg-green-900/30 border border-green-700 rounded-full text-green-400 font-semibold mb-4">
                ✨ The Solution
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                MelodyBond: Fair, Transparent, Decentralized
              </h2>
              <p className="text-lg text-gray-300">
                We cut out the middlemen and empower artists and fans to work together directly.
              </p>
            </div>

            {/* How It Works */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {/* Step 1: Pitch */}
              <div className="bg-gray-800 border border-purple-700 rounded-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  1
                </div>
                <h3 className="text-xl font-bold text-purple-300 mb-3">PITCH</h3>
                <p className="text-gray-300 mb-4">
                  An artist applies to the MelodyBond DAO for funding
                </p>
                <div className="bg-gray-700/50 p-3 rounded text-sm text-purple-200 italic">
                  "$10,000 for 50% of my next single"
                </div>
              </div>

              {/* Step 2: Fund */}
              <div className="bg-gray-800 border border-blue-700 rounded-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  2
                </div>
                <h3 className="text-xl font-bold text-blue-300 mb-3">FUND</h3>
                <p className="text-gray-300 mb-4">
                  The DAO, made of fans, votes on the proposal
                </p>
                <div className="bg-gray-700/50 p-3 rounded text-sm text-blue-200">
                  If it passes → Artist is paid instantly from the DAO treasury
                </div>
              </div>

              {/* Step 3: Profit */}
              <div className="bg-gray-800 border border-green-700 rounded-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  3
                </div>
                <h3 className="text-xl font-bold text-green-300 mb-3">PROFIT</h3>
                <p className="text-gray-300 mb-4">
                  The DAO receives an RWA NFT representing future royalties
                </p>
                <div className="bg-gray-700/50 p-3 rounded text-sm text-green-200">
                  50% of that song's streaming revenue → DAO members
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/50 rounded-lg p-6">
                <h4 className="text-lg font-bold text-purple-300 mb-3">✅ For Artists</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Keep 50%+ of your revenue (vs. 10% with labels)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Get funded instantly without predatory contracts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Build a community of invested fans</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-blue-900/30 to-green-900/30 border border-blue-500/50 rounded-lg p-6">
                <h4 className="text-lg font-bold text-blue-300 mb-3">✅ For Fans</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Invest in artists you believe in</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Earn royalties from streaming success</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Vote on which artists get funded</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-b from-gray-950 to-gray-900 border-t border-gray-700">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to Change Music Forever?
            </h2>
            <p className="text-lg text-gray-300">
              Join MelodyBond today and be part of the decentralized music revolution.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Link 
                href="/projects"
                className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg transition-colors"
              >
                Start Investing
              </Link>
              <Link 
                href="/governance"
                className="px-8 py-4 border border-purple-500 text-purple-300 rounded-lg hover:bg-purple-900/30 font-semibold text-lg transition-colors"
              >
                Join the DAO
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
