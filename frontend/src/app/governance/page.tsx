"use client";

import { useState, useEffect } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { formatUnits, type Address, type Hex, keccak256, toHex } from "viem";
import { publicClient } from "@/lib/clients";
// Use the same addresses & ABIs as portfolio to avoid mismatches
import { DAO_ADDRESS, DAO_ABI, RWA_GOVERNOR_ABI, RWA_ABI, RWA_ADDRESS } from "@/constants";
import { ProposalState, VoteSupport } from "@/contracts";
import { gaslessVoteRWA } from "@/lib/accountAbstraction";

// Retry helper for RPC calls that return "0x" or fail transiently
async function retryRead<T>(fn: () => Promise<T>, retries = 2, delayMs = 500): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fn();
      // Check for "0x" string return (viem sometimes returns this instead of throwing)
      if (typeof result === 'string' && result === '0x') {
        throw new Error('RPC returned 0x');
      }
      return result;
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('0x') || msg.includes('no data')) {
        if (i < retries) {
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      // On final retry or non-retryable error, return null
      return null;
    }
  }
  return null;
}

// Helper to parse metadata URI
async function parseMetadataURI(uri: string): Promise<{ name?: string; image?: string }> {
  if (!uri) return {};
  
  try {
    let metadata;
    
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.slice('data:application/json;base64,'.length);
      const jsonString = atob(base64Data);
      metadata = JSON.parse(jsonString);
    } else if (uri.startsWith('data:application/json,')) {
      const jsonStr = uri.slice('data:application/json,'.length);
      const decoded = decodeURIComponent(jsonStr);
      metadata = JSON.parse(decoded);
    } else if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('ipfs://')) {
      const fetchUrl = uri.startsWith('ipfs://') 
        ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : uri;
      const res = await fetch(fetchUrl);
      metadata = await res.json();
    }
    
    return {
      name: metadata?.name,
      image: metadata?.image
    };
  } catch (err) {
    return {};
  }
}

// Helper to parse proposal description and extract clean display text
function parseProposalDescription(description: string): string {
  if (!description) return "Untitled Proposal";
  
  // Parse "Distribute X tokens from RWA #Y to investors" format
  const distributeMatch = description.match(/Distribute\s+(\d+)\s+tokens\s+from\s+RWA\s+#(\d+)\s+to\s+investors/i);
  if (distributeMatch) {
    const amount = Number(distributeMatch[1]) / 1_000_000; // Convert from wei to USDC (6 decimals)
    return `Withdraw ${amount.toLocaleString()} USDC`;
  }
  
  // Parse "Change metadata for RWA #X to data:application/json,{...}" format
  const metadataMatch = description.match(/Change metadata for RWA #\d+ to (.+)/i);
  if (metadataMatch) {
    const metadataStr = metadataMatch[1];
    if (metadataStr.startsWith("data:application/json,")) {
      try {
        const jsonStr = metadataStr.slice("data:application/json,".length);
        const decoded = decodeURIComponent(jsonStr);
        const parsed = JSON.parse(decoded);
        
        if (parsed.name) return `Change Name to: ${parsed.name}`;
        if (parsed.image) return `Change Image to: ${parsed.image}`;
      } catch (e) {
        // Regex fallback
        const nameMatch = metadataStr.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch) return `Change Name to: ${decodeURIComponent(nameMatch[1])}`;
        
        const imageMatch = metadataStr.match(/"image"\s*:\s*"([^"]+)"/);
        if (imageMatch) return `Change Image to: ${decodeURIComponent(imageMatch[1])}`;
      }
    }
    return `Update Metadata`;
  }
  
  // Parse "Change image for RWA #X" format
  if (description.match(/Change image for RWA #\d+/i)) {
    return "Change Image";
  }
  
  // Try to parse data URI: data:application/json,{...}
  if (description.startsWith("data:application/json,")) {
    try {
      const jsonStr = description.slice("data:application/json,".length);
      const decoded = decodeURIComponent(jsonStr);
      const parsed = JSON.parse(decoded);
      
      if (parsed.name) return `Change Name to: ${parsed.name}`;
      if (parsed.image) return `Change Image to: ${parsed.image}`;
      
      const keys = Object.keys(parsed);
      if (keys.length > 0) return `Update: ${keys.join(", ")}`;
    } catch (e) {
      const nameMatch = description.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch) return `Change Name to: ${decodeURIComponent(nameMatch[1])}`;
      
      const imageMatch = description.match(/"image"\s*:\s*"([^"]+)"/);
      if (imageMatch) return `Change Image to: ${decodeURIComponent(imageMatch[1])}`;
    }
  }
  
  return description;
}

interface RWAProposalDisplay {
  proposalId: bigint;
  description: string;
  state: number;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  userHasVoted: boolean;
  proposer?: Address;
  voteStart?: bigint;
  voteEnd?: bigint;
  targets?: Address[];
  values?: bigint[];
  calldatas?: Hex[];
}

interface RWASet {
  nftId: bigint;
  governorAddress: Address;
  tbaAddress: Address;
  userShares: bigint;
  proposals: RWAProposalDisplay[];
  metadata?: {
    name?: string;
    image?: string;
  };
}

export default function GovernancePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [rwas, setRwas] = useState<RWASet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [pendingExec, setPendingExec] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollId: any;
    
    async function load() {
      if (!address) {
        setRwas([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
  if (!DAO_ADDRESS) throw new Error("DAO address not configured");
        await loadRWAGovernors(isMounted);
      } catch (error) {
        console.error("[Governance] Error loading RWA governance data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    load();

    // Removed aggressive 6s polling - causes constant RPC failures and flickering.
    // Manual refresh after vote now handles state updates.
    
    return () => {
      isMounted = false;
    };
  }, [address]);

  async function loadRWAGovernors(isMounted: boolean) {
    if (!address) return;
    try {
  if (!DAO_ADDRESS) { setRwas([]); return; }
      const governors: RWASet[] = [];

      // Determine scan upper bound using nextRWAProposalId (minted NFTs cannot exceed proposals)
      let upperBound = 50n;
      try {
        const nextProposalId = await publicClient.readContract({
          address: DAO_ADDRESS,
          abi: DAO_ABI,
          functionName: 'nextRWAProposalId'
        }) as bigint;
        upperBound = nextProposalId > 0n ? nextProposalId + 5n : 50n;
      } catch (e) {
        console.warn('[Governance] nextRWAProposalId read failed; using default upperBound', upperBound.toString());
      }

      // Literal ABI for ProposalCreated to avoid parseAbiItem / event mapping issues
      const proposalCreatedEvent = {
        type: 'event',
        name: 'ProposalCreated',
        inputs: [
          { name: 'proposalId', type: 'uint256', indexed: false },
          { name: 'proposer', type: 'address', indexed: false },
          { name: 'targets', type: 'address[]', indexed: false },
          { name: 'values', type: 'uint256[]', indexed: false },
          { name: 'signatures', type: 'string[]', indexed: false },
          { name: 'calldatas', type: 'bytes[]', indexed: false },
          { name: 'voteStart', type: 'uint256', indexed: false },
          { name: 'voteEnd', type: 'uint256', indexed: false },
          { name: 'description', type: 'string', indexed: false },
        ],
      } as const;

      let fromBlock: bigint | undefined = undefined;
      const deployBlock = process.env.NEXT_PUBLIC_DEPLOY_BLOCK?.trim();
      if (deployBlock && /^\d+$/.test(deployBlock)) {
        try { fromBlock = BigInt(deployBlock); } catch {}
      }

      let latestBlock: bigint | undefined;
      try {
        latestBlock = await publicClient.getBlockNumber();
      } catch {
        latestBlock = undefined;
      }

      for (let nftId = 0n; nftId < upperBound; nftId++) {
        // Governor presence indicates executed proposal minted this NFT
        let governorAddress: Address;
        try {
          governorAddress = await publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'rwaDaos',
            args: [nftId]
          }) as Address;
        } catch {
          continue;
        }
        if (!governorAddress || governorAddress === '0x0000000000000000000000000000000000000000') continue;

        // User shares (treat errors as zero)
        let shares: bigint = 0n;
        const sharesResult = await retryRead(async () => {
          return await publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'rwaShares',
            args: [nftId, address]
          }) as bigint;
        });
        shares = sharesResult || 0n;
        if (!sharesResult) {
          console.warn('[Governance] rwaShares unavailable for nft', nftId.toString(), '- treating as 0');
        }
        if (shares === 0n) continue; // Skip RWAs user has no stake in

        // Attempt to reconstruct TBA address via governor's tbaAddress() or deterministic salt? Governor exposes tbaAddress()
        let tbaAddress: Address = '0x0000000000000000000000000000000000000000';
        try {
          const GOV_ABI_MIN = [{
            type: 'function', name: 'tbaAddress', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }]
          }] as const;
          tbaAddress = await publicClient.readContract({
            address: governorAddress,
            abi: GOV_ABI_MIN,
            functionName: 'tbaAddress'
          }) as Address;
        } catch {}

        // Gather proposals via event logs (optional). Failures produce empty list.
        let proposals: RWAProposalDisplay[] = [];
        try {
          const pLogs = await publicClient.getLogs({
            address: governorAddress,
            event: proposalCreatedEvent,
            ...(fromBlock !== undefined ? { fromBlock } : {}),
            ...(latestBlock !== undefined ? { toBlock: latestBlock } : {}),
          });
          
          // Safety check - getLogs can fail in weird ways
          if (!pLogs || !Array.isArray(pLogs)) {
            console.warn('[Governance] getLogs returned invalid data for', governorAddress);
          } else {
            for (const log of pLogs) {
            const proposalId = log.args.proposalId as bigint;
            const description = (log.args.description as string) || 'Untitled';
            const proposer = log.args.proposer as Address | undefined;
            const voteStart = log.args.voteStart as bigint | undefined;
            const voteEnd = log.args.voteEnd as bigint | undefined;
            const targets = (log.args.targets as Address[]) || [];
            const values = (log.args.values as bigint[]) || [];
            const calldatas = (log.args.calldatas as Hex[]) || [];
            let state = 0;
            let forVotes = 0n;
            let againstVotes = 0n;
            let abstainVotes = 0n;
            try {
              state = await publicClient.readContract({
                address: governorAddress,
                abi: RWA_GOVERNOR_ABI,
                functionName: 'state',
                args: [proposalId]
              }) as number;
              const votes = await publicClient.readContract({
                address: governorAddress,
                abi: RWA_GOVERNOR_ABI,
                functionName: 'proposalVotes',
                args: [proposalId]
              }) as any;
              againstVotes = votes[0];
              forVotes = votes[1];
              abstainVotes = votes[2];
            } catch {}
            let userHasVoted = false;
            try {
              const HAS_VOTED_ABI = [{
                type: 'function', name: 'hasVoted', stateMutability: 'view', inputs: [
                  { name: 'proposalId', type: 'uint256' },
                  { name: 'account', type: 'address' }
                ], outputs: [{ type: 'bool' }]
              }] as const;
              userHasVoted = await publicClient.readContract({
                address: governorAddress,
                abi: HAS_VOTED_ABI,
                functionName: 'hasVoted',
                args: [proposalId, address as Address]
              }) as boolean;
            } catch {}

            // Optimistically promote Pending -> Active if current time surpassed voteStart
            try {
              if (state === 0 && voteStart && BigInt(Math.floor(Date.now()/1000)) > voteStart) {
                state = 1; // Active
              }
              if (state === 1 && voteEnd && BigInt(Math.floor(Date.now()/1000)) > voteEnd) {
                // If still reported Active but past end, mark Succeeded/Defeated needs final state call; keep as Active for now
              }
            } catch {}
            proposals.push({ proposalId, description, state, forVotes, againstVotes, abstainVotes, userHasVoted, proposer, targets, values, calldatas });
            }
          }
        } catch (e) {
          console.warn('[Governance] ProposalCreated getLogs failed for governor', governorAddress, e);
        }

        // Fetch tokenURI and parse metadata
        let metadata: { name?: string; image?: string } = {};
        const tokenURIResult = await retryRead(async () => {
          return await publicClient.readContract({
            address: RWA_ADDRESS,
            abi: RWA_ABI,
            functionName: 'tokenURI',
            args: [nftId]
          }) as string;
        }, 1, 300); // Shorter retry for metadata (non-blocking)
        
        if (tokenURIResult) {
          try {
            metadata = await parseMetadataURI(tokenURIResult);
          } catch (parseErr) {
            console.warn('[Governance] Metadata parse failed for NFT', nftId.toString());
          }
        } else {
          console.warn('[Governance] tokenURI unavailable for NFT', nftId.toString());
        }

        governors.push({ nftId, governorAddress, tbaAddress, userShares: shares, proposals: proposals.reverse(), metadata });
      }

      if (isMounted) setRwas(governors);
    } catch (error) {
      console.error('[Governance] Error loading RWA governors:', error);
    }
  }

  async function voteOnRWAProposal(governorAddress: Address, proposalId: bigint, support: number) {
    if (!address) return;
    setPendingVote(`${governorAddress}-${proposalId.toString()}`);
    try {
      if (walletClient) {
        // Estimate gas and cap to avoid RPC caps or underestimation
        let gasOverride: bigint | undefined;
        try {
          const est = await publicClient.estimateContractGas({
            address: governorAddress,
            abi: RWA_GOVERNOR_ABI,
            functionName: 'castVote',
            args: [proposalId, support],
            account: walletClient.account?.address as Address,
          });
          gasOverride = (est * 12n) / 10n; // 20% buffer
          const cap = 3_000_000n;
          if (gasOverride > cap) gasOverride = cap;
        } catch {
          gasOverride = 1_200_000n;
        }

        const hash = await walletClient.writeContract({
          address: governorAddress,
          abi: RWA_GOVERNOR_ABI,
          functionName: 'castVote',
          args: [proposalId, support],
          gas: gasOverride,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        // Fallback: attempt relayer (will vote as relayer with 0 weight; not ideal, but non-blocking)
        await gaslessVoteRWA(walletClient as any, address, governorAddress, proposalId, support);
      }
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error?.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) {
        // user rejection; ignore
      } else if (msg.includes('71c6af49') || msg.includes('not currently active')) {
        // Governor revert: vote not currently active; refresh state
        console.warn('[Governance] Vote attempted while proposal not Active yet. Refreshing states.');
        await loadRWAGovernors(true);
      } else {
        console.error('Error voting:', error);
      }
    } finally {
      setPendingVote(null);
      await loadRWAGovernors(true);
    }
  }

  async function executeProposal(
    governorAddress: Address,
    proposal: RWAProposalDisplay,
    nftId: bigint
  ) {
    if (!address || !walletClient) return;
    const key = `${governorAddress}-${proposal.proposalId.toString()}-exec`;
    setPendingExec(key);
    try {
      // OpenZeppelin Governor expects description hash = keccak256(bytes(description))
      const descriptionHash = keccak256(toHex(proposal.description));

      // Debug: Check proposal state and hash before executing
      const currentState = await publicClient.readContract({
        address: governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'state',
        args: [proposal.proposalId]
      }) as number;

      console.log('[Governance] ========== EXECUTE DEBUG ==========');
      console.log('[Governance] Proposal ID:', proposal.proposalId.toString());
      console.log('[Governance] Current state:', currentState, '(Expected: 4=Succeeded)');
      console.log('[Governance] Description:', proposal.description);
      console.log('[Governance] Description length:', proposal.description.length);
      console.log('[Governance] Description hash:', descriptionHash);
      console.log('[Governance] Targets:', proposal.targets);
      console.log('[Governance] Values:', proposal.values?.map(v => v.toString()));
      console.log('[Governance] Calldatas:', proposal.calldatas);
      console.log('[Governance] Targets length:', proposal.targets?.length);
      console.log('[Governance] Values length:', proposal.values?.length);
      console.log('[Governance] Calldatas length:', proposal.calldatas?.length);
      console.log('[Governance] ===================================');

      if (currentState !== ProposalState.Succeeded) {
        const stateNames = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
        alert(`Cannot execute: Proposal is in state ${stateNames[currentState] || currentState}, expected Succeeded (4)`);
        setPendingExec(null);
        return;
      }

      // Estimate gas with buffer and cap
      let gasOverride: bigint | undefined;
      try {
        const est = await publicClient.estimateContractGas({
          address: governorAddress,
          abi: RWA_GOVERNOR_ABI,
          functionName: 'execute',
          args: [proposal.targets || [], proposal.values || [], proposal.calldatas || [], descriptionHash],
          account: walletClient.account?.address as Address,
        });
        gasOverride = (est * 12n) / 10n; // 20% buffer
        const cap = 6_000_000n;
        if (gasOverride > cap) gasOverride = cap;
      } catch (estErr: any) {
        console.error('[Governance] Gas estimation failed - transaction will revert!');
        console.error('[Governance] Error message:', estErr?.message || 'Unknown');
        
        // Additional debug: Check TBA balance and approval
        console.log('[Governance] Checking TBA state...');
        try {
          const tbaAddress = await publicClient.readContract({
            address: governorAddress,
            abi: RWA_GOVERNOR_ABI,
            functionName: 'tbaAddress',
          }) as Address;
          console.log('[Governance] TBA Address:', tbaAddress);
          
          // Check NFT owner
          const nftOwner = await publicClient.readContract({
            address: RWA_ADDRESS,
            abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }],
            functionName: 'ownerOf',
            args: [nftId]
          }) as Address;
          console.log('[Governance] NFT ID:', nftId.toString());
          console.log('[Governance] NFT Owner:', nftOwner);
          console.log('[Governance] Governor Address:', governorAddress);
          console.log('[Governance] Governor owns NFT:', nftOwner.toLowerCase() === governorAddress.toLowerCase());
          
          // Check if this is a withdraw proposal (has USDC as target[0])
          if (proposal.targets && proposal.targets.length >= 2) {
            const usdcAddress = proposal.targets[0];
            const usdcBalance = await publicClient.readContract({
              address: usdcAddress,
              abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
              functionName: 'balanceOf',
              args: [tbaAddress]
            }) as bigint;
            console.log('[Governance] TBA USDC balance:', usdcBalance.toString());
            
            // Decode the distribute calldata to get the amount
            const distributeCalldata = proposal.calldatas?.[1];
            if (distributeCalldata && distributeCalldata.length >= 66) {
              // Skip function selector (4 bytes = 8 hex chars + 0x), get first parameter (nftId - 32 bytes), then amount (32 bytes)
              const amountHex = '0x' + distributeCalldata.slice(74, 138); // bytes 36-68
              const amount = BigInt(amountHex);
              console.log('[Governance] Required amount:', amount.toString());
              console.log('[Governance] Has sufficient balance:', usdcBalance >= amount);
              
              if (usdcBalance < amount) {
                alert(`Execution failed: TBA has insufficient USDC balance.\nBalance: ${usdcBalance.toString()}\nRequired: ${amount.toString()}`);
              } else if (nftOwner.toLowerCase() !== governorAddress.toLowerCase()) {
                alert(`Execution failed: Governor doesn't own the NFT.\nNFT Owner: ${nftOwner}\nGovernor: ${governorAddress}\n\nRun the TransferNFTsToGovernors script!`);
              } else {
                alert('Execution will fail! Check console for details.');
              }
            }
          }
        } catch (balErr) {
          console.error('[Governance] Failed to check TBA state:', balErr);
          alert('Execution will fail! Could not determine the cause. Check console.');
        }
        
        setPendingExec(null);
        return;
      }

      const hash = await walletClient.writeContract({
        address: governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'execute',
        args: [proposal.targets || [], proposal.values || [], proposal.calldatas || [], descriptionHash],
        gas: gasOverride,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await loadRWAGovernors(true);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (error?.code === 4001 || msg.includes('user denied') || msg.includes('user rejected')) {
        // user rejection
      } else {
        console.error('[Governance] Execute failed:', error);
      }
    } finally {
      setPendingExec(null);
    }
  }

  function getProposalStateText(state: number): string {
    const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
    return states[state] || "Unknown";
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="text-xl text-white">Loading governance data...</div>
      </div>
    );
  }

  const handleManualRefresh = async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    await loadRWAGovernors(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">RWA Governance</h1>
            <p className="text-sm text-gray-400">Only proposals for RWAs you invested in are shown. Your vote weight equals your shares for that NFT.</p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded text-sm font-semibold transition self-start sm:self-auto"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {rwas.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-lg">No voting power yet.</p>
            <p className="text-sm text-gray-400 mt-2">Invest in a funding proposal to unlock RWA governance.</p>
          </div>
        )}

        <div className="space-y-10">
          {rwas.map(rwa => (
            <div key={rwa.nftId.toString()} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {rwa.metadata?.name || `RWA NFT #${rwa.nftId.toString()}`}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 break-all">Governor: {rwa.governorAddress}</p>
                  <p className="text-xs text-gray-500 break-all">TBA: {rwa.tbaAddress}</p>
                </div>
                <div className="text-sm bg-gray-700 px-4 py-2 rounded self-start sm:self-auto">
                  Your Shares: <span className="text-white font-semibold">{formatUnits(rwa.userShares, 18)}</span>
                </div>
              </div>

              {rwa.proposals.length === 0 && (
                <div className="text-center py-6 border border-dashed border-gray-600 rounded">
                  <p className="text-gray-400">No proposals yet for this RWA.</p>
                </div>
              )}

              <div className="space-y-5">
                {rwa.proposals.map(p => {
                  const total = p.forVotes + p.againstVotes + p.abstainVotes;
                  const pct = (v: bigint) => total === BigInt(0) ? "0%" : `${(Number(v) / Number(total) * 100).toFixed(1)}%`;
                  const key = `${rwa.governorAddress}-${p.proposalId.toString()}`;
                  return (
                    <div key={p.proposalId.toString()} className="bg-gray-700/60 rounded-lg p-5 border border-gray-600">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white break-words">{parseProposalDescription(p.description)}</h3>
                          <p className="text-[11px] text-gray-400">ID: {p.proposalId.toString()} {p.voteStart && (<>
                            | start {p.voteStart.toString()} end {p.voteEnd?.toString()}
                          </> )}</p>
                          {(p.proposer && address && p.proposer.toLowerCase() === address.toLowerCase()) && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-indigo-900 text-indigo-200">You proposed</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded self-start sm:self-auto ${
                          p.state === ProposalState.Active ? "bg-green-900 text-green-200" :
                          p.state === ProposalState.Succeeded ? "bg-blue-900 text-blue-200" :
                          p.state === ProposalState.Defeated ? "bg-red-900 text-red-200" : "bg-gray-600 text-gray-300"
                        }`}>{getProposalStateText(p.state)}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center mb-4">
                        <div className="bg-gray-600/60 rounded p-2">
                          <p className="text-[11px] text-gray-300">For</p>
                          <p className="font-bold text-green-400 text-sm">{formatUnits(p.forVotes, 18)}</p>
                          <p className="text-[10px] text-gray-400">{pct(p.forVotes)}</p>
                        </div>
                        <div className="bg-gray-600/60 rounded p-2">
                          <p className="text-[11px] text-gray-300">Against</p>
                          <p className="font-bold text-red-400 text-sm">{formatUnits(p.againstVotes, 18)}</p>
                          <p className="text-[10px] text-gray-400">{pct(p.againstVotes)}</p>
                        </div>
                        <div className="bg-gray-600/60 rounded p-2">
                          <p className="text-[11px] text-gray-300">Abstain</p>
                          <p className="font-bold text-gray-200 text-sm">{formatUnits(p.abstainVotes, 18)}</p>
                          <p className="text-[10px] text-gray-400">{pct(p.abstainVotes)}</p>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-400 mb-3">Total Votes: {formatUnits(total, 18)} | Your Weight: {formatUnits(rwa.userShares, 18)}</div>

                      {p.state === ProposalState.Active && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            disabled={pendingVote === key || p.userHasVoted}
                            onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.For)}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${pendingVote === key || p.userHasVoted ? "bg-green-900 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"} text-white`}
                          >{pendingVote === key ? "Submitting..." : p.userHasVoted ? "Already Voted" : "For"}</button>
                          <button
                            disabled={pendingVote === key || p.userHasVoted}
                            onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.Against)}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${pendingVote === key || p.userHasVoted ? "bg-red-900 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"} text-white`}
                          >{pendingVote === key ? "Submitting..." : p.userHasVoted ? "Already Voted" : "Against"}</button>
                          <button
                            disabled={pendingVote === key || p.userHasVoted}
                            onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.Abstain)}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${pendingVote === key || p.userHasVoted ? "bg-gray-800 cursor-not-allowed" : "bg-gray-600 hover:bg-gray-700"} text-white`}
                          >{pendingVote === key ? "Submitting..." : p.userHasVoted ? "Already Voted" : "Abstain"}</button>
                        </div>
                      )}
                      {p.state === ProposalState.Succeeded && (
                        <div className="mt-3">
                          <button
                            disabled={pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec`}
                            onClick={() => executeProposal(rwa.governorAddress, p, rwa.nftId)}
                            className={`w-full px-4 py-2 rounded text-sm font-semibold transition ${pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec` ? 'bg-blue-900 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                          >
                            {pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec` ? 'Executing...' : 'Execute Proposal'}
                          </button>
                          <p className="text-[11px] text-gray-400 mt-2">Execute to apply changes (metadata update or fund distribution).</p>
                        </div>
                      )}
                      {p.state === ProposalState.Executed && (
                        <div className="mt-3 text-center text-xs font-semibold px-3 py-2 rounded bg-indigo-800 text-indigo-200">
                          ✅ Executed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}