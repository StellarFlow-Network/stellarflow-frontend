"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  ShieldAlert,
  Database,
  Terminal,
  Wifi,
  WifiOff,
  Cpu
} from 'lucide-react';
import { useRafThrottle } from '../hooks/useRafThrottle';
import { useMounted } from '@/app/hooks/useMounted';
import { Icon, ICON_IDS } from '@/components/icons';
import { useXdrWorker } from './useXdrWorker';
import { buildHighlightedParts, HighlightPart } from '@/utils/textUtils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';

const SEARCH_FIELDS: (keyof LogEntry)[] = ['message', 'actor', 'txHash'];

import { LogEntry, FilteredLogResult, FuseMatch, XdrFields } from './types';
import { readIndexedLogs, writeIndexedLogs } from './indexedLogStorage';

// --- Mock Data ---
const MOCK_LOGS: LogEntry[] = [
  { id: '101', timestamp: '2026-04-28 12:40:01', type: 'transaction', severity: 'info', message: 'XDR: AAAAAEAAAAAEAAAAC...', actor: 'VTPass Lagos', txHash: '0xabc...123' },
  { id: '102', timestamp: '2026-04-28 12:35:12', type: 'security', severity: 'critical', message: 'Unauthorized API attempt detected from IP 192.168.1.1', actor: 'System Guard' },
  { id: '103', timestamp: '2026-04-28 12:30:45', type: 'system', severity: 'warning', message: 'Regional Failover: Switching to Frankfurt Secondary', actor: 'Network Orchestrator' },
  { id: '104', timestamp: '2026-04-28 12:20:10', type: 'transaction', severity: 'info', message: 'XDR: BBBBBEEEEEEFFFFF...', actor: 'Binance Pan-Africa', txHash: '0xdef...456' },
];

function matchesSeverity(log: LogEntry, severity: "all" | LogEntry["severity"]) {
  return severity === "all" || log.severity === severity;
}

function includesQuery(log: LogEntry, query: string) {
  if (!query) return true;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return SEARCH_FIELDS.some((field) => {
    const value = log[field];
    return typeof value === "string" && value.toLowerCase().includes(normalizedQuery);
  });
}

function buildMatches(log: LogEntry, query: string): FuseMatch[] | undefined {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return undefined;

  const matches: FuseMatch[] = [];
  for (const key of SEARCH_FIELDS) {
    const value = log[key];
    if (typeof value !== "string") continue;

    const lowerValue = value.toLowerCase();
    const index = lowerValue.indexOf(normalizedQuery);
    if (index === -1) continue;

    matches.push({
      key,
      indices: [[index, index + normalizedQuery.length - 1]],
    });
  }

  return matches.length > 0 ? matches : undefined;
}

function mergeDecodedLogs(logs: LogEntry[], decodedMap: Map<string, XdrFields>): LogEntry[] {
  return logs.map((log) => {
    const decodedData = decodedMap.get(log.id);
    if (!decodedData) return log;
    return { ...log, decodedData: decodedData };
  });
}

function LogsSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-gray-100" aria-busy="true">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded-md bg-white/8" />
          <div className="h-10 w-56 rounded-md bg-white/10" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 rounded-lg bg-white/8" />
          <div className="h-10 w-28 rounded-lg bg-white/8" />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-800 bg-[#161b22] p-4 md:flex-row">
        <div className="h-10 flex-1 rounded-md bg-white/8" />
        <div className="h-10 w-full rounded-md bg-white/8 md:w-56" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#161b22]">
        <div className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] border-b border-gray-800 bg-[#0d1117]/80 text-[10px] uppercase tracking-wider text-gray-500">
          <div className="px-6 py-4">Timestamp</div>
          <div className="px-6 py-4">Type</div>
          <div className="px-6 py-4">Severity</div>
          <div className="px-6 py-4">Event Message</div>
          <div className="px-6 py-4">Actor</div>
          <div className="px-6 py-4 text-right">Reference</div>
        </div>

        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] border-b border-gray-800/50 items-center"
            >
              <div className="px-6 py-4">
                <div className="h-4 w-28 rounded bg-white/8" />
              </div>
              <div className="px-6 py-4">
                <div className="h-4 w-24 rounded bg-white/8" />
              </div>
              <div className="px-6 py-4">
                <div className="h-6 w-20 rounded-full bg-white/8" />
              </div>
              <div className="px-6 py-4">
                <div className="h-4 w-full rounded bg-white/8" />
              </div>
              <div className="px-6 py-4">
                <div className="h-4 w-24 rounded bg-white/8" />
              </div>
              <div className="px-6 py-4 text-right">
                <div className="ml-auto h-4 w-16 rounded bg-white/8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LogsPage() {
  const mounted = useMounted();
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
  const [filter, setFilter] = useState<"all" | LogEntry["severity"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const { batchDecode, decoding: xdrDecoding } = useXdrWorker();

  const throttledSetSearchQuery = useRafThrottle((v: string) => setSearchQuery(v));
  const throttledSetFilter = useRafThrottle((v: "all" | LogEntry["severity"]) => setFilter(v));

  useEffect(() => {
    if (!mounted) return;

    const cachedLogs = readIndexedLogs();
    if (cachedLogs) {
      setLogs(cachedLogs);
    }

    setStorageReady(true);
  }, [mounted]);

  useEffect(() => {
    if (!storageReady) return;
    writeIndexedLogs(logs);
  }, [logs, storageReady]);

  useEffect(() => {
    if (!mounted) return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mounted]);

  useEffect(() => {
    if (!storageReady) return;

    workerRef.current = new Worker(new URL("./search-worker.ts", import.meta.url));

    workerRef.current.onmessage = (event: MessageEvent<{ type: string; payload?: { results?: FilteredLogResult[] } }>) => {
      if (event.data.type === "RESULTS" && event.data.payload?.results) {
        setIsSearching(false);
      }
    };

    workerRef.current.postMessage({ type: "INIT", payload: { logs } });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [logs, storageReady]);

  useEffect(() => {
    if (!storageReady) return;

    const xdrItems = logs
      .filter((log) => log.message.startsWith("XDR: ") && !log.decodedData)
      .map((log) => ({ id: log.id, xdr: log.message.replace("XDR: ", "") }));

    if (xdrItems.length === 0) return;

    batchDecode("initial-batch", xdrItems)
      .then((results) => {
        const decodedMap = new Map<string, XdrFields>();
        for (const result of results) {
          if (result.status === "ERROR" || !result.decoded_payload) continue;
          decodedMap.set(result.id, result.decoded_payload);
        }
        setLogs((currentLogs) => mergeDecodedLogs(currentLogs, decodedMap));
      })
      .catch(() => {
        // XDR decode errors are already surfaced by the hook.
      });
  }, [batchDecode, logs, storageReady]);

  const activeLogs = storageReady ? logs : MOCK_LOGS;

  const filteredResults = useMemo<FilteredLogResult[]>(() => {
    const normalizedQuery = searchQuery.trim();
    const matchedLogs = activeLogs
      .filter((log) => matchesSeverity(log, filter))
      .filter((log) => includesQuery(log, normalizedQuery));

    return matchedLogs.map((log) => ({
      item: log,
      matches: buildMatches(log, normalizedQuery),
    }));
  }, [logs, storageReady, filter, searchQuery]);

  useEffect(() => {
    if (!storageReady) return;

    const timer = window.setTimeout(() => {
      if (!workerRef.current) return;
      const currentLogs = storageReady ? logs : MOCK_LOGS;
      setIsSearching(Boolean(searchQuery.trim()));
      workerRef.current.postMessage({
        type: "SEARCH",
        payload: { query: searchQuery, logs: currentLogs },
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [logs, searchQuery, storageReady]);

  const rowVirtualizer = useVirtualizer({
    count: filteredResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const exportCsv = () => {
    const headers = ["Timestamp", "Type", "Severity", "Message", "Actor", "Hash"];
    const csv = [
      headers.join(","),
      ...filteredResults.map(({ item }) =>
        [
          item.timestamp,
          item.type,
          item.severity,
          `"${item.message.replace(/"/g, '""')}"`,
          item.actor,
          item.txHash ?? "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.hidden = true;
    anchor.href = url;
    anchor.download = `stellarflow_logs_${new Date().toISOString().split("T")[0]}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.URL.revokeObjectURL(url);
  };

  const displayedCount = filteredResults.length;

  if (!mounted || !storageReady) {
    return <LogsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-gray-100">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-sm text-gray-500">Admin / Audit</p>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        </div>

        <div className="flex items-center gap-3">
          {xdrDecoding && (
            <div className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 animate-pulse">
              <Icon id={ICON_IDS.cpu} size={13} className="text-purple-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-purple-300">
                Decoding XDR…
              </span>
            </div>
          )}

          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#161b22] px-4 py-2 text-sm text-gray-300 transition-all hover:bg-gray-800"
          >
            <Icon id={ICON_IDS.download} size={16} />
            Export CSV
          </button>

          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700">
            <Icon id={ICON_IDS.terminal} size={16} />
            Live Console
          </button>
        </div>
      </div>

      {/* --- Filter & Search Bar --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Icon id={ICON_IDS.search} size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-blue-500 animate-pulse' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Filter logs by message, actor, or hash..."
            value={searchQuery}
            onChange={(e) => throttledSetSearchQuery(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <Icon id={ICON_IDS.filter} size={18} className="text-gray-500" />
          <select 
            className="bg-[#0d1117] border border-gray-700 rounded-md py-2 px-4 text-sm focus:outline-none"
            value={filter}
            onChange={(e) => throttledSetFilter(e.target.value as any)}
          >
            <option value="all">All Severities</option>
            <option value="info">Info Only</option>
            <option value="warning">Warnings</option>
            <option value="critical">Critical Errors</option>
          </select>
        </div>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl border border-gray-800 bg-[#161b22]">
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 bg-yellow-500/90 px-4 py-1.5 text-xs font-bold text-black"
            >
              <Icon id={ICON_IDS.wifiOff} size={14} />
              Operating in Offline Mode — cached data is being shown
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] border-b border-gray-800 bg-[#0d1117]/80 text-[10px] uppercase tracking-wider text-gray-500 backdrop-blur-md">
          <div className="px-6 py-4 font-medium">Timestamp</div>
          <div className="px-6 py-4 font-medium">Type</div>
          <div className="px-6 py-4 font-medium">Severity</div>
          <div className="px-6 py-4 font-medium">Event Message</div>
          <div className="px-6 py-4 font-medium">Actor</div>
          <div className="px-6 py-4 text-right font-medium">Reference</div>
        </div>

        {displayedCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center text-gray-500">
            <Icon id={ICON_IDS.search} size={32} className="opacity-20" />
            <p>No logs matching “{searchQuery}”</p>
          </div>
        ) : (
          <div ref={parentRef} className="max-h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-gray-700">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const result = filteredResults[virtualRow.index];
                const log = result.item;
                const matches = result.matches ?? [];

                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] items-center border-b border-gray-800/50 font-mono text-[13px] transition-colors hover:bg-[#1c2128]"
                  >
                    <div className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {log.timestamp}
                    </div>

                    <div className="px-6 py-4">
                      <span className="flex items-center gap-2 text-gray-200">
                        {log.type === "transaction" && (
                          <Icon id={ICON_IDS.database} size={14} className="text-blue-400" />
                        )}
                        {log.type === "security" && (
                          <Icon id={ICON_IDS.shieldAlert} size={14} className="text-red-400" />
                        )}
                        {log.type === "system" && (
                          <Icon id={ICON_IDS.fileText} size={14} className="text-gray-400" />
                        )}
                        <span className="capitalize">{log.type}</span>
                      </span>
                    </div>

                    <div className="px-6 py-4">
                      <SeverityIndicator severity={log.severity} />
                    </div>

                    <div className="px-6 py-4 text-gray-200">
                      {log.decodedData ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                            Decoded XDR
                          </span>
                          <span className="font-mono text-xs text-green-400">
                            {JSON.stringify(log.decodedData)}
                          </span>
                        </div>
                      ) : (
                        <SearchHighlight
                          text={log.message}
                          matches={matches.find((match) => match.key === "message")?.indices}
                        />
                      )}
                    </div>

                    <div className="px-6 py-4 text-gray-400">
                      <SearchHighlight
                        text={log.actor}
                        matches={matches.find((match) => match.key === "actor")?.indices}
                      />
                    </div>

                    <div className="px-6 py-4 text-right">
                      {log.txHash ? (
                        <button className="group/hash ml-auto flex items-center justify-end gap-1 text-blue-500 hover:text-blue-400">
                          <span className="text-xs uppercase group-hover/hash:underline">
                            <SearchHighlight
                              text={log.txHash}
                              matches={matches.find((match) => match.key === "txHash")?.indices}
                            />
                          </span>
                          <Icon id={ICON_IDS.externalLink} size={12} />
                        </button>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-800 p-4 text-sm text-gray-500">
          <span>
            Showing {displayedCount} of {activeLogs.length} entries
          </span>

          <div className="flex gap-2">
            <button className="rounded-md border border-gray-700 p-2 opacity-50" disabled>
              <Icon id={ICON_IDS.chevronLeft} size={16} />
            </button>
            <button className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-gray-800">
              <Icon id={ICON_IDS.chevronRight} size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchHighlight({
  text,
  matches,
}: {
  text: string;
  matches?: readonly (readonly [number, number])[];
}) {
  const parts = useMemo<HighlightPart[]>(() => buildHighlightedParts(text, matches as [number, number][] | undefined), [text, matches]);

  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {parts.map((part, index) =>
        part.type === "text" ? (
          <React.Fragment key={`${index}-text`}>{part.text}</React.Fragment>
        ) : (
          <mark
            key={`${index}-match`}
            className="rounded-sm border-b border-[#CBF34D]/50 bg-[#CBF34D]/30 px-0.5 text-[#CBF34D] no-underline"
          >
            {part.text}
          </mark>
        ),
      )}
    </span>
  );
}

function SeverityIndicator({ severity }: { severity: LogEntry["severity"] }) {
  const styles = {
    info: "text-blue-400 bg-blue-400/10",
    warning: "text-yellow-500 bg-yellow-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  return (
    <div className={`flex w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 ${styles[severity]}`}>
      <div
        className={`h-1.5 w-1.5 rounded-full fill-current ${severity === "critical" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: "currentColor" }}
      />
      <span className="text-[11px] font-bold uppercase">{severity}</span>
    </div>
  );
}
