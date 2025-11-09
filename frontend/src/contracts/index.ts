import { parseAbi } from 'viem';
// Contract addresses and configuration
export const CONTRACTS = {
  DAO: process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}`,
  GOV_TOKEN: process.env.NEXT_PUBLIC_GOVTOKEN_ADDRESS as `0x${string}`,
  TIMELOCK: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS as `0x${string}`,
  RWA_NFT: process.env.NEXT_PUBLIC_RWA_NFT_ADDRESS as `0x${string}`,
  RWAGOVERNOR_LOGIC: process.env.NEXT_PUBLIC_RWAGOVERNOR_LOGIC_ADDRESS as `0x${string}`,
  DISTRIBUTOR: process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS as `0x${string}`,
  VOTING_PAYMASTER: process.env.NEXT_PUBLIC_VOTING_PAYMASTER_ADDRESS as `0x${string}`,
  DAO_TREASURY: process.env.NEXT_PUBLIC_DAO_TREASURY_ADDRESS as `0x${string}`,
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
  ENTRYPOINT: process.env.NEXT_PUBLIC_ENTRYPOINT as `0x${string}`,
  ERC6551_REGISTRY: process.env.NEXT_PUBLIC_ERC6551_REGISTRY_ADDRESS as `0x${string}`,
} as const;

export const CHAIN_CONFIG = {
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || 'Sepolia',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL as string,
  bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL as string,
} as const;

// RWA Proposal States
export enum RWAProposalState {
  Funding = 0,
  Succeeded = 1,
  Failed = 2,
  Executed = 3,
}

// Governor Proposal States
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

// Vote support values
export enum VoteSupport {
  Against = 0,
  For = 1,
  Abstain = 2,
}

// USDC conversion constants
export const USDC_DECIMALS = 6;
export const SHARE_DECIMALS = 18;
export const USDC_TO_SHARES_MULTIPLIER = BigInt(10 ** (SHARE_DECIMALS - USDC_DECIMALS));

// Helper to convert USDC amount to shares
export function usdcToShares(usdcAmount: bigint): bigint {
  return usdcAmount * USDC_TO_SHARES_MULTIPLIER;
}

// Helper to convert shares to USDC
export function sharesToUsdc(shares: bigint): bigint {
  return shares / USDC_TO_SHARES_MULTIPLIER;
}

// ABI fragments for key functions
export const DAO_ABI = parseAbi([
  // State
  'function nextRWAProposalId() view returns (uint256)',
  // 'function nextRWANFTId() view returns (uint256)', // not implemented in DAO.sol
  'function token() view returns (address)',
  'function rwaProposals(uint256) view returns (uint256 id, address proposer, uint256 targetUSDC, uint256 raisedUSDC, uint256 deadline, string nftMetadataURI, uint8 state)',
  'function rwaShares(uint256 nftId, address account) view returns (uint256)',
  'function rwaDaos(uint256 nftId) view returns (address)',
  'function isRWAGovernor(address) view returns (bool)',
  'function nftProposalId(uint256 nftId) view returns (uint256)',
  'function getInvestorList(uint256 proposalId) view returns (address[])',
  
  // Actions
  'function createRWAFundingProposal(uint256 _targetUSDC, string _nftMetadataURI)',
  'function invest(uint256 proposalId, uint256 amount)',
  'function finalizeProposal(uint256 proposalId)',
  'function reclaimInvestment(uint256 proposalId)',
  
  // Governor functions
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'function getVotes(address account) view returns (uint256)',
  
  // Events
  'event RWAFundingProposalCreated(uint256 indexed proposalId, address indexed proposer, uint256 targetUSDC, uint256 deadline)',
  'event Invested(uint256 indexed proposalId, address indexed investor, uint256 amount)',
  'event ProposalFinalized(uint256 indexed proposalId, uint8 newState)',
  'event InvestmentReclaimed(uint256 indexed proposalId, address indexed investor, uint256 amount)',
  'event RWADeployed(uint256 indexed nftId, address governor, address tba)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
]);

export const RWAGOVERNOR_ABI = parseAbi([
  'function nftId() view returns (uint256)',
  'function tbaAddress() view returns (address)',
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
]);

export const GOVTOKEN_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function getVotes(address account) view returns (uint256)',
  'function delegate(address delegatee)',
  'function delegates(address account) view returns (address)',
]);

export const RWA_NFT_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
]);

export const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

export const DISTRIBUTOR_ABI = parseAbi([
  'function distribute(uint256 nftId, uint256 totalAmount, address tokenAddress)',
]);

export const VOTING_PAYMASTER_ABI = parseAbi([
  'function validatePaymasterUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 requiredPreFund) view returns (bytes context, uint256 validationData)',
]);

export const ENTRYPOINT_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function getDepositInfo(address account) view returns (uint112 deposit, uint112 staked, uint32 unstakeDelaySec, uint48 withdrawTime)',
  'function depositTo(address account) payable',
  'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)',
]);
