'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Plus, Wallet, Copy, ExternalLink } from 'lucide-react';

export interface WalletAccount {
  publicKey: string;
  label?: string;
  balance: string; // Primary asset balance (e.g., "1,234.56 XLM")
  balanceUSD?: string; // USD equivalent
  isActive: boolean;
}

export interface AccountSwitcherDropdownProps {
  /** List of available accounts from the connected wallet */
  accounts: WalletAccount[];
  /** Currently active account public key */
  activeAccountKey: string;
  /** Called when user switches to a different account */
  onAccountSwitch: (publicKey: string) => void | Promise<void>;
  /** Called when user clicks "Add New Account" */
  onAddAccount?: () => void | Promise<void>;
  /** Loading state during account switch */
  isLoading?: boolean;
  /** Optional CSS class for custom styling */
  className?: string;
}

/**
 * Truncates a Stellar public key for display
 * Example: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 * Becomes: GXXX...XXXXX
 */
function truncatePublicKey(key: string, prefixLength = 4, suffixLength = 4): string {
  if (key.length <= prefixLength + suffixLength) return key;
  return `${key.slice(0, prefixLength)}...${key.slice(-suffixLength)}`;
}

export function AccountSwitcherDropdown({
  accounts,
  activeAccountKey,
  onAccountSwitch,
  onAddAccount,
  isLoading = false,
  className = '',
}: AccountSwitcherDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeAccount = useMemo(
    () => accounts.find((acc) => acc.publicKey === activeAccountKey),
    [accounts, activeAccountKey]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAccountSelect = useCallback(
    async (publicKey: string) => {
      if (publicKey === activeAccountKey) {
        setIsOpen(false);
        return;
      }

      try {
        await onAccountSwitch(publicKey);
        setIsOpen(false);
      } catch (error) {
        console.error('Failed to switch account:', error);
        // Keep dropdown open on error so user can retry
      }
    },
    [activeAccountKey, onAccountSwitch]
  );

  const handleAddAccount = useCallback(async () => {
    if (!onAddAccount) return;

    try {
      await onAddAccount();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  }, [onAddAccount]);

  const handleCopyKey = useCallback(
    (publicKey: string, event: React.MouseEvent) => {
      event.stopPropagation();

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard
          .writeText(publicKey)
          .then(() => {
            setCopiedKey(publicKey);
            setTimeout(() => setCopiedKey(null), 2000);
          })
          .catch((err) => console.error('Failed to copy:', err));
      }
    },
    []
  );

  const handleViewOnExplorer = useCallback(
    (publicKey: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const explorerUrl = `https://stellar.expert/explorer/public/account/${publicKey}`;
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    },
    []
  );

  if (!activeAccount) {
    return (
      <div className={`text-sm text-red-500 ${className}`}>
        No active account
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[240px]"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {/* Wallet Icon */}
        <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Wallet size={18} className="text-blue-600 dark:text-blue-400" />
        </div>

        {/* Account Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {activeAccount.label || 'Account'}
            </p>
            {accounts.length > 1 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({accounts.findIndex((a) => a.publicKey === activeAccountKey) + 1}/{accounts.length})
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
            {truncatePublicKey(activeAccount.publicKey)}
          </p>
        </div>

        {/* Balance & Chevron */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeAccount.balance}
            </p>
            {activeAccount.balanceUSD && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ${activeAccount.balanceUSD}
              </p>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-full min-w-[320px] max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Switch Account
            </p>
          </div>

          {/* Account List */}
          <div className="max-h-96 overflow-y-auto">
            {accounts.map((account) => {
              const isActive = account.publicKey === activeAccountKey;
              const isCopied = copiedKey === account.publicKey;

              return (
                <button
                  key={account.publicKey}
                  type="button"
                  onClick={() => handleAccountSelect(account.publicKey)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border-b border-gray-100 dark:border-gray-700/50 text-left ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {/* Account Icon / Checkmark */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {isActive ? <Check size={20} /> : <Wallet size={20} />}
                  </div>

                  {/* Account Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {account.label || `Account ${accounts.indexOf(account) + 1}`}
                      </p>
                      {isActive && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {truncatePublicKey(account.publicKey, 6, 6)}
                      </p>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyKey(account.publicKey, e)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy full address"
                      >
                        {isCopied ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} className="text-gray-400" />
                        )}
                      </button>

                      {/* Explorer Link */}
                      <button
                        type="button"
                        onClick={(e) => handleViewOnExplorer(account.publicKey, e)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink size={12} className="text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {account.balance}
                    </p>
                    {account.balanceUSD && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ${account.balanceUSD}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Add Account Action */}
          {onAddAccount && (
            <button
              type="button"
              onClick={handleAddAccount}
              disabled={isLoading}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border-t border-gray-200 dark:border-gray-700 text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Plus size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Add New Account
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Generate a new key in your wallet
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountSwitcherDropdown;
