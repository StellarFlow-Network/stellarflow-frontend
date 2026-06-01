'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMounted } from '@/app/hooks/useMounted';

export interface WalletState {
  publicKey: string | null;
  connected: boolean;
  source: 'extension' | 'fallback' | 'none';
  lastCheckedAt: number;
}

interface WalletContextType {
  wallet: WalletState | null;
  isChecking: boolean;
  error: string | null;
  refreshWalletState: () => Promise<WalletState | null>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const CACHE_TTL = 2500;
let cache: { expiresAt: number; value: WalletState | null } | null = null;
let pendingRequest: Promise<WalletState | null> | null = null;

const createFallbackState = (source: WalletState['source']): WalletState => ({
  publicKey: null,
  connected: false,
  source,
  lastCheckedAt: Date.now(),
});

async function queryExtensionWalletState(): Promise<WalletState> {
  if (typeof window === 'undefined') {
    return createFallbackState('none');
  }

  const anyWindow = window as any;
  const extension =
    anyWindow.stellar || anyWindow.Freighter || anyWindow.freighterApi || anyWindow.Horizon || null;

  try {
    if (typeof extension?.getPublicKey === 'function') {
      const publicKey = await extension.getPublicKey();
      return {
        publicKey: typeof publicKey === 'string' ? publicKey : null,
        connected: Boolean(publicKey),
        source: 'extension',
        lastCheckedAt: Date.now(),
      };
    }

    if (typeof extension?.publicKey === 'string') {
      return {
        publicKey: extension.publicKey,
        connected: true,
        source: 'extension',
        lastCheckedAt: Date.now(),
      };
    }

    if (typeof extension?.isConnected === 'function') {
      const connected = await extension.isConnected();
      return {
        publicKey: null,
        connected: Boolean(connected),
        source: 'extension',
        lastCheckedAt: Date.now(),
      };
    }
  } catch {
    // Extension query failure should not break the app. Fall back to cached state.
  }

  return createFallbackState('none');
}

async function getWalletState(): Promise<WalletState | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = queryExtensionWalletState().then((state) => {
    cache = {
      expiresAt: Date.now() + CACHE_TTL,
      value: state,
    };
    pendingRequest = null;
    return state;
  });

  return pendingRequest;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWalletState = React.useCallback(async () => {
    if (!mounted) return null;
    
    setIsChecking(true);
    setError(null);

    try {
      const state = await getWalletState();
      setWallet(state);
      return state;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh wallet state');
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    refreshWalletState();
  }, [mounted, refreshWalletState]);

  const value = useMemo(
    () => ({ wallet, isChecking, error, refreshWalletState }),
    [wallet, isChecking, error, refreshWalletState],
  );

  // Serve static placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return <WalletContext.Provider value={{ wallet: null, isChecking: false, error: null, refreshWalletState }}>{children}</WalletContext.Provider>;
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletState() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletState must be used within a WalletProvider');
  }
  return context;
}
