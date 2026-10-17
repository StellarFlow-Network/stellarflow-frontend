"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

export type NetworkTarget = "testnet" | "mainnet";

/** Per-network endpoint + passphrase bundle, keyed by `NetworkTarget`. */
export interface NetworkConfig {
  /** Human-readable network label. */
  label: string;
  network: NetworkTarget;
  /** Passphrase transactions are signed against. */
  networkPassphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
}

/**
 * Static per-network configuration table shared by hooks/components that need
 * endpoint details without subscribing to the provider (they fall back to
 * `NETWORK_CONFIGS[network]` when rendered outside `<NetworkProvider>`).
 */
export const NETWORK_CONFIGS: Record<NetworkTarget, NetworkConfig> = {
  testnet: {
    label: "Testnet",
    network: "testnet",
    networkPassphrase: "Test DF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    label: "Public",
    network: "mainnet",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban-mainnet.stellar.org",
  },
};

/** A configured Soroban RPC node available for selection. */
export interface RPCNode {
  id: string;
  label: string;
  url: string;
  network: NetworkTarget;
}

/** Static Soroban RPC node catalog, grouped by network. */
export const RPC_NODES: Record<NetworkTarget, RPCNode[]> = {
  testnet: [
    {
      id: "testnet-sdf",
      label: "SDF Testnet",
      url: "https://soroban-testnet.stellar.org",
      network: "testnet",
    },
  ],
  mainnet: [
    {
      id: "mainnet-sdf",
      label: "SDF Public",
      url: "https://soroban-mainnet.stellar.org",
      network: "mainnet",
    },
  ],
};

export type RPCStatus = "online" | "degraded" | "offline" | "unknown";

export interface RPCLatencyResult {
  nodeId: string;
  url: string;
  /** Round-trip time in milliseconds, or null when the ping failed. */
  latencyMs: number | null;
  status: RPCStatus;
  checkedAt: number;
}

interface NetworkContextType {
  network: NetworkTarget;
  horizonUrl: string;
  sorobanUrl: string;
  customHorizonUrl: string;
  /** Active network config (honours a custom Horizon endpoint when set). */
  config: NetworkConfig;
  /** Active Soroban RPC node identifier. */
  activeRpcNodeId: string;
  /** Available Soroban RPC nodes for the active network. */
  rpcNodes: RPCNode[];
  /** Latest latency results keyed by node id. */
  rpcLatencies: Record<string, RPCLatencyResult>;
}

interface NetworkActionsType {
  switchNetwork: (target: NetworkTarget) => Promise<void>;
  setCustomHorizonEndpoint: (url: string) => Promise<boolean>;
  resetToDefaultEndpoint: () => void;
  /** Select the active Soroban RPC node (persisted in local storage). */
  selectRpcNode: (nodeId: string) => void;
  /** Measure round-trip latency for all available RPC nodes. */
  measureRpcLatencies: () => Promise<void>;
}

interface NetworkStatusType {
  isSwitching: boolean;
  isValidating: boolean;
  isPinging: boolean;
  error: string | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
const NetworkActionsContext = createContext<NetworkActionsType | undefined>(undefined);
const NetworkStatusContext = createContext<NetworkStatusType | undefined>(undefined);

const DEFAULT_ENDPOINTS: Record<NetworkTarget, { horizon: string; soroban: string }> = {
  testnet: {
    horizon: "https://horizon-testnet.stellar.org",
    soroban: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    horizon: "https://horizon.stellar.org",
    soroban: "https://soroban-mainnet.stellar.org",
  },
};

const STORAGE_KEYS = {
  network: "stellarflow_network",
  customHorizon: "stellarflow_custom_horizon",
  rpcNode: "stellarflow_rpc_node",
} as const;

/** Latency threshold (ms) below which a node is considered healthy. */
const LATENCY_GOOD_MS = 300;
/** Latency threshold (ms) above which a node is considered slow/degraded. */
const LATENCY_SLOW_MS = 1000;
const PING_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 30000;

/** Classify a latency measurement into a status dot colour. */
export function classifyLatency(latencyMs: number | null): RPCStatus {
  if (latencyMs === null) return "offline";
  if (latencyMs <= LATENCY_GOOD_MS) return "online";
  if (latencyMs <= LATENCY_SLOW_MS) return "degraded";
  return "offline";
}

/** Measure a single RPC endpoint's round-trip time in milliseconds. */
async function pingEndpoint(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    // A JSON-RPC post is the most representative probe of a Soroban RPC node.
    const response = await fetch(url.replace(/\/+$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
      signal: controller.signal,
      cache: "no-store",
    });
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!response.ok) return null;
    return Math.round(end - start);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<NetworkTarget>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.network);
      if (saved === "testnet" || saved === "mainnet") return saved;
    }
    return "testnet";
  });

  const [customHorizonUrl, setCustomHorizonUrlState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.customHorizon) || "";
    }
    return "";
  });

  const [activeRpcNodeId, setActiveRpcNodeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.rpcNode);
      if (saved) return saved;
    }
    return RPC_NODES.testnet[0].id;
  });

  const [rpcLatencies, setRpcLatencies] = useState<Record<string, RPCLatencyResult>>({});
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const rpcNodes = useMemo<RPCNode[]>(() => RPC_NODES[network] ?? [], [network]);

  // Ensure the active node id always refers to a node on the current network.
  useEffect(() => {
    if (!rpcNodes.some((node) => node.id === activeRpcNodeId)) {
      setActiveRpcNodeId(rpcNodes[0]?.id ?? "");
    }
  }, [rpcNodes, activeRpcNodeId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.network, network);
    }
  }, [network]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (customHorizonUrl) {
        localStorage.setItem(STORAGE_KEYS.customHorizon, customHorizonUrl);
      } else {
        localStorage.removeItem(STORAGE_KEYS.customHorizon);
      }
    }
  }, [customHorizonUrl]);

  useEffect(() => {
    if (typeof window !== "undefined" && activeRpcNodeId) {
      localStorage.setItem(STORAGE_KEYS.rpcNode, activeRpcNodeId);
    }
  }, [activeRpcNodeId]);

  const horizonUrl = useMemo(() => {
    if (customHorizonUrl) {
      return customHorizonUrl;
    }
    return DEFAULT_ENDPOINTS[network].horizon;
  }, [network, customHorizonUrl]);

  const sorobanUrl = useMemo(() => {
    const selected = rpcNodes.find((node) => node.id === activeRpcNodeId);
    return selected?.url ?? DEFAULT_ENDPOINTS[network].soroban;
  }, [network, rpcNodes, activeRpcNodeId]);

  const validateEndpoint = async (url: string): Promise<boolean> => {
    if (!url.trim()) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url.replace(/\/+$/, ""), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok || response.status < 500;
    } catch {
      return false;
    }
  };

  const measureRpcLatencies = useCallback(async (): Promise<void> => {
    const nodes = RPC_NODES[network] ?? [];
    if (nodes.length === 0) return;
    setIsPinging(true);
    try {
      const results = await Promise.all(
        nodes.map(async (node) => {
          const latencyMs = await pingEndpoint(node.url);
          const result: RPCLatencyResult = {
            nodeId: node.id,
            url: node.url,
            latencyMs,
            status: classifyLatency(latencyMs),
            checkedAt: Date.now(),
          };
          return result;
        }),
      );
      setRpcLatencies((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.nodeId] = result;
        }
        return next;
      });
    } finally {
      setIsPinging(false);
    }
  }, [network]);

  // Poll latencies for the active network on mount and at a fixed interval.
  useEffect(() => {
    void measureRpcLatencies();
    const intervalId = setInterval(() => {
      void measureRpcLatencies();
    }, PING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [measureRpcLatencies]);

  const switchNetwork = useCallback(async (target: NetworkTarget) => {
    setIsSwitching(true);
    setError(null);
    try {
      const targetUrl = DEFAULT_ENDPOINTS[target].horizon;
      const ok = await validateEndpoint(targetUrl);
      if (!ok) {
        throw new Error(`Failed to connect to ${target} Horizon node.`);
      }
      setNetwork(target);
      setCustomHorizonUrlState(""); // clear custom when switching network targets
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network switch failed";
      setError(message);
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const setCustomHorizonEndpoint = useCallback(async (url: string): Promise<boolean> => {
    const trimmed = url.trim();
    if (!trimmed) {
      setCustomHorizonUrlState("");
      setError(null);
      return true;
    }

    setIsValidating(true);
    setError(null);

    try {
      const isValid = await validateEndpoint(trimmed);
      if (!isValid) {
        setError("Custom endpoint ping failed. Falling back to default network Horizon.");
        setCustomHorizonUrlState("");
        setIsValidating(false);
        return false;
      }

      setCustomHorizonUrlState(trimmed);
      setIsValidating(false);
      return true;
    } catch {
      setError("Connection error. Falling back to default network Horizon.");
      setCustomHorizonUrlState("");
      setIsValidating(false);
      return false;
    }
  }, []);

  const resetToDefaultEndpoint = useCallback(() => {
    setCustomHorizonUrlState("");
    setError(null);
  }, []);

  const selectRpcNode = useCallback((nodeId: string) => {
    const exists = (RPC_NODES[network] ?? []).some((node) => node.id === nodeId);
    if (!exists) {
      setError("Selected RPC node is not available on this network.");
      return;
    }
    setActiveRpcNodeId(nodeId);
    setError(null);
  }, [network]);

  const contextValue = useMemo<NetworkContextType>(
    () => ({
      network,
      horizonUrl,
      sorobanUrl,
      customHorizonUrl,
      config: {
        ...NETWORK_CONFIGS[network],
        horizonUrl,
        sorobanRpcUrl: sorobanUrl,
      },
      activeRpcNodeId,
      rpcNodes,
      rpcLatencies,
    }),
    [network, horizonUrl, sorobanUrl, customHorizonUrl, activeRpcNodeId, rpcNodes, rpcLatencies],
  );

  const actionsValue = useMemo<NetworkActionsType>(
    () => ({
      switchNetwork,
      setCustomHorizonEndpoint,
      resetToDefaultEndpoint,
      selectRpcNode,
      measureRpcLatencies,
    }),
    [switchNetwork, setCustomHorizonEndpoint, resetToDefaultEndpoint, selectRpcNode, measureRpcLatencies],
  );

  const statusValue = useMemo<NetworkStatusType>(
    () => ({ isSwitching, isValidating, isPinging, error }),
    [isSwitching, isValidating, isPinging, error],
  );

  return (
    <NetworkContext.Provider value={contextValue}>
      <NetworkActionsContext.Provider value={actionsValue}>
        <NetworkStatusContext.Provider value={statusValue}>
          {children}
        </NetworkStatusContext.Provider>
      </NetworkActionsContext.Provider>
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within a NetworkProvider");
  return ctx;
}

export function useNetworkActions(): NetworkActionsType {
  const ctx = useContext(NetworkActionsContext);
  if (!ctx) throw new Error("useNetworkActions must be used within a NetworkProvider");
  return ctx;
}

export function useNetworkStatus(): NetworkStatusType {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) throw new Error("useNetworkStatus must be used within a NetworkProvider");
  return ctx;
}