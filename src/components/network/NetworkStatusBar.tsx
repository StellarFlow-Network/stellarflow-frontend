"use client";

import React, { useState, useEffect } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  formatLatencyDisplay,
  classifyLatency,
} from "@/config/rpcNodes";
import { useNetworkHeartbeat, type UseNetworkHeartbeatReturn } from "@/hooks/useNetworkHeartbeat";
import { NodeFailoverDropdown } from "./NodeFailoverDropdown";

export interface NetworkStatusBarProps {
  className?: string;
  heartbeat?: UseNetworkHeartbeatReturn;
  isDocked?: boolean;
  collapsible?: boolean;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({
  className = "",
  heartbeat: externalHeartbeat,
  isDocked = true,
  collapsible = true,
}) => {
  const localHeartbeat = useNetworkHeartbeat();
  const heartbeat = externalHeartbeat ?? localHeartbeat;

  const {
    activeNode,
    network,
    latencyMs,
    colorName,
    statusLabel,
    dotClass,
    badgeClass,
    textClass,
    glowClass,
    isPinging,
    lastPingTimestamp,
    pingHistory,
    error,
    triggerHeartbeat,
  } = heartbeat;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>("just now");

  // Format "time ago" for last heartbeat ping
  useEffect(() => {
    if (!lastPingTimestamp) {
      setTimeAgo("connecting…");
      return;
    }

    const update = () => {
      const diffSec = Math.floor((Date.now() - lastPingTimestamp) / 1000);
      if (diffSec < 2) setTimeAgo("just now");
      else if (diffSec < 60) setTimeAgo(`${diffSec}s ago`);
      else setTimeAgo(`${Math.floor(diffSec / 60)}m ago`);
    };

    update();
    const timer = setInterval(update, 2000);
    return () => clearInterval(timer);
  }, [lastPingTimestamp]);

  if (isDocked && isCollapsed) {
    return (
      <div
        className="fixed bottom-3 right-3 z-40 transition-all duration-300"
        style={{ contain: "layout style" }}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xl backdrop-blur-md transition-all hover:scale-105 ${badgeClass}`}
          title="Expand Network Status Bar"
        >
          <span className={`h-2 w-2 rounded-full ${dotClass} ${glowClass}`} />
          <span className="font-mono">{formatLatencyDisplay(latencyMs)}</span>
          <span className="text-[10px] text-zinc-400">▲</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Network connection status bar"
      className={`${
        isDocked
          ? "fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/90 bg-[#070C18]/90 backdrop-blur-xl shadow-2xl"
          : "w-full rounded-2xl border border-zinc-800 bg-[#0A1020] p-3 shadow-lg"
      } ${className}`}
      style={{ contain: "layout style" }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* ── Left: Live Connection Dot + Active Node Details ──────────── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Pulsing Status Dot */}
          <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
            {colorName !== "gray" && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotClass}`}
              />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass} ${glowClass}`}
            />
          </div>

          {/* Network Badge */}
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
              network === "mainnet"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
            }`}
          >
            {network}
          </span>

          {/* Active Node Info */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
              {activeNode.name}
            </span>
            <span className="hidden md:inline font-mono text-[10px] text-zinc-500 truncate max-w-[180px]">
              ({activeNode.url})
            </span>
          </div>

          {/* Error Message if any */}
          {error && (
            <span
              className="hidden lg:inline text-[10px] text-rose-400 truncate max-w-[160px]"
              title={error}
            >
              ⚠ {error}
            </span>
          )}
        </div>

        {/* ── Center: Dynamic Latency Indicator & Ping History ─────────── */}
        <div className="flex items-center gap-3">
          {/* Dynamic Latency Badge (<200ms Green, 200-500ms Yellow, >500ms Red) */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono font-bold transition-colors ${badgeClass}`}
            title={`Latency tier: ${statusLabel}`}
          >
            <span className="text-[10px] uppercase tracking-wider opacity-75">Ping:</span>
            <span className="text-xs">{formatLatencyDisplay(latencyMs)}</span>
            <span className={`text-[10px] hidden sm:inline ${textClass}`}>
              ({statusLabel.split(" ")[0]})
            </span>
          </div>

          {/* Recent Ping Dots (History) */}
          {pingHistory.length > 0 && (
            <div
              className="hidden md:flex items-center gap-1 bg-zinc-900/60 px-2 py-1 rounded-full border border-zinc-800/60"
              title="Recent heartbeat latency history"
            >
              <span className="text-[9px] text-zinc-500 uppercase mr-0.5">History</span>
              {pingHistory.slice(-5).map((ms, idx) => {
                const tier = classifyLatency(ms);
                return (
                  <span
                    key={`${ms}-${idx}`}
                    className={`h-1.5 w-1.5 rounded-full ${tier.dotClass}`}
                    title={`${ms}ms`}
                  />
                );
              })}
            </div>
          )}

          {/* Heartbeat Time Ago */}
          <span className="hidden sm:inline font-mono text-[10px] text-zinc-500">
            {timeAgo}
          </span>
        </div>

        {/* ── Right: Action Buttons (Ping Now, Failover Dropdown, Collapse) ── */}
        <div className="relative flex items-center gap-2">
          {/* Immediate Ping Heartbeat Trigger */}
          <button
            type="button"
            onClick={() => void triggerHeartbeat()}
            disabled={isPinging}
            aria-label="Ping active Stellar node now"
            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all active:scale-95 disabled:opacity-50"
          >
            <Icon
              id={ICON_IDS.refresh}
              size={12}
              className={isPinging ? "animate-spin text-[#39FF14]" : "text-zinc-400"}
            />
            <span className="hidden sm:inline">Ping</span>
          </button>

          {/* Failover Node Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="dialog"
            aria-label="Open Stellar Node failover selection menu"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-bold text-white hover:border-[#39FF14]/50 hover:bg-zinc-700 transition-all active:scale-95 shadow-sm"
          >
            <Icon id={ICON_IDS.sliders} size={12} className="text-[#39FF14]" />
            <span>Failover Node</span>
            <span className="text-[9px] text-zinc-400">▾</span>
          </button>

          {/* Minimize / Collapse toggle */}
          {collapsible && isDocked && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse network status bar"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              title="Minimize status bar"
            >
              <Icon id={ICON_IDS.minus} size={14} />
            </button>
          )}

          {/* Node Failover Dropdown Popover */}
          <NodeFailoverDropdown
            isOpen={dropdownOpen}
            onClose={() => setDropdownOpen(false)}
            heartbeat={heartbeat}
            className="bottom-full mb-3 right-0"
          />
        </div>
      </div>
    </aside>
  );
};

export default NetworkStatusBar;
