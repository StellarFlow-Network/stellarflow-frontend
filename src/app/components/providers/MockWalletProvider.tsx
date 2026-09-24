'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  WalletStateContext,
  WalletStatusContext,
  WalletActionsContext,
  type WalletState,
} from './WalletProvider';

export interface MockWalletConfig {
  initialConnected?: boolean;
  publicKey?: string;
  transactionDelayMs?: number;
  simulateFailure?: boolean;
  mockBalances?: Record<string, string>;
}

interface MockWalletProviderProps {
  children: React.ReactNode;
  config?: MockWalletConfig;
}

const DEFAULT_CONFIG: MockWalletConfig = {
  initialConnected: true,
  publicKey: 'GBMOCKXLMPROVIDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  transactionDelayMs: 1500,
  simulateFailure: false,
  mockBalances: {
    XLM: '10000.00',
    USDC: '500.00',
  },
};

/**
 * MockWalletProvider
 * 
 * Provides a mock wallet environment simulating transactions locally without requiring 
 * live Stellar testnet connections during design iterations.
 * Can be used in Storybook or local development.
 */
export function MockWalletProvider({ children, config = {} }: MockWalletProviderProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [connected, setConnected] = useState(!!mergedConfig.initialConnected);
  const [isChecking, setIsChecking] = useState(false);
  
  const walletState: WalletState | null = useMemo(() => {
    if (!connected) return { publicKey: null, connected: false, source: 'none', lastCheckedAt: Date.now() };
    return {
      publicKey: mergedConfig.publicKey || null,
      connected: true,
      source: 'extension',
      lastCheckedAt: Date.now(),
    };
  }, [connected, mergedConfig.publicKey]);

  const refreshWalletState = React.useCallback(async () => {
    setIsChecking(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsChecking(false);
    return walletState;
  }, [walletState]);

  // Export mock transaction functions globally for UI components that use transactionOps
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__MOCK_TX_CONFIG__ = {
        delayMs: mergedConfig.transactionDelayMs,
        simulateFailure: mergedConfig.simulateFailure,
        mockBalances: mergedConfig.mockBalances,
      };
    }
  }, [mergedConfig]);

  const stateValue = useMemo(() => ({ wallet: walletState }), [walletState]);
  const statusValue = useMemo(() => ({ isChecking, error: null }), [isChecking]);
  const actionsValue = useMemo(() => ({ refreshWalletState }), [refreshWalletState]);

  return (
    <WalletStateContext.Provider value={stateValue}>
      <WalletStatusContext.Provider value={statusValue}>
        <WalletActionsContext.Provider value={actionsValue}>
          {children}
        </WalletActionsContext.Provider>
      </WalletStatusContext.Provider>
    </WalletStateContext.Provider>
  );
}
