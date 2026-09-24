'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { useToast } from '@/components/ui/ToastQueue';
import { useWallet, useWalletActions } from '@/app/hooks/useWalletState';
import { scanAccountAllowances, revokeAllowance } from '@/lib/allowanceAuditOps';
import type { AllowanceRiskLevel, TokenAllowance } from '@/types/allowance';

function useTokenAllowances(publicKey: string | null | undefined) {
  const [allowances, setAllowances] = useState<TokenAllowance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = React.useCallback(() => {
    if (!publicKey) {
      setTimeout(() => {
        setAllowances([]);
        setIsLoading(false);
      }, 0);
      return;
    }
    setTimeout(() => {
      setIsLoading(true);
      setError(null);
      scanAccountAllowances(publicKey)
        .then(setAllowances)
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not scan account permissions.',
          );
        })
        .finally(() => setIsLoading(false));
    }, 0);
  }, [publicKey]);

  React.useEffect(() => {
    scan();
  }, [scan]);

  const removeMany = React.useCallback((ids: string[]) => {
    setAllowances((prev) => prev.filter((a) => !ids.includes(a.id)));
  }, []);

  return { allowances, isLoading, error, rescan: scan, removeMany };
}

const RISK_STYLES: Record<
  AllowanceRiskLevel,
  { badge: string; row: string; label: string }
> = {
  high: {
    badge:
      'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border border-red-200 dark:border-red-500/30',
    row: 'bg-red-50/60 dark:bg-red-950/10',
    label: 'High Risk',
  },
  medium: {
    badge:
      'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30',
    row: '',
    label: 'Medium Risk',
  },
  low: {
    badge:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    row: '',
    label: 'Low Risk',
  },
};

export function AllowanceManager() {
  const { wallet } = useWallet();
  const { refreshWalletState } = useWalletActions();
  const publicKey = wallet?.publicKey;

  const { allowances, isLoading, error, rescan, removeMany } = useTokenAllowances(publicKey);
  const { addToast, updateToast } = useToast();
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [isBatchArmed, setIsBatchArmed] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const handleConnectWallet = async () => {
    const state = await refreshWalletState();
    if (!state?.connected) {
      alert("No active Stellar wallet detected. Please connect your extension.");
    }
  };

  const highRiskAllowances = useMemo(
    () => allowances.filter((a) => a.riskLevel === 'high'),
    [allowances],
  );

  if (!publicKey) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 text-center py-16">
        <div className="max-w-md mx-auto space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Icon id={ICON_IDS.shieldAlert} size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audit & Revoke Allowances</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Please connect your Soroban wallet to scan account spending allowances, review active permissions, and revoke approvals.
            </p>
          </div>
          <button
            onClick={handleConnectWallet}
            className="inline-flex items-center justify-center px-6 py-3 font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md transition-all focus:outline-none"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const handleRevoke = async (id: string) => {
    setRevokingIds((prev) => new Set(prev).add(id));
    const target = allowances.find((a) => a.id === id);
    const toastId = addToast({
      title: 'Revoking approval',
      description: target
        ? `Setting the allowance for ${target.contractName} to zero…`
        : 'Submitting revocation transaction…',
      status: 'processing',
    });

    try {
      await revokeAllowance(id);
      removeMany([id]);
      updateToast(toastId, {
        status: 'confirmed',
        title: 'Approval revoked',
        description: target
          ? `${target.contractName} can no longer move your ${target.assetCode}.`
          : 'The allowance was reset to zero.',
      });
    } catch (err) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Revocation failed',
        description:
          err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setRevokingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRevokeAllHighRisk = async () => {
    if (highRiskAllowances.length === 0) return;

    if (!isBatchArmed) {
      setIsBatchArmed(true);
      return;
    }

    setIsBatchArmed(false);
    setIsBatchRunning(true);
    const ids = highRiskAllowances.map((a) => a.id);
    const toastId = addToast({
      title: 'Revoking high-risk approvals',
      description: `Submitting ${ids.length} revocation transaction${ids.length === 1 ? '' : 's'}…`,
      status: 'processing',
    });

    try {
      // Sequential, not Promise.all: each revoke is a separate signed
      // transaction against the connected wallet, so they queue one at a
      // time the same way a user manually approving each prompt would.
      for (const id of ids) {
        setRevokingIds((prev) => new Set(prev).add(id));
        await revokeAllowance(id);
      }
      removeMany(ids);
      updateToast(toastId, {
        status: 'confirmed',
        title: 'High-risk approvals revoked',
        description: `${ids.length} unlimited approval${ids.length === 1 ? '' : 's'} cleared.`,
      });
    } catch (err) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Batch revocation failed',
        description:
          err instanceof Error
            ? err.message
            : 'Some approvals may still be active. Please retry.',
      });
    } finally {
      setRevokingIds(new Set());
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Token Approvals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every smart contract instance approved to spend your tokens, scanned
            across all connected contract addresses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={rescan}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <Icon id={ICON_IDS.refreshCcw} size={14} />
            Rescan
          </button>
          <button
            onClick={handleRevokeAllHighRisk}
            disabled={highRiskAllowances.length === 0 || isBatchRunning}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isBatchArmed ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Icon id={ICON_IDS.shieldAlert} size={14} />
            {isBatchRunning
              ? 'Revoking…'
              : isBatchArmed
                ? 'Confirm Revoke All'
                : `Revoke All High-Risk (${highRiskAllowances.length})`}
          </button>
        </div>
      </div>

      {isBatchArmed && !isBatchRunning && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300"
        >
          This submits {highRiskAllowances.length} separate revocation
          transaction{highRiskAllowances.length === 1 ? '' : 's'}, one per
          contract. Click again to confirm.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300"
        >
          {error}
        </div>
      )}

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
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Risk</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {allowances.map((allowance) => {
                const risk = RISK_STYLES[allowance.riskLevel];
                const isRevoking = revokingIds.has(allowance.id);
                return (
                  <tr
                    key={allowance.id}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${risk.row}`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{allowance.contractName}</span>
                        <span className="text-xs text-gray-500 font-mono mt-0.5">
                          {allowance.contractId.slice(0, 10)}…{allowance.contractId.slice(-6)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {allowance.assetCode}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-sm font-medium ${
                          allowance.isUnlimited
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {allowance.allowanceAmount}
                      </span>
                      {allowance.expirationLedger === null && (
                        <span className="block text-[11px] text-gray-500">No expiration</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${risk.badge}`}
                      >
                        {allowance.riskLevel === 'high' && (
                          <Icon id={ICON_IDS.alertTriangle} size={11} />
                        )}
                        {risk.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleRevoke(allowance.id)}
                        disabled={isRevoking || isBatchRunning}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 border border-transparent rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRevoking ? 'Revoking...' : 'Revoke Access'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-100 dark:border-yellow-800/30">
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <Icon id={ICON_IDS.alertTriangle} size={18} className="text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Security Notice</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Revoking access sets the allowance back to zero. The contract will no longer be able to move your tokens until you explicitly approve it again. Unlimited approvals with no expiration are flagged high-risk because a compromised or malicious contract could drain the full balance in one call.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
