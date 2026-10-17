"use client";

import { useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";

export interface SorobanSimulationDebuggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rpcUrl: string;
  loading: boolean;
  result: unknown | null;
  error: string | null;
  durationMs: number | null;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function formatResource(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();
  if (typeof value === "string" && value.trim()) return value;
  return "Not reported";
}

function collectRevertMessages(value: unknown): string[] {
  const messages = new Set<string>();
  const visit = (item: unknown, depth: number) => {
    if (depth > 6 || item === null || item === undefined) return;
    if (typeof item === "string") {
      if (/\b(revert|trap|failed|failure|error|panic)\b/i.test(item)) messages.add(item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, depth + 1));
      return;
    }
    const record = asRecord(item);
    if (record) Object.values(record).forEach((child) => visit(child, depth + 1));
  };
  visit(value, 0);
  return [...messages];
}

export function SorobanSimulationDebuggerModal({
  isOpen,
  onClose,
  rpcUrl,
  loading,
  result,
  error,
  durationMs,
}: SorobanSimulationDebuggerModalProps) {
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const record = asRecord(result);
  const cost = asRecord(record?.cost);
  const logs = record?.events ?? record?.diagnosticEvents ?? record?.diagnostic_events ?? [];
  const revertMessages = useMemo(
    () => collectRevertMessages({ error, result }),
    [error, result],
  );
  const rawJson = useMemo(
    () => JSON.stringify({ rpcUrl, error, result }, null, 2) ?? "null",
    [error, result, rpcUrl],
  );

  const copyRawJson = async () => {
    setCopyError(null);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
    } catch (copyFailure) {
      setCopyError(copyFailure instanceof Error ? copyFailure.message : "Clipboard access failed.");
    }
  };

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Soroban Simulation Debugger"
      size="xl"
    >
      <div className="max-h-[75vh] space-y-4 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span className="break-all">RPC endpoint: {rpcUrl}</span>
          <span>{durationMs === null ? "—" : `${durationMs.toFixed(1)} ms`}</span>
        </div>

        {loading ? (
          <p className="rounded-lg border border-gray-800 bg-[#0d1117] p-6 text-sm text-gray-400" role="status">
            Running Soroban transaction simulation…
          </p>
        ) : (
          <>
            {error && (
              <div role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">
                <h3 className="mb-1 font-semibold">Simulation failed</h3>
                <p className="break-words">{error}</p>
              </div>
            )}

            <section aria-label="Resource consumption" className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <h3 className="text-xs uppercase tracking-wide text-gray-500">CPU instructions</h3>
                <p className="mt-1 font-mono text-sm text-gray-200">
                  {formatResource(cost?.cpuInsns ?? cost?.cpu_insns)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <h3 className="text-xs uppercase tracking-wide text-gray-500">Memory bytes</h3>
                <p className="mt-1 font-mono text-sm text-gray-200">
                  {formatResource(cost?.memBytes ?? cost?.mem_bytes)}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-200">Contract revert reasons</h3>
              {revertMessages.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-rose-900/60 bg-rose-950/20 p-3 text-sm text-rose-300">
                  {revertMessages.map((message) => <li className="break-words" key={message}>{message}</li>)}
                </ul>
              ) : (
                <p className="rounded-lg border border-gray-800 bg-[#0d1117] p-3 text-sm text-gray-500">
                  No revert reason reported.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-200">Execution logs</h3>
              <pre className="max-h-48 overflow-auto rounded-lg border border-gray-800 bg-black/40 p-3 text-xs leading-5 text-gray-300">
                {JSON.stringify(logs, null, 2) ?? "[]"}
              </pre>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-200">Raw simulation response</h3>
                <button
                  type="button"
                  onClick={() => void copyRawJson()}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800"
                >
                  {copied ? "Copied raw JSON" : "Copy Raw Simulation JSON"}
                </button>
              </div>
              {copyError && <p role="alert" className="text-xs text-rose-400">{copyError}</p>}
              <pre className="max-h-64 overflow-auto rounded-lg border border-gray-800 bg-black/40 p-3 text-xs leading-5 text-gray-300">
                {rawJson}
              </pre>
            </section>
          </>
        )}
      </div>
    </OptimizedDialog>
  );
}

export default SorobanSimulationDebuggerModal;
