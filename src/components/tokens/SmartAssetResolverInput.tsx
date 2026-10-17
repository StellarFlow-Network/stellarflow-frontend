"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { fetchTokenMetadata } from "@/lib/customTokens";
import { resolveStellarDomainAsset } from "@/lib/stellarToml";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatTokenAmount } from "@/utils/formatters";
import type { TokenOption } from "@/components/swap/SwapForm";

interface SmartAssetResolverInputProps {
  tokens: TokenOption[];
  onSelect: (token: TokenOption) => void;
  selectedAddress?: string;
  disabledAddress?: string;
  balances?: Record<string, string>;
}

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const DOMAIN_PATTERN = /^(?:https:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/)?$/i;

export function SmartAssetResolverInput({
  tokens,
  onSelect,
  selectedAddress,
  disabledAddress,
  balances,
}: SmartAssetResolverInputProps) {
  const [query, setQuery] = useState("");
  const [resolvedToken, setResolvedToken] = useState<TokenOption | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fuse = useMemo(
    () => new Fuse(tokens, { keys: ["symbol", "name"], threshold: 0.35, ignoreLocation: true }),
    [tokens],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return tokens;
    const lowered = trimmed.toLowerCase();
    const addressMatches = tokens.filter((token) => token.address.toLowerCase().includes(lowered));
    const fuzzyMatches = fuse.search(trimmed).map(({ item }) => item);
    const seen = new Set<string>();
    return [...addressMatches, ...fuzzyMatches].filter((token) => {
      if (seen.has(token.address)) return false;
      seen.add(token.address);
      return true;
    });
  }, [fuse, query, tokens]);

  useEffect(() => {
    const value = query.trim();
    const currentRequest = ++requestId.current;
    setResolvedToken(null);
    setResolutionError(null);

    if (!value || results.some((token) => token.address.toLowerCase() === value.toLowerCase())) {
      setIsResolving(false);
      return;
    }

    const isContractId = CONTRACT_ID_PATTERN.test(value);
    const isDomain = DOMAIN_PATTERN.test(value);
    if (!isContractId && !isDomain) {
      setIsResolving(false);
      return;
    }

    const controller = new AbortController();
    setIsResolving(true);
    const timer = window.setTimeout(async () => {
      try {
        const metadata = isDomain
          ? await resolveStellarDomainAsset(value, controller.signal)
          : await fetchTokenMetadata({ mode: "contract", contractId: value });
        if (controller.signal.aborted || currentRequest !== requestId.current) return;
        setResolvedToken({
          symbol: metadata.symbol,
          name: metadata.name,
          address: metadata.contractId,
          decimals: metadata.decimals,
          ...("iconUrl" in metadata ? { iconUrl: metadata.iconUrl } : {}),
        });
      } catch (error) {
        if (controller.signal.aborted || currentRequest !== requestId.current) return;
        setResolutionError(error instanceof Error ? error.message : "Could not resolve this asset.");
      } finally {
        if (!controller.signal.aborted && currentRequest === requestId.current) {
          setIsResolving(false);
        }
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, results]);

  const selectable = resolvedToken && !results.some(
    (token) => token.address === resolvedToken.address,
  ) ? [...results, resolvedToken] : results;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol, domain, or contract address"
          className="w-full rounded-lg border border-gray-700 bg-[#0d1117] py-2.5 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
          aria-label="Search tokens, domains, or contract addresses"
          autoFocus
        />
      </div>

      {isResolving && (
        <p className="text-xs text-blue-300" role="status">Resolving Stellar asset metadata…</p>
      )}
      {resolutionError && (
        <p className="text-xs text-rose-400" role="alert">{resolutionError}</p>
      )}

      <div className="max-h-80 space-y-1 overflow-y-auto" role="listbox" aria-label="Token results">
        {selectable.length === 0 && !isResolving && !resolutionError && query.trim() && (
          <p className="py-4 text-center text-sm text-gray-400">
            <span className="mb-1 block font-semibold text-amber-400">Unverified asset symbol</span>
            Search by contract address or domain to verify token metadata.
          </p>
        )}

        {selectable.map((token) => {
          const isResolved = token === resolvedToken;
          const isDisabled = token.address === disabledAddress;
          const isSelected = token.address === selectedAddress;
          const balance = balances?.[token.address];
          return (
            <button
              key={token.address}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={isDisabled}
              onClick={() => onSelect(token)}
              title={isDisabled ? "Already selected on the other side of this swap" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isDisabled
                  ? "cursor-not-allowed opacity-40"
                  : isSelected ? "bg-blue-500/10" : "hover:bg-gray-800"
              }`}
            >
              <TokenIcon src={token.iconUrl} symbol={token.symbol} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-100">{token.symbol}</p>
                <p className="truncate text-xs text-gray-500">{token.name}</p>
              </div>
              {isResolved && (
                <span className="shrink-0 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                  Unverified
                </span>
              )}
              {balance !== undefined && (
                <span className="shrink-0 font-mono text-xs text-gray-400">
                  {formatTokenAmount(balance)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SmartAssetResolverInput;
