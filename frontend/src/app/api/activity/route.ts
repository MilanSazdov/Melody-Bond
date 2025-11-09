import { NextRequest } from 'next/server'
import { DAO_ADDRESS, RWA_ADDRESS, GOV_TOKEN_ADDRESS, TIMELOCK_ADDRESS, VOTING_PAYMASTER_ADDRESS } from '../../../constants'

type EtherscanTx = {
  blockNumber: string
  timeStamp: string
  hash: string
  nonce: string
  blockHash: string
  transactionIndex: string
  from: string
  to: string
  value: string
  gas: string
  gasPrice: string
  isError: string
  txreceiptstatus?: string
  input: string
  contractAddress: string
  cumulativeGasUsed: string
  gasUsed: string
  confirmations: string
}

function uniqueBy<T, K extends string | number>(arr: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const item of arr) {
    const k = key(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const addressesParam = searchParams.get('addresses')
  const limit = Number(searchParams.get('limit') || '50')

  // Use provided addresses or default to key contracts
  const defaultAddrs = [DAO_ADDRESS, RWA_ADDRESS, GOV_TOKEN_ADDRESS, TIMELOCK_ADDRESS, VOTING_PAYMASTER_ADDRESS]
  const addresses = (addressesParam ? addressesParam.split(',') : defaultAddrs).filter(Boolean)

  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing ETHERSCAN_API_KEY' }, { status: 400 })
  }

  const base = 'https://api-sepolia.etherscan.io/api'

  try {
    const results = await Promise.all(
      addresses.map(async (addr) => {
        const url = `${base}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
        const res = await fetch(url, { next: { revalidate: 30 } })
        if (!res.ok) throw new Error(`Etherscan error for ${addr}: ${res.status}`)
        const json = await res.json()
        if (json.status !== '1' && json.message !== 'No transactions found') {
          throw new Error(`Etherscan returned: ${json.message}`)
        }
        const txs: EtherscanTx[] = Array.isArray(json.result) ? json.result : []
        return txs.map((t) => ({ ...t, _source: addr }))
      })
    )

    const merged = uniqueBy(results.flat(), (t) => t.hash)
      .sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
      .slice(0, limit)

    const data = merged.map((t) => ({
      hash: t.hash,
      from: t.from,
      to: t.to,
      value: t.value,
      timeStamp: Number(t.timeStamp),
      status: t.isError === '0' && (t.txreceiptstatus === undefined || t.txreceiptstatus === '1') ? 'success' : 'failed',
      source: (t as any)._source as string,
    }))

    return Response.json({ addresses, count: data.length, data })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to fetch activity' }, { status: 500 })
  }
}