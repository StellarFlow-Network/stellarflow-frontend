"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RPC_NODES,
  LATENCY_THRESHOLDS,
  STORAGE_KEYS,
  classifyLatency,
  getDefaultNodeForNetwork,
  persistActiveNode,
  persistCustomNodes,
  readCustomNodes,
  readPersistedActiveNode,
  type LatencyTier,
  type NetworkTarget,
  type NodeLatencyRecord,
  type StellarRpcNode,
} from "@/config/rpcNodes";
import { rpcManager } from "@/services/rpc";
import { useOptionalNetwork } from "@/app/components/providers/NetworkProvider";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

export interface UseNetworkHeartbeatOptions {
  network?: NetworkTarget;
  pollIntervalMs?: number;
  timeoutMs?: number;
  autoStart?: boolean;
}

export interface UseNetworkHeartbeatReturn {
  activeNode: StellarRpcNode;
  network: NetworkTarget;
  latencyMs: number | null;
  tier: LatencyTier;
  colorName: "green" | "yellow" | "red" | "gray";
  statusLabel: string;
  dotClass: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
  glowClass: string;
  isPinging: boolean;
  lastPingTimestamp: number | null;
  pingHistory: number[];
  error: string | null;
  consecutiveFailures: number;
  autoFailover: boolean;
  candidateNodes: StellarRpcNode[];
  nodeLatencies: Record<string, NodeLatencyRecord>;
  isProbingAll: boolean;
  switchActiveNode: (node: StellarRpcNode) => Promise<void>;
  triggerHeartbeat: () => Promise<void>;
  probeAllNodes: () => Promise<void>;
  addCustomNode: (nodeData: { name: string; url: string; type?: "soroban" | "horizon" | "hybrid" }) => Promise<StellarRpcNode>;
  removeCustomNode: (nodeId: string) => void;
  setAutoFailover: (enabled: boolean) => void;
}

export function useNetworkHeartbeat(
  options: UseNetworkHeartbeatOptions = {},
): UseNetworkHeartbeatReturn {
  const optionalNetworkCtx = useOptionalNetwork();
  const activeNetwork: NetworkTarget = options.network ?? optionalNetworkCtx?.network ?? "testnet";
  const pollIntervalMs = options.pollIntervalMs ?? LATENCY_THRESHOLDS.HEARTBEAT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? LATENCY_THRESHOLDS.TIMEOUT_MS;
  const autoStart = options.autoStart ?? true;

  const isOnline = useOnlineStatus();

  // Custom nodes stored locally
  const [customNodes, setCustomNodes] = useState<StellarRpcNode[]>(readCustomNodes);

  // Active selected node
  const [activeNode, setActiveNode] = useState<StellarRpcNode>(() =>
    readPersistedActiveNode(activeNetwork),
  );

  // Auto-failover preference
  const [autoFailover, setAutoFailoverState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEYS.AUTO_FAILOVER);
    return stored === null ? true : stored === "true";
  });

  // Heartbeat ping state
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTimestamp, setLastPingTimestamp] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Multi-node probing state
  const [nodeLatencies, setNodeLatencies] = useState<Record<string, NodeLatencyRecord>>({});
  const [isProbingAll, setIsProbingAll] = useState(false);

  // Ref tracking current network/node to prevent race conditions
  const generationRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);

  // Sync active node when network changes
  useEffect(() => {
    const defaultOrPersisted = readPersistedActiveNode(activeNetwork);
    setActiveNode(defaultOrPersisted);
    rpcManager.setCurrentEndpoint(defaultOrPersisted.url);
    setLatencyMs(null);
    setError(null);
    setConsecutiveFailures(0);
    consecutiveFailuresRef.current = 0;
  }, [activeNetwork]);

  // Combined candidate nodes for active network
  const candidateNodes = useMemo(() => {
    const builtIn = DEFAULT_RPC_NODES.filter((n) => n.network === activeNetwork);
    const custom = customNodes.filter((n) => n.network === activeNetwork);
    return [...builtIn, ...custom];
  }, [activeNetwork, customNodes]);

  // Core ping single node function
  const pingNode = useCallback(
    async (node: StellarRpcNode): Promise<{ latencyMs: number; error: string | null }> => {
      return rpcManager.pingEndpoint(node.url, timeoutMs);
    },
    [timeoutMs],
  );

  // Trigger heartbeat ping on active node
  const triggerHeartbeat = useCallback(async () => {
    if (!isOnline) {
      setError("Browser is offline");
      setLatencyMs(null);
      return;
    }

    const gen = ++generationRef.current;
    setIsPinging(true);

    try {
      const result = await pingNode(activeNode);
      if (gen !== generationRef.current) return;

      const now = Date.now();
      setLastPingTimestamp(now);

      if (result.error) {
        setError(result.error);
        setLatencyMs(null);
        consecutiveFailuresRef.current += 1;
        setConsecutiveFailures(consecutiveFailuresRef.current);

        // Auto-failover trigger if 3 consecutive failures occur
        if (autoFailover && consecutiveFailuresRef.current >= 3) {
          const alternatives = candidateNodes.filter((n) => n.id !== activeNode.id);
          if (alternatives.length > 0) {
            const nextNode = alternatives[0];
            setActiveNode(nextNode);
            persistActiveNode(activeNetwork, nextNode);
            rpcManager.setCurrentEndpoint(nextNode.url);
            consecutiveFailuresRef.current = 0;
            setConsecutiveFailures(0);
          }
        }
      } else {
        setError(null);
        setLatencyMs(result.latencyMs);
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setPingHistory((prev) => {
          const next = [...prev, result.latencyMs];
          return next.length > 10 ? next.slice(-10) : next;
        });

        // Record into nodeLatencies
        setNodeLatencies((prev) => ({
          ...prev,
          [activeNode.id]: {
            nodeId: activeNode.id,
            url: activeNode.url,
            latencyMs: result.latencyMs,
            tier: classifyLatency(result.latencyMs).tier,
            lastChecked: now,
            error: null,
            history: [...(prev[activeNode.id]?.history ?? []), result.latencyMs].slice(-10),
          },
        }));
      }
    } catch (err) {
      if (gen !== generationRef.current) return;
      const errMsg = err instanceof Error ? err.message : "Heartbeat ping failed";
      setError(errMsg);
      setLatencyMs(null);
    } finally {
      if (gen === generationRef.current) {
        setIsPinging(false);
      }
    }
  }, [activeNode, activeNetwork, autoFailover, candidateNodes, isOnline, pingNode]);

  // Probe all candidate nodes simultaneously
  const probeAllNodes = useCallback(async () => {
    if (!isOnline || candidateNodes.length === 0) return;
    setIsProbingAll(true);

    try {
      const results = await Promise.allSettled(
        candidateNodes.map(async (node) => {
          const pingResult = await pingNode(node);
          return { node, ...pingResult };
        }),
      );

      const now = Date.now();
      const nextMap: Record<string, NodeLatencyRecord> = {};

      results.forEach((res) => {
        if (res.status === "fulfilled") {
          const { node, latencyMs: measuredMs, error: nodeErr } = res.value;
          const tier = nodeErr ? "unhealthy" : classifyLatency(measuredMs).tier;
          nextMap[node.id] = {
            nodeId: node.id,
            url: node.url,
            latencyMs: nodeErr ? null : measuredMs,
            tier,
            lastChecked: now,
            error: nodeErr,
            history: nodeErr ? [] : [measuredMs],
          };
        }
      });

      setNodeLatencies((prev) => ({ ...prev, ...nextMap }));
    } finally {
      setIsProbingAll(false);
    }
  }, [candidateNodes, isOnline, pingNode]);

  // Manual failover / switch active node
  const switchActiveNode = useCallback(
    async (node: StellarRpcNode) => {
      setActiveNode(node);
      persistActiveNode(activeNetwork, node);
      rpcManager.setCurrentEndpoint(node.url);
      setLatencyMs(null);
      setError(null);
      consecutiveFailuresRef.current = 0;
      setConsecutiveFailures(0);

      // Trigger immediate ping to the newly chosen node
      const gen = ++generationRef.current;
      setIsPinging(true);
      try {
        const result = await pingNode(node);
        if (gen !== generationRef.current) return;
        const now = Date.now();
        setLastPingTimestamp(now);
        if (result.error) {
          setError(result.error);
        } else {
          setLatencyMs(result.latencyMs);
          setPingHistory([result.latencyMs]);
          setNodeLatencies((prev) => ({
            ...prev,
            [node.id]: {
              nodeId: node.id,
              url: node.url,
              latencyMs: result.latencyMs,
              tier: classifyLatency(result.latencyMs).tier,
              lastChecked: now,
              error: null,
              history: [result.latencyMs],
            },
          }));
        }
      } finally {
        if (gen === generationRef.current) {
          setIsPinging(false);
        }
      }
    },
    [activeNetwork, pingNode],
  );

  // Add custom node
  const addCustomNode = useCallback(
    async (nodeData: { name: string; url: string; type?: "soroban" | "horizon" | "hybrid" }) => {
      const newNode: StellarRpcNode = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: nodeData.name.trim() || "Custom RPC Node",
        url: nodeData.url.trim(),
        network: activeNetwork,
        type: nodeData.type ?? (nodeData.url.includes("horizon") ? "horizon" : "soroban"),
        provider: "Custom",
        isCustom: true,
        region: "Custom",
      };

      const updated = [...customNodes, newNode];
      setCustomNodes(updated);
      persistCustomNodes(updated);
      return newNode;
    },
    [activeNetwork, customNodes],
  );

  // Remove custom node
  const removeCustomNode = useCallback(
    (nodeId: string) => {
      const updated = customNodes.filter((n) => n.id !== nodeId);
      setCustomNodes(updated);
      persistCustomNodes(updated);

      if (activeNode.id === nodeId) {
        const fallback = getDefaultNodeForNetwork(activeNetwork);
        void switchActiveNode(fallback);
      }
    },
    [activeNetwork, activeNode.id, customNodes, switchActiveNode],
  );

  // Toggle auto-failover
  const setAutoFailover = useCallback((enabled: boolean) => {
    setAutoFailoverState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.AUTO_FAILOVER, String(enabled));
    }
  }, []);

  // Periodic heartbeat timer with visibility listener
  useEffect(() => {
    if (!autoStart || !isOnline) return;

    // Run initial heartbeat immediately
    void triggerHeartbeat();

    let timerId: NodeJS.Timeout | null = null;

    const startInterval = () => {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        if (document.visibilityState === "visible") {
          void triggerHeartbeat();
        }
      }, pollIntervalMs);
    };

    startInterval();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void triggerHeartbeat();
        startInterval();
      } else if (timerId) {
        clearInterval(timerId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoStart, isOnline, pollIntervalMs, triggerHeartbeat]);

  // Compute latency classification styling
  const classification = useMemo(() => {
    if (!isOnline) {
      return {
        tier: "unhealthy" as LatencyTier,
        colorName: "red" as const,
        dotClass: "bg-rose-500",
        textClass: "text-rose-400",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        borderClass: "border-rose-500/30",
        glowClass: "shadow-[0_0_10px_2px_rgba(244,63,94,0.4)]",
        label: "Offline",
      };
    }
    return classifyLatency(latencyMs);
  }, [isOnline, latencyMs]);

  return {
    activeNode,
    network: activeNetwork,
    latencyMs,
    tier: classification.tier,
    colorName: classification.colorName,
    statusLabel: classification.label,
    dotClass: classification.dotClass,
    badgeClass: classification.badgeClass,
    textClass: classification.textClass,
    borderClass: classification.borderClass,
    glowClass: classification.glowClass,
    isPinging,
    lastPingTimestamp,
    pingHistory,
    error,
    consecutiveFailures,
    autoFailover,
    candidateNodes,
    nodeLatencies,
    isProbingAll,
    switchActiveNode,
    triggerHeartbeat,
    probeAllNodes,
    addCustomNode,
    removeCustomNode,
    setAutoFailover,
  };
}
