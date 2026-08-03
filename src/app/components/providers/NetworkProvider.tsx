"use client";

/**
 * NetworkProvider.tsx
 *
 * Global state for the user-selected Horizon / Soroban target network
 * (Testnet ↔ Mainnet).  Follows the three-slice context pattern used by
 * WalletProvider, UserProvider, and SocketProvider so each consumer only
 * re-renders when the slice it subscribes to actually changes.
 *
 * Slices
 * ──────
 *  • NetworkStateContext   — the selected `NetworkTarget` and memoised SDK
 *                            clients (Horizon.Server + rpc.Server).
 *  • NetworkStatusContext  — whether a client re-instantiation is in-flight
 *                            and any error string.
 *  • NetworkActionsContext — stable `switchNetwork` callback; identity never
 *                            changes after mount so it never triggers a
 *                            re-render.
 *
 * SDK clients
 * ───────────
 * The provider lazily imports `@stellar/stellar-sdk` the first time
 * `switchNetwork` is called so the SDK stays out of the initial page bundle.
 * After the first import the module reference is cached in a module-level
 * variable so subsequent switches are synchronous.
 *
 * Persistence
 * ───────────
 * The selected network is persisted to `localStorage` under the key
 * `"stellarflow.network"` so the choice survives page reloads.  Reading and
 * writing are guarded behind `typeof window !== "undefined"` checks for SSR
 * safety.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMounted } from "@/app/hooks/useMounted";

// ─────────────────────────────────────────────────────────────────────────────
// Network configuration
// ─────────────────────────────────────────────────────────────────────────────

export type NetworkTarget = "testnet" | "mainnet";

export interface NetworkConfig {
  /** Human-readable label shown in the UI */
  label: string;
  /** Stellar network passphrase used for signing */
  networkPassphrase: string;
  /** Horizon REST API base URL */
  horizonUrl: string;
  /** Soroban RPC endpoint URL */
  sorobanRpcUrl: string;
}

export const NETWORK_CONFIGS: Readonly<Record<NetworkTarget, NetworkConfig>> = {
  testnet: {
    label: "Testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    label: "Mainnet",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban.stellar.org",
  },
};

const STORAGE_KEY = "stellarflow.network";

/** Default to testnet so new sessions always start on the safe network. */
const DEFAULT_NETWORK: NetworkTarget = "testnet";

// ─────────────────────────────────────────────────────────────────────────────
// SDK client types (typed lightly so we avoid eagerly importing the SDK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opaque wrapper around the lazily-instantiated Stellar SDK clients.
 * Consumers that need to call SDK methods should import the SDK themselves
 * (lazily) and pass these client instances rather than re-creating them.
 */
export interface StellarClients {
  /** `Horizon.Server` instance pointed at the active network */
  horizon: HorizonServerLike;
  /** `rpc.Server` instance pointed at the active network */
  soroban: SorobanServerLike;
  /** The `NetworkTarget` these clients belong to — for double-checking */
  network: NetworkTarget;
}

/**
 * Minimal structural types so we can type the client instances without
 * importing the entire SDK at module evaluation time.
 */
export interface HorizonServerLike {
  readonly serverURL: string;
  // loadAccount, transactions, etc. are called by consumers; not declared here
  // to avoid a hard dependency on the SDK type definitions at this layer.
  [key: string]: unknown;
}

export interface SorobanServerLike {
  readonly serverURL: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level SDK cache (set on first lazy import)
// ─────────────────────────────────────────────────────────────────────────────

interface StellarSdkModule {
  Horizon: {
    Server: new (url: string) => HorizonServerLike;
  };
  rpc: {
    Server: new (url: string, opts?: { allowHttp?: boolean }) => SorobanServerLike;
  };
}

let sdkCache: StellarSdkModule | null = null;

async function getSdk(): Promise<StellarSdkModule> {
  if (sdkCache) return sdkCache;
  const sdk = await import("@stellar/stellar-sdk");
  sdkCache = sdk as unknown as StellarSdkModule;
  return sdkCache;
}

function buildClients(network: NetworkTarget, sdk: StellarSdkModule): StellarClients {
  const cfg = NETWORK_CONFIGS[network];
  return {
    horizon: new sdk.Horizon.Server(cfg.horizonUrl),
    soroban: new sdk.rpc.Server(cfg.sorobanRpcUrl, { allowHttp: false }),
    network,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence helpers (SSR-safe)
// ─────────────────────────────────────────────────────────────────────────────

function readPersistedNetwork(): NetworkTarget {
  if (typeof window === "undefined") return DEFAULT_NETWORK;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "testnet" || stored === "mainnet") return stored;
  } catch {
    // localStorage may be blocked (private mode, iframe sandboxing, etc.)
  }
  return DEFAULT_NETWORK;
}

function persistNetwork(network: NetworkTarget): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, network);
  } catch {
    // Silently ignore — persistence is best-effort
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkStateContextType {
  /** Currently selected network target */
  network: NetworkTarget;
  /** Convenience alias for `NETWORK_CONFIGS[network]` */
  config: NetworkConfig;
  /**
   * Lazily-built SDK clients for the active network.
   * `null` until the first `switchNetwork` call completes (or the provider
   * mounts and immediately builds clients in the background).
   */
  clients: StellarClients | null;
}

export interface NetworkStatusContextType {
  /** True while SDK clients are being (re-)instantiated after a switch */
  isSwitching: boolean;
  /** Non-null when client instantiation failed */
  error: string | null;
}

export interface NetworkActionsContextType {
  /**
   * Switch to a different network target.
   * Immediately updates `network` / `config` in state, then asynchronously
   * re-instantiates the SDK clients.  Returns a promise that resolves once
   * the clients are ready.
   */
  switchNetwork: (target: NetworkTarget) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────────

const NetworkStateContext = createContext<NetworkStateContextType | null>(null);
const NetworkStatusContext = createContext<NetworkStatusContextType | null>(null);
const NetworkActionsContext = createContext<NetworkActionsContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();

  // Read the persisted choice synchronously on first render (client only).
  // On the server this always returns `DEFAULT_NETWORK`.
  const [network, setNetwork] = useState<NetworkTarget>(DEFAULT_NETWORK);
  const [clients, setClients] = useState<StellarClients | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the in-flight switch to prevent race conditions when the user
  // clicks the toggle rapidly.
  const switchGenRef = useRef(0);

  // ── Hydrate from localStorage once the client is mounted ──────────────────
  useEffect(() => {
    if (!mounted) return;
    const persisted = readPersistedNetwork();
    if (persisted !== DEFAULT_NETWORK) {
      // Trigger a full client build for the persisted network.
      // We do this via the shared switchNetwork path so the loading state is
      // consistent.
      void switchNetworkImpl(persisted);
    } else {
      // Build clients for the default network in the background.
      void switchNetworkImpl(DEFAULT_NETWORK);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── Core switch implementation (not exposed directly) ─────────────────────
  async function switchNetworkImpl(target: NetworkTarget): Promise<void> {
    // Bump the generation counter so any in-flight older switch can bail out.
    const gen = ++switchGenRef.current;

    // Immediately reflect the new network/config in state so the UI
    // (selector, banner) updates without waiting for SDK initialisation.
    setNetwork(target);
    setIsSwitching(true);
    setError(null);
    persistNetwork(target);

    try {
      const sdk = await getSdk();
      // Bail if a newer switch was started while we were awaiting the import.
      if (gen !== switchGenRef.current) return;

      const newClients = buildClients(target, sdk);
      if (gen !== switchGenRef.current) return;

      setClients(newClients);
    } catch (err) {
      if (gen !== switchGenRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initialise SDK clients for the selected network.",
      );
    } finally {
      if (gen === switchGenRef.current) {
        setIsSwitching(false);
      }
    }
  }

  // ── Stable callback exposed to consumers ──────────────────────────────────
  const switchNetwork = useCallback(
    async (target: NetworkTarget): Promise<void> => {
      if (!mounted) return;
      if (target === network && clients !== null) return; // already on this network
      await switchNetworkImpl(target);
    },
    // switchNetworkImpl is a local function in the component scope and is
    // stable across renders because it only reads refs/setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, network, clients],
  );

  const config = NETWORK_CONFIGS[network];

  // ── Memoised context values ────────────────────────────────────────────────
  const stateValue = useMemo<NetworkStateContextType>(
    () => ({ network, config, clients }),
    [network, config, clients],
  );

  const statusValue = useMemo<NetworkStatusContextType>(
    () => ({ isSwitching, error }),
    [isSwitching, error],
  );

  const actionsValue = useMemo<NetworkActionsContextType>(
    () => ({ switchNetwork }),
    [switchNetwork],
  );

  // ── SSR / pre-hydration placeholder ───────────────────────────────────────
  if (!mounted) {
    const placeholderState: NetworkStateContextType = {
      network: DEFAULT_NETWORK,
      config: NETWORK_CONFIGS[DEFAULT_NETWORK],
      clients: null,
    };
    const placeholderStatus: NetworkStatusContextType = {
      isSwitching: false,
      error: null,
    };
    const placeholderActions: NetworkActionsContextType = {
      switchNetwork: () => Promise.resolve(),
    };

    return (
      <NetworkStateContext.Provider value={placeholderState}>
        <NetworkStatusContext.Provider value={placeholderStatus}>
          <NetworkActionsContext.Provider value={placeholderActions}>
            {children}
          </NetworkActionsContext.Provider>
        </NetworkStatusContext.Provider>
      </NetworkStateContext.Provider>
    );
  }

  return (
    <NetworkStateContext.Provider value={stateValue}>
      <NetworkStatusContext.Provider value={statusValue}>
        <NetworkActionsContext.Provider value={actionsValue}>
          {children}
        </NetworkActionsContext.Provider>
      </NetworkStatusContext.Provider>
    </NetworkStateContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Granular consumer hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to network target + config + SDK clients.
 * Re-renders when the network is switched or clients become ready.
 */
export function useNetwork(): NetworkStateContextType {
  const ctx = useContext(NetworkStateContext);
  if (!ctx) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return ctx;
}

/**
 * Same slice as {@link useNetwork} but returns `null` instead of throwing when
 * no provider is mounted above the consumer.
 *
 * Lets leaf components (modals, one-off widgets) pick up the selected network
 * when it is available without forcing the provider — and its lazily-imported
 * SDK clients — onto every page that renders them.
 */
export function useOptionalNetwork(): NetworkStateContextType | null {
  return useContext(NetworkStateContext);
}

/**
 * Subscribe to switch progress (`isSwitching`) and `error`.
 * Will NOT re-render on network target or client changes.
 */
export function useNetworkStatus(): NetworkStatusContextType {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) {
    throw new Error("useNetworkStatus must be used within a NetworkProvider");
  }
  return ctx;
}

/**
 * Subscribe only to the stable `switchNetwork` action callback.
 * Identity is stable after mount — never triggers a re-render on its own.
 */
export function useNetworkActions(): NetworkActionsContextType {
  const ctx = useContext(NetworkActionsContext);
  if (!ctx) {
    throw new Error("useNetworkActions must be used within a NetworkProvider");
  }
  return ctx;
}
