'use client';

import { useState } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { publicClient } from '@/lib/clients';
import { CONTRACTS, DAO_ABI } from '@/contracts';

interface CreateProposalFormProps {
  onSuccess?: () => void;
}

export default function CreateProposalForm({ onSuccess }: CreateProposalFormProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    targetUSDC: '',
    name: '',
    description: '',
    imageUrl: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    if (!formData.targetUSDC || parseFloat(formData.targetUSDC) <= 0) {
      alert('Please enter a valid target amount');
      return;
    }

    if (!formData.name || !formData.description) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);

      // Create metadata JSON
      const metadata = {
        name: formData.name,
        description: formData.description,
        image: formData.imageUrl || 'https://via.placeholder.com/400',
      };

      // In production, you'd upload this to IPFS
      // For demo, we'll use a data URI (not recommended for production)
      const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

      const targetUSDC = parseUnits(formData.targetUSDC, 6); // USDC has 6 decimals

      alert('Creating proposal...');
      const hash = await walletClient.writeContract({
        address: CONTRACTS.DAO,
        abi: DAO_ABI,
        functionName: 'createRWAFundingProposal',
        args: [targetUSDC, metadataURI],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      
      alert(`Proposal created successfully! Transaction: ${hash}`);
      
      // Reset form
      setFormData({
        targetUSDC: '',
        name: '',
        description: '',
        imageUrl: '',
      });
      setIsOpen(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating proposal:', error);
      alert('Failed to create proposal: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-lg"
        >
          + Create New RWA Proposal
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 border border-gray-700 rounded-lg p-6 bg-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Create RWA Funding Proposal</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            Target Funding Amount (USDC) *
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="10000"
            value={formData.targetUSDC}
            onChange={(e) => setFormData({ ...formData, targetUSDC: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            The total USDC amount needed to fund this RWA project
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            Project Name *
          </label>
          <input
            type="text"
            placeholder="Solar Farm Investment"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            Description *
          </label>
          <textarea
            placeholder="Describe the RWA project, expected returns, timeline, etc."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 h-32 text-white placeholder-gray-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            Image URL (optional)
          </label>
          <input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            A placeholder image will be used if left empty
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !address}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating...' : 'Create Proposal'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-6 py-3 border border-gray-600 rounded-lg hover:bg-gray-700 text-white"
          >
            Cancel
          </button>
        </div>

        {!address && (
          <p className="text-sm text-yellow-400">
            Please connect your wallet to create a proposal
          </p>
        )}
      </form>
    </div>
  );
}
