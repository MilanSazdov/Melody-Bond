// Contract addresses and ABIs for the RWA demo (Sepolia)
// Note: ABIs are expected under src/abis after you copy rwa-backend/out -> src/abis

// --- ABI imports ---
// To keep the app buildable before ABIs are copied, we avoid static imports here.
// After copying `rwa-backend/out` to `src/abis`, you can optionally replace the
// placeholders below with static imports similar to:
//   import DAOArtifact from './abis/DAO.sol/DAO.json'

// --- Sepolia Contract Addresses (Updated with your new deployments) ---
export const GOV_TOKEN_ADDRESS = '0xb0231d9dC68C4C320d121237fE8De00ab5899dBE' as const;
export const TIMELOCK_ADDRESS = '0x417875AD8Af4DE85325DC1Ea09A719ea16254dDD' as const;
export const DAO_ADDRESS = '0x132AD6fB8EaF3065C831Febf5788AbDa4B72c76C' as const;
export const RWA_ADDRESS = '0x914c81B1A6C3aCF7B5903a7EDcB53C59373C6B57' as const;
export const VOTING_PAYMASTER_ADDRESS = '0xAfb770895D6df47fC99Fc486093F229fF5645443' as const;
export const DISTRIBUTOR_ADDRESS = '0xdD504aE23C6C63Ee60Ffc7abd84F736BC9b601f9' as const;
export const RWA_GOVERNOR_LOGIC_ADDRESS = '0x6a5Fb4851aEB873641768e7996b8112766a50FC7' as const;

// NOTE: This address was not in your update list and remains unchanged.
export const MARKET_ADDRESS = '0xcb7bdd15f77d7ac42b0b297eacde12e0132682b6' as const;

// ERC-4337 EntryPoint (v0.6)
export const ENTRYPOINT_ADDRESS = (process.env.NEXT_PUBLIC_ENTRYPOINT || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') as `0x${string}`;

// SimpleAccountFactory - Deploy this first!
export const ACCOUNT_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_ACCOUNT_FACTORY || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// ERC-6551 (Token Bound Accounts)
export const ERC6551_REGISTRY_ADDRESS = '0x000000006551c19487814612e58FE06813775758' as const;
export const ERC6551_IMPLEMENTATION_ADDRESS = '0x0000000000000000000000000000000000006551' as const;

// Mock USDC
export const MOCK_USDC_ADDRESS = '0x49379c59Da9D2472896B37B8Cd86EA0B1CB256E9' as const;

// --- ABIs ---
// Minimal ABIs needed for current UI interactions.
// Replace with full artifacts (run `npm run copy:abis`) when you need exhaustive functionality.
export const GOV_TOKEN_ABI = [
	{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'getVotes', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'delegates', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'delegate', inputs: [{ name: 'to', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const DAO_ABI = [
	{ type: 'function', name: 'propose', inputs: [
			{ name: 'targets', type: 'address[]' },
			{ name: 'values', type: 'uint256[]' },
			{ name: 'calldatas', type: 'bytes[]' },
			{ name: 'description', type: 'string' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'state', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
	{ type: 'function', name: 'proposalNeedsQueuing', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
	{ type: 'function', name: 'queue', inputs: [
			{ name: 'targets', type: 'address[]' },
			{ name: 'values', type: 'uint256[]' },
			{ name: 'calldatas', type: 'bytes[]' },
			{ name: 'descriptionHash', type: 'bytes32' },
		], outputs: [], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'execute', inputs: [
			{ name: 'targets', type: 'address[]' },
			{ name: 'values', type: 'uint256[]' },
			{ name: 'calldatas', type: 'bytes[]' },
			{ name: 'descriptionHash', type: 'bytes32' },
		], outputs: [], stateMutability: 'payable' },
	{ type: 'function', name: 'castVote', inputs: [
			{ name: 'proposalId', type: 'uint256' },
			{ name: 'support', type: 'uint8' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'rwaShares', inputs: [
			{ name: 'nftId', type: 'uint256' },
			{ name: 'investor', type: 'address' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'rwaDaos', inputs: [
			{ name: 'nftId', type: 'uint256' },
		], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'nftProposalId', inputs: [
			{ name: 'nftId', type: 'uint256' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'rwaProposals', inputs: [
			{ name: 'proposalId', type: 'uint256' },
		], outputs: [
			{ name: 'id', type: 'uint256' },
			{ name: 'proposer', type: 'address' },
			{ name: 'targetUSDC', type: 'uint256' },
			{ name: 'raisedUSDC', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'nftMetadataURI', type: 'string' },
			{ name: 'state', type: 'uint8' },
		], stateMutability: 'view' },
	{ type: 'function', name: 'getInvestorList', inputs: [
			{ name: 'proposalId', type: 'uint256' },
		], outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view' },
] as const;

export const RWA_ABI = [
	{ type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'mint', inputs: [
			{ name: 'to', type: 'address' },
			{ name: 'tokenURI', type: 'string' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'tokenURI', inputs: [ { name: 'tokenId', type: 'uint256' } ], outputs: [ { type: 'string' } ], stateMutability: 'view' },
	{ type: 'function', name: 'totalSupply', inputs: [], outputs: [ { type: 'uint256' } ], stateMutability: 'view' },
	{ type: 'function', name: 'setTokenURI', inputs: [ 
			{ name: 'tokenId', type: 'uint256' },
			{ name: 'uri', type: 'string' }
		], outputs: [], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'ownerOf', inputs: [ { name: 'tokenId', type: 'uint256' } ], outputs: [ { type: 'address' } ], stateMutability: 'view' },
] as const;

export const VOTING_PAYMASTER_ABI = [
	{ type: 'function', name: 'getDeposit', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
] as const;

// SimpleAccountFactory ABI
export const ACCOUNT_FACTORY_ABI = [
	{ type: 'function', name: 'createAccount', inputs: [
		{ name: 'owner', type: 'address' },
		{ name: 'salt', type: 'uint256' }
	], outputs: [{ type: 'address' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'getAddress', inputs: [
		{ name: 'owner', type: 'address' },
		{ name: 'salt', type: 'uint256' }
	], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const;

// SimpleAccount ABI
export const SIMPLE_ACCOUNT_ABI = [
	{ type: 'function', name: 'execute', inputs: [
		{ name: 'dest', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'func', type: 'bytes' }
	], outputs: [], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'entryPoint', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'getNonce', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

// EntryPoint ABI
export const ENTRYPOINT_ABI = [
	{ type: 'function', name: 'handleOps', inputs: [
		{ name: 'ops', type: 'tuple[]', components: [
			{ name: 'sender', type: 'address' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'initCode', type: 'bytes' },
			{ name: 'callData', type: 'bytes' },
			{ name: 'callGasLimit', type: 'uint256' },
			{ name: 'verificationGasLimit', type: 'uint256' },
			{ name: 'preVerificationGas', type: 'uint256' },
			{ name: 'maxFeePerGas', type: 'uint256' },
			{ name: 'maxPriorityFeePerGas', type: 'uint256' },
			{ name: 'paymasterAndData', type: 'bytes' },
			{ name: 'signature', type: 'bytes' }
		]},
		{ name: 'beneficiary', type: 'address' }
	], outputs: [], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'getUserOpHash', inputs: [
		{ name: 'userOp', type: 'tuple', components: [
			{ name: 'sender', type: 'address' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'initCode', type: 'bytes' },
			{ name: 'callData', type: 'bytes' },
			{ name: 'callGasLimit', type: 'uint256' },
			{ name: 'verificationGasLimit', type: 'uint256' },
			{ name: 'preVerificationGas', type: 'uint256' },
			{ name: 'maxFeePerGas', type: 'uint256' },
			{ name: 'maxPriorityFeePerGas', type: 'uint256' },
			{ name: 'paymasterAndData', type: 'bytes' },
			{ name: 'signature', type: 'bytes' }
		]}
	], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
] as const;

// Deprecated Marketplace ABI retained only if needed elsewhere; governance flow does not use it.
export const MARKETPLACE_ABI = [] as const;

// ERC-6551 registry/account minimal ABIs for proposal payloads and TBA lookups
export const ERC6551_REGISTRY_ABI = [
	{ type: 'function', name: 'createAccount', inputs: [
		{ name: 'implementation', type: 'address' },
		{ name: 'chainId', type: 'uint256' },
		{ name: 'tokenContract', type: 'address' },
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'salt', type: 'uint256' },
		{ name: 'initData', type: 'bytes' },
	], outputs: [ { type: 'address' } ], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'account', inputs: [
		{ name: 'implementation', type: 'address' },
		{ name: 'chainId', type: 'uint256' },
		{ name: 'tokenContract', type: 'address' },
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'salt', type: 'uint256' },
	], outputs: [ { type: 'address' } ], stateMutability: 'view' },
] as const;

export const ERC6551_ACCOUNT_ABI = [
	{ type: 'function', name: 'execute', inputs: [
		{ name: 'to', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'data', type: 'bytes' },
	], outputs: [ { type: 'bytes' } ], stateMutability: 'payable' },
] as const;

// Minimal ERC20 for MockUSDC balance display
export const ERC20_ABI = [
	{ type: 'function', name: 'balanceOf', inputs: [ { name: 'account', type: 'address' } ], outputs: [ { type: 'uint256' } ], stateMutability: 'view' },
	{ type: 'function', name: 'symbol', inputs: [], outputs: [ { type: 'string' } ], stateMutability: 'view' },
	{ type: 'function', name: 'decimals', inputs: [], outputs: [ { type: 'uint8' } ], stateMutability: 'view' },
	{ type: 'function', name: 'transfer', inputs: [
		{ name: 'to', type: 'address' },
		{ name: 'amount', type: 'uint256' }
	], outputs: [ { type: 'bool' } ], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'approve', inputs: [
		{ name: 'spender', type: 'address' },
		{ name: 'amount', type: 'uint256' }
	], outputs: [ { type: 'bool' } ], stateMutability: 'nonpayable' },
] as const;

// RWAGovernor ABI
export const RWA_GOVERNOR_ABI = [
	{ type: 'function', name: 'propose', inputs: [
			{ name: 'targets', type: 'address[]' },
			{ name: 'values', type: 'uint256[]' },
			{ name: 'calldatas', type: 'bytes[]' },
			{ name: 'description', type: 'string' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'state', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
	{ type: 'function', name: 'castVote', inputs: [
			{ name: 'proposalId', type: 'uint256' },
			{ name: 'support', type: 'uint8' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'execute', inputs: [
			{ name: 'targets', type: 'address[]' },
			{ name: 'values', type: 'uint256[]' },
			{ name: 'calldatas', type: 'bytes[]' },
			{ name: 'descriptionHash', type: 'bytes32' },
		], outputs: [], stateMutability: 'payable' },
	{ type: 'function', name: 'nftId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'tbaAddress', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'proposalVotes', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [
		{ name: 'againstVotes', type: 'uint256' },
		{ name: 'forVotes', type: 'uint256' },
		{ name: 'abstainVotes', type: 'uint256' }
	], stateMutability: 'view' },
	{ type: 'function', name: 'hasVoted', inputs: [
		{ name: 'proposalId', type: 'uint256' },
		{ name: 'account', type: 'address' }
	], outputs: [{ type: 'bool' }], stateMutability: 'view' },
	{ type: 'function', name: 'proposeProfitDistribution', inputs: [
		{ name: 'distributorAddress', type: 'address' },
		{ name: 'tokenAddress', type: 'address' },
		{ name: 'amount', type: 'uint256' }
	], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'event', name: 'ProposalCreated', inputs: [
		{ name: 'proposalId', type: 'uint256', indexed: true },
		{ name: 'proposer', type: 'address', indexed: false },
		{ name: 'targets', type: 'address[]', indexed: false },
		{ name: 'values', type: 'uint256[]', indexed: false },
		{ name: 'signatures', type: 'string[]', indexed: false },
		{ name: 'calldatas', type: 'bytes[]', indexed: false },
		{ name: 'startBlock', type: 'uint256', indexed: false },
		{ name: 'endBlock', type: 'uint256', indexed: false },
		{ name: 'description', type: 'string', indexed: false }
	] },
	{ type: 'event', name: 'VoteCast', inputs: [
		{ name: 'voter', type: 'address', indexed: true },
		{ name: 'proposalId', type: 'uint256', indexed: false },
		{ name: 'support', type: 'uint8', indexed: false },
		{ name: 'weight', type: 'uint256', indexed: false },
		{ name: 'reason', type: 'string', indexed: false }
	] },
] as const;

// Distributor ABI
export const DISTRIBUTOR_ABI = [
	{ type: 'function', name: 'distribute', inputs: [
			{ name: 'nftId', type: 'uint256' },
			{ name: 'totalAmount', type: 'uint256' },
			{ name: 'tokenAddress', type: 'address' },
		], outputs: [], stateMutability: 'nonpayable' },
] as const;

// DAO Treasury address for revenue extraction proposals
export const DAO_TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_DAO_TREASURY || '0x0000000000000000000000000000000000000000') as `0x${string}`;
// export const MOCK_USDC_ABI = MockUSDCArtifact.abi
// export const ERC6551_REGISTRY_ABI = RegistryArtifact.abi
// export const ERC6551_IMPLEMENTATION_ABI = ImplementationArtifact.abi

export const SEPOLIA_CHAIN_ID = 11155111 as const;