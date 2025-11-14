"use client";

import { useState, useEffect, useRef } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { formatUnits, type Address, type Hex, keccak256, toHex } from "viem";
import { publicClient } from "@/lib/clients";

import { DAO_ADDRESS, DAO_ABI, RWA_GOVERNOR_ABI, RWA_ABI, RWA_ADDRESS } from "@/constants";
import { ProposalState, VoteSupport } from "@/contracts";
import { gaslessVoteRWA } from "@/lib/accountAbstraction";
import { getUserRWAInvestments } from "@/lib/rwaGovernance";

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
  const [copied, setCopied] = useState(false);

  // Single effect with stable primitive dependency
  useEffect(() => {
    const addressKey = address ? address.toLowerCase() : '';
    
    let isMounted = true;
    
    async function load() {
      if (!addressKey) {
        setRwas([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        if (!DAO_ADDRESS) throw new Error("DAO address not configured");
        
        await loadRWAGovernors(address as Address, isMounted);
      } catch (error) {
        console.error("[Governance] Error loading:", error);
        if (isMounted) setRwas([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [address ? address.toLowerCase() : '']);

  async function loadRWAGovernors(userAddress: Address, isMounted: boolean) {
    try {
      if (!userAddress || !DAO_ADDRESS) {
        if (isMounted) {
          setRwas([]);
          setLoading(false);
        }
        return;
      }

      // Use the same helper function as portfolio page to get all user investments
      const userInvestments = await getUserRWAInvestments(publicClient, userAddress);

      if (userInvestments.length === 0) {
        if (isMounted) {
          setRwas([]);
          setLoading(false);
        }
        return;
      }

      // Load all RWA data in parallel
      const rwaPromises = userInvestments.map(async (investment) => {
        try {
          console.log('[Governance] Processing investment:', investment);
          const nftId = investment.nftId;
          const governorAddress = investment.governorAddress;
          const tbaAddress = investment.tbaAddress;
          const shares = investment.shares;

          console.log('[Governance] Extracted values - nftId:', nftId, 'governor:', governorAddress, 'shares:', shares);

          if (nftId === undefined || nftId === null || !governorAddress || governorAddress === '0x0000000000000000000000000000000000000000') {
            console.log('[Governance] Skipping - invalid data');
            return null;
          }

          // Get metadata from investment
          let metadata: { name?: string; image?: string } = {
            name: investment.metadata?.name,
            image: investment.metadata?.image
          };

          // Get proposals for this governor (fetch from block 0 to ensure we get all historical proposals)
          let proposals: RWAProposalDisplay[] = [];
          try {
            console.log('[Governance] Fetching proposal events for governor:', governorAddress);
            const pLogs = await publicClient.getLogs({
              address: governorAddress,
              event: {
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
              } as const,
              fromBlock: BigInt(0),
              toBlock: 'latest',
            });
            console.log('[Governance] Found', pLogs?.length || 0, 'proposal events for governor:', governorAddress);

            if (pLogs && Array.isArray(pLogs) && pLogs.length > 0) {
              const proposalPromises = pLogs.map(async (pLog) => {
                const proposalId = pLog.args.proposalId as bigint;
                const description = (pLog.args.description as string) || 'Untitled';
                const proposer = pLog.args.proposer as Address | undefined;
                const voteStart = pLog.args.voteStart as bigint | undefined;
                const voteEnd = pLog.args.voteEnd as bigint | undefined;
                const targets = (pLog.args.targets as Address[]) || [];
                const values = (pLog.args.values as bigint[]) || [];
                const calldatas = (pLog.args.calldatas as Hex[]) || [];

                let state = 0;
                let forVotes = 0n;
                let againstVotes = 0n;
                let abstainVotes = 0n;
                let userHasVoted = false;

                try {
                  [state, userHasVoted] = await Promise.all([
                    publicClient.readContract({
                      address: governorAddress,
                      abi: RWA_GOVERNOR_ABI,
                      functionName: 'state',
                      args: [proposalId]
                    }) as Promise<number>,
                    publicClient.readContract({
                      address: governorAddress,
                      abi: [{
                        type: 'function', name: 'hasVoted', stateMutability: 'view',
                        inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'account', type: 'address' }],
                        outputs: [{ type: 'bool' }]
                      }] as const,
                      functionName: 'hasVoted',
                      args: [proposalId, userAddress]
                    }) as Promise<boolean>
                  ]);

                  const votes = await publicClient.readContract({
                    address: governorAddress,
                    abi: RWA_GOVERNOR_ABI,
                    functionName: 'proposalVotes',
                    args: [proposalId]
                  }) as any;
                  
                  againstVotes = votes[0];
                  forVotes = votes[1];
                  abstainVotes = votes[2];
                  
                  console.log('[Governance] Proposal', proposalId.toString(), '- state:', state, 'votes:', { for: forVotes.toString(), against: againstVotes.toString() });
                } catch (err) {
                  console.warn('[Governance] Skipping proposal from old/incompatible governor deployment:', proposalId.toString());
                  // Return null to filter out proposals from old deployments that can't be read
                  return null;
                }

                return {
                  proposalId,
                  description,
                  state,
                  forVotes,
                  againstVotes,
                  abstainVotes,
                  userHasVoted,
                  proposer,
                  voteStart,
                  voteEnd,
                  targets,
                  values,
                  calldatas
                };
              });

              const allProposals = await Promise.all(proposalPromises);
              // Filter out null proposals (from old/incompatible deployments)
              proposals = allProposals.filter((p) => p !== null) as RWAProposalDisplay[];
              proposals.reverse(); // Most recent first
              console.log('[Governance] Processed', proposals.length, 'valid proposals for governor:', governorAddress);
            } else {
              console.log('[Governance] No proposal logs found for governor', governorAddress);
            }
          } catch (err) {
            console.error('[Governance] Failed to fetch proposals for governor', governorAddress, err);
          }

          console.log('[Governance] Returning RWA data - nftId:', nftId.toString(), 'proposals:', proposals.length);
          return {
            nftId,
            governorAddress,
            tbaAddress,
            userShares: shares,
            proposals,
            metadata
          };
        } catch (error) {
          console.error('[Governance] Error loading RWA:', error);
          return null;
        }
      });

      const results = await Promise.all(rwaPromises);
      console.log('[Governance] Raw results:', results);
      const validRwas = results.filter((r) => r !== null) as RWASet[];
      console.log('[Governance] Valid RWAs after filter:', validRwas);

      if (isMounted) {
        setRwas(validRwas);
        setLoading(false);
      }
    } catch (error) {
      console.error('[Governance] Error in loadRWAGovernors:', error);
      if (isMounted) {
        setRwas([]);
        setLoading(false);
      }
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
        console.warn('[Governance] Vote attempted while proposal not Active yet.');
      } else {
        console.error('Error voting:', error);
      }
    } finally {
      setPendingVote(null);
      if (address) {
        await loadRWAGovernors(address, true);
      }
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
      if (address) {
        await loadRWAGovernors(address, true);
      }
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

  // Helper to get image URL (handle IPFS)
  const getImageUrl = (imageUri?: string) => {
    if (!imageUri) return null;
    if (imageUri.startsWith('ipfs://')) {
      return imageUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return imageUri;
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-gray-300">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="mb-8 text-7xl">🗳️</div>
            <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
              RWA Governance
            </h1>
            <p className="text-xl text-gray-400 mb-8">Connect your wallet to participate in governance</p>
            <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl p-12 max-w-md mx-auto">
              <p className="text-lg mb-3">Please connect your wallet to view governance.</p>
              <p className="text-sm text-gray-400">Invest in a project first to unlock voting power.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-gray-300">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mb-6"></div>
            <p className="text-xl text-gray-400">Loading governance data...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleManualRefresh = async () => {
    if (!isConnected || !address) return;
    
    try {
      setLoading(true);
      await loadRWAGovernors(address, true);
    } catch (error) {
      console.error('[Governance] Refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-gray-300">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header Section */}
        <div className="mb-10">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/40 via-blue-900/40 to-purple-900/40 border border-emerald-500/20 p-8 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
                <div>
                  <h1 className="text-5xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
                    Your Governance Dashboard
                  </h1>
                  <p className="text-lg text-gray-300">Vote on proposals for RWAs you've invested in</p>
                </div>
                <div className="flex gap-3 self-start md:self-auto">
                  <button
                    onClick={handleCopyAddress}
                    className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    title="Copy wallet address"
                  >
                    {copied ? (
                      <>
                        <span className="text-base">✓</span>
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <span className="text-base">📋</span>
                        <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleManualRefresh}
                    disabled={loading}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-semibold transition-all shadow-lg text-sm"
                  >
                    {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/60 backdrop-blur-sm border border-emerald-500/20 rounded-xl p-4">
                  <div className="text-3xl mb-2">🗳️</div>
                  <div className="text-sm text-gray-400">Your RWAs</div>
                  <div className="text-2xl font-bold text-emerald-400">{rwas.length}</div>
                </div>
                <div className="bg-gray-800/60 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
                  <div className="text-3xl mb-2">📋</div>
                  <div className="text-sm text-gray-400">Active Proposals</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {rwas.reduce((sum, rwa) => sum + rwa.proposals.filter(p => p.state === ProposalState.Active).length, 0)}
                  </div>
                </div>
                <div className="bg-gray-800/60 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4">
                  <div className="text-3xl mb-2">💪</div>
                  <div className="text-sm text-gray-400">Total Voting Power</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {formatUnits(rwas.reduce((sum, rwa) => sum + rwa.userShares, BigInt(0)), 18)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {rwas.length === 0 && (
          <div className="text-center py-20 bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700">
            <div className="mb-6 text-8xl">🎯</div>
            <p className="text-2xl text-gray-300 mb-3 font-semibold">No Voting Power Yet</p>
            <p className="text-gray-400 mb-6">Invest in RWA projects to unlock governance participation</p>
          </div>
        )}

        {/* RWA Governance Cards */}
        <div className="space-y-8">
          {rwas.map(rwa => {
            const imageUrl = getImageUrl(rwa.metadata?.image);
            
            return (
              <div key={rwa.nftId.toString()} className="group/rwa">
                {/* RWA Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-800/80 to-gray-800/40 border border-gray-700 hover:border-emerald-500/50 transition-all backdrop-blur-sm mb-6">
                  {/* Background Image */}
                  {imageUrl && (
                    <>
                      <div className="absolute inset-0 opacity-10">
                        <img 
                          src={imageUrl}
                          alt={rwa.metadata?.name || ''}
                          className="w-full h-full object-cover blur-sm"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 to-gray-900/70"></div>
                    </>
                  )}
                  
                  <div className="relative z-10 p-6 flex flex-col md:flex-row md:items-center gap-6">
                    {/* NFT Image/Icon */}
                    <div className="relative flex-shrink-0">
                      <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-lg">
                        {imageUrl ? (
                          <img 
                            src={imageUrl}
                            alt={rwa.metadata?.name || `RWA #${rwa.nftId}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-500 flex items-center justify-center text-3xl">
                            🏢
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 px-2 py-1 bg-emerald-500 rounded-full text-xs font-bold text-white shadow-lg">
                        #{rwa.nftId.toString()}
                      </div>
                    </div>

                    {/* RWA Info */}
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-2 group-hover/rwa:text-emerald-400 transition-colors">
                        {rwa.metadata?.name || `RWA NFT #${rwa.nftId.toString()}`}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                        <span className="px-3 py-1 bg-emerald-900/50 text-emerald-300 rounded-full text-xs font-medium border border-emerald-700/50">
                          {rwa.proposals.length} Proposal{rwa.proposals.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-gray-400 font-mono text-xs">
                          Governor: {rwa.governorAddress.slice(0, 8)}...{rwa.governorAddress.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-gray-400 text-sm">Your Voting Power:</span>
                          <span className="ml-2 text-emerald-400 font-bold text-lg">{formatUnits(rwa.userShares, 18)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proposals */}
                {rwa.proposals.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                    <div className="text-5xl mb-3">📭</div>
                    <p className="text-gray-400">No proposals yet for this RWA</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 pl-0 md:pl-6">
                    {rwa.proposals.map(p => {
                      const total = p.forVotes + p.againstVotes + p.abstainVotes;
                      const pct = (v: bigint) => total === BigInt(0) ? "0%" : `${(Number(v) / Number(total) * 100).toFixed(1)}%`;
                      const key = `${rwa.governorAddress}-${p.proposalId.toString()}`;
                      
                      return (
                        <div key={p.proposalId.toString()} className="group/proposal relative overflow-hidden bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all shadow-lg hover:shadow-blue-500/10">
                          <div className="p-6">
                            {/* Proposal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-2 group-hover/proposal:text-blue-400 transition-colors">
                                  {parseProposalDescription(p.description)}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                  <span className="font-mono">ID: {p.proposalId.toString()}</span>
                                  {(p.proposer && address && p.proposer.toLowerCase() === address.toLowerCase()) && (
                                    <span className="px-2 py-1 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
                                      ✨ Your Proposal
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              <div className="self-start">
                                <span className={`px-4 py-2 rounded-full text-xs font-bold ${
                                  p.state === ProposalState.Active ? "bg-green-500/90 text-white shadow-lg shadow-green-500/50 animate-pulse" :
                                  p.state === ProposalState.Succeeded ? "bg-blue-500/90 text-white shadow-lg" :
                                  p.state === ProposalState.Defeated ? "bg-red-500/90 text-white shadow-lg" :
                                  p.state === ProposalState.Executed ? "bg-emerald-500/90 text-white shadow-lg" :
                                  "bg-gray-600/90 text-gray-300"
                                }`}>
                                  {p.state === ProposalState.Active && '🔴 ACTIVE'}
                                  {p.state === ProposalState.Executed && '✓ EXECUTED'}
                                  {p.state !== ProposalState.Active && p.state !== ProposalState.Executed && getProposalStateText(p.state).toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Vote Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-5">
                              <div className="bg-gradient-to-br from-green-900/40 to-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
                                <div className="text-xs text-green-300 mb-1 font-medium">For</div>
                                <div className="text-2xl font-bold text-green-400 mb-1">{formatUnits(p.forVotes, 18)}</div>
                                <div className="text-xs text-green-300/70">{pct(p.forVotes)}</div>
                              </div>
                              <div className="bg-gradient-to-br from-red-900/40 to-red-900/20 border border-red-700/50 rounded-lg p-4 text-center">
                                <div className="text-xs text-red-300 mb-1 font-medium">Against</div>
                                <div className="text-2xl font-bold text-red-400 mb-1">{formatUnits(p.againstVotes, 18)}</div>
                                <div className="text-xs text-red-300/70">{pct(p.againstVotes)}</div>
                              </div>
                              <div className="bg-gradient-to-br from-gray-700/40 to-gray-700/20 border border-gray-600/50 rounded-lg p-4 text-center">
                                <div className="text-xs text-gray-300 mb-1 font-medium">Abstain</div>
                                <div className="text-2xl font-bold text-gray-200 mb-1">{formatUnits(p.abstainVotes, 18)}</div>
                                <div className="text-xs text-gray-400">{pct(p.abstainVotes)}</div>
                              </div>
                            </div>

                            {/* Vote Info */}
                            <div className="mb-5 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Total Votes:</span>
                                <span className="text-white font-semibold">{formatUnits(total, 18)}</span>
                              </div>
                              <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-400">Your Voting Power:</span>
                                <span className="text-emerald-400 font-semibold">{formatUnits(rwa.userShares, 18)}</span>
                              </div>
                            </div>

                            {/* Voting Buttons */}
                            {p.state === ProposalState.Active && (
                              <div className="grid grid-cols-3 gap-3">
                                <button
                                  disabled={pendingVote === key || p.userHasVoted}
                                  onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.For)}
                                  className={`px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                                    pendingVote === key || p.userHasVoted 
                                      ? "bg-green-900/50 cursor-not-allowed text-green-300/50" 
                                      : "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg hover:shadow-green-500/50"
                                  }`}
                                >
                                  {pendingVote === key ? "⏳" : p.userHasVoted ? "✓ Voted" : "👍 For"}
                                </button>
                                <button
                                  disabled={pendingVote === key || p.userHasVoted}
                                  onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.Against)}
                                  className={`px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                                    pendingVote === key || p.userHasVoted 
                                      ? "bg-red-900/50 cursor-not-allowed text-red-300/50" 
                                      : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-lg hover:shadow-red-500/50"
                                  }`}
                                >
                                  {pendingVote === key ? "⏳" : p.userHasVoted ? "✓ Voted" : "👎 Against"}
                                </button>
                                <button
                                  disabled={pendingVote === key || p.userHasVoted}
                                  onClick={() => voteOnRWAProposal(rwa.governorAddress, p.proposalId, VoteSupport.Abstain)}
                                  className={`px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                                    pendingVote === key || p.userHasVoted 
                                      ? "bg-gray-800/50 cursor-not-allowed text-gray-400/50" 
                                      : "bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-700 hover:to-gray-600 text-white shadow-lg"
                                  }`}
                                >
                                  {pendingVote === key ? "⏳" : p.userHasVoted ? "✓ Voted" : "🤷 Abstain"}
                                </button>
                              </div>
                            )}

                            {/* Execute Button */}
                            {p.state === ProposalState.Succeeded && (
                              <div>
                                <button
                                  disabled={pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec`}
                                  onClick={() => executeProposal(rwa.governorAddress, p, rwa.nftId)}
                                  className={`w-full px-6 py-4 rounded-lg font-bold transition-all ${
                                    pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec`
                                      ? 'bg-blue-900/50 cursor-not-allowed text-blue-300/50' 
                                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-blue-500/50'
                                  }`}
                                >
                                  {pendingExec === `${rwa.governorAddress}-${p.proposalId.toString()}-exec` ? '⏳ Executing...' : '✨ Execute Proposal'}
                                </button>
                                <p className="text-xs text-gray-400 mt-3 text-center">
                                  Execute to apply changes (metadata update or fund distribution)
                                </p>
                              </div>
                            )}

                            {/* Executed Badge */}
                            {p.state === ProposalState.Executed && (
                              <div className="text-center px-4 py-4 rounded-lg bg-gradient-to-r from-emerald-900/50 to-blue-900/50 border border-emerald-500/50">
                                <span className="text-emerald-400 font-bold text-lg">✅ Successfully Executed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}