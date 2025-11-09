'use client'

import { useState, useEffect } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { publicClient } from '@/lib/clients'
import { getUserRWAInvestments, getTBABalance, RWAInvestment } from '@/lib/rwaGovernance'
import { CONTRACTS } from '@/contracts'
import Link from 'next/link'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [investments, setInvestments] = useState<RWAInvestment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNFT, setSelectedNFT] = useState<RWAInvestment | null>(null)
  const [showProposalModal, setShowProposalModal] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    async function load() {
      if (!address) {
        setInvestments([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const userInvestments = await getUserRWAInvestments(publicClient, address)

        // Load balances for each investment
        const investmentsWithBalances = await Promise.all(
          userInvestments.map(async (inv) => {
            const balance = await getTBABalance(publicClient, inv.tbaAddress, CONTRACTS.USDC)
            return {
              ...inv,
              tbaBalance: balance,
            }
          })
        )

        if (isMounted) {
          setInvestments(investmentsWithBalances as any)
        }
      } catch (error) {
        console.error('[Portfolio] Error loading investments:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    load()
    
    return () => {
      isMounted = false
    }
  }, [address])

  const handleProposeClick = (investment: RWAInvestment) => {
    setSelectedNFT(investment)
    setShowProposalModal(true)
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-300">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="text-4xl font-bold text-white mb-2">My Portfolio</h1>
          <p className="text-sm text-gray-400 mb-8">View and manage your RWA investments</p>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
            <p className="text-lg mb-4">Please connect your wallet to view your portfolio.</p>
            <Link href="/projects" className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
              Explore Projects
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-white mb-2">My Portfolio</h1>
        <p className="text-sm text-gray-400 mb-8">View and manage your RWA investments</p>

        {loading ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
            <p className="text-gray-400">Loading your investments...</p>
          </div>
        ) : investments.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <p className="text-lg mb-4">You haven't invested in any RWA NFTs yet.</p>
            <Link
              href="/projects"
              className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Explore Projects
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {investments.map((investment) => (
              <InvestmentCard
                key={investment.nftId.toString()}
                investment={investment as any}
                onPropose={() => handleProposeClick(investment)}
              />
            ))}
          </div>
        )}

        {showProposalModal && selectedNFT && (
          <ProposalModal
            investment={selectedNFT}
            onClose={() => {
              setShowProposalModal(false)
              setSelectedNFT(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

function InvestmentCard({
  investment,
  onPropose,
}: {
  investment: RWAInvestment & { tbaBalance?: bigint }
  onPropose: () => void
}) {
  const sharesFormatted = formatUnits(investment.shares, 18)
  const balanceFormatted = investment.tbaBalance !== undefined ? formatUnits(investment.tbaBalance, 6) : '0'
  
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden hover:border-emerald-600/50 transition-all group">
      <div className="aspect-video bg-gradient-to-br from-emerald-900/40 via-blue-900/40 to-purple-900/40 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 group-hover:from-emerald-500/20 group-hover:to-blue-500/20 transition-all"></div>
        <span className="text-white text-5xl font-bold relative z-10">#{investment.nftId.toString()}</span>
      </div>

      <div className="p-5">
        <h3 className="text-xl font-bold text-white mb-4">RWA NFT #{investment.nftId.toString()}</h3>

        <div className="space-y-3 text-sm mb-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Your Shares:</span>
            <span className="font-semibold text-emerald-400">{Number(sharesFormatted).toFixed(2)}</span>
          </div>

          {investment.tbaBalance !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">TBA Balance:</span>
              <span className="font-semibold text-blue-400">{Number(balanceFormatted).toFixed(2)} USDC</span>
            </div>
          )}

          <div className="pt-3 border-t border-gray-700">
            <p className="text-[11px] text-gray-500 break-all mb-1">
              Governor: {investment.governorAddress.slice(0, 10)}...{investment.governorAddress.slice(-8)}
            </p>
            <p className="text-[11px] text-gray-500 break-all">
              TBA: {investment.tbaAddress.slice(0, 10)}...{investment.tbaAddress.slice(-8)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onPropose}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            Propose
          </button>
          <Link
            href={`/governance?nft=${investment.nftId}`}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center font-medium text-sm"
          >
            Governance
          </Link>
        </div>
      </div>
    </div>
  )
}

function ProposalModal({
  investment,
  onClose,
}: {
  investment: RWAInvestment
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<'changeName' | 'changeImage' | 'withdraw' | null>(null)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Create Proposal for RWA #{investment.nftId.toString()}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>

          {!selectedType ? (
            <div className="space-y-4">
              <p className="text-gray-400 mb-6">Select the type of proposal you want to create:</p>

              <button
                onClick={() => setSelectedType('changeName')}
                className="w-full p-6 border-2 border-gray-700 rounded-lg hover:border-emerald-600 hover:bg-gray-700/50 transition-all text-left group"
              >
                <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-emerald-400 transition-colors">1. Change Name/Metadata</h3>
                <p className="text-gray-400 text-sm">Update the name and metadata URI for this RWA NFT</p>
              </button>

              <button
                onClick={() => setSelectedType('changeImage')}
                className="w-full p-6 border-2 border-gray-700 rounded-lg hover:border-blue-600 hover:bg-gray-700/50 transition-all text-left group"
              >
                <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-blue-400 transition-colors">2. Change Image</h3>
                <p className="text-gray-400 text-sm">Update the image for this RWA NFT</p>
              </button>

              <button
                onClick={() => setSelectedType('withdraw')}
                className="w-full p-6 border-2 border-gray-700 rounded-lg hover:border-purple-600 hover:bg-gray-700/50 transition-all text-left group"
              >
                <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-purple-400 transition-colors">3. Withdraw Funds</h3>
                <p className="text-gray-400 text-sm">Distribute funds from the TBA wallet to all investors based on their shares</p>
              </button>
            </div>
          ) : (
            <ProposalForm
              investment={investment}
              proposalType={selectedType}
              onBack={() => setSelectedType(null)}
              onSuccess={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ProposalForm({
  investment,
  proposalType,
  onBack,
  onSuccess,
}: {
  investment: RWAInvestment
  proposalType: 'changeName' | 'changeImage' | 'withdraw'
  onBack: () => void
  onSuccess: () => void
}) {
  const { data: walletClient } = useWalletClient()

  const [metadataURI, setMetadataURI] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletClient) {
      setError('Wallet not connected')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const { buildChangeNameProposal, buildChangeImageProposal, buildWithdrawProposal } = await import('@/lib/rwaGovernance')
      const { RWA_GOVERNOR_ABI } = await import('@/constants')

      let proposalData
      if (proposalType === 'changeName') {
        proposalData = buildChangeNameProposal(investment.nftId, metadataURI)
      } else if (proposalType === 'changeImage') {
        proposalData = buildChangeImageProposal(investment.nftId, metadataURI)
      } else {
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6)) // USDC has 6 decimals
        proposalData = buildWithdrawProposal(investment.nftId, amountWei)
      }

      const hash = await walletClient.writeContract({
        address: investment.governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'propose',
        args: [proposalData.targets, proposalData.values, proposalData.calldatas, proposalData.description],
      })

      await publicClient.waitForTransactionReceipt({ hash })

      alert('Proposal created successfully!')
      onSuccess()
    } catch (err: any) {
      console.error('[Portfolio] Error creating proposal:', err)
      const msg = err?.message || 'Failed to create proposal'
      if (err?.code === 4001 || msg.toLowerCase().includes('user denied') || msg.toLowerCase().includes('user rejected')) {
        setError('Transaction rejected by user')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 text-sm"
      >
        ← Back
      </button>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-white">
          {proposalType === 'changeName' && 'Change Name/Metadata'}
          {proposalType === 'changeImage' && 'Change Image'}
          {proposalType === 'withdraw' && 'Withdraw Funds'}
        </h3>

        {(proposalType === 'changeName' || proposalType === 'changeImage') && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Metadata URI
            </label>
            <input
              type="text"
              value={metadataURI}
              onChange={(e) => setMetadataURI(e.target.value)}
              placeholder="ipfs://... or https://..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              Enter the URI pointing to the new metadata JSON file
            </p>
          </div>
        )}

        {proposalType === 'withdraw' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              This amount will be distributed to all investors proportionally based on their shares
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Proposal'}
        </button>
      </div>
    </form>
  )
}
