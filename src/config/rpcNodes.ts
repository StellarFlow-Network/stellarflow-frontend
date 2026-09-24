/**
 * rpcNodes.ts
 *
 * Central configuration registry of Stellar RPC and Horizon endpoints for
 * Testnet and Mainnet, along with latency classification standards for Issue #730.
 *
 * Latency Thresholds:
 * - Green (Optimal):   < 200ms
 * - Yellow (Degraded): 200ms - 500ms
 * - Red (Unhealthy):   > 500ms or error/timeout
 */

export type NetworkTarget = "testnet" | "mainnet";
export type RpcNodeType = "soroban" | "horizon" | "hybrid";
export type LatencyTier = "optimal" | "degraded" | "unhealthy" | "checking";

export interface StellarRpcNode {
  id: string;
  name: string;
  url: string;
  network: NetworkTarget;
  type: RpcNodeType;
  provider: string;
  isDefault?: boolean;
  isCustom?: boolean;
  region?: string;
}

export interface NodeLatencyRecord {
  nodeId: string;
  url: string;
  latencyMs: number | null;
  tier: LatencyTier;
  lastChecked: number | null;
  error: string | null;
  history: number[];
}

export const LATENCY_THRESHOLDS = {
  OPTIMAL_CEILING_MS: 200,   // < 200ms is Green
  DEGRADED_CEILING_MS: 500,  // 200 - 500ms is Yellow; > 500ms is Red
  TIMEOUT_MS: 6000,
  HEARTBEAT_INTERVAL_MS: 10000, // 10s default ping interval
} as const;

export const DEFAULT_RPC_NODES: StellarRpcNode[] = [
  // ── Testnet Nodes ──────────────────────────────────────────────────────────
  {
    id: "sdf-testnet-soroban",
    name: "SDF Testnet RPC",
    url: "https://soroban-testnet.stellar.org",
    network: "testnet",
    type: "soroban",
    provider: "Stellar Development Foundation",
    isDefault: true,
    region: "Global (Anycast)",
  },
  {
    id: "sdf-testnet-horizon",
    name: "SDF Testnet Horizon",
    url: "https://horizon-testnet.stellar.org",
    network: "testnet",
    type: "horizon",
    provider: "Stellar Development Foundation",
    region: "Global (Anycast)",
  },
  {
    id: "stellar-testnet-community",
    name: "Stellar Community Testnet",
    url: "https://testnet.sorobanrpc.com",
    network: "testnet",
    type: "soroban",
    provider: "Public Community",
    region: "US-East",
  },

  // ── Mainnet Nodes ──────────────────────────────────────────────────────────
  {
    id: "sdf-mainnet-soroban",
    name: "SDF Mainnet RPC",
    url: "https://soroban-rpc.mainnet.stellar.org",
    network: "mainnet",
    type: "soroban",
    provider: "Stellar Development Foundation",
    isDefault: true,
    region: "Global (Anycast)",
  },
  {
    id: "sdf-mainnet-horizon",
    name: "SDF Mainnet Horizon",
    url: "https://horizon.stellar.org",
    network: "mainnet",
    type: "horizon",
    provider: "Stellar Development Foundation",
    region: "Global (Anycast)",
  },
  {
    id: "publicnode-mainnet-soroban",
    name: "PublicNode Mainnet",
    url: "https://mainnet.sorobanrpc.com",
    network: "mainnet",
    type: "soroban",
    provider: "PublicNode",
    region: "EU-Central",
  },
  {
    id: "blockdaemon-mainnet",
    name: "Blockdaemon Stellar RPC",
    url: "https://stellar-mainnet.blockdaemon.com",
    network: "mainnet",
    type: "soroban",
    provider: "Blockdaemon",
    region: "US-West",
  },
  {
    id: "ankr-mainnet-stellar",
    name: "Ankr Stellar RPC",
    url: "https://rpc.ankr.com/stellar",
    network: "mainnet",
    type: "hybrid",
    provider: "Ankr Network",
    region: "Global Edge",
  },
];

export const STORAGE_KEYS = {
  ACTIVE_NODE_PREFIX: "stellarflow.active_rpc_node.",
  CUSTOM_NODES: "stellarflow.custom_rpc_nodes",
  AUTO_FAILOVER: "stellarflow.auto_failover_enabled",
  HEARTBEAT_INTERVAL: "stellarflow.heartbeat_interval_ms",
} as const;

/**
 * Classify round-trip latency into standardized tiers with exact colors:
 * - Green: < 200ms
 * - Yellow: 200ms - 500ms
 * - Red: > 500ms or null/error
 */
export function classifyLatency(
  latencyMs: number | null,
  optimalCeiling = LATENCY_THRESHOLDS.OPTIMAL_CEILING_MS,
  degradedCeiling = LATENCY_THRESHOLDS.DEGRADED_CEILING_MS,
): {
  tier: LatencyTier;
  colorName: "green" | "yellow" | "red" | "gray";
  dotClass: string;
  textClass: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  label: string;
} {
  if (latencyMs === null) {
    return {
      tier: "checking",
      colorName: "gray",
      dotClass: "bg-zinc-500",
      textClass: "text-zinc-400",
      badgeClass: "bg-zinc-800/80 text-zinc-300 border-zinc-700",
      borderClass: "border-zinc-700",
      glowClass: "shadow-[0_0_8px_rgba(113,113,122,0.3)]",
      label: "Checking…",
    };
  }

  if (latencyMs < optimalCeiling) {
    return {
      tier: "optimal",
      colorName: "green",
      dotClass: "bg-[#39FF14]",
      textClass: "text-[#39FF14]",
      badgeClass: "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30",
      borderClass: "border-[#39FF14]/30",
      glowClass: "shadow-[0_0_10px_2px_rgba(57,255,20,0.4)]",
      label: "Fast (<200ms)",
    };
  }

  if (latencyMs <= degradedCeiling) {
    return {
      tier: "degraded",
      colorName: "yellow",
      dotClass: "bg-yellow-400",
      textClass: "text-yellow-400",
      badgeClass: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
      borderClass: "border-yellow-400/30",
      glowClass: "shadow-[0_0_10px_2px_rgba(250,204,21,0.4)]",
      label: "Moderate (200-500ms)",
    };
  }

  return {
    tier: "unhealthy",
    colorName: "red",
    dotClass: "bg-rose-500",
    textClass: "text-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    borderClass: "border-rose-500/30",
    glowClass: "shadow-[0_0_10px_2px_rgba(244,63,94,0.4)]",
    label: "Slow (>500ms)",
  };
}

/** Format milliseconds for display */
export function formatLatencyDisplay(ms: number | null): string {
  if (ms === null) return "—";
  return `${Math.round(ms)}ms`;
}

/** Get default active node for a target network */
export function getDefaultNodeForNetwork(network: NetworkTarget): StellarRpcNode {
  const found = DEFAULT_RPC_NODES.find(
    (n) => n.network === network && n.isDefault,
  );
  return found ?? DEFAULT_RPC_NODES.filter((n) => n.network === network)[0];
}

/** Read persisted active node for a network from localStorage (SSR-safe) */
export function readPersistedActiveNode(network: NetworkTarget): StellarRpcNode {
  if (typeof window === "undefined") {
    return getDefaultNodeForNetwork(network);
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEYS.ACTIVE_NODE_PREFIX}${network}`);
    if (raw) {
      const parsed = JSON.parse(raw) as StellarRpcNode;
      if (parsed && parsed.url && parsed.network === network) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse/storage errors
  }
  return getDefaultNodeForNetwork(network);
}

/** Persist active node choice */
export function persistActiveNode(network: NetworkTarget, node: StellarRpcNode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEYS.ACTIVE_NODE_PREFIX}${network}`,
      JSON.stringify(node),
    );
  } catch {
    // Best-effort
  }
}

/** Read custom user-defined nodes */
export function readCustomNodes(): StellarRpcNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.CUSTOM_NODES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is StellarRpcNode =>
            Boolean(item && item.id && item.url && item.network && item.isCustom),
        );
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

/** Save custom user-defined nodes */
export function persistCustomNodes(nodes: StellarRpcNode[]): void {
  if (typeof window === "undefined") return;
  try {
    const customOnly = nodes.filter((n) => n.isCustom);
    window.localStorage.setItem(
      STORAGE_KEYS.CUSTOM_NODES,
      JSON.stringify(customOnly),
    );
  } catch {
    // Ignore
  }
}
