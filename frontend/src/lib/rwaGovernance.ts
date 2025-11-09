import { Address, encodeFunctionData, Hex, keccak256, toHex, PublicClient } from 'viem'
import { 
  DAO_ADDRESS, 
  RWA_ADDRESS, 
  DISTRIBUTOR_ADDRESS,
  MOCK_USDC_ADDRESS,
  ERC6551_REGISTRY_ADDRESS,
  ERC6551_IMPLEMENTATION_ADDRESS,
  DEPLOY_BLOCK,
  DAO_ABI,
  RWA_ABI,
  RWA_GOVERNOR_ABI,
  ERC6551_ACCOUNT_ABI,
  ERC20_ABI,
  DISTRIBUTOR_ABI
} from '../constants'

/**
 * Parse metadata from various URI formats (data URIs, IPFS, HTTP)
 */
async function parseMetadataURI(uri: string): Promise<{ name?: string; image?: string; description?: string }> {
  if (!uri) return {}
  
  try {
    let metadata;
    
    // Handle data:application/json;base64,... format
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.slice('data:application/json;base64,'.length);
      const jsonString = atob(base64Data);
      metadata = JSON.parse(jsonString);
    }
    // Handle data:application/json,... format (URL-encoded JSON)
    else if (uri.startsWith('data:application/json,')) {
      const jsonStr = uri.slice('data:application/json,'.length);
      const decoded = decodeURIComponent(jsonStr);
      metadata = JSON.parse(decoded);
    }
    // Handle HTTP/IPFS URLs
    else if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('ipfs://')) {
      const fetchUrl = uri.startsWith('ipfs://') 
        ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : uri;
      const res = await fetch(fetchUrl);
      metadata = await res.json();
    }
    
    return {
      name: metadata?.name,
      image: metadata?.image,
      description: metadata?.description
    };
  } catch (err) {
    console.warn('[Metadata] Failed to parse URI:', uri, err);
    return {};
  }
}

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
 * Parse full metadata JSON from a tokenURI that may be:
 * - data:application/json;base64,<base64>
 * - data:application/json,<url-encoded-json>
 * - http(s) or ipfs:// URL
 */
export async function parseFullMetadata(uri: string): Promise<Record<string, any>> {
  if (!uri) return {};
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.slice('data:application/json;base64,'.length);
      const jsonString = typeof atob !== 'undefined' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('utf8');
      return JSON.parse(jsonString);
    }
    if (uri.startsWith('data:application/json,')) {
      const jsonStr = uri.slice('data:application/json,'.length);
      const decoded = decodeURIComponent(jsonStr);
      return JSON.parse(decoded);
    }
    if (uri.startsWith('ipfs://') || uri.startsWith('http://') || uri.startsWith('https://')) {
      const url = uri.startsWith('ipfs://') ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/') : uri;
      const res = await fetch(url);
      return await res.json();
    }
  } catch (err) {
    console.warn('[Metadata] parseFullMetadata failed for', uri, err);
  }
  return {};
}

function buildDataJsonURI(obj: Record<string, any>): string {
  try {
    const json = JSON.stringify(obj);
    return `data:application/json,${encodeURIComponent(json)}`;
  } catch {
    return `data:application/json,${encodeURIComponent('{}')}`;
  }
}

/**
 * Build a merged metadata URI, preserving existing fields and updating only provided ones.
 */
export async function buildMergedMetadataURI(currentUri: string, updates: { name?: string; image?: string; description?: string }): Promise<string> {
  const current = await parseFullMetadata(currentUri).catch(() => ({}));
  const merged: Record<string, any> = { ...current };
  if (typeof updates.name !== 'undefined') merged.name = updates.name;
  if (typeof updates.image !== 'undefined') merged.image = updates.image;
  if (typeof updates.description !== 'undefined') merged.description = updates.description;
  return buildDataJsonURI(merged);
}

/**
 * Get all RWA NFTs that a user has invested in (both active proposals and finalized NFTs)
 */
export async function getUserRWAInvestments(
  publicClient: PublicClient,
  userAddress: Address
): Promise<RWAInvestment[]> {
  try {
    const investments: RWAInvestment[] = []

    // Heuristic upper bound: attempt up to nextRWAProposalId (if available) or fallback to 50.
    let upperBound = 50n
    try {
      const nextProposalId = await publicClient.readContract({
        address: DAO_ADDRESS,
        abi: DAO_ABI,
        functionName: 'nextRWAProposalId'
      }) as bigint
      // Minted NFT ids start at 0 and increment only when proposals succeed.
      // We can't infer exact supply because RWA.sol has no totalSupply in deployed version.
      // Use nextProposalId as a safe upper exploration bound (can't exceed number of proposals).
      upperBound = nextProposalId > 0n ? nextProposalId + 5n : 50n // small cushion
      console.log('[RWA] Using upperBound', upperBound.toString(), 'derived from nextProposalId', nextProposalId.toString())
    } catch (e) {
      console.warn('[RWA] Could not read nextRWAProposalId. Falling back to default upperBound', upperBound.toString())
    }

    for (let nftId = 0n; nftId < upperBound; nftId++) {
      try {
        // Check if governor exists for this NFT (indicates successful execution)
        const governorAddress = await publicClient.readContract({
          address: DAO_ADDRESS,
          abi: DAO_ABI,
          functionName: 'rwaDaos',
          args: [nftId]
        }) as Address

        if (governorAddress === '0x0000000000000000000000000000000000000000') {
          continue // Not a deployed RWA governor; skip
        }

        // Read user shares; if zero skip
        let shares: bigint = 0n
        try {
          shares = await publicClient.readContract({
            address: DAO_ADDRESS,
            abi: DAO_ABI,
            functionName: 'rwaShares',
            args: [nftId, userAddress]
          }) as bigint
        } catch (shareErr) {
          // Treat errors ("0x" returns) as zero shares
          shares = 0n
        }

        if (shares === 0n) continue

        // Fetch tokenURI (skip if token does not exist)
        let uri = ''
        try {
          uri = await publicClient.readContract({
            address: RWA_ADDRESS,
            abi: RWA_ABI,
            functionName: 'tokenURI',
            args: [nftId]
          }) as string
        } catch (uriErr) {
          console.warn('[RWA] tokenURI unavailable for NFT', nftId.toString(), uriErr)
        }

        // Derive TBA address using deterministic salt
        let tbaAddress: Address = '0x0000000000000000000000000000000000000000'
        try {
          tbaAddress = await getTBAAddress(publicClient, nftId)
        } catch (tbaErr) {
          console.warn('[RWA] TBA lookup failed for NFT', nftId.toString(), tbaErr)
        }

        // Parse metadata to extract name and image
        let parsedMetadata: { name?: string; image?: string } = {}
        try {
          parsedMetadata = await parseMetadataURI(uri)
        } catch (metaErr) {
          console.warn('[RWA] Metadata parse failed for NFT', nftId.toString(), metaErr)
        }

        investments.push({
          nftId,
          shares,
          governorAddress,
          tbaAddress,
          metadata: { 
            uri,
            name: parsedMetadata.name,
            image: parsedMetadata.image
          }
        })
      } catch (err) {
        // Likely out-of-range or unreadable; continue scanning
        continue
      }
    }

    console.log('[RWA] 📊 Total investments found via NFT scan:', investments.length)
    console.log('[RWA] Investment details:', investments.map(i => ({ nftId: i.nftId.toString(), shares: i.shares.toString() })))

    return investments
  } catch (error) {
    console.error('Error fetching RWA investments:', error)
    return []
  }
}

/**
 * Get TBA address for an RWA NFT
 * Must match the salt calculation in DAO.sol: keccak256(nftId, chainid)
 */
export async function getTBAAddress(
  publicClient: PublicClient,
  nftId: bigint
): Promise<Address> {
  const chainId = BigInt(11155111) // Sepolia
  
  // Calculate salt the same way as DAO.sol: keccak256(nftId, chainId)
  // Pack nftId and chainId as two uint256 values (64 bytes total)
  const nftIdHex = toHex(nftId, { size: 32 })
  const chainIdHex = toHex(chainId, { size: 32 })
  const packedData = (nftIdHex + chainIdHex.slice(2)) as Hex // Concatenate, remove 0x from second
  const salt = keccak256(packedData)

  console.log('[TBA] Calculating TBA for NFT', nftId.toString(), 'with salt', salt)

  const tbaAddress = await publicClient.readContract({
    address: ERC6551_REGISTRY_ADDRESS,
    abi: [
      {
        type: 'function',
        name: 'account',
        inputs: [
          { name: 'implementation', type: 'address' },
          { name: 'salt', type: 'bytes32' },
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'account',
    args: [
      ERC6551_IMPLEMENTATION_ADDRESS,
      salt,
      chainId,
      RWA_ADDRESS,
      nftId,
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
    description: `Change name for RWA #${nftId}`,
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
