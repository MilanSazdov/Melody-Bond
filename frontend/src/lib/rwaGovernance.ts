import { Address, encodeFunctionData, Hex, keccak256, toHex, PublicClient } from 'viem'
import { 
  DAO_ADDRESS, 
  RWA_ADDRESS, 
  DISTRIBUTOR_ADDRESS,
  MOCK_USDC_ADDRESS,
  ERC6551_REGISTRY_ADDRESS,
  ERC6551_IMPLEMENTATION_ADDRESS,
  DAO_ABI,
  RWA_ABI,
  RWA_GOVERNOR_ABI,
  ERC6551_ACCOUNT_ABI,
  ERC20_ABI,
  DISTRIBUTOR_ABI
} from '../constants'

export type RWAInvestment = {
  nftId: bigint
  shares: bigint
  governorAddress: Address
  tbaAddress: Address
  metadata: {
    uri: string
    name?: string
    image?: string
  }
}

export type RWAProposal = {
  proposalId: string
  nftId: bigint
  governorAddress: Address
  description: string
  state: number
  forVotes: bigint
  againstVotes: bigint
  abstainVotes: bigint
  executed: boolean
  type: 'changeName' | 'changeImage' | 'withdraw' | 'other'
}

/**
 * Get all RWA NFTs that a user has invested in
 */
export async function getUserRWAInvestments(
  publicClient: PublicClient,
  userAddress: Address
): Promise<RWAInvestment[]> {
  try {
    // First, get total supply of RWA NFTs
    const totalSupply = await publicClient.readContract({
      address: RWA_ADDRESS,
      abi: RWA_ABI,
      functionName: 'totalSupply',
    }) as bigint

    const investments: RWAInvestment[] = []

    // Check each NFT for user's shares
    for (let i = 0; i < Number(totalSupply); i++) {
      const nftId = BigInt(i)
      
      // Get user's shares in this NFT
      const shares = await publicClient.readContract({
        address: DAO_ADDRESS,
        abi: DAO_ABI,
        functionName: 'rwaShares',
        args: [nftId, userAddress],
      }) as bigint

      if (shares > 0n) {
        // User has invested in this NFT
        const governorAddress = await publicClient.readContract({
          address: DAO_ADDRESS,
          abi: DAO_ABI,
          functionName: 'rwaDaos',
          args: [nftId],
        }) as Address

        // Calculate TBA address
        const tbaAddress = await getTBAAddress(publicClient, nftId)

        // Get metadata
        const uri = await publicClient.readContract({
          address: RWA_ADDRESS,
          abi: RWA_ABI,
          functionName: 'tokenURI',
          args: [nftId],
        }) as string

        investments.push({
          nftId,
          shares,
          governorAddress,
          tbaAddress,
          metadata: {
            uri,
          },
        })
      }
    }

    return investments
  } catch (error) {
    console.error('Error fetching RWA investments:', error)
    return []
  }
}

/**
 * Get TBA address for an RWA NFT
 */
export async function getTBAAddress(
  publicClient: PublicClient,
  nftId: bigint
): Promise<Address> {
  const tbaAddress = await publicClient.readContract({
    address: ERC6551_REGISTRY_ADDRESS,
    abi: [
      {
        type: 'function',
        name: 'account',
        inputs: [
          { name: 'implementation', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
        ],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'account',
    args: [
      ERC6551_IMPLEMENTATION_ADDRESS,
      BigInt(11155111), // Sepolia chain ID
      RWA_ADDRESS,
      nftId,
      BigInt(0), // Default salt
    ],
  }) as Address

  return tbaAddress
}

/**
 * Create proposal to change RWA name/metadata
 */
export function buildChangeNameProposal(nftId: bigint, newMetadataURI: string): {
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
  description: string
} {
  const setTokenURIData = encodeFunctionData({
    abi: RWA_ABI,
    functionName: 'setTokenURI',
    args: [nftId, newMetadataURI],
  })

  return {
    targets: [RWA_ADDRESS],
    values: [0n],
    calldatas: [setTokenURIData],
    description: `Change metadata for RWA #${nftId} to ${newMetadataURI}`,
  }
}

/**
 * Create proposal to change RWA image (same as name, just different metadata)
 */
export function buildChangeImageProposal(nftId: bigint, newMetadataURI: string): {
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
  description: string
} {
  const setTokenURIData = encodeFunctionData({
    abi: RWA_ABI,
    functionName: 'setTokenURI',
    args: [nftId, newMetadataURI],
  })

  return {
    targets: [RWA_ADDRESS],
    values: [0n],
    calldatas: [setTokenURIData],
    description: `Change image for RWA #${nftId}`,
  }
}

/**
 * Create proposal to withdraw funds (distribute to investors)
 */
export function buildWithdrawProposal(nftId: bigint, amount: bigint, tokenAddress: Address = MOCK_USDC_ADDRESS): {
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
  description: string
} {
  // Step 1: TBA approves Distributor to spend tokens
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [DISTRIBUTOR_ADDRESS, amount],
  })

  // Step 2: TBA calls distribute on Distributor
  const distributeData = encodeFunctionData({
    abi: DISTRIBUTOR_ABI,
    functionName: 'distribute',
    args: [nftId, amount, tokenAddress],
  })

  return {
    targets: [tokenAddress, DISTRIBUTOR_ADDRESS],
    values: [0n, 0n],
    calldatas: [approveData, distributeData],
    description: `Distribute ${amount} tokens from RWA #${nftId} to investors`,
  }
}

/**
 * Get all proposals for an RWA Governor
 */
export async function getRWAProposals(
  publicClient: PublicClient,
  governorAddress: Address,
  nftId: bigint
): Promise<RWAProposal[]> {
  try {
    // Get ProposalCreated events
    const logs = await publicClient.getLogs({
      address: governorAddress,
      event: {
        type: 'event',
        name: 'ProposalCreated',
        inputs: [
          { name: 'proposalId', type: 'uint256', indexed: true },
          { name: 'proposer', type: 'address', indexed: false },
          { name: 'targets', type: 'address[]', indexed: false },
          { name: 'values', type: 'uint256[]', indexed: false },
          { name: 'signatures', type: 'string[]', indexed: false },
          { name: 'calldatas', type: 'bytes[]', indexed: false },
          { name: 'startBlock', type: 'uint256', indexed: false },
          { name: 'endBlock', type: 'uint256', indexed: false },
          { name: 'description', type: 'string', indexed: false },
        ],
      },
      fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || '0'),
      toBlock: 'latest',
    })

    const proposals: RWAProposal[] = []

    for (const log of logs) {
      const { proposalId, description } = log.args as any

      // Get proposal state
      const state = await publicClient.readContract({
        address: governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'state',
        args: [proposalId],
      }) as number

      // Get votes
      const votes = await publicClient.readContract({
        address: governorAddress,
        abi: RWA_GOVERNOR_ABI,
        functionName: 'proposalVotes',
        args: [proposalId],
      }) as [bigint, bigint, bigint]

      // Determine proposal type from description
      let type: RWAProposal['type'] = 'other'
      if (description.toLowerCase().includes('metadata') || description.toLowerCase().includes('name')) {
        type = 'changeName'
      } else if (description.toLowerCase().includes('image')) {
        type = 'changeImage'
      } else if (description.toLowerCase().includes('distribute') || description.toLowerCase().includes('withdraw')) {
        type = 'withdraw'
      }

      proposals.push({
        proposalId: proposalId.toString(),
        nftId,
        governorAddress,
        description,
        state,
        forVotes: votes[1],
        againstVotes: votes[0],
        abstainVotes: votes[2],
        executed: state === 7, // Executed state
        type,
      })
    }

    return proposals
  } catch (error) {
    console.error('Error fetching RWA proposals:', error)
    return []
  }
}

/**
 * Get user's voting power for an RWA
 */
export async function getUserVotingPower(
  publicClient: PublicClient,
  userAddress: Address,
  nftId: bigint
): Promise<bigint> {
  try {
    const shares = await publicClient.readContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: 'rwaShares',
      args: [nftId, userAddress],
    }) as bigint

    return shares
  } catch (error) {
    console.error('Error fetching voting power:', error)
    return 0n
  }
}

/**
 * Check if user has voted on a proposal
 */
export async function hasUserVoted(
  publicClient: PublicClient,
  governorAddress: Address,
  proposalId: bigint,
  userAddress: Address
): Promise<boolean> {
  try {
    const hasVoted = await publicClient.readContract({
      address: governorAddress,
      abi: RWA_GOVERNOR_ABI,
      functionName: 'hasVoted',
      args: [proposalId, userAddress],
    }) as boolean

    return hasVoted
  } catch (error) {
    console.error('Error checking vote status:', error)
    return false
  }
}

/**
 * Get TBA balance for a token
 */
export async function getTBABalance(
  publicClient: PublicClient,
  tbaAddress: Address,
  tokenAddress: Address = MOCK_USDC_ADDRESS
): Promise<bigint> {
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [tbaAddress],
    }) as bigint

    return balance
  } catch (error) {
    console.error('Error fetching TBA balance:', error)
    return 0n
  }
}
