// Contract addresses and ABIs for the RWA demo (Sepolia)
// Note: ABIs are expected under src/abis after you copy rwa-backend/out -> src/abis

// --- ABI imports ---
// To keep the app buildable before ABIs are copied, we avoid static imports here.
// After copying `rwa-backend/out` to `src/abis`, you can optionally replace the
// placeholders below with static imports similar to:
//   import DAOArtifact from './abis/DAO.sol/DAO.json'

// --- Sepolia Contract Addresses (Updated with your new deployments) ---
export const GOV_TOKEN_ADDRESS = '0x6055b512F5166690Eb53c5afC83D8Ff9B489A2c6' as const;
export const TIMELOCK_ADDRESS = '0x6bb79f6993A6BfaEB7549DA7ae59450E50A60379' as const;
export const DAO_ADDRESS = '0x0289C1674FCF0cdBBD17507289BaCc03C56546FF' as const;
export const RWA_ADDRESS = '0x3AC74246B7240C2f389278C36d1e396c15a39df9' as const;
export const VOTING_PAYMASTER_ADDRESS = '0x4ae4fF6ed1D6a918e1eb6f5929428cd56C37F913' as const;

// NOTE: This address was not in your update list and remains unchanged.
export const MARKET_ADDRESS = '0xcb7bdd15f77d7ac42b0b297eacde12e0132682b6' as const;

// ERC-4337 EntryPoint (v0.6)
export const ENTRYPOINT_ADDRESS = (process.env.NEXT_PUBLIC_ENTRYPOINT || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') as `0x${string}`;

// SimpleAccountFactory - Deploy this first!
export const ACCOUNT_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_ACCOUNT_FACTORY || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// ERC-6551 (Token Bound Accounts) — fill with your actual deployed addresses
export const ERC6551_REGISTRY_ADDRESS = '0x...' as const; // TODO: set your Registry address
export const ERC6551_IMPLEMENTATION_ADDRESS = '0x...' as const; // TODO: set your Implementation address

// Optional: Mock USDC (Phase 4 simulation)
export const MOCK_USDC_ADDRESS = '0x5355770b7DED4F455F7ee58E81D8400EeDaEE6B5' as const; // TODO: set after deployment

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
] as const;

export const RWA_ABI = [
	{ type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
	{ type: 'function', name: 'mint', inputs: [
			{ name: 'to', type: 'address' },
			{ name: 'tokenURI', type: 'string' },
		], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
	{ type: 'function', name: 'tokenURI', inputs: [ { name: 'tokenId', type: 'uint256' } ], outputs: [ { type: 'string' } ], stateMutability: 'view' },
	{ type: 'function', name: 'totalSupply', inputs: [], outputs: [ { type: 'uint256' } ], stateMutability: 'view' },
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
] as const;

// DAO Treasury address for revenue extraction proposals
export const DAO_TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_DAO_TREASURY || '0x0000000000000000000000000000000000000000') as `0x${string}`;
// export const MOCK_USDC_ABI = MockUSDCArtifact.abi
// export const ERC6551_REGISTRY_ABI = RegistryArtifact.abi
// export const ERC6551_IMPLEMENTATION_ABI = ImplementationArtifact.abi

export const SEPOLIA_CHAIN_ID = 11155111 as const;