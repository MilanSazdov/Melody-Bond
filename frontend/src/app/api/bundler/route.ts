import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, http, Address, Hex } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const ENTRYPOINT_ADDRESS = process.env.NEXT_PUBLIC_ENTRYPOINT || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const BUNDLER_PRIVATE_KEY = process.env.BUNDLER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/f0cf3284818e47609886fab853477aaa'

const ENTRYPOINT_ABI = [
  {
    type: 'function',
    name: 'handleOps',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
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
        ]
      },
      { name: 'beneficiary', type: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const

export async function POST(req: NextRequest) {
  try {
    if (!BUNDLER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Bundler not configured. Set BUNDLER_PRIVATE_KEY in .env.local' },
        { status: 500 }
      )
    }

    const { userOp } = await req.json()

    if (!userOp) {
      return NextResponse.json({ error: 'Missing userOp' }, { status: 400 })
    }

    // Create bundler wallet client
    const account = privateKeyToAccount(BUNDLER_PRIVATE_KEY as Hex)
    const bundlerClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(RPC_URL)
    })

    console.log('Bundler submitting UserOperation...')
    console.log('Sender:', userOp.sender)
    console.log('Nonce:', userOp.nonce)
    console.log('Has initCode:', userOp.initCode !== '0x')
    console.log('PaymasterAndData:', userOp.paymasterAndData)
    console.log('CallData selector:', userOp.callData.slice(0, 10))
    console.log('CallData full:', userOp.callData)
    
    // Verify paymaster address
    if (userOp.paymasterAndData === '0x' || userOp.paymasterAndData === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️ WARNING: No paymaster specified! Sender will pay for gas.')
    } else {
      console.log('✓ Paymaster will sponsor this UserOp')
      console.log('Expected callData selector: 0xb61d27f6 (execute)')
      console.log('Expected DAO address in callData: 0x4a65FD32676004F1dC4f9F62aDCFCF08fa65bA29')
    }

    // Submit UserOperation to EntryPoint
    const userOpStruct = {
      sender: userOp.sender as Address,
      nonce: BigInt(userOp.nonce),
      initCode: userOp.initCode as Hex,
      callData: userOp.callData as Hex,
      callGasLimit: BigInt(userOp.callGasLimit),
      verificationGasLimit: BigInt(userOp.verificationGasLimit),
      preVerificationGas: BigInt(userOp.preVerificationGas),
      maxFeePerGas: BigInt(userOp.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
      paymasterAndData: userOp.paymasterAndData as Hex,
      signature: userOp.signature as Hex
    }

    // Submit transaction without waiting for receipt (faster response)
    const hash = await bundlerClient.writeContract({
      address: ENTRYPOINT_ADDRESS as Address,
      abi: ENTRYPOINT_ABI,
      functionName: 'handleOps',
      args: [[userOpStruct], account.address], // beneficiary = bundler
      gas: BigInt(5000000) // 5M gas limit for the transaction
    }) as Hex

    console.log('UserOperation submitted! Hash:', hash)
    console.log('Check status: https://sepolia.etherscan.io/tx/' + hash)

    // Return immediately - don't wait for confirmation
    return NextResponse.json({
      success: true,
      hash,
      message: 'Vote submitted! Transaction is being mined...',
      etherscanUrl: `https://sepolia.etherscan.io/tx/${hash}`
    })
  } catch (error: any) {
    console.error('Bundler error:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to submit UserOperation',
        details: error.cause?.message || error.details || 'Unknown error'
      },
      { status: 500 }
    )
  }
}
