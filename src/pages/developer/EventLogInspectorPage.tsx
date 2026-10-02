'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, Check, ChevronDown, ChevronRight, Clock3, Copy, Database, LoaderCircle, Radio, Search, Square, Wifi } from 'lucide-react';
import { NETWORK_CONFIGS, useOptionalNetwork } from '@/app/components/providers/NetworkProvider';

type RpcEvent = {
  id?: string;
  type?: string;
  ledger?: number;
  ledgerClosedAt?: string;
  contractId?: string;
  topic?: string[];
  value?: string;
  inSuccessfulContractCall?: boolean;
  pagingToken?: string;
  [key: string]: unknown;
};

type InspectedEvent = {
  event: RpcEvent;
  decoded: { topics: unknown[]; value: unknown };
  rawXdr: string;
};

type RpcResponse<T> = { jsonrpc?: string; id?: number; result?: T; error?: { code?: number; message?: string; data?: unknown } };

const POLL_INTERVAL_MS = 4_000;
const MAX_EVENTS = 500;

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (value instanceof Map) return Object.fromEntries(Array.from(value, ([key, nested]) => [String(jsonSafe(key)), jsonSafe(nested)]));
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, jsonSafe(nested)]));
  }
  return value;
}

async function decodeScVal(encoded: string): Promise<unknown> {
  try {
    const { xdr, scValToNative } = await import('@stellar/stellar-sdk');
    return jsonSafe(scValToNative(xdr.ScVal.fromXDR(encoded, 'base64')));
  } catch {
    return encoded;
  }
}

async function inspectEvent(event: RpcEvent): Promise<InspectedEvent> {
  const topics = Array.isArray(event.topic) ? event.topic : [];
  const [decodedTopics, decodedValue] = await Promise.all([
    Promise.all(topics.map(decodeScVal)),
    typeof event.value === 'string' ? decodeScVal(event.value) : Promise.resolve(event.value ?? null),
  ]);
  const rawXdr = JSON.stringify({ topics, value: event.value ?? null }, null, 2);
  return { event, decoded: { topics: decodedTopics, value: decodedValue }, rawXdr };
}

function JsonValue({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-[#090d13] p-4 text-xs leading-6 text-cyan-100">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

export default function EventLogInspectorPage() {
  const networkContext = useOptionalNetwork();
  const network = networkContext?.network ?? 'testnet';
  const rpcUrl = networkContext?.sorobanUrl ?? NETWORK_CONFIGS[network].sorobanRpcUrl;
  const [contractId, setContractId] = useState('');
  const [topicHash, setTopicHash] = useState('');
  const [startLedger, setStartLedger] = useState('');
  const [endLedger, setEndLedger] = useState('');
  const [events, setEvents] = useState<InspectedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamState, setStreamState] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestId = useRef(0);
  const eventIds = useRef(new Set<string>());

  const filters = useMemo(() => ({ contractId: contractId.trim(), topicHash: topicHash.trim() }), [contractId, topicHash]);

  const rpcCall = useCallback(async <T,>(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Soroban RPC returned HTTP ${response.status}.`);
    const payload = await response.json() as RpcResponse<T>;
    if (payload.error) throw new Error(payload.error.message ?? `Soroban RPC error ${payload.error.code ?? ''}`.trim());
    if (!payload.result) throw new Error('Soroban RPC returned an empty response.');
    return payload.result;
  }, [rpcUrl]);

  const buildFilters = useCallback(() => {
    const filter: { type: 'contract'; contractIds?: string[]; topics?: string[][] } = { type: 'contract' };
    if (filters.contractId) filter.contractIds = [filters.contractId];
    if (filters.topicHash) filter.topics = [[filters.topicHash]];
    return [filter];
  }, [filters]);

  const addEvents = useCallback(async (incoming: RpcEvent[], mode: 'replace' | 'append') => {
    const unique = incoming.filter((event, index) => {
      const key = event.id ?? event.pagingToken ?? `${event.ledger}-${event.contractId}-${index}-${JSON.stringify(event.topic)}`;
      if (eventIds.current.has(key)) return false;
      eventIds.current.add(key);
      return true;
    });
    const inspected = await Promise.all(unique.map(inspectEvent));
    setEvents((current) => {
      const combined = mode === 'replace' ? inspected : [...inspected.reverse(), ...current];
      return combined.slice(0, MAX_EVENTS);
    });
    setLastUpdated(new Date());
    return inspected.length;
  }, []);

  const queryEvents = useCallback(async () => {
    setError(null);
    setNotice(null);
    const start = Number(startLedger);
    const end = endLedger ? Number(endLedger) : undefined;
    if (!Number.isSafeInteger(start) || start < 1) {
      setError('Enter a valid start ledger greater than zero.');
      return;
    }
    if (end !== undefined && (!Number.isSafeInteger(end) || end < start)) {
      setError('End ledger must be a valid number equal to or greater than the start ledger.');
      return;
    }
    if (filters.contractId && !/^C[A-Z2-7]{55}$/.test(filters.contractId)) {
      setError('Contract ID must be a valid Stellar contract address (C…).');
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const result = await rpcCall<{ events?: RpcEvent[]; latestLedger?: number; cursor?: string }>('getEvents', {
        startLedger: start,
        ...(end !== undefined ? { endLedger: end } : {}),
        filters: buildFilters(),
        pagination: { limit: 1000 },
        xdrFormat: 'base64',
      });
      if (requestId.current !== currentRequest) return;
      eventIds.current.clear();
      const count = await addEvents(result.events ?? [], 'replace');
      setNotice(`${count.toLocaleString()} event${count === 1 ? '' : 's'} loaded${result.latestLedger ? ` · latest ledger ${result.latestLedger.toLocaleString()}` : ''}.`);
      if (!result.events?.length) setNotice('No contract events matched this query.');
    } catch (cause) {
      if (requestId.current === currentRequest) setError(cause instanceof Error ? cause.message : 'Unable to query contract events.');
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [addEvents, buildFilters, endLedger, filters.contractId, rpcCall, startLedger]);

  const useRecentRange = useCallback(async () => {
    setError(null);
    try {
      const latest = await rpcCall<{ sequence: number }>('getLatestLedger', {});
      const end = latest.sequence;
      setStartLedger(String(Math.max(1, end - 99)));
      setEndLedger(String(end));
      setNotice(`Selected the latest 100 ledgers, ending at ${end.toLocaleString()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read the latest ledger.');
    }
  }, [rpcCall]);

  useEffect(() => {
    if (!streaming) {
      setStreamState('idle');
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    let busy = false;
    let nextLedger = 0;
    setStreamState('connecting');
    setError(null);

    const poll = async () => {
      if (cancelled || busy) return;
      busy = true;
      try {
        const latest = await rpcCall<{ sequence: number }>('getLatestLedger', {}, controller.signal);
        if (!nextLedger) {
          nextLedger = Math.max(0, latest.sequence - 1);
          if (!cancelled) setStreamState('live');
        }
        if (latest.sequence < nextLedger) nextLedger = latest.sequence;
        if (latest.sequence >= nextLedger + 1) {
          const result = await rpcCall<{ events?: RpcEvent[] }>('getEvents', {
            startLedger: nextLedger + 1,
            endLedger: latest.sequence,
            filters: buildFilters(),
            pagination: { limit: 1000 },
            xdrFormat: 'base64',
          }, controller.signal);
          if (!cancelled) {
            const count = await addEvents(result.events ?? [], 'append');
            nextLedger = latest.sequence;
            setStreamState('live');
            if (count) setNotice(`${count} new event${count === 1 ? '' : 's'} received · ledger ${latest.sequence.toLocaleString()}.`);
          }
        }
      } catch (cause) {
        if (!cancelled && !controller.signal.aborted) {
          setStreamState('error');
          setError(cause instanceof Error ? cause.message : 'Live event polling failed.');
        }
      } finally {
        busy = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [addEvents, buildFilters, rpcCall, streaming]);

  const toggleStreaming = () => {
    setError(null);
    setNotice(null);
    setStreaming((active) => !active);
  };

  const copyRawXdr = async (item: InspectedEvent) => {
    try {
      await navigator.clipboard.writeText(item.rawXdr);
      setCopiedId(item.event.id ?? item.event.pagingToken ?? null);
      setNotice('Raw event XDR copied to clipboard.');
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError('Clipboard access is unavailable. Use a secure browser context and try again.');
    }
  };

  const statusText = streamState === 'live' ? 'Live · polling ledger events' : streamState === 'connecting' ? 'Connecting to Soroban RPC' : streamState === 'error' ? 'Stream interrupted · retrying' : 'Stream paused';

  return (
    <main className="min-h-screen bg-[#0b0e13] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400"><Database size={14} /> Developer Tools <span className="text-slate-600">/</span> Soroban</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Event log inspector</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Query contract events by ledger, contract, or topic. Inspect decoded payloads alongside the original base64 XDR.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{network === 'mainnet' ? 'Mainnet' : 'Testnet'} RPC</span>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-[#11161e] p-5 shadow-xl shadow-black/10 sm:p-6" aria-labelledby="query-heading">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div><h2 id="query-heading" className="text-lg font-semibold">Event query</h2><p className="mt-1 text-sm text-slate-400">Narrow results using any combination of filters.</p></div>
            <button type="button" onClick={useRecentRange} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-700 hover:text-cyan-300">Use latest 100 ledgers</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-xs font-medium text-slate-300"><span>Contract ID <span className="font-normal text-slate-500">(optional)</span></span><input value={contractId} onChange={(event) => setContractId(event.target.value)} placeholder="C…" autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-slate-700 bg-[#0b0f15] px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15" /></label>
            <label className="space-y-2 text-xs font-medium text-slate-300"><span>Event topic hash <span className="font-normal text-slate-500">(optional)</span></span><input value={topicHash} onChange={(event) => setTopicHash(event.target.value)} placeholder="Base64-encoded XDR topic" autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-slate-700 bg-[#0b0f15] px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15" /><span className="block text-[11px] leading-4 text-slate-500">Matches the first topic position; paste its base64 XDR value.</span></label>
            <label className="space-y-2 text-xs font-medium text-slate-300"><span>Start ledger <span className="text-rose-400">*</span></span><input inputMode="numeric" value={startLedger} onChange={(event) => setStartLedger(event.target.value)} placeholder="e.g. 52,000,000" className="w-full rounded-lg border border-slate-700 bg-[#0b0f15] px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15" /></label>
            <label className="space-y-2 text-xs font-medium text-slate-300"><span>End ledger <span className="font-normal text-slate-500">(optional)</span></span><input inputMode="numeric" value={endLedger} onChange={(event) => setEndLedger(event.target.value)} placeholder="Latest available" className="w-full rounded-lg border border-slate-700 bg-[#0b0f15] px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15" /></label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-5">
            <button type="button" onClick={queryEvents} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}{loading ? 'Querying events…' : 'Query events'}</button>
            <button type="button" onClick={toggleStreaming} aria-pressed={streaming} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${streaming ? 'border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-950/70' : 'border-emerald-800 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60'}`}>{streaming ? <Square size={14} /> : <Radio size={16} />}{streaming ? 'Stop live stream' : 'Start live stream'}</button>
            <p className="ml-auto max-w-full truncate text-xs text-slate-500" title={rpcUrl}>Endpoint: {rpcUrl}</p>
          </div>
          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-300"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
          {notice && !error && <p role="status" className="mt-4 text-sm text-slate-400">{notice}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#11161e]" aria-labelledby="events-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
            <div><h2 id="events-heading" className="text-lg font-semibold">Contract events <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 align-middle text-xs font-medium text-slate-300">{events.length}{events.length === MAX_EVENTS ? '+' : ''}</span></h2><p className="mt-1 text-xs text-slate-500">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Results appear here after a query or when live streaming starts.'}</p></div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${streaming && streamState === 'live' ? 'border-emerald-900 bg-emerald-950/30 text-emerald-300' : streamState === 'error' ? 'border-rose-900 bg-rose-950/30 text-rose-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${streaming && streamState === 'live' ? 'animate-pulse bg-emerald-400' : streamState === 'error' ? 'bg-rose-400' : 'bg-slate-500'}`} />{statusText}</div>
          </div>
          {events.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Activity size={26} className="mb-3 text-slate-600" /><p className="text-sm font-medium text-slate-300">No events to display</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">Set a start ledger and run a query, or enable live streaming to watch new contract events as ledgers close.</p></div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {events.map((item, index) => {
                const id = item.event.id ?? item.event.pagingToken ?? `${item.event.ledger}-${index}`;
                const expanded = expandedId === id;
                return <article key={id} className="transition-colors hover:bg-white/[0.015]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                    <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} event details`} onClick={() => setExpandedId(expanded ? null : id)} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-cyan-950/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">{item.event.type ?? 'contract'}</span><span className="font-mono text-xs text-slate-400">Ledger {item.event.ledger?.toLocaleString() ?? '—'}</span>{item.event.inSuccessfulContractCall === false && <span className="rounded bg-amber-950/50 px-2 py-0.5 text-[10px] text-amber-300">Unsuccessful call</span>}</div><p className="mt-1 truncate font-mono text-xs text-slate-500" title={item.event.contractId}>{item.event.contractId ?? item.event.id ?? 'Unknown contract'}</p></div>
                    <div className="flex items-center gap-3 text-xs text-slate-500"><span className="hidden items-center gap-1 sm:inline-flex"><Clock3 size={13} />{item.event.ledgerClosedAt ? new Date(item.event.ledgerClosedAt).toLocaleTimeString() : '—'}</span><button type="button" onClick={() => void copyRawXdr(item)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-cyan-700 hover:text-cyan-300">{copiedId === id ? <Check size={13} /> : <Copy size={13} />}{copiedId === id ? 'Copied' : 'Copy raw XDR'}</button></div>
                  </div>
                  {expanded && <div className="grid gap-4 px-5 pb-5 pl-14 sm:grid-cols-2 sm:px-6 sm:pl-[4.5rem]"><div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decoded payload</h3><span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Wifi size={11} /> ScVal JSON</span></div><JsonValue value={item.decoded} /></div><div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Raw XDR (base64)</h3></div><JsonValue value={JSON.parse(item.rawXdr) as unknown} /></div></div>}
                </article>;
              })}
            </div>
          )}
        </section>
        <p className="text-center text-[11px] leading-5 text-slate-600">Live updates poll the selected Soroban RPC every {POLL_INTERVAL_MS / 1000} seconds. RPC event history is retention-limited by the network operator.</p>
      </div>
    </main>
  );
}