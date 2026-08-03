'use client';

import React, { useState, useEffect } from 'react';

// Types
export interface TokenAllowance {
  id: string;
  contractId: string;
  contractName: string;
  assetCode: string;
  assetIssuer?: string;
  allowanceAmount: string;
  lastUpdated: string;
}

// Mock Hook for Demonstration (since actual Soroban indexer hook isn't present)
function useTokenAllowances() {
  const [allowances, setAllowances] = useState<TokenAllowance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching active allowances
    const fetchAllowances = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setAllowances([
        {
          id: '1',
          contractId: 'CBLZ5K7Q...',
          contractName: 'StellarFlow AMM Pool',
          assetCode: 'USDC',
          allowanceAmount: '5000.00',
          lastUpdated: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '2',
          contractId: 'CABC123X...',
          contractName: 'Lending Protocol V2',
          assetCode: 'XLM',
          allowanceAmount: '10000.00',
          lastUpdated: new Date(Date.now() - 172800000).toISOString(),
        }
      ]);
      setIsLoading(false);
    };

    fetchAllowances();
  }, []);

  const revokeAllowance = async (id: string) => {
    // In a real app, this would use @stellar/freighter-api to sign a transaction
    // calling the `approve` function with amount 0 on the token contract.
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulating transaction
    setAllowances((prev) => prev.filter((a) => a.id !== id));
  };

  return { allowances, isLoading, revokeAllowance };
}

export function AllowanceManager() {
  const { allowances, isLoading, revokeAllowance } = useTokenAllowances();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeAllowance(id);
    } catch (error) {
      console.error('Failed to revoke allowance', error);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Token Allowances</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Review and revoke active smart contract spending limits on your account.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : allowances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">You have no active token allowances.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Contract</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Asset</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Allowance</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {allowances.map((allowance) => (
                <tr key={allowance.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">{allowance.contractName}</span>
                      <span className="text-xs text-gray-500 font-mono mt-0.5">{allowance.contractId}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {allowance.assetCode}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {allowance.allowanceAmount}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(allowance.id)}
                      disabled={revokingId === allowance.id}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 border border-transparent rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {revokingId === allowance.id ? 'Revoking...' : 'Revoke Access'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-100 dark:border-yellow-800/30">
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Security Notice</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Revoking access sets the allowance back to zero. The contract will no longer be able to move your tokens until you explicitly approve it again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
