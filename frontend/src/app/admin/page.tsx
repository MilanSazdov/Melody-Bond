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
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gray-700 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/30 border border-purple-800/50 text-purple-400 text-sm font-medium mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Admin Panel
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">Paymaster Management</h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Monitor and fund the Paymaster wallet that powers gasless transactions for the MelodyBond DAO
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Balance Overview - Large Display */}
          <div className="bg-gradient-to-br from-purple-900/20 via-gray-800 to-blue-900/20 border border-purple-500/30 rounded-xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                    <span className="text-2xl">💎</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Current Balance</p>
                    <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      {loading ? '...' : formatEther(paymasterBalance)} ETH
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    Number(formatEther(paymasterBalance)) > 0.5 
                      ? 'bg-green-900/50 text-green-300 border border-green-700' 
                      : Number(formatEther(paymasterBalance)) > 0.1
                      ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                      : 'bg-red-900/50 text-red-300 border border-red-700'
                  }`}>
                    {Number(formatEther(paymasterBalance)) > 0.5 
                      ? '✓ Healthy' 
                      : Number(formatEther(paymasterBalance)) > 0.1
                      ? '⚠ Low Balance'
                      : '⚠️ Critical - Refill Needed'}
                  </div>
                </div>
              </div>
              <button
                onClick={loadPaymasterBalance}
                disabled={loading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh Balance</span>
                  </>
                )}
              </button>
            </div>

            {/* Paymaster Address */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2 font-medium">Paymaster Wallet Address</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <code className="flex-1 bg-gray-950/50 px-4 py-3 rounded-lg text-sm text-purple-300 font-mono break-all border border-gray-700">
                  {PAYMASTER_ADDRESS}
                </code>
                <button
                  onClick={copyAddress}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold flex items-center gap-2 justify-center"
                  title="Copy address"
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fund Paymaster Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Fund Paymaster</h3>
                <p className="text-sm text-gray-400">Add ETH to enable gasless transactions</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6 mb-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950/50 border border-gray-600 rounded-lg text-white text-lg font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder="0.1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 0.5 ETH or more</p>
                </div>
                <button
                  onClick={handleFundPaymaster}
                  disabled={!address || isPending || isConfirming}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
                >
                  {isPending || isConfirming ? '⏳ Sending...' : '🚀 Send ETH'}
                </button>
              </div>
            </div>

            {hash && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <p className="text-xs text-gray-400 font-semibold mb-1">Transaction Hash:</p>
                <code className="text-xs text-green-400 break-all font-mono">{hash}</code>
                {isSuccess && (
                  <p className="text-sm text-green-400 mt-2 font-semibold">✓ Transaction confirmed successfully!</p>
                )}
              </div>
            )}

            {!address && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-yellow-300 font-semibold">Wallet Not Connected</p>
                  <p className="text-sm text-gray-300 mt-1">Please connect your wallet to fund the paymaster</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-900/20 to-gray-800 border border-green-700/50 rounded-xl p-6">
              <div className="text-3xl mb-3">✅</div>
              <h3 className="font-bold text-lg text-white mb-2">Gasless Voting</h3>
              <p className="text-sm text-gray-300">
                DAO members vote on proposals without paying any gas fees
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/20 to-gray-800 border border-blue-700/50 rounded-xl p-6">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-lg text-white mb-2">Auto Finalization</h3>
              <p className="text-sm text-gray-300">
                Approved projects are finalized automatically with paymaster support
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-900/20 to-gray-800 border border-purple-700/50 rounded-xl p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-bold text-lg text-white mb-2">Instant Execution</h3>
              <p className="text-sm text-gray-300">
                Transactions execute immediately without waiting for user approvals
              </p>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="text-4xl">ℹ️</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-300 mb-4">How the Paymaster Works</h3>
                <p className="text-gray-300 mb-4">
                  The paymaster wallet sponsors gas fees for specific smart contract operations, enabling a seamless user experience:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                      <span>✓</span>
                      <span>Gasless Operations</span>
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>DAO.castVote(uint256,uint8)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>RWAGovernor.castVote(uint256,uint8)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>DAO.finalizeProposal(uint256)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <span>⚠</span>
                      <span>User Pays Gas</span>
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>DAO.invest(uint256,uint256)</span>
                      </li>
                      <li className="text-xs text-gray-400 ml-4 mt-1">
                        Requires USDC transfer from user's wallet
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="text-sm text-yellow-300 mt-4 bg-yellow-900/20 border border-yellow-700/50 rounded p-3">
                  💡 <strong>Note:</strong> Keep the paymaster funded with at least 0.5 ETH to ensure smooth operations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
