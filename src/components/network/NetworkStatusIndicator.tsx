"use client";

import React, { useState, useRef } from "react";
import { formatLatencyDisplay } from "@/config/rpcNodes";
import { useNetworkHeartbeat, type UseNetworkHeartbeatReturn } from "@/hooks/useNetworkHeartbeat";
import { NodeFailoverDropdown } from "./NodeFailoverDropdown";

export interface NetworkStatusIndicatorProps {
  className?: string;
  heartbeat?: UseNetworkHeartbeatReturn;
  showNodeName?: boolean;
}

/**
 * Compact pill for the navigation bar — displays live connection state,
 * dynamic latency in ms, color-coded indicator (<200ms Green, 200-500ms Yellow, >500ms Red),
 * and opens the node failover dropdown menu on click.
 */
export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  className = "",
  heartbeat: externalHeartbeat,
  showNodeName = false,
}) => {
  const localHeartbeat = useNetworkHeartbeat();
  const heartbeat = externalHeartbeat ?? localHeartbeat;

  const {
    activeNode,
    latencyMs,
    colorName,
    dotClass,
    badgeClass,
    glowClass,
    textClass,
    isPinging,
  } = heartbeat;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        aria-expanded={dropdownOpen}
        aria-haspopup="dialog"
        aria-label={`Network latency: ${formatLatencyDisplay(latencyMs)}, Node: ${activeNode.name}`}
        className={`group flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-200 select-none hover:brightness-110 active:scale-95 ${badgeClass}`}
      >
        {/* Pulsing Status Dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {colorName !== "gray" && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotClass}`}
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${dotClass} ${glowClass}`}
          />
        </span>

        {/* RPC & Node Tag */}
        <span className="flex items-center gap-1">
          <span className={textClass}>RPC</span>
          {showNodeName && (
            <span className="hidden max-w-[90px] truncate text-[10px] text-zinc-400 sm:inline">
              {activeNode.name.replace("SDF ", "").replace("Stellar ", "")}
            </span>
          )}
        </span>

        {/* Dynamic Latency in ms */}
        <span
          className={`font-mono text-[11px] font-bold ${
            isPinging ? "animate-pulse" : ""
          }`}
        >
          {formatLatencyDisplay(latencyMs)}
        </span>

        {/* Dropdown Chevron */}
        <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200">
          ▾
        </span>
      </button>

      {/* Node Failover Dropdown */}
      <NodeFailoverDropdown
        isOpen={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        heartbeat={heartbeat}
      />
    </div>
  );
};

export default NetworkStatusIndicator;
