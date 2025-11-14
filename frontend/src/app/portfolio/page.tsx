'use client'

import { useState, useEffect } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { formatUnits, parseUnits, type Address } from 'viem'
import { publicClient } from '@/lib/clients'
import { getUserRWAInvestments, getTBABalance, RWAInvestment } from '@/lib/rwaGovernance'
import { CONTRACTS } from '@/contracts'
import { USDC_ABI } from '@/contracts'
import Link from 'next/link'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [investments, setInvestments] = useState<RWAInvestment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNFT, setSelectedNFT] = useState<RWAInvestment | null>(null)
  const [showProposalModal, setShowProposalModal] = useState(false)

  // Unified loading flow: fetch investments + balances together, once per address
  useEffect(() => {
    let isMounted = true
    const addr = (address || '').toLowerCase()

    const loadAll = async () => {
      setLoading(true)
      try {
        if (!addr) {
          if (isMounted) setInvestments([])
          return
        }
        console.log('[Portfolio] Fetching investments for', addr)
        const userInvestments = await getUserRWAInvestments(publicClient, address as any)
        console.log('[Portfolio] Received', userInvestments.length, 'investments')

        const enriched = await Promise.all(
          userInvestments.map(async (inv) => {
            if (inv.tbaAddress === '0x0000000000000000000000000000000000000000') {
              return { ...inv, tbaBalance: 0n }
            }
            try {
              const bal = await getTBABalance(publicClient, inv.tbaAddress, CONTRACTS.USDC)
              return { ...inv, tbaBalance: bal }
            } catch (e) {
              console.warn('[Portfolio] TBA balance read failed for', inv.nftId.toString(), e)
              return { ...inv, tbaBalance: 0n }
            }
          })
        )
        if (isMounted) setInvestments(enriched as any)
      } catch (e) {
        console.error('[Portfolio] Error loading portfolio:', e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadAll()
    return () => { isMounted = false }
  }, [(address || '').toLowerCase()])

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

function AddFundsButton({ tbaAddress }: { tbaAddress: Address }) {
  const [showInput, setShowInput] = useState(false)
  const [amount, setAmount] = useState('')
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0))
  const [sending, setSending] = useState(false)
  
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  useEffect(() => {
    if (!address || !showInput) return
    
    const loadBalance = async () => {
      try {
        // Pre-flight code existence check to avoid ContractFunctionExecutionError if USDC not deployed on current chain
        let code: string | undefined = undefined
        try {
          code = await publicClient.getBytecode({ address: CONTRACTS.USDC })
        } catch (codeErr) {
          console.warn('[AddFunds] getBytecode failed for USDC', CONTRACTS.USDC, codeErr)
        }
        if (!code || code === '0x') {
          console.warn('[AddFunds] USDC contract not deployed. Setting balance = 0.')
          setUserBalance(0n)
          return
        }
        const balance = await publicClient.readContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address]
        }) as bigint
        setUserBalance(balance)
      } catch (err) {
        console.error('[AddFunds] Failed to load user USDC balance:', err)
        setUserBalance(0n)
      }
    }
    
    loadBalance()
  }, [address, showInput])

  const handleSend = async () => {
    if (!walletClient || !address || !amount || parseFloat(amount) <= 0) return
    
    setSending(true)
    try {
      const amountBN = parseUnits(amount, 6)
      if (amountBN > userBalance) {
        alert('Insufficient USDC balance')
        return
      }

      // Estimate gas with 20% buffer and 15M cap
      let gasEstimate = BigInt(100000)
      try {
        gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [tbaAddress, amountBN],
          account: address
        })
        gasEstimate = (gasEstimate * BigInt(120)) / BigInt(100)
        const cap = BigInt(15_000_000)
        if (gasEstimate > cap) gasEstimate = cap
      } catch (gasError) {
        console.warn('[AddFunds] Gas estimation failed, using fallback:', gasError)
      }

      const tx = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [tbaAddress, amountBN],
        gas: gasEstimate
      })

      console.log('[AddFunds] Transaction sent:', tx)
      alert(`✅ Sent ${amount} USDC to TBA. Tx: ${tx}`)
      setAmount('')
      setShowInput(false)
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase()
      if (err?.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) {
        // user canceled; ignore
      } else {
        console.error('[AddFunds] Transfer failed:', err)
        alert('Failed to send USDC. See console for details.')
      }
    } finally {
      setSending(false)
    }
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
      >
        Add Funds
      </button>
    )
  }

  const balanceFormatted = formatUnits(userBalance, 6)

  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Your Balance:</span>
        <span className="text-white font-semibold">{Number(balanceFormatted).toFixed(2)} USDC</span>
      </div>
      
      <input
        type="number"
        placeholder="Amount (USDC)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      <div className="flex gap-2">
        <button
          onClick={handleSend}
          disabled={sending || !amount || parseFloat(amount) <= 0 || userBalance === BigInt(0)}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors text-sm font-medium"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
        <button
          onClick={() => {
            setShowInput(false)
            setAmount('')
          }}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
        >
          Cancel
        </button>
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
  // Check if this is a funding proposal (no governor/TBA yet)
  const isFundingProposal = investment.governorAddress === '0x0000000000000000000000000000000000000000'
  
  const sharesFormatted = formatUnits(investment.shares, 18)
  const balanceFormatted = investment.tbaBalance !== undefined ? formatUnits(investment.tbaBalance, 6) : '0'
  
  // Get image URL and handle IPFS
  const getImageUrl = (imageUri?: string) => {
    if (!imageUri) return null
    if (imageUri.startsWith('ipfs://')) {
      return imageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
    }
    return imageUri
  }

  const imageUrl = getImageUrl(investment.metadata?.image)

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden hover:border-emerald-600/50 transition-all group">
      <div className="aspect-video bg-gradient-to-br from-emerald-900/40 via-blue-900/40 to-purple-900/40 flex items-center justify-center relative overflow-hidden">
        {imageUrl && !isFundingProposal ? (
          <>
            <img 
              src={imageUrl} 
              alt={investment.metadata?.name || `RWA #${investment.nftId.toString()}`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent"></div>
            <span className="text-white text-5xl font-bold relative z-10 drop-shadow-lg">#{investment.nftId.toString()}</span>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 group-hover:from-emerald-500/20 group-hover:to-blue-500/20 transition-all"></div>
            {isFundingProposal ? (
              <div className="text-center relative z-10">
                <div className="text-4xl mb-2">⏳</div>
                <span className="text-white text-2xl font-bold">Proposal #{investment.nftId.toString()}</span>
              </div>
            ) : (
              <span className="text-white text-5xl font-bold relative z-10">#{investment.nftId.toString()}</span>
            )}
          </>
        )}
      </div>

      <div className="p-5">
        {isFundingProposal ? (
          <>
            <div className="mb-3">
              <span className="inline-block px-3 py-1 bg-yellow-900/50 text-yellow-300 rounded-full text-xs font-medium">
                🔄 In Funding
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">{investment.metadata.name || `Proposal #${investment.nftId}`}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Your investment in this funding proposal. Once the funding goal is reached and the proposal is finalized, you'll receive voting shares in the RWA NFT.
            </p>
            <Link
              href="/projects"
              className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center font-medium text-sm"
            >
              View Proposal
            </Link>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-white mb-4">
              {investment.metadata?.name || `RWA NFT #${investment.nftId.toString()}`}
            </h3>

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

            <div className="flex flex-col gap-2">
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
              <AddFundsButton tbaAddress={investment.tbaAddress} />
            </div>
          </>
        )}
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
            <h2 className="text-2xl font-bold text-white">
              Create Proposal for {investment.metadata?.name || `RWA #${investment.nftId.toString()}`}
            </h2>
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
                <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-emerald-400 transition-colors">1. Change Name</h3>
                <p className="text-gray-400 text-sm">Update the name for this RWA NFT</p>
              </button>

              <button
                onClick={() => setSelectedType('changeImage')}
                className="w-full p-6 border-2 border-gray-700 rounded-lg hover:border-blue-600 hover:bg-gray-700/50 transition-all text-left group"
              >
                <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-blue-400 transition-colors">2. Change Image URL</h3>
                <p className="text-gray-400 text-sm">Update the image URL for this RWA NFT</p>
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
  investment: RWAInvestment & { tbaBalance?: bigint }
  proposalType: 'changeName' | 'changeImage' | 'withdraw'
  onBack: () => void
  onSuccess: () => void
}) {
  const { data: walletClient } = useWalletClient()

  const [name, setName] = useState('')
  const [imageURL, setImageURL] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tbaBalance = investment.tbaBalance || BigInt(0)
  const tbaBalanceFormatted = formatUnits(tbaBalance, 6)

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
        // Merge existing metadata with new name
        const { buildMergedMetadataURI, buildChangeNameProposal } = await import('@/lib/rwaGovernance')
        const currentUri = investment.metadata?.uri || ''
        const merged = await buildMergedMetadataURI(currentUri, { name })
        proposalData = buildChangeNameProposal(investment.nftId, merged)
      } else if (proposalType === 'changeImage') {
        const { buildMergedMetadataURI, buildChangeImageProposal } = await import('@/lib/rwaGovernance')
        const currentUri = investment.metadata?.uri || ''
        const merged = await buildMergedMetadataURI(currentUri, { image: imageURL })
        proposalData = buildChangeImageProposal(investment.nftId, merged)
      } else {
        const amountWei = parseUnits(amount, 6) // USDC has 6 decimals
        proposalData = buildWithdrawProposal(investment.nftId, amountWei)
      }

      // Estimate gas and cap it below RPC cap to avoid "transaction gas limit too high" reverts
      let gasOverride: bigint | undefined = undefined
      try {
        const estimated = await publicClient.estimateContractGas({
          address: investment.governorAddress,
          abi: RWA_GOVERNOR_ABI,
          functionName: 'propose',
          args: [proposalData.targets, proposalData.values, proposalData.calldatas, proposalData.description],
          account: walletClient.account?.address as Address,
        })
        // Add a 20% buffer but keep well under common caps (e.g., 16,777,216)
        const buffered = (estimated * 12n) / 10n
        const cap = 15_000_000n
        gasOverride = buffered > cap ? cap : buffered
      } catch (e) {
        // If estimation fails, fall back to a conservative cap
        gasOverride = 4_000_000n
      }

      const hash = await walletClient.writeContract({
        address: investment.governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'propose',
        args: [proposalData.targets, proposalData.values, proposalData.calldatas, proposalData.description],
        gas: gasOverride,
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
          {proposalType === 'changeName' && `Change Name for ${investment.metadata?.name || `RWA #${investment.nftId.toString()}`}`}
          {proposalType === 'changeImage' && `Change Image for ${investment.metadata?.name || `RWA #${investment.nftId.toString()}`}`}
          {proposalType === 'withdraw' && `Withdraw Funds from ${investment.metadata?.name || `RWA #${investment.nftId.toString()}`}`}
        </h3>

        {proposalType === 'changeName' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My RWA NFT"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              Enter the new name for this RWA NFT
            </p>
          </div>
        )}

        {proposalType === 'changeImage' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Image URL
            </label>
            <input
              type="url"
              value={imageURL}
              onChange={(e) => setImageURL(e.target.value)}
              placeholder="https://... or ipfs://..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              Enter the URL for the new image
            </p>
          </div>
        )}

        {proposalType === 'withdraw' && (
          <div>
            <div className="mb-4 p-3 bg-gray-700/50 border border-gray-600 rounded-lg flex justify-between items-center">
              <span className="text-sm text-gray-300">TBA Balance:</span>
              <span className={`font-semibold ${tbaBalance === BigInt(0) ? 'text-red-400' : 'text-blue-400'}`}>
                {Number(tbaBalanceFormatted).toFixed(2)} USDC
              </span>
            </div>
            
            {tbaBalance === BigInt(0) && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm font-medium">
                  ⚠️ Warning: The TBA has no USDC balance. This withdrawal proposal will fail if executed.
                </p>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount to Withdraw (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              disabled={tbaBalance === BigInt(0)}
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
