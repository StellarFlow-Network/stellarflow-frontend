"use client";

import React, { useState, useMemo } from "react";
import { useValidatorAudit } from "../../hooks/useValidatorAudit";

export default function ValidatorAuditPage() {
  const { data } = useValidatorAudit();
  const { validators } = data;

  const [filter, setFilter] = useState<"all" | "active" | "jailed">("all");

  const filteredValidators = useMemo(() => {
    if (filter === "all") return validators;
    return validators.filter(v => v.status === filter);
  }, [validators, filter]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans selection:bg-lime-500 selection:text-black">
      {/* Header Container */}
      <div className="mb-8 border-b border-neutral-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Validator Slashing & Heartbeat Audit
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time consensus verification, uptime audits, and economic slashing metrics.
          </p>
        </div>
        
        {/* Toggle Controls */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-1 text-xs font-mono">
          {(["all", "active", "jailed"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-md uppercase transition-all ${
                filter === type ? "bg-neutral-800 text-lime-400 font-bold border border-neutral-700" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">TOTAL ACTIVE VALIDATORS</span>
          <span className="text-2xl font-bold font-mono text-neutral-100">
            {validators.filter(v => v.status === "active").length} / {validators.length}
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">TOTAL CAPITAL STAKED</span>
          <span className="text-2xl font-bold font-mono text-lime-400">107,000 XLM</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">CUMULATIVE SLASH EVENTS</span>
          <span className="text-2xl font-bold font-mono text-red-400">9 Infracs</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">NETWORK HEARTBEAT INDEX</span>
          <span className="text-2xl font-bold font-mono text-emerald-400">93.15%</span>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-neutral-200 flex items-center gap-2">
          <span>🛡️</span> Security Infrastructure Node Matrix
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider">
                <th className="py-3 px-4">Validator Identity</th>
                <th className="py-3 px-4">Stellar Account Handle</th>
                <th className="py-3 px-4 text-right">Heartbeat Uptime</th>
                <th className="py-3 px-4 text-right">Missed Checkpoints</th>
                <th className="py-3 px-4 text-right">Slashing History</th>
                <th className="py-3 px-4 text-right">Active Security Bond</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50 text-sm font-mono">
              {filteredValidators.map((val) => (
                <tr key={val.id} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-neutral-200 font-sans">{val.name}</td>
                  <td className="py-4 px-4 text-xs text-neutral-500 font-mono select-all">{val.address}</td>
                  <td className={`py-4 px-4 text-right font-bold ${val.uptime > 95 ? "text-emerald-400" : val.uptime > 80 ? "text-amber-500" : "text-red-500"}`}>
                    {val.uptime.toFixed(2)}%
                  </td>
                  <td className="py-4 px-4 text-right text-neutral-300">{val.missedBlocks}</td>
                  <td className={`py-4 px-4 text-right font-bold ${val.slashingEvents > 0 ? "text-red-400" : "text-neutral-500"}`}>
                    {val.slashingEvents}
                  </td>
                  <td className="py-4 px-4 text-right text-neutral-100">{val.stakedXlm.toLocaleString()} XLM</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded text-xs uppercase tracking-wider font-sans font-bold ${
                      val.status === "active" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" :
                      val.status === "jailed" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                      "bg-neutral-950 text-neutral-500 border border-neutral-800"
                    }`}>
                      {val.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
