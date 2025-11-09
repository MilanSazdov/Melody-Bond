import { Address, encodeFunctionData, Hex } from 'viem'
import { DAO_ADDRESS, RWA_ADDRESS, ERC6551_REGISTRY_ADDRESS, ERC6551_IMPLEMENTATION_ADDRESS, ERC6551_REGISTRY_ABI, ERC6551_ACCOUNT_ABI, ERC20_ABI, DAO_TREASURY_ADDRESS } from '../constants'

// Tiny helpers to build proposal payloads centered around DAO + Timelock execution

export type ProposalPayload = {
  targets: Address[]
  values: bigint[]
  calldatas: Hex[]
}

// 1) Mint RWA + Create TBA (ERC-6551) in a single proposal
// Assumptions: salt=0, initData empty; Timelock owns RWA and can mint
export function buildMintAndCreateTBAPayload(params: {
  to: Address
  tokenURI: string
  chainId: number
  salt?: bigint
  initData?: Hex
}): ProposalPayload {
  const salt = params.salt ?? BigInt(0)
  const initData = params.initData ?? '0x'

  const mintData = encodeFunctionData({
    abi: [
      { type: 'function', name: 'mint', inputs: [ { name: 'to', type: 'address' }, { name: 'tokenURI', type: 'string' } ], outputs: [ { type: 'uint256' } ] }
    ] as const,
    functionName: 'mint',
    args: [params.to, params.tokenURI]
  })

  const createAccountData = encodeFunctionData({
    abi: ERC6551_REGISTRY_ABI as any,
    functionName: 'createAccount',
    args: [
      ERC6551_IMPLEMENTATION_ADDRESS,
      BigInt(params.chainId),
      RWA_ADDRESS,
  BigInt(0), 
      salt,
      initData,
    ]
  })

  return {
    targets: [RWA_ADDRESS, ERC6551_REGISTRY_ADDRESS],
  values: [BigInt(0), BigInt(0)],
    calldatas: [mintData, createAccountData]
  }
}

// 2) Move revenue from TBA to DAO Treasury via TBA.execute(token.transfer(to, amount))
export function buildTBARevenueTransferPayload(params: {
  tba: Address
  token: Address // MockUSDC
  to?: Address // default DAO_TREASURY_ADDRESS
  amount: bigint
}): ProposalPayload {
  const to = params.to ?? (DAO_TREASURY_ADDRESS as Address)
  const transferData = encodeFunctionData({
    abi: ERC20_ABI as any,
    functionName: 'transfer',
    args: [to, params.amount]
  })
  const executeData = encodeFunctionData({
    abi: ERC6551_ACCOUNT_ABI as any,
    functionName: 'execute',
  args: [params.token, BigInt(0), transferData]
  })
  return {
    targets: [params.tba],
  values: [BigInt(0)],
    calldatas: [executeData]
  }
}

// Optional convenience: wrap with description builders
export const describeMintAndCreateTBA = (nameOrUri: string) => `Mint RWA and create TBA for ${nameOrUri}`
export const describeTBARevenueTransfer = (amount: string) => `Move ${amount} USDC from TBA to DAO Treasury`