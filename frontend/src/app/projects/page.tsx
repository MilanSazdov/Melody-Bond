'use client';

import { useState, useEffect, useRef } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { formatUnits, parseUnits, type Address } from 'viem';
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const loadStartedRef = useRef(false);
  const [copiedAddresses, setCopiedAddresses] = useState<Record<string, boolean>>({});

  // Load proposals
  useEffect(() => {
    // Prevent double execution in React 18 StrictMode (dev fast refresh)
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    let isMounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        console.log('[Projects] Starting loadProposals');
        if (!CONTRACTS.DAO || !CONTRACTS.USDC) {
          console.warn('[Projects] Missing contract addresses', CONTRACTS);
          if (isMounted) setProposals([]);
          return;
        }
        if (!CONTRACTS.DAO.startsWith('0x') || CONTRACTS.DAO.length !== 42) {
          console.error('[Projects] Invalid DAO address', CONTRACTS.DAO);
          if (isMounted) setProposals([]);
          return;
        }
        console.log('[Projects] DAO:', CONTRACTS.DAO, 'USDC:', CONTRACTS.USDC);
        await loadProposalsData(isMounted);
      } catch (e: any) {
        console.error('[Projects] Top-level load failed:', e);
        if (isMounted) setFetchError(e?.message || 'Failed to load proposals');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
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
      let fromBlock = BigInt(0);
      if (process.env.NEXT_PUBLIC_DEPLOY_BLOCK) {
        const v = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
        if (v && /^\d+$/.test(v)) {
          try { fromBlock = BigInt(v); } catch {}
        }
      }
      const toBlock: bigint | 'latest' = 'latest';

      // Helper to safely fetch single-event logs (fallback empty array on failure)
      const safeGetEventLogs = async (eventDesc: any): Promise<any[]> => {
        try {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.DAO,
            event: eventDesc as any,
            fromBlock,
            toBlock,
          });
          return Array.isArray(logs) ? logs : [];
        } catch (err) {
          console.warn('[Projects] safeGetEventLogs failed for', eventDesc?.name, err);
          return [];
        }
      };

      // Fetch creation events (explicit ABI avoids parse issues)
      let createdLogs: any[] = [];
      try {
        console.log('[Projects] Fetching RWAFundingProposalCreated logs from', fromBlock.toString(), 'to latest');
        const RWAFundingProposalCreatedEvent = {
          type: 'event',
          name: 'RWAFundingProposalCreated',
          inputs: [
            { name: 'proposalId', type: 'uint256', indexed: true },
            { name: 'proposer', type: 'address', indexed: true },
            { name: 'targetUSDC', type: 'uint256', indexed: false },
            { name: 'deadline', type: 'uint256', indexed: false },
          ],
        } as const;
        createdLogs = await safeGetEventLogs(RWAFundingProposalCreatedEvent);
        console.log('[Projects] Got', createdLogs.length, 'RWAFundingProposalCreated events');
      } catch (e) {
        console.warn('[Projects] RWAFundingProposalCreated getLogs failed (will continue with empty list)', e);
        if (isMounted && !createdLogs.length) {
          setFetchError('Could not fetch funding proposal events.');
        }
        createdLogs = [];
      }
      if (!Array.isArray(createdLogs)) createdLogs = [];

      // Find finalized proposals and exclude them from list
      const finalizedIds = new Set<string>();
      try {
        const RWADeployedEvent = {
          type: 'event',
          name: 'RWADeployed',
          inputs: [
            { name: 'nftId', type: 'uint256', indexed: true },
            { name: 'governor', type: 'address', indexed: false },
            { name: 'tba', type: 'address', indexed: false },
          ],
        } as const;
        const deployedLogs = await safeGetEventLogs(RWADeployedEvent);
        for (const dlog of (Array.isArray(deployedLogs) ? deployedLogs : [])) {
          const nftId = (dlog as any)?.args?.nftId as bigint | undefined;
          if (!nftId) continue;
          try {
            const pid = await publicClient.readContract({ address: CONTRACTS.DAO, abi: DAO_ABI, functionName: 'nftProposalId', args: [nftId] }) as bigint;
            if (pid && pid !== BigInt(0)) finalizedIds.add(pid.toString());
          } catch {}
        }
      } catch (e) {
        console.warn('[Projects] RWADeployed getLogs failed (continuing)', e);
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
      if (items.length > 0) {
        console.log('[Projects] Items:', items.map(i => ({ id: i.id.toString(), state: i.state, deadline: i.deadline.toString(), target: i.targetUSDC.toString(), raised: i.raisedUSDC.toString() })));
      }
      
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
    } catch (error: any) {
      console.error('[Projects] Error loading proposals:', error);
      if (isMounted) setFetchError(error?.message || 'Failed to load proposals');
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
      // Pre-flight: ensure USDC contract code exists on current chain to avoid ContractFunctionExecutionError ("0x" return data)
      let code: string | undefined = undefined;
      try {
        code = await publicClient.getBytecode({ address: CONTRACTS.USDC });
      } catch (codeErr) {
        console.warn('[Projects] getBytecode failed for USDC address', CONTRACTS.USDC, codeErr);
      }
      if (!code || code === '0x') {
        console.warn('[Projects] USDC contract not deployed on this network. Skipping balance/allowance reads.');
        if (isMounted) {
          setUsdcBalance(0n);
          setUsdcAllowance(0n);
        }
        return;
      }
      // Safe sequential reads to isolate failures & suppress stack traces
      const safeRead = async <T,>(fn: () => Promise<T>, label: string): Promise<T | undefined> => {
        try {
          return await fn();
        } catch (err: any) {
          const msg = (err?.message || '').toLowerCase();
          if (msg.includes('returned no data') || msg.includes('execution error')) {
            console.warn(`[Projects] ${label} unavailable (no data). Treating as zero.`);
          } else {
            console.warn(`[Projects] ${label} read failed`, err);
          }
          return undefined;
        }
      };

      const balance = await safeRead(async () => {
        return await publicClient.readContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as bigint;
      }, 'USDC balance');

      const allowance = await safeRead(async () => {
        return await publicClient.readContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: 'allowance',
          args: [address, CONTRACTS.DAO],
        }) as bigint;
      }, 'USDC allowance');

      const finalBalance = typeof balance === 'bigint' ? balance : 0n;
      const finalAllowance = typeof allowance === 'bigint' ? allowance : 0n;
      console.log('[Projects] USDC Balance:', finalBalance.toString(), 'Allowance:', finalAllowance.toString());
      if (isMounted) {
        setUsdcBalance(finalBalance);
        setUsdcAllowance(finalAllowance);
      }
    } catch (error) {
      console.error('[Projects] Error loading USDC info:', error);
      // On error, avoid throwing; set zeros to keep UI consistent
      if (isMounted) {
        setUsdcBalance(0n);
        setUsdcAllowance(0n);
      }
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

  // Helper to get image URL (handle IPFS)
  const getImageUrl = (imageUri?: string) => {
    if (!imageUri) return null;
    if (imageUri.startsWith('ipfs://')) {
      return imageUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return imageUri;
  };

  // Group proposals by artist/proposer
  const groupByArtist = () => {
    const groups = new Map<string, { artist: Address; proposals: RWAProposal[] }>();
    
    proposals.forEach(proposal => {
      const existing = groups.get(proposal.proposer);
      if (existing) {
        existing.proposals.push(proposal);
      } else {
        groups.set(proposal.proposer, {
          artist: proposal.proposer,
          proposals: [proposal]
        });
      }
    });
    
    return Array.from(groups.values());
  };

  const artistGroups = groupByArtist();

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddresses(prev => ({ ...prev, [address]: true }));
      setTimeout(() => {
        setCopiedAddresses(prev => ({ ...prev, [address]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-300">
        <div className="container mx-auto px-4 py-10">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
            <p className="text-gray-400">Loading projects...</p>
            {fetchError && <p className="text-red-400 text-xs mt-4">{fetchError}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-gray-400">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-12">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/40 via-blue-900/40 to-purple-900/40 border border-emerald-500/20 p-8 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
            
            <div className="relative z-10">
              <h1 className="text-5xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
                Discover Artists & Projects
              </h1>
              <p className="text-xl text-gray-300 mb-6">Invest in real-world asset tokenization and support creative talent</p>
              
              <CreateProposalForm onSuccess={() => loadProposalsData(true)} />
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/60 backdrop-blur-sm border border-emerald-500/20 rounded-lg p-4">
                  <div className="text-3xl mb-2">🎵</div>
                  <div className="text-sm text-gray-400">Total Artists</div>
                  <div className="text-2xl font-bold text-emerald-400">{artistGroups.length}</div>
                </div>
                <div className="bg-gray-800/60 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
                  <div className="text-3xl mb-2">🚀</div>
                  <div className="text-sm text-gray-400">Active Projects</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {proposals.filter(p => p.state === RWAProposalState.Funding).length}
                  </div>
                </div>
                <div className="bg-gray-800/60 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4">
                  <div className="text-3xl mb-2">💰</div>
                  <div className="text-sm text-gray-400">Total Raised</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {formatUnits(proposals.reduce((sum, p) => sum + p.raisedUSDC, BigInt(0)), 6)} USDC
                  </div>
                </div>
              </div>

              {address && (
                <div className="mt-4 p-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Your Wallet Balance:</span>
                    <span className="text-lg font-bold text-white">{formatUnits(usdcBalance, 6)} USDC</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {fetchError}
          </div>
        )}

        {/* Artists & Their Projects */}
        {proposals.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700">
            <div className="mb-6 text-8xl">🎨</div>
            <p className="text-2xl text-gray-300 mb-3 font-semibold">No Projects Yet</p>
            <p className="text-gray-400 mb-6">Be the first to create an RWA tokenization project!</p>
            <div className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-lg font-medium">
              Create Your First Project
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {artistGroups.map((group, idx) => {
              const firstProject = group.proposals[0];
              const firstMeta = metadata[firstProject.id.toString()];
              const totalRaised = group.proposals.reduce((sum, p) => sum + p.raisedUSDC, BigInt(0));
              const activeCount = group.proposals.filter(p => p.state === RWAProposalState.Funding).length;
              const copied = copiedAddresses[group.artist] || false;
              
              return (
                <div key={group.artist} className="group">
                  {/* Artist Header */}
                  <div className="mb-6 flex items-start gap-6 p-6 rounded-2xl bg-gradient-to-r from-gray-800/80 to-gray-800/40 border border-gray-700 hover:border-emerald-500/50 transition-all backdrop-blur-sm">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-500 p-1">
                        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-3xl font-bold text-white">
                          🎵
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-gray-900 flex items-center justify-center text-xs font-bold">
                        {group.proposals.length}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-gray-400 font-mono text-sm">
                          {group.artist.slice(0, 10)}...{group.artist.slice(-8)}
                        </span>
                        <button
                          onClick={() => handleCopyAddress(group.artist)}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-lg text-xs font-medium transition-all flex items-center gap-2 group/copy"
                          title="Copy full address"
                        >
                          {copied ? (
                            <>
                              <span className="text-base">✓</span>
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <span className="text-base">📋</span>
                              <span className="group-hover/copy:text-emerald-300">Copy Address</span>
                            </>
                          )}
                        </button>
                        {activeCount > 0 && (
                          <span className="px-3 py-1 bg-emerald-900/50 text-emerald-300 rounded-full text-xs font-medium border border-emerald-700/50">
                            {activeCount} Active Project{activeCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-400">Total Projects:</span>
                          <span className="ml-2 font-semibold text-white">{group.proposals.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Total Raised:</span>
                          <span className="ml-2 font-semibold text-emerald-400">{formatUnits(totalRaised, 6)} USDC</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Artist's Projects Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-0 md:pl-6">
                    {group.proposals.map((proposal) => {
                      const meta = metadata[proposal.id.toString()];
                      const progress = Number((proposal.raisedUSDC * BigInt(100)) / proposal.targetUSDC);
                      const canFinalize = proposal.deadline <= BigInt(Math.floor(Date.now() / 1000));
                      const investTxKey = `invest-${proposal.id}`;
                      const finalizeTxKey = `finalize-${proposal.id}`;
                      const pendingTx = pendingTxs[investTxKey] || pendingTxs[finalizeTxKey];
                      const imageUrl = getImageUrl(meta?.image);

                      return (
                        <div 
                          key={proposal.id.toString()} 
                          className="group/card relative overflow-hidden rounded-xl bg-gray-800/60 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 backdrop-blur-sm"
                        >
                          {/* Project Image */}
                          <div className="relative w-full h-56 overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800">
                            {imageUrl ? (
                              <>
                                <img 
                                  src={imageUrl}
                                  alt={meta?.name || `Project #${proposal.id}`}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-5xl mb-2">🎵</div>
                                  <div className="text-sm text-gray-500">Loading...</div>
                                </div>
                              </div>
                            )}
                            
                            {/* Status Badge */}
                            <div className="absolute top-3 right-3">
                              {proposal.state === RWAProposalState.Executed && (
                                <span className="px-3 py-1.5 bg-emerald-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-lg">
                                  ✓ EXECUTED
                                </span>
                              )}
                              {proposal.state === RWAProposalState.Succeeded && (
                                <span className="px-3 py-1.5 bg-blue-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-lg">
                                  SUCCEEDED
                                </span>
                              )}
                              {proposal.state === RWAProposalState.Failed && (
                                <span className="px-3 py-1.5 bg-red-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-lg">
                                  FAILED
                                </span>
                              )}
                              {proposal.state === RWAProposalState.Funding && canFinalize && (
                                <span className="px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-lg">
                                  ENDED
                                </span>
                              )}
                              {proposal.state === RWAProposalState.Funding && !canFinalize && (
                                <span className="px-3 py-1.5 bg-emerald-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-lg animate-pulse">
                                  🔴 LIVE
                                </span>
                              )}
                            </div>

                            {/* Transaction Status */}
                            {pendingTx && (
                              <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm shadow-lg ${
                                pendingTx.status === 'pending' ? 'bg-blue-500/90 text-white animate-pulse' :
                                pendingTx.status === 'success' ? 'bg-green-500/90 text-white' :
                                'bg-red-500/90 text-white'
                              }`}>
                                {pendingTx.status === 'pending' && '⏳ Processing'}
                                {pendingTx.status === 'success' && '✓ Success'}
                                {pendingTx.status === 'error' && '✗ Failed'}
                              </div>
                            )}

                            {/* Project ID Badge */}
                            <div className="absolute bottom-3 left-3">
                              <span className="px-3 py-1 bg-gray-900/80 backdrop-blur-sm text-gray-300 rounded-full text-xs font-mono">
                                #{proposal.id.toString()}
                              </span>
                            </div>
                          </div>

                          {/* Project Info */}
                          <div className="p-5">
                            <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover/card:text-emerald-400 transition-colors">
                              {meta?.name || `Project #${proposal.id}`}
                            </h3>
                            <p className="text-sm text-gray-400 mb-4 line-clamp-2 leading-relaxed">
                              {meta?.description || 'Loading project details...'}
                            </p>

                            {/* Funding Progress */}
                            <div className="mb-4">
                              <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-gray-400 font-medium">Funding Progress</span>
                                <span className="text-emerald-400 font-bold">{progress}%</span>
                              </div>
                              <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/50"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-xs mt-2">
                                <span className="text-white font-semibold">{formatUnits(proposal.raisedUSDC, 6)} USDC</span>
                                <span className="text-gray-500">Goal: {formatUnits(proposal.targetUSDC, 6)} USDC</span>
                              </div>
                            </div>

                            {/* Time Remaining */}
                            <div className="flex items-center gap-2 mb-4 text-xs">
                              <span className="text-gray-400">⏰</span>
                              <span className="text-gray-300 font-medium">{getTimeRemaining(proposal.deadline)}</span>
                            </div>

                            {/* Action Buttons */}
                            {proposal.state === RWAProposalState.Executed ? (
                              <div className="w-full bg-gray-700/50 text-gray-400 px-4 py-3 rounded-lg text-center text-sm font-medium border border-gray-600">
                                🎉 Project Completed
                              </div>
                            ) : proposal.state === RWAProposalState.Failed ? (
                              <button
                                onClick={() => reclaimInvestment(proposal.id)}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 rounded-lg hover:from-orange-700 hover:to-red-700 transition-all font-semibold text-sm shadow-lg"
                              >
                                Reclaim Investment
                              </button>
                            ) : !canFinalize ? (
                              <div className="space-y-2">
                                <input
                                  type="number"
                                  placeholder="Amount in USDC"
                                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                                  value={investAmounts[proposal.id.toString()] || ''}
                                  onChange={(e) => setInvestAmounts(prev => ({
                                    ...prev,
                                    [proposal.id.toString()]: e.target.value
                                  }))}
                                />
                                <button
                                  onClick={() => invest(proposal.id, investAmounts[proposal.id.toString()] || '0')}
                                  className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-4 py-3 rounded-lg hover:from-emerald-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg hover:shadow-emerald-500/50"
                                  disabled={!address || !investAmounts[proposal.id.toString()] || pendingTxs[investTxKey]?.status === 'pending'}
                                >
                                  {pendingTxs[investTxKey]?.status === 'pending' ? '⏳ Processing...' : '💰 Invest Now'}
                                </button>
                              </div>
                            ) : address?.toLowerCase() === proposal.proposer.toLowerCase() ? (
                              <button
                                onClick={() => finalizeProposal(proposal.id)}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg"
                                disabled={pendingTxs[finalizeTxKey]?.status === 'pending'}
                              >
                                {pendingTxs[finalizeTxKey]?.status === 'pending' ? '⏳ Processing...' : '✨ Finalize (Gasless)'}
                              </button>
                            ) : (
                              <div className="w-full bg-gray-700/50 text-gray-400 px-4 py-3 rounded-lg text-center text-sm font-medium border border-gray-600">
                                Awaiting finalization
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
