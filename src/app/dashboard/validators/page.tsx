"use client";

import React, { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useValidatorAudit,
  type ValidatorNode,
} from "../../hooks/useValidatorAudit";
import { useDebouncedInput } from "../../hooks/useDebouncedInput";
import { ValidatorHeartbeatCell } from "../../components/validators/ValidatorHeartbeatCell";
import { ValidatorStatusWidget } from "../../components/validators/ValidatorStatusWidget";

const ROW_HEIGHT = 57;

export default function ValidatorAuditPage() {
  const { data, isFetching } = useValidatorAudit();
  const { validators } = data;
  const [filter, setFilter] = useState<"all" | "active" | "jailed" | "offline">(
    "all",
  );
  const [selectedValidator, setSelectedValidator] = useState<ValidatorNode | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    value: searchInput,
    setValue: setSearchInput,
    debounced: debouncedSearchQuery,
  } = useDebouncedInput("", 250);

  const filteredValidators = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();

    return validators.filter((validator) => {
      const matchesFilter =
        filter === "all" || validator.status === filter;
      const matchesQuery =
        query.length === 0 ||
        validator.name.toLowerCase().includes(query) ||
        validator.address.toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [validators, filter, debouncedSearchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredValidators.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - virtualRows[virtualRows.length - 1].end
      : 0;

  const activeCount = validators.filter((validator) => validator.status === "active")
    .length;
  const totalStaked = validators.reduce(
    (sum, validator) => sum + validator.stakedXlm,
    0,
  );
  const totalSlashEvents = validators.reduce(
    (sum, validator) => sum + validator.slashingEvents,
    0,
  );
  const averageUptime =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + validator.uptime, 0) /
        validators.length
      : 0;

  return (
    <>
      <div className="min-h-screen bg-neutral-950 p-6 font-sans text-neutral-100 selection:bg-lime-500 selection:text-black">
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

          <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-1 font-mono text-xs">
            {(["all", "active", "jailed", "offline"] as const).map((type) => (
              <button
                key={type}
                type="button"
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

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard
            label="TOTAL ACTIVE VALIDATORS"
            value={`${activeCount} / ${validators.length}`}
            valueClassName="text-neutral-100"
          />
          <MetricCard
            label="TOTAL CAPITAL STAKED"
            value={`${totalStaked.toLocaleString()} XLM`}
            valueClassName="text-lime-400"
          />
          <MetricCard
            label="CUMULATIVE SLASH EVENTS"
            value={`${totalSlashEvents} Infracs`}
            valueClassName="text-red-400"
          />
          <MetricCard
            label="NETWORK HEARTBEAT INDEX"
            value={`${averageUptime.toFixed(2)}%`}
            valueClassName="text-emerald-400"
          />
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-200">
                Security Infrastructure Node Matrix
              </h2>
              <p className="mt-1 text-xs font-mono text-neutral-500">
                {isFetching ? "Refreshing validator data..." : "Latest validator audit snapshot"}
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by address or name..."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2 pl-9 pr-9 text-xs font-mono text-neutral-200 placeholder-neutral-600 outline-none transition-colors focus:border-lime-600"
                aria-label="Search validators"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[600px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-neutral-900">
                <tr className="border-b border-neutral-800 font-mono text-xs uppercase tracking-wider text-neutral-400">
                  <th className="px-4 py-3">Validator Identity</th>
                  <th className="px-4 py-3">Stellar Account Handle</th>
                  <th className="px-4 py-3 text-right">Heartbeat Uptime</th>
                  <th className="px-4 py-3 text-right">Missed Checkpoints</th>
                  <th className="px-4 py-3 text-right">Slashing History</th>
                  <th className="px-4 py-3 text-right">Active Security Bond</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50 text-sm font-mono">
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={8} style={{ height: paddingTop }} />
                  </tr>
                )}

                {virtualRows.map((virtualRow) => {
                  const validator = filteredValidators[virtualRow.index];

                  return (
                    <tr
                      key={validator.id}
                      className="transition-colors hover:bg-neutral-800/20"
                      style={{ contain: "layout paint" }}
                    >
                      <td className="px-4 py-4 font-sans font-bold text-neutral-200">
                        {validator.name}
                      </td>
                      <td className="select-all px-4 py-4 text-xs text-neutral-500">
                        {validator.address}
                      </td>
                      <ValidatorHeartbeatCell
                        uptime={validator.uptime}
                        status={validator.status}
                      />
                      <td className="px-4 py-4 text-right text-neutral-300">
                        {validator.missedBlocks}
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-bold ${
                          validator.slashingEvents > 0
                            ? "text-red-400"
                            : "text-neutral-500"
                        }`}
                      >
                        {validator.slashingEvents}
                      </td>
                      <td className="px-4 py-4 text-right text-neutral-100">
                        {validator.stakedXlm.toLocaleString()} XLM
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ValidatorStatusWidget status={validator.status} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        {validator.status === "jailed" ? (
                          <button
                            type="button"
                            onClick={() => setSelectedValidator(validator)}
                            className="rounded-md border border-amber-800/70 bg-amber-950/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 transition-colors hover:border-amber-500 hover:text-amber-100"
                            aria-haspopup="dialog"
                          >
                            Inspect
                          </button>
                        ) : (
                          <span className="text-xs uppercase tracking-wider text-neutral-600">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={8} style={{ height: paddingBottom }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedValidator && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jailed-validator-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-amber-800/70 bg-neutral-950 p-6 shadow-2xl shadow-black/60">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400">
                  Jailed validator
                </p>
                <h2
                  id="jailed-validator-modal-title"
                  className="mt-2 text-2xl font-bold text-neutral-100"
                >
                  {selectedValidator.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedValidator(null)}
                className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 transition-colors hover:border-neutral-400 hover:text-white"
                aria-label="Close jailed validator details"
              >
                ×
              </button>
            </div>

            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <DetailCard
                label="Heartbeat uptime"
                value={`${selectedValidator.uptime.toFixed(2)}%`}
                valueClassName="text-amber-300"
              />
              <DetailCard
                label="Missed checkpoints"
                value={String(selectedValidator.missedBlocks)}
                valueClassName="text-red-300"
              />
              <DetailCard
                label="Slash events"
                value={String(selectedValidator.slashingEvents)}
                valueClassName="text-red-300"
              />
              <DetailCard
                label="Security bond"
                value={`${selectedValidator.stakedXlm.toLocaleString()} XLM`}
                valueClassName="text-neutral-100"
              />
            </dl>

            <p className="mt-5 break-all rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-xs text-neutral-400">
              {selectedValidator.address}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div
      style={{ contain: "layout paint" }}
      className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
    >
      <span className="mb-1 block text-xs font-mono text-neutral-400">
        {label}
      </span>
      <span className={`text-2xl font-bold font-mono ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

function DetailCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-900 p-4">
      <dt className="text-xs uppercase text-neutral-500">{label}</dt>
      <dd className={`mt-1 font-mono text-lg font-bold ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}
