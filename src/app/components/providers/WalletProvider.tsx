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

// ---------------------------------------------------------------------------
// Three independent contexts — each slice re-renders only its own consumers.
// ---------------------------------------------------------------------------

interface WalletStateContextType {
  wallet: WalletState | null;
}

interface WalletStatusContextType {
  isChecking: boolean;
  error: string | null;
}

interface WalletActionsContextType {
  refreshWalletState: () => Promise<WalletState | null>;
}

const WalletStateContext = createContext<WalletStateContextType | null>(null);
const WalletStatusContext = createContext<WalletStatusContextType | null>(null);
const WalletActionsContext = createContext<WalletActionsContextType | null>(null);

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

  const stateValue = useMemo<WalletStateContextType>(
    () => ({ wallet }),
    [wallet],
  );

  const statusValue = useMemo<WalletStatusContextType>(
    () => ({ isChecking, error }),
    [isChecking, error],
  );

  const actionsValue = useMemo<WalletActionsContextType>(
    () => ({ refreshWalletState }),
    [refreshWalletState],
  );

  // Serve static placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    const placeholderState: WalletStateContextType = { wallet: null };
    const placeholderStatus: WalletStatusContextType = { isChecking: false, error: null };
    const placeholderActions: WalletActionsContextType = { refreshWalletState: () => Promise.resolve(null) };

    return (
      <WalletStateContext.Provider value={placeholderState}>
        <WalletStatusContext.Provider value={placeholderStatus}>
          <WalletActionsContext.Provider value={placeholderActions}>
            {children}
          </WalletActionsContext.Provider>
        </WalletStatusContext.Provider>
      </WalletStateContext.Provider>
    );
  }

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

// ---------------------------------------------------------------------------
// Granular consumer hooks
// ---------------------------------------------------------------------------

export function useWallet(): WalletStateContextType {
  const ctx = useContext(WalletStateContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}

export function useWalletStatus(): WalletStatusContextType {
  const ctx = useContext(WalletStatusContext);
  if (!ctx) {
    throw new Error('useWalletStatus must be used within a WalletProvider');
  }
  return ctx;
}

export function useWalletActions(): WalletActionsContextType {
  const ctx = useContext(WalletActionsContext);
  if (!ctx) {
    throw new Error('useWalletActions must be used within a WalletProvider');
  }
  return ctx;
}

/**
 * @deprecated Use the granular hooks instead:
 *   - `useWallet()`       for wallet state keys
 *   - `useWalletStatus()`  for isChecking / error
 *   - `useWalletActions()` for refreshWalletState callback
 */
export function useWalletState() {
  const state = useWallet();
  const status = useWalletStatus();
  const actions = useWalletActions();
  return {
    wallet: state.wallet,
    isChecking: status.isChecking,
    error: status.error,
    refreshWalletState: actions.refreshWalletState,
  };
}
