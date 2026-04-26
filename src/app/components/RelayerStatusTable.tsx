"use client";

import React, { useEffect, useState } from "react";
import { pingRelayer } from "../services/relayerPingService";

export interface Relayer {
  id: string;
  name: string;
  status: "Online" | "Offline" | "Syncing";
  latency: number; // in ms
  /** Optional base URL for /ping health check */
  baseUrl?: string;
}

export interface RelayerStatusTableProps {
  relayers?: Relayer[];
}

export default function RelayerStatusTable({ relayers = [] }: RelayerStatusTableProps) {
  const [pingStatuses, setPingStatuses] = useState<Record<string, "active" | "inactive">>({});

  useEffect(() => {
    if (relayers.length === 0) return;

    async function runPings() {
      const results = await Promise.all(
        relayers
          .filter((r) => r.baseUrl)
          .map((r) => pingRelayer(r.id, r.baseUrl!))
      );
      const map: Record<string, "active" | "inactive"> = {};
      for (const result of results) {
        map[result.id] = result.status;
      }
      setPingStatuses(map);
    }

    runPings();
    const interval = setInterval(runPings, 30_000);
    return () => clearInterval(interval);
  }, [relayers]);

  function resolveStatus(relayer: Relayer): Relayer["status"] {
    if (!relayer.baseUrl) return relayer.status;
    const ping = pingStatuses[relayer.id];
    if (ping === "inactive") return "Offline";
    if (ping === "active") return "Online";
    return relayer.status;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
      <table className="w-full table-fixed text-left text-sm text-white/80">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-white/50">
            <th className="w-1/3 p-4 font-medium">Relayer Name</th>
            <th className="w-1/3 p-4 font-medium">Status</th>
            <th className="w-1/3 p-4 font-medium text-right">Latency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {relayers.map((relayer) => {
            const status = resolveStatus(relayer);
            return (
              <tr key={relayer.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="p-4 font-medium text-white">{relayer.name}</td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                      status === "Online"
                        ? "bg-[#39FF14]/10 text-[#39FF14]"
                        : status === "Offline"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === "Online"
                          ? "bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.6)]"
                          : status === "Offline"
                          ? "bg-red-400"
                          : "bg-yellow-400"
                      }`}
                    />
                    {status}
                  </span>
                </td>
                <td className="p-4 text-right font-mono text-white/70">
                  {relayer.latency} ms
                </td>
              </tr>
            );
          })}
          {relayers.length === 0 && (
            <tr>
              <td colSpan={3} className="p-8 text-center text-white/40">
                No relayers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
