'use client';

import { useState, useEffect } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { formatUnits, parseUnits, type Address, parseAbiItem } from 'viem';
import { publicClient } from '@/lib/clients';
import { CONTRACTS, DAO_ABI, USDC_ABI, RWAProposalState, usdcToShares } from '@/contracts';
import { gaslessFinalize } from '@/lib/accountAbstraction';
import CreateProposalForm from '@/components/CreateProposalForm';

interface RWAProposal {
  id: bigint;
  proposer: Address;
  targetUSDC: bigint;
  raisedUSDC: bigint;
  deadline: bigint;
  nftMetadataURI: string;
  state: number;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
}

export default function ProjectsPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [proposals, setProposals] = useState<RWAProposal[]>([]);
  const [metadata, setMetadata] = useState<Record<string, NFTMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [investAmounts, setInvestAmounts] = useState<Record<string, string>>({});
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [usdcAllowance, setUsdcAllowance] = useState<bigint>(BigInt(0));
  const [pendingTxs, setPendingTxs] = useState<Record<string, { type: string; status: 'pending' | 'success' | 'error'; message?: string }>>({});

  // Load proposals
  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      try {
        setLoading(true);
        console.log('[Projects] Starting loadProposals');
        
        if (!CONTRACTS.DAO || !CONTRACTS.USDC) {
          console.warn('[Projects] Missing contract addresses', CONTRACTS);
          if (isMounted) setProposals([]);
          return;
        }
        console.log('[Projects] DAO:', CONTRACTS.DAO, 'USDC:', CONTRACTS.USDC);
        if (!CONTRACTS.DAO.startsWith('0x') || CONTRACTS.DAO.length !== 42) {
          console.error('[Projects] Invalid DAO address', CONTRACTS.DAO);
          if (isMounted) setProposals([]);
          return;
        }

        await loadProposalsData(isMounted);
      } catch (error) {
        console.error('[Projects] Error in load:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load USDC balance and allowance
  useEffect(() => {
    let isMounted = true;
    
    if (address) {
      loadUSDCInfo(isMounted);
    }
    
    return () => {
      isMounted = false;
    };
  }, [address]);

  async function loadProposalsData(isMounted: boolean) {
    try {

      // Discover proposals via events to avoid relying on nextRWAProposalId
      let latestBlock: bigint | undefined;
      try { latestBlock = await publicClient.getBlockNumber(); } catch {}
      let fromBlock = BigInt(0);
      if (process.env.NEXT_PUBLIC_DEPLOY_BLOCK) {
        const v = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
        if (v && /^\d+$/.test(v)) {
          try { fromBlock = BigInt(v); } catch {}
        }
      }

      // Fetch creation events
      let createdLogs: any[] = [];
      try {
        console.log('[Projects] Fetching events from block', fromBlock.toString(), 'to', latestBlock?.toString());
        const createdEvent = parseAbiItem('event RWAFundingProposalCreated(uint256 indexed proposalId, address indexed proposer, uint256 targetUSDC, uint256 deadline)');
        if ((createdEvent as any)?.inputs) {
          createdLogs = await publicClient.getLogs({
            address: CONTRACTS.DAO,
            event: createdEvent,
            ...(latestBlock ? { toBlock: latestBlock } : {}),
            fromBlock,
          });
          console.log('[Projects] Got', createdLogs.length, 'RWAFundingProposalCreated events');
        }
      } catch (e) {
        console.warn('[Projects] RWAFundingProposalCreated getLogs failed', e);
        createdLogs = [];
      }
      if (!Array.isArray(createdLogs)) createdLogs = [];

      // Find finalized proposals and exclude them from list
      const finalizedIds = new Set<string>();
      try {
        const deployedEvent = parseAbiItem('event RWADeployed(uint256 indexed nftId, address governor, address tba)');
        if ((deployedEvent as any)?.inputs) {
          const deployedLogs = await publicClient.getLogs({
            address: CONTRACTS.DAO,
            event: deployedEvent,
            ...(latestBlock ? { toBlock: latestBlock } : {}),
            fromBlock,
          });
          for (const dlog of (Array.isArray(deployedLogs) ? deployedLogs : [])) {
            const nftId = (dlog as any)?.args?.nftId as bigint | undefined;
            if (!nftId) continue;
            try {
              const pid = await publicClient.readContract({ address: CONTRACTS.DAO, abi: DAO_ABI, functionName: 'nftProposalId', args: [nftId] }) as bigint;
              if (pid && pid !== BigInt(0)) finalizedIds.add(pid.toString());
            } catch {}
          }
        }
      } catch (e) {
        console.warn('[Projects] RWADeployed getLogs failed', e);
      }

      // Build proposals from creation logs, enrich via rwaProposals if available
      const items: RWAProposal[] = [];
      for (const clog of createdLogs) {
        const proposalId = (clog as any)?.args?.proposalId as bigint;
        if (!proposalId) continue;
        // Show all proposals including finalized ones
        const isFinalized = finalizedIds.has(proposalId.toString());
        const proposer = (clog as any)?.args?.proposer as Address;
        const targetUSDC = ((clog as any)?.args?.targetUSDC as bigint) || BigInt(0);
        const deadline = ((clog as any)?.args?.deadline as bigint) || BigInt(0);

        // Try to read full struct; fall back gracefully
        let raisedUSDC = BigInt(0);
        let nftMetadataURI = '';
        let stateNum: number = RWAProposalState.Funding;
        try {
          const tup = await publicClient.readContract({ address: CONTRACTS.DAO, abi: DAO_ABI, functionName: 'rwaProposals', args: [proposalId] }) as any;
          if (tup && tup.length >= 7) {
            // [exists, proposer, targetUSDC, raisedUSDC, deadline, nftMetadataURI, state]
            raisedUSDC = tup[3] as bigint;
            nftMetadataURI = (tup[5] as string) || '';
            stateNum = Number(tup[6] as bigint | number);
          }
        } catch {}

        // If finalized, set state to Executed for display purposes
        if (isFinalized && stateNum === RWAProposalState.Succeeded) {
          stateNum = RWAProposalState.Executed;
        }

        items.push({ id: proposalId, proposer, targetUSDC, raisedUSDC, deadline, nftMetadataURI, state: stateNum });
      }

      // Show ALL proposals (active, ended, succeeded, failed, finalized)
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      console.log('[Projects] Built', items.length, 'items before filtering');
      console.log('[Projects] Items:', items.map(i => ({ id: i.id.toString(), state: i.state, deadline: i.deadline.toString(), target: i.targetUSDC.toString(), raised: i.raisedUSDC.toString() })));
      
      // Sort by proposal ID (newest first)
      const sorted = items.sort((a, b) => Number(b.id - a.id));
      
      console.log('[Projects] Showing all', sorted.length, 'proposals');
      if (isMounted) setProposals(sorted);

      // Load metadata in background
      for (const p of sorted) {
        if (!isMounted) break;
        if (p.nftMetadataURI) {
          try {
            console.log('[Projects] Fetching metadata for proposal', p.id.toString(), 'from', p.nftMetadataURI);
            
            let meta;
            // Handle data URIs
            if (p.nftMetadataURI.startsWith('data:application/json;base64,')) {
              // Base64 encoded
              const base64Data = p.nftMetadataURI.replace('data:application/json;base64,', '');
              const jsonString = atob(base64Data);
              meta = JSON.parse(jsonString);
            } else if (p.nftMetadataURI.startsWith('data:application/json,')) {
              // Plain JSON (URL-encoded)
              const jsonStr = p.nftMetadataURI.slice('data:application/json,'.length);
              const decoded = decodeURIComponent(jsonStr);
              meta = JSON.parse(decoded);
            } else {
              // Handle regular URLs (IPFS, HTTP, etc.)
              const res = await fetch(p.nftMetadataURI);
              meta = await res.json();
            }
            
            console.log('[Projects] Loaded metadata:', meta);
            if (isMounted) setMetadata(prev => ({ ...prev, [p.id.toString()]: meta }));
          } catch (e) {
            console.warn('[Projects] metadata load failed for proposal', p.id.toString(), e);
          }
        } else {
          console.log('[Projects] No metadata URI for proposal', p.id.toString());
        }
      }
    } catch (error) {
      console.error('[Projects] Error loading proposals:', error);
    }
  }

  async function loadUSDCInfo(isMounted: boolean) {
    console.log('[Projects] Loading USDC info for address:', address);
    if (!address) {
      console.log('[Projects] No address connected, skipping USDC info load');
      return;
    }
    if (!CONTRACTS.USDC) {
      console.warn('[Projects] USDC contract address missing');
      return;
    }
    console.log('[Projects] USDC contract:', CONTRACTS.USDC, 'DAO contract:', CONTRACTS.DAO);

    try {
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'allowance',
          args: [address, CONTRACTS.DAO],
        }) as Promise<bigint>,
      ]);

      console.log('[Projects] USDC Balance:', balance.toString(), 'Allowance:', allowance.toString());
      if (isMounted) {
        setUsdcBalance(balance);
        setUsdcAllowance(allowance);
      }
    } catch (error) {
      console.error('[Projects] Error loading USDC info:', error);
    }
  }

  async function approveUSDC(amount: bigint) {
    if (!walletClient || !address) return;
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACTS.DAO, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await loadUSDCInfo(true);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) return;
      console.error('Error approving USDC:', error);
    }
  }

  async function invest(proposalId: bigint, amount: string) {
    if (!walletClient || !address) return;
    const txKey = `invest-${proposalId}`;
    try {
      setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'invest', status: 'pending' } }));
      
      const amountBigInt = parseUnits(amount, 6); // USDC decimals
      if (amountBigInt > usdcBalance) {
        setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'invest', status: 'error', message: 'Insufficient balance' } }));
        setTimeout(() => setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; }), 3000);
        return;
      }
      
      // Check allowance and approve if needed
      if (amountBigInt > usdcAllowance) {
        await approveUSDC(amountBigInt);
      }
      
      // User calls invest directly (pays gas themselves)
      // This is necessary because the contract does transferFrom(msg.sender, ...)
      const hash = await walletClient.writeContract({
        address: CONTRACTS.DAO,
        abi: DAO_ABI,
        functionName: 'invest',
        args: [proposalId, amountBigInt],
        account: address,
        chain: walletClient.chain,
      });

      // Wait for transaction
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'invest', status: 'success', message: `TX: ${hash.slice(0, 10)}...` } }));
      } else {
        setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'invest', status: 'error', message: 'Transaction failed' } }));
      }
      
      setTimeout(() => setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; }), 5000);
      await loadProposalsData(true);
      await loadUSDCInfo(true);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) {
        setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; });
        return;
      }
      console.error('Error investing:', error);
      setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'invest', status: 'error', message: error.message || 'Failed' } }));
      setTimeout(() => setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; }), 5000);
    }
  }

  async function finalizeProposal(proposalId: bigint) {
    const txKey = `finalize-${proposalId}`;
    try {
      setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'finalize', status: 'pending' } }));
      
      const txHash = await gaslessFinalize(proposalId);
      setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'finalize', status: 'success', message: `TX: ${txHash.slice(0, 10)}...` } }));
      setTimeout(() => setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; }), 5000);
      await loadProposalsData(true);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) {
        setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; });
        return;
      }
      console.error('Error finalizing:', error);
      setPendingTxs(prev => ({ ...prev, [txKey]: { type: 'finalize', status: 'error', message: error.message || 'Failed' } }));
      setTimeout(() => setPendingTxs(prev => { const n = {...prev}; delete n[txKey]; return n; }), 5000);
    }
  }

  async function reclaimInvestment(proposalId: bigint) {
    if (!walletClient || !address) return;
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.DAO,
        abi: DAO_ABI,
        functionName: 'reclaimInvestment',
        args: [proposalId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await loadProposalsData(true);
      await loadUSDCInfo(true);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) return;
      console.error('Error reclaiming investment:', error);
    }
  }

  function getTimeRemaining(deadline: bigint): string {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline <= now) return 'Ended';
    
    const remaining = Number(deadline - now);
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="text-xl text-white">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-400">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 bg-gray-800 p-6 rounded-lg">
          <h1 className="text-4xl font-bold mb-2 text-white">RWA Funding Projects</h1>
          <p className="text-gray-300">Invest in real-world asset tokenization projects</p>
          
          <CreateProposalForm onSuccess={() => loadProposalsData(true)} />
          
          <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <h3 className="text-sm font-bold text-blue-300 mb-2">💡 How It Works</h3>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• <strong>Invest:</strong> Fund projects with USDC (you pay gas)</li>
              <li>• <strong>Get Shares:</strong> Receive voting power proportional to investment</li>
              <li>• <strong>Project Succeeds:</strong> Funds go to DAO Treasury, NFT minted with TBA wallet</li>
              <li>• <strong>Earn Revenue:</strong> Project creator sends revenue to TBA wallet</li>
              <li>• <strong>Withdraw:</strong> Vote to distribute revenue from TBA (gasless voting!)</li>
            </ul>
          </div>

          {address && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-white">
                <strong>Your USDC Balance:</strong> {formatUnits(usdcBalance, 6)} USDC
              </p>
              <p className="text-sm text-gray-300 mt-1">
                When you invest 100 USDC, you receive {formatUnits(usdcToShares(BigInt(100 * 1e6)), 18)} voting shares (18 decimals)
              </p>
            </div>
          )}
        </div>

        {proposals.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <div className="mb-4 text-6xl">📋</div>
            <p className="text-xl text-gray-300 mb-2">No Funding Proposals Yet</p>
            <p className="text-gray-400">Create the first RWA tokenization project to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map((proposal) => {
            const meta = metadata[proposal.id.toString()];
            const progress = Number((proposal.raisedUSDC * BigInt(100)) / proposal.targetUSDC);
            const canFinalize = proposal.deadline <= BigInt(Math.floor(Date.now() / 1000));
            const investTxKey = `invest-${proposal.id}`;
            const finalizeTxKey = `finalize-${proposal.id}`;
            const pendingTx = pendingTxs[investTxKey] || pendingTxs[finalizeTxKey];

            return (
              <div key={proposal.id.toString()} className="border border-gray-700 rounded-lg overflow-hidden shadow-lg bg-gray-800 relative">
                <div className="w-full h-48 bg-gray-700 flex items-center justify-center overflow-hidden">
                  {meta?.image ? (
                    <img 
                      src={meta.image} 
                      alt={meta?.name || `Proposal #${proposal.id}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x300/1f2937/9ca3af?text=RWA+Project';
                      }}
                    />
                  ) : (
                    <div className="text-gray-500 text-center p-4">
                      <div className="text-4xl mb-2">🏢</div>
                      <div className="text-sm">Loading image...</div>
                    </div>
                  )}
                </div>
                {pendingTx && (
                  <div className={`absolute top-2 right-2 px-3 py-1 rounded text-sm font-medium ${
                    pendingTx.status === 'pending' ? 'bg-blue-600 text-white animate-pulse' :
                    pendingTx.status === 'success' ? 'bg-green-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {pendingTx.status === 'pending' && '⏳ Processing...'}
                    {pendingTx.status === 'success' && '✓ Success!'}
                    {pendingTx.status === 'error' && `✗ ${pendingTx.message || 'Failed'}`}
                  </div>
                )}
                <div className="p-6 bg-gray-700">
                  <h3 className="text-xl font-bold mb-2 text-white">{meta?.name || `Proposal #${proposal.id}`}</h3>
                  <p className="text-gray-300 mb-4 line-clamp-3">{meta?.description || 'Loading...'}</p>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1 text-gray-300">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm mt-1 text-gray-300">
                      <span>{formatUnits(proposal.raisedUSDC, 6)} USDC</span>
                      <span>{formatUnits(proposal.targetUSDC, 6)} USDC</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">
                      {getTimeRemaining(proposal.deadline)}
                    </p>
                    {proposal.state === RWAProposalState.Executed && (
                      <span className="px-2 py-1 bg-emerald-900 text-emerald-200 rounded text-xs font-medium">
                        ✓ EXECUTED
                      </span>
                    )}
                    {proposal.state === RWAProposalState.Succeeded && (
                      <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs font-medium">
                        SUCCEEDED
                      </span>
                    )}
                    {proposal.state === RWAProposalState.Failed && (
                      <span className="px-2 py-1 bg-red-900 text-red-200 rounded text-xs font-medium">
                        FAILED
                      </span>
                    )}
                    {proposal.state === RWAProposalState.Funding && canFinalize && (
                      <span className="px-2 py-1 bg-yellow-900 text-yellow-200 rounded text-xs font-medium">
                        ENDED
                      </span>
                    )}
                  </div>

                  {proposal.state === RWAProposalState.Executed ? (
                    <div className="w-full bg-gray-600 text-gray-300 px-4 py-2 rounded text-center text-sm">
                      Project Finalized - NFT Minted
                    </div>
                  ) : proposal.state === RWAProposalState.Failed ? (
                    <button
                      onClick={() => reclaimInvestment(proposal.id)}
                      className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                    >
                      Reclaim Investment
                    </button>
                  ) : !canFinalize ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="Amount (USDC)"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                        value={investAmounts[proposal.id.toString()] || ''}
                        onChange={(e) => setInvestAmounts(prev => ({
                          ...prev,
                          [proposal.id.toString()]: e.target.value
                        }))}
                      />
                      <button
                        onClick={() => invest(proposal.id, investAmounts[proposal.id.toString()] || '0')}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        disabled={!address || !investAmounts[proposal.id.toString()] || pendingTxs[investTxKey]?.status === 'pending'}
                      >
                        {pendingTxs[investTxKey]?.status === 'pending' ? 'Processing...' : 'Invest'}
                      </button>
                    </div>
                  ) : address?.toLowerCase() === proposal.proposer.toLowerCase() ? (
                    <button
                      onClick={() => finalizeProposal(proposal.id)}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                      disabled={pendingTxs[finalizeTxKey]?.status === 'pending'}
                    >
                      {pendingTxs[finalizeTxKey]?.status === 'pending' ? 'Processing...' : 'Finalize (Gasless)'}
                    </button>
                  ) : (
                    <div className="w-full bg-gray-600 text-gray-400 px-4 py-2 rounded text-center text-sm">
                      Waiting for creator to finalize
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
