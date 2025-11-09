
import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, http, parseEther, encodeFunctionData, Address, Hex } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS as Address || '0x6f3e357FD8fd26aa19a40622e46a54f1A89b9e08'
const VOTING_PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_VOTING_PAYMASTER_ADDRESS as Address || '0x0362131939e115b335061E873AbE8048b8d8985b'
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as Hex

const DAO_ABI = [
  {
    type: 'function',
    name: 'castVoteBySig',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
      { name: 'voter', type: 'address' },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  }
] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proposalId, support, voter, signature } = body

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Relayer not configured. Set RELAYER_PRIVATE_KEY in .env.local' },
        { status: 500 }
      )
    }

    // Validate inputs
    if (!proposalId || support === undefined || !voter || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: proposalId, support, voter, signature' },
        { status: 400 }
      )
    }

    // Create relayer account
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY)
    
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/f0cf3284818e47609886fab853477aaa'),
    })

    console.log('🗳️ Submitting gasless vote:', {
      proposalId,
      support,
      voter,
      paymaster: VOTING_PAYMASTER_ADDRESS,
      relayer: account.address
    })

    const hash = await walletClient.writeContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: 'castVoteBySig',
      args: [BigInt(proposalId), Number(support), voter as Address, signature as Hex],
    })

    console.log('✅ Gasless vote submitted:', hash)

    return NextResponse.json({ 
      success: true, 
      hash,
      message: 'Vote submitted gaslessly via VotingPaymaster!',
      paymasterAddress: VOTING_PAYMASTER_ADDRESS
    })

  } catch (error: any) {
    console.error('Gasless vote error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to submit gasless vote' },
      { status: 500 }
    )
  }
}
