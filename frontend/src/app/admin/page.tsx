'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { getRelayerBalance } from '@/lib/accountAbstraction';

const PAYMASTER_ADDRESS = '0xB2291BF9C008f964A566FBa701d6FBD9b2a93a81' as const;

export default function AdminPage() {
  const { address } = useAccount();
  const [paymasterBalance, setPaymasterBalance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState('0.1');
  const [copied, setCopied] = useState(false);

  const { data: hash, sendTransaction, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    loadPaymasterBalance();
  }, []);

  useEffect(() => {
    if (isSuccess) {
      loadPaymasterBalance();
    }
  }, [isSuccess]);

  async function loadPaymasterBalance() {
    try {
      setLoading(true);
      const balance = await getRelayerBalance();
      setPaymasterBalance(balance);
    } catch (error) {
      console.error('Error loading paymaster balance:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(PAYMASTER_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFundPaymaster() {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      const amount = parseEther(fundAmount);
      sendTransaction({
        to: PAYMASTER_ADDRESS,
        value: amount,
      });
    } catch (error) {
      console.error('Error funding paymaster:', error);
      alert('Invalid amount');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-400">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 bg-gray-800 p-6 rounded-lg">
          <h1 className="text-4xl font-bold mb-2 text-white">Admin Panel</h1>
          <p className="text-gray-300">Monitor the Paymaster Wallet for gasless transactions</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Paymaster Balance Card */}
          <div className="border border-gray-700 rounded-lg p-6 bg-gray-800">
            <h2 className="text-2xl font-bold mb-4 text-white">Paymaster Wallet Status</h2>
            
            <div className="bg-gray-700 rounded-lg p-6 mb-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Paymaster Balance</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {loading ? '...' : formatEther(paymasterBalance)} ETH
                  </p>
                </div>
                <button
                  onClick={loadPaymasterBalance}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50"
                >
                  {loading ? '⏳' : 'Refresh'}
                </button>
              </div>

              {/* Paymaster Address */}
              <div className="border-t border-gray-600 pt-4">
                <p className="text-sm text-gray-400 mb-2">Paymaster Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-purple-300 font-mono break-all">
                    {PAYMASTER_ADDRESS}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                    title="Copy address"
                  >
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>

            {/* Fund Paymaster Section */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/50 rounded-lg p-6 mb-4">
              <h3 className="text-lg font-bold mb-4 text-purple-300">💰 Fund Paymaster Wallet</h3>
              <p className="text-sm text-gray-300 mb-4">
                Send ETH to the paymaster so it can pay gas fees for user transactions
              </p>
              
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                    placeholder="0.1"
                  />
                </div>
                <button
                  onClick={handleFundPaymaster}
                  disabled={!address || isPending || isConfirming}
                  className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending || isConfirming ? 'Sending...' : 'Send ETH'}
                </button>
              </div>

              {hash && (
                <div className="mt-3 p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-400">Transaction Hash:</p>
                  <code className="text-xs text-green-400 break-all">{hash}</code>
                  {isSuccess && (
                    <p className="text-sm text-green-400 mt-2">✓ Transaction confirmed!</p>
                  )}
                </div>
              )}

              {!address && (
                <p className="mt-3 text-sm text-yellow-400">⚠️ Connect your wallet to fund the paymaster</p>
              )}
            </div>

            <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
              <h3 className="text-lg font-bold mb-2 text-blue-300">ℹ️ About the Paymaster</h3>
              <p className="text-sm text-gray-300 mb-2">
                The paymaster wallet pays gas fees for gasless transactions:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                <li>✅ Voting on DAO proposals (DAO.castVote)</li>
                <li>✅ Voting on RWA Governor proposals (RWAGovernor.castVote)</li>
                <li>✅ Finalizing funded projects (DAO.finalizeProposal)</li>
                <li>❌ Investments require user to pay gas (due to USDC approval)</li>
              </ul>
              <p className="text-sm text-yellow-300 mt-2">
                ⚠️ Note: Users must pay gas for investments because the contract transfers USDC from their wallet.
              </p>
              <p className="text-sm text-gray-300 mt-1">
                Keep this wallet funded to ensure smooth voting experience!
              </p>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
              <h3 className="font-bold mb-2 text-white">Gasless Invest</h3>
              <p className="text-sm text-gray-300">
                Users can invest in RWA funding proposals without paying gas fees
              </p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
              <h3 className="font-bold mb-2 text-white">Gasless Voting</h3>
                <p className="text-sm text-gray-300">
                Both DAO and RWA Governor votes are paid for by the paymaster
              </p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
              <h3 className="font-bold mb-2 text-white">Gasless Finalization</h3>
                <p className="text-sm text-gray-300">
                Project finalization is also covered by the paymaster wallet
              </p>
            </div>
          </div>

          {/* Sponsored Functions */}
          <div className="border border-gray-700 rounded-lg p-6 bg-gray-800">
            <h3 className="text-lg font-bold mb-4 text-white">Paymaster-Sponsored Functions</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="font-mono text-gray-300">DAO.castVote(uint256,uint8)</span>
                <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">GASLESS</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="font-mono text-gray-300">RWAGovernor.castVote(uint256,uint8)</span>
                <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">GASLESS</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="font-mono text-gray-300">DAO.finalizeProposal(uint256)</span>
                <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">GASLESS</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-600/50 rounded border border-gray-500">
                <span className="font-mono text-gray-400">DAO.invest(uint256,uint256)</span>
                <span className="px-2 py-1 bg-yellow-900 text-yellow-200 rounded text-xs">USER PAYS GAS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
