"use client";

import { useState, useEffect } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { formatUnits, type Address, parseAbiItem } from "viem";
import { publicClient } from "@/lib/clients";
import { CONTRACTS, DAO_ABI, RWAGOVERNOR_ABI, ProposalState, VoteSupport } from "@/contracts";
import { gaslessVoteRWA } from "@/lib/accountAbstraction";

interface RWAProposalDisplay {
  proposalId: bigint;
  description: string;
  state: number;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  userHasVoted: boolean;
  proposer?: Address;
}

interface RWASet {
  nftId: bigint;
  governorAddress: Address;
  tbaAddress: Address;
  userShares: bigint;
  proposals: RWAProposalDisplay[];
}

export default function GovernancePage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [rwas, setRwas] = useState<RWASet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingVote, setPendingVote] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      if (!address) {
        setRwas([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        if (!CONTRACTS.DAO) throw new Error("DAO address not configured");
        await loadRWAGovernors(isMounted);
      } catch (error) {
        console.error("[Governance] Error loading RWA governance data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [address]);

  async function loadRWAGovernors(isMounted: boolean) {
    if (!address) return;
    try {
      if (!CONTRACTS.DAO) { setRwas([]); return; }
      const governors: RWASet[] = [];
      const proposalCreatedEvent = parseAbiItem(
        "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
      );
      const rwaDeployedEvent = parseAbiItem("event RWADeployed(uint256 indexed nftId, address governor, address tba)");
      let fromBlock: bigint | undefined = undefined;
      const deployBlock = process.env.NEXT_PUBLIC_DEPLOY_BLOCK?.trim();
      if (deployBlock && /^\d+$/.test(deployBlock)) {
        try { fromBlock = BigInt(deployBlock); } catch {}
      }
      let latestBlock: bigint | undefined = undefined;
      try {
        latestBlock = await publicClient.getBlockNumber();
      } catch (e) {
        console.warn("[Governance] getBlockNumber failed, defaulting to latest");
        latestBlock = undefined;
      }

      let rwaLogs: any[] = [];
      try {
        rwaLogs = await publicClient.getLogs({
          address: CONTRACTS.DAO,
          event: rwaDeployedEvent,
          ...(fromBlock !== undefined ? { fromBlock } : {}),
          ...(latestBlock !== undefined ? { toBlock: latestBlock } : {}),
        });
      } catch (e) {
        console.warn("getLogs RWADeployed failed", e);
        rwaLogs = [];
      }

      for (const log of rwaLogs) {
        const nftId = log.args.nftId as bigint;
        const governorAddress = log.args.governor as Address;
        const tbaAddress = log.args.tba as Address;
  let shares: bigint = BigInt(0);
        try {
          shares = await publicClient.readContract({
            address: CONTRACTS.DAO,
            abi: DAO_ABI,
            functionName: "rwaShares",
            args: [nftId, address],
          }) as bigint;
        } catch (e) {
          console.warn("rwaShares read failed", nftId.toString(), e);
          shares = BigInt(0);
        }
  if (shares === BigInt(0)) continue;

        let proposals: RWAProposalDisplay[] = [];
        try {
          const logs = await publicClient.getLogs({
            address: governorAddress,
            event: proposalCreatedEvent,
            ...(fromBlock !== undefined ? { fromBlock } : {}),
            ...(latestBlock !== undefined ? { toBlock: latestBlock } : {}),
          });
          for (const plog of logs) {
            const proposalId = plog.args.proposalId as bigint;
            const description = (plog.args.description as string) || "Untitled";
            const proposer = plog.args.proposer as Address | undefined;
            let state = 0;
            let forVotes = BigInt(0);
            let againstVotes = BigInt(0);
            let abstainVotes = BigInt(0);
            try {
              state = await publicClient.readContract({
                address: governorAddress,
                abi: RWAGOVERNOR_ABI,
                functionName: "state",
                args: [proposalId],
              }) as number;
              const votes = await publicClient.readContract({
                address: governorAddress,
                abi: RWAGOVERNOR_ABI,
                functionName: "proposalVotes",
                args: [proposalId],
              }) as any;
              againstVotes = votes[0];
              forVotes = votes[1];
              abstainVotes = votes[2];
            } catch {}
            // Determine if current user has voted using a minimal ABI for hasVoted
            let userHasVoted = false;
            try {
              const HAS_VOTED_ABI = [{
                type: 'function',
                name: 'hasVoted',
                stateMutability: 'view',
                inputs: [
                  { name: 'proposalId', type: 'uint256' },
                  { name: 'account', type: 'address' }
                ],
                outputs: [{ type: 'bool' }]
              }] as const;
              userHasVoted = await publicClient.readContract({
                address: governorAddress,
                abi: HAS_VOTED_ABI,
                functionName: 'hasVoted',
                args: [proposalId, address as Address],
              }) as boolean;
            } catch {}
            proposals.push({ proposalId, description, state, forVotes, againstVotes, abstainVotes, userHasVoted, proposer });
          }
        } catch (e) {
          console.warn("proposal getLogs failed", governorAddress, e);
          proposals = [];
        }

        governors.push({ nftId, governorAddress, tbaAddress, userShares: shares, proposals: proposals.reverse() });
      }
      if (isMounted) setRwas(governors);
    } catch (error) {
      console.error("[Governance] Error loading RWA governors:", error);
    }
  }

  async function voteOnRWAProposal(governorAddress: Address, proposalId: bigint, support: number) {
    if (!walletClient || !address) return;
    try {
      setPendingVote(`${governorAddress}-${proposalId.toString()}`);
      await gaslessVoteRWA(walletClient, address, governorAddress, proposalId, support);
      await loadRWAGovernors(true);
    } catch (error) {
      const msg = (error as any)?.message?.toLowerCase?.() || "";
      if ((error as any)?.code === 4001 || msg.includes("user denied") || msg.includes("user rejected")) {
        return;
      }
      console.error("Error voting:", error);
    } finally {
      setPendingVote(null);
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-white mb-2">RWA Governance</h1>
        <p className="text-sm text-gray-400 mb-8">Only proposals for RWAs you invested in are shown. Your vote weight equals your shares for that NFT.</p>

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
                  <h2 className="text-2xl font-semibold text-white">RWA NFT #{rwa.nftId.toString()}</h2>
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
                          <h3 className="text-lg font-semibold text-white break-words">{p.description || "Untitled Proposal"}</h3>
                          <p className="text-[11px] text-gray-400">ID: {p.proposalId.toString()}</p>
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