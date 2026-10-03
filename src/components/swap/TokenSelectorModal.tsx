"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatTokenAmount } from "@/utils/formatters";
import type { TokenOption } from "./SwapForm";

export interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenOption[];
  onSelect: (token: TokenOption) => void;
  /** Address of the token currently selected in this field, highlighted in the list. */
  selectedAddress?: string;
  /** Address already chosen on the opposite side of the swap; shown disabled so it can't be picked twice. */
  disabledAddress?: string;
  /** Balances keyed by token address, rendered next to each row when available. */
  balances?: Record<string, string>;
}

function matchesAddress(token: TokenOption, query: string): boolean {
  return token.address.toLowerCase().includes(query);
}

export function TokenSelectorModal({
  isOpen,
  onClose,
  tokens,
  onSelect,
  selectedAddress,
  disabledAddress,
  balances,
}: TokenSelectorModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // Autofocus once the dialog has mounted into the DOM.
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  const fuse = useMemo(
    () =>
      new Fuse(tokens, {
        keys: ["symbol", "name"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [tokens],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return tokens;

    const lowered = trimmed.toLowerCase();
    const addressMatches = tokens.filter((token) => matchesAddress(token, lowered));
    const fuzzyMatches = fuse.search(trimmed).map(({ item }) => item);

    const seen = new Set<string>();
    const merged: TokenOption[] = [];
    for (const token of [...addressMatches, ...fuzzyMatches]) {
      if (!seen.has(token.address)) {
        seen.add(token.address);
        merged.push(token);
      }
    }
    return merged;
  }, [query, tokens, fuse]);

  const handleSelect = (token: TokenOption) => {
    if (token.address === disabledAddress) return;
    onSelect(token);
    onClose();
  };

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Select a token" size="sm">
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by symbol, name, or contract address"
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] py-2.5 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
            aria-label="Search tokens"
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto" role="listbox" aria-label="Token results">
          {results.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              No tokens found for &ldquo;{query}&rdquo;
            </p>
          )}

          {results.map((token) => {
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
                onClick={() => handleSelect(token)}
                title={isDisabled ? "Already selected on the other side of this swap" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : isSelected
                      ? "bg-blue-500/10"
                      : "hover:bg-gray-800"
                }`}
              >
                <TokenIcon src={token.iconUrl} symbol={token.symbol} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-100">{token.symbol}</p>
                  <p className="truncate text-xs text-gray-500">{token.name}</p>
                </div>
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
    </OptimizedDialog>
  );
}

export default TokenSelectorModal;
