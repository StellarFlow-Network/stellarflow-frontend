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
  isConnected: boolean;
}

interface WalletStatusContextType {
  isChecking: boolean;
  error: string | null;
}

interface WalletActionsContextType {
  refreshWalletState: () => Promise<WalletState | null>;
}
interface FreighterExtension {
  getPublicKey?: () => Promise<string>;
  publicKey?: string;
  isConnected?: () => Promise<boolean>;
}

interface WalletWindow extends Window {
  stellar?: FreighterExtension;
  Freighter?: FreighterExtension;
  freighterApi?: FreighterExtension;
  Horizon?: FreighterExtension;
}
export const WalletStateContext = createContext<WalletStateContextType | null>(null);
export const WalletStatusContext = createContext<WalletStatusContextType | null>(null);
export const WalletActionsContext = createContext<WalletActionsContextType | null>(null);

const CACHE_TTL = 2500;
const WALLET_STORAGE_KEY = 'stellarflow.wallet.publicKey';
let cache: { expiresAt: number; value: WalletState | null } | null = null;
let pendingRequest: Promise<WalletState | null> | null = null;

function readPersistedPublicKey(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return (
      window.localStorage.getItem(WALLET_STORAGE_KEY) ||
      window.sessionStorage.getItem(WALLET_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function persistPublicKey(publicKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(WALLET_STORAGE_KEY, publicKey);
    window.sessionStorage.removeItem(WALLET_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing or sandboxed frames.
  }
}

function clearPersistedPublicKey(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    window.sessionStorage.removeItem(WALLET_STORAGE_KEY);
  } catch {
    // Ignore storage failures while handling an expired wallet session.
  }
}

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

const walletWindow = window as WalletWindow;
  const extension =
    walletWindow.stellar || walletWindow.Freighter || walletWindow.freighterApi || walletWindow.Horizon || null;

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
    if (state.connected && state.publicKey) {
      persistPublicKey(state.publicKey);
    } else {
      clearPersistedPublicKey();
    }
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

  useEffect(() => {
    if (!mounted) return;

    const persistedPublicKey = readPersistedPublicKey();
    if (persistedPublicKey) {
      setWallet({
        publicKey: persistedPublicKey,
        connected: true,
        source: 'extension',
        lastCheckedAt: Date.now(),
      });
    }
  }, [mounted]);

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
    void refreshWalletState();
  }, [mounted, refreshWalletState]);

  const stateValue = useMemo<WalletStateContextType>(
    () => ({ wallet, isConnected: Boolean(wallet?.connected) }),
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
    const placeholderState: WalletStateContextType = { wallet: null, isConnected: false };
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

/**
 * Same slices as {@link useWallet} / {@link useWalletActions} but returning
 * `null` instead of throwing when no provider is mounted above the consumer.
 *
 * Lets globally-mounted UI (the command palette) offer wallet actions where a
 * provider exists and degrade quietly where it does not, without forcing every
 * page to wrap itself in a WalletProvider.
 */
export function useOptionalWallet(): WalletStateContextType | null {
  return useContext(WalletStateContext);
}

export function useOptionalWalletActions(): WalletActionsContextType | null {
  return useContext(WalletActionsContext);
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
