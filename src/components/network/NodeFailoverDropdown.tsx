"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  classifyLatency,
  formatLatencyDisplay,
  type StellarRpcNode,
} from "@/config/rpcNodes";
import { useNetworkHeartbeat } from "@/hooks/useNetworkHeartbeat";

export interface NodeFailoverDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  heartbeat?: ReturnType<typeof useNetworkHeartbeat>;
}

export const NodeFailoverDropdown: React.FC<NodeFailoverDropdownProps> = ({
  isOpen,
  onClose,
  className = "",
  heartbeat: externalHeartbeat,
}) => {
  const localHeartbeat = useNetworkHeartbeat({ autoStart: false });
  const heartbeat = externalHeartbeat ?? localHeartbeat;

  const {
    activeNode,
    candidateNodes,
    nodeLatencies,
    isProbingAll,
    isPinging,
    autoFailover,
    switchActiveNode,
    probeAllNodes,
    addCustomNode,
    removeCustomNode,
    setAutoFailover,
    triggerHeartbeat,
  } = heartbeat;

  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customType, setCustomType] = useState<"soroban" | "horizon" | "hybrid">("soroban");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle adding custom node
  const handleAddCustomNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const trimmedUrl = customUrl.trim();
    if (!trimmedUrl) {
      setAddError("Node URL is required");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setAddError("Please enter a valid URL (e.g. https://rpc.example.com)");
      return;
    }

    setIsAdding(true);
    try {
      const newNode = await addCustomNode({
        name: customName.trim() || "Custom RPC",
        url: trimmedUrl,
        type: customType,
      });

      // Switch to the new node immediately
      await switchActiveNode(newNode);
      setCustomName("");
      setCustomUrl("");
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add node");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectNode = useCallback(
    async (node: StellarRpcNode) => {
      if (node.id === activeNode.id) {
        // Trigger a fresh ping if already selected
        await triggerHeartbeat();
      } else {
        await switchActiveNode(node);
      }
    },
    [activeNode.id, switchActiveNode, triggerHeartbeat],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Stellar RPC Node Failover and Selection"
      className={`absolute right-0 z-50 mt-2 w-[340px] sm:w-[400px] rounded-2xl border border-zinc-800 bg-[#0A0F1E]/95 p-4 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 duration-150 ${className}`}
      style={{ contain: "layout style" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
            <Icon id={ICON_IDS.network} size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Stellar Node Failover
            </h3>
            <p className="text-[11px] text-zinc-400">
              Active: <span className="font-semibold text-zinc-200">{activeNode.name}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close node failover menu"
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <Icon id={ICON_IDS.xCircle} size={18} />
        </button>
      </div>

      {/* ── Toolbar Actions (Ping All & Auto-Failover) ──────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/50">
        <button
          type="button"
          onClick={() => void probeAllNodes()}
          disabled={isProbingAll}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
          title="Ping all candidate nodes to benchmark latency"
        >
          <Icon
            id={ICON_IDS.refresh}
            size={13}
            className={isProbingAll ? "animate-spin text-[#39FF14]" : "text-zinc-400"}
          />
          <span>{isProbingAll ? "Testing Nodes…" : "Benchmark All"}</span>
        </button>

        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={autoFailover}
            onChange={(e) => setAutoFailover(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 accent-[#39FF14] text-[#39FF14] focus:ring-0"
          />
          <span className="text-[11px] font-medium text-zinc-400">Auto Failover</span>
        </label>
      </div>

      {/* ── Candidate Node List ─────────────────────────────────────────── */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1 mb-1">
          Available Stellar Nodes ({candidateNodes.length})
        </div>

        {candidateNodes.map((node) => {
          const isActive = node.id === activeNode.id;
          const latencyRecord = nodeLatencies[node.id];
          const currentLatency = isActive
            ? heartbeat.latencyMs
            : latencyRecord?.latencyMs ?? null;
          const tierInfo = classifyLatency(currentLatency);

          return (
            <div
              key={node.id}
              onClick={() => void handleSelectNode(node)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void handleSelectNode(node);
                }
              }}
              className={`group flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                isActive
                  ? "border-[#39FF14]/40 bg-[#39FF14]/5 shadow-[0_0_12px_rgba(57,255,20,0.1)]"
                  : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/50"
              }`}
            >
              {/* Left Side: Status Dot + Node Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  {isActive && (
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${tierInfo.dotClass}`}
                    />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${tierInfo.dotClass} ${
                      isActive ? tierInfo.glowClass : ""
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-xs font-bold ${
                        isActive ? "text-white" : "text-zinc-300 group-hover:text-white"
                      }`}
                    >
                      {node.name}
                    </span>
                    {node.isDefault && (
                      <span className="rounded bg-zinc-800 px-1 py-0.2 text-[9px] font-medium text-zinc-400 uppercase">
                        Default
                      </span>
                    )}
                    {node.isCustom && (
                      <span className="rounded bg-blue-500/20 px-1 py-0.2 text-[9px] font-medium text-blue-300 uppercase">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    {node.url}
                  </p>
                </div>
              </div>

              {/* Right Side: Latency Badge + Active Check */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${tierInfo.badgeClass}`}
                >
                  {isPinging && isActive ? (
                    <Icon id={ICON_IDS.refresh} size={10} className="animate-spin" />
                  ) : null}
                  {formatLatencyDisplay(currentLatency)}
                </span>

                {node.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomNode(node.id);
                    }}
                    title="Remove custom node"
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Icon id={ICON_IDS.minus} size={12} />
                  </button>
                )}

                {isActive && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#39FF14]/20 text-[#39FF14]">
                    <Icon id={ICON_IDS.check} size={12} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Custom Node Section ─────────────────────────────────────── */}
      <div className="mt-3 border-t border-zinc-800/80 pt-3">
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2 text-xs font-semibold text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <Icon id={ICON_IDS.plus} size={13} />
            <span>Add Custom Stellar RPC Node</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomNode} className="space-y-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">New Custom RPC Node</span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>

            <div>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Node Name (e.g. Private Validator)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
              />
            </div>

            <div>
              <input
                type="url"
                required
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://soroban-rpc.your-domain.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as any)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 focus:border-[#39FF14] focus:outline-none"
              >
                <option value="soroban">Soroban RPC</option>
                <option value="horizon">Horizon REST</option>
                <option value="hybrid">Hybrid</option>
              </select>

              <button
                type="submit"
                disabled={isAdding}
                className="flex-1 rounded-lg bg-[#39FF14] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#32e012] transition-colors disabled:opacity-50"
              >
                {isAdding ? "Testing…" : "Save & Connect"}
              </button>
            </div>

            {addError && (
              <p className="text-[11px] text-rose-400">{addError}</p>
            )}
          </form>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#39FF14]" /> &lt;200ms Fast
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> 200-500ms Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> &gt;500ms Slow
        </span>
      </div>
    </div>
  );
};

export default NodeFailoverDropdown;
