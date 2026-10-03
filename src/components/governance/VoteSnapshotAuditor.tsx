'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Coins, ExternalLink, Info, Loader2, Users } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoteSnapshot {
  address: string;
  ledger: number;
  /** Tokens owned outright at the snapshot ledger. */
  owned: number;
  /** Voting power delegated in from other accounts at the snapshot ledger. */
  delegated: number;
  /** owned + delegated. */
  total: number;
}

export interface VoteSnapshotAuditorProps {
  /** Account whose historical voting power should be audited. */
  address: string;
  /** Ledger height recorded as the proposal's voting-power snapshot. */
  snapshotLedger: number;
  /** Stellar network, used for the StellarExpert verification link. */
  network?: string;
  /**
   * Base URL of the indexer / API that serves historical voting power.
   * Defaults to `NEXT_PUBLIC_API_URL`; when neither is set the component
   * degrades to a "no indexer configured" notice instead of fetching.
   */
  indexerUrl?: string;
  className?: string;
}

const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** StellarExpert URL for a specific ledger header, used to verify a snapshot. */
export function explorerLedgerUrl(network: string, ledger: number): string {
  const segment = network === 'mainnet' || network === 'public' ? 'public' : network || 'testnet';
  return `https://stellar.expert/explorer/${segment}/ledger/${ledger}`;
}

/** Owned + delegated voting power, guarding against negative/garbage values. */
export function computeVotingPowerBreakdown(input: {
  owned?: number | null;
  delegated?: number | null;
}): { owned: number; delegated: number; total: number } {
  const owned = Math.max(0, Number(input.owned ?? 0) || 0);
  const delegated = Math.max(0, Number(input.delegated ?? 0) || 0);
  return { owned, delegated, total: owned + delegated };
}

export function hasVotingPower(snapshot: { total: number }): boolean {
  return Number(snapshot.total) > 0;
}

export function formatVotingPower(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

async function fetchVoteSnapshot(
  address: string,
  ledger: number,
  indexerUrl: string,
): Promise<VoteSnapshot> {
  const base = indexerUrl.replace(/\/+$/, '');
  const res = await fetch(
    `${base}/governance/voting-power?address=${encodeURIComponent(address)}&ledger=${ledger}`,
    { headers: { accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`Indexer responded with ${res.status}`);
  }

  const data = (await res.json()) as {
    owned?: number;
    ownedTokens?: number;
    delegated?: number;
    delegatedTokens?: number;
    total?: number;
  };
  const breakdown = computeVotingPowerBreakdown({
    owned: data.owned ?? data.ownedTokens,
    delegated: data.delegated ?? data.delegatedTokens,
  });

  return {
    address,
    ledger,
    ...breakdown,
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : breakdown.total,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoteSnapshotAuditor({
  address,
  snapshotLedger,
  network = DEFAULT_NETWORK,
  indexerUrl,
  className,
}: VoteSnapshotAuditorProps) {
  const baseUrl = indexerUrl ?? process.env.NEXT_PUBLIC_API_URL;
  const [snapshot, setSnapshot] = useState<VoteSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!baseUrl) {
      setSnapshot(null);
      setStatus('ready');
      return () => {
        cancelled = true;
      };
    }

    setStatus('loading');
    setError(null);

    fetchVoteSnapshot(address, snapshotLedger, baseUrl)
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [address, snapshotLedger, baseUrl, reloadKey]);

  const explorerUrl = explorerLedgerUrl(network, snapshotLedger);

  return (
    <section
      className={className}
      aria-label="Vote snapshot auditor"
      data-testid="vote-snapshot-auditor"
    >
      <header className="mb-3">
        <h3 className="text-base font-semibold text-white">Voting power snapshot</h3>
        <p className="text-xs text-slate-400">
          Historical vote weight for <span className="font-mono">{address}</span> at ledger{' '}
          {snapshotLedger}.
        </p>
      </header>

      {status === 'loading' && (
        <div
          role="status"
          data-testid="snapshot-loading"
          className="flex items-center gap-2 text-sm text-slate-300"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading historical voting power…
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          data-testid="snapshot-error"
          className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-100"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span>Could not load snapshot: {error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-2 rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && !snapshot && (
        <p data-testid="snapshot-unavailable" className="text-sm text-slate-400">
          No indexer is configured, so historical voting power is unavailable. Set{' '}
          <code>NEXT_PUBLIC_API_URL</code> to enable this audit.
        </p>
      )}

      {status === 'ready' && snapshot && (
        <div data-testid="snapshot-result">
          {hasVotingPower(snapshot) ? (
            <dl data-testid="snapshot-breakdown" className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Coins className="h-3.5 w-3.5" aria-hidden="true" /> Owned
                </dt>
                <dd className="text-lg font-semibold text-white" data-testid="snapshot-owned">
                  {formatVotingPower(snapshot.owned)}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> Delegated in
                </dt>
                <dd className="text-lg font-semibold text-white" data-testid="snapshot-delegated">
                  {formatVotingPower(snapshot.delegated)}
                </dd>
              </div>
              <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3">
                <dt className="text-xs text-cyan-100">Total vote weight</dt>
                <dd className="text-lg font-semibold text-cyan-50" data-testid="snapshot-total">
                  {formatVotingPower(snapshot.total)}
                </dd>
              </div>
            </dl>
          ) : (
            <div
              data-testid="snapshot-zero"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This address had <strong>0 voting power</strong> at ledger {snapshotLedger}, so it
                was not eligible to vote on this proposal. Voting power is fixed at the snapshot
                ledger — tokens acquired or delegated afterwards do not count.
              </span>
            </div>
          )}
        </div>
      )}

      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="snapshot-explorer-link"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200"
      >
        Verify ledger {snapshotLedger} on StellarExpert
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}

export default VoteSnapshotAuditor;
