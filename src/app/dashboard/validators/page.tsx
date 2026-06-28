"use client";

import React, { useMemo, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useValidatorAudit,
  type ValidatorNode,
} from "../../hooks/useValidatorAudit";

const ROW_HEIGHT = 57; // py-4 (~16px top+bottom) + 1px border + content ≈ 57px

export default function ValidatorAuditPage() {
  const { data } = useValidatorAudit();
  const { validators } = data;

  const [filter, setFilter] = useState<"all" | "active" | "jailed">("all");
  const [selectedJailedValidator, setSelectedJailedValidator] =
    useState<ValidatorNode | null>(null);

  const filteredValidators = useMemo(() => {
    if (filter === "all") return validators;
    return validators.filter((v) => v.status === filter);
  }, [validators, filter]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredValidators.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <>
      <div className="min-h-screen bg-neutral-950 p-6 font-sans text-neutral-100 selection:bg-lime-500 selection:text-black">
        {/* Header Container */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-neutral-800 pb-6 md:flex-row md:items-center">
          <div>
            <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Validator Slashing & Heartbeat Audit
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Real-time consensus verification, uptime audits, and economic
              slashing metrics.
            </p>
          </div>

          {/* Toggle Controls */}
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-1 font-mono text-xs">
            {(["all", "active", "jailed"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-md px-3 py-1.5 uppercase transition-all ${
                  filter === type
                    ? "border border-neutral-700 bg-neutral-800 font-bold text-lime-400"
                    : "text-neutral-400 hover:text-neutral-200"
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
            {validators.filter((v) => v.status === "active").length} /{" "}
            {validators.length}
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

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-neutral-200 flex items-center gap-2">
          <span>🛡️</span> Security Infrastructure Node Matrix
        </h2>
        <div ref={scrollRef} className="overflow-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-neutral-900">
              <tr className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider">
                <th className="py-3 px-4">Validator Identity</th>
                <th className="py-3 px-4">Stellar Account Handle</th>
                <th className="py-3 px-4 text-right">Heartbeat Uptime</th>
                <th className="py-3 px-4 text-right">Missed Checkpoints</th>
                <th className="py-3 px-4 text-right">Slashing History</th>
                <th className="py-3 px-4 text-right">Active Security Bond</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50 text-sm font-mono">
              {paddingTop > 0 && <tr><td colSpan={7} style={{ height: paddingTop }} /></tr>}
              {virtualRows.map((vRow) => {
                const val = filteredValidators[vRow.index];
                return (
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
                );
              })}
              {paddingBottom > 0 && <tr><td colSpan={7} style={{ height: paddingBottom }} /></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {selectedJailedValidator && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jailed-validator-modal-title"
      >
        <div className="w-full max-w-lg rounded-2xl border border-amber-800/70 bg-neutral-950 p-6 shadow-2xl shadow-black/60">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400">Jailed validator</p>
              <h2 id="jailed-validator-modal-title" className="mt-2 text-2xl font-bold text-neutral-100">
                {selectedJailedValidator.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedJailedValidator(null)}
              className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 transition-colors hover:border-neutral-400 hover:text-white"
              aria-label="Close jailed validator details"
            >
              ×
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-neutral-900 p-4">
              <dt className="text-xs uppercase text-neutral-500">Heartbeat uptime</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-amber-300">{selectedJailedValidator.uptime.toFixed(2)}%</dd>
            </div>
            <div className="rounded-xl bg-neutral-900 p-4">
              <dt className="text-xs uppercase text-neutral-500">Missed checkpoints</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-red-300">{selectedJailedValidator.missedBlocks}</dd>
            </div>
            <div className="rounded-xl bg-neutral-900 p-4">
              <dt className="text-xs uppercase text-neutral-500">Slash events</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-red-300">{selectedJailedValidator.slashingEvents}</dd>
            </div>
            <div className="rounded-xl bg-neutral-900 p-4">
              <dt className="text-xs uppercase text-neutral-500">Security bond</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-neutral-100">{selectedJailedValidator.stakedXlm.toLocaleString()} XLM</dd>
            </div>
          </dl>

          <p className="mt-5 break-all rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-xs text-neutral-400">
            {selectedJailedValidator.address}
          </p>
        </div>
      </div>
    )}
    </>
  );
}
