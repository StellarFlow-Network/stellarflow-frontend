"use client";

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { Search, BadgeCheck, X, Check, PlusCircle } from "lucide-react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatTokenAmount } from "@/utils/formatters";
import { getCustomTokens } from "@/lib/customTokens";
import type { TokenOption as SwapTokenOption } from "./SwapForm";

export type TokenOption = SwapTokenOption;

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
  /** Optional custom token addresses or collection to mark tokens as custom. */
  customTokenAddresses?: Set<string> | string[];
  /** Optional callback fired when the user clicks the custom token import button. */
  onOpenImportModal?: () => void;
}

type FilterTab = "all" | "verified" | "custom";

function truncateAddress(address: string): string {
  if (!address || address.toLowerCase() === "native") return "Native";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TokenSelectorModal({
  isOpen,
  onClose,
  tokens,
  onSelect,
  selectedAddress,
  disabledAddress,
  balances,
  customTokenAddresses,
  onOpenImportModal,
}: TokenSelectorModalProps) {
  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [importedSet, setImportedSet] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Sync custom tokens from localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setFilterTab("all");
      try {
        const stored = getCustomTokens();
        if (stored && stored.length > 0) {
          setImportedSet(new Set(stored.map((t) => t.contractId.toLowerCase())));
        } else {
          setImportedSet(new Set());
        }
      } catch {
        setImportedSet(new Set());
      }

      // Autofocus search input on open
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  // Set of custom addresses passed via props
  const propCustomSet = useMemo(() => {
    if (!customTokenAddresses) return null;
    if (customTokenAddresses instanceof Set) {
      return new Set(Array.from(customTokenAddresses).map((a) => a.toLowerCase()));
    }
    return new Set(customTokenAddresses.map((a) => a.toLowerCase()));
  }, [customTokenAddresses]);

  // Helper to determine if a token is a custom import
  const checkIsCustom = useCallback(
    (token: TokenOption): boolean => {
      if (token.isCustom) return true;
      if (token.tags?.some((t) => t.toLowerCase() === "custom" || t.toLowerCase() === "imported")) {
        return true;
      }
      const addrLower = token.address.toLowerCase();
      if (propCustomSet?.has(addrLower)) return true;
      if (importedSet.has(addrLower)) return true;
      return false;
    },
    [propCustomSet, importedSet],
  );

  // Helper to determine if a token is verified
  const checkIsVerified = useCallback(
    (token: TokenOption): boolean => {
      if (token.verified !== undefined) return Boolean(token.verified);
      if (token.tags?.some((t) => t.toLowerCase() === "verified")) return true;
      if (checkIsCustom(token)) return false;
      const addrLower = token.address.toLowerCase();
      const symUpper = token.symbol.toUpperCase();
      // Native XLM is always protocol-verified
      if (addrLower === "native" || symUpper === "XLM") return true;
      return false;
    },
    [checkIsCustom],
  );

  // Fuse instance for fallback fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(tokens, {
        keys: [
          { name: "symbol", weight: 0.6 },
          { name: "name", weight: 0.3 },
          { name: "address", weight: 0.1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [tokens],
  );

  // Defer query updates so typing remains buttery-smooth even with 1,000+ assets
  const deferredQuery = useDeferredValue(query);

  // Filter and rank tokens instantly
  const results = useMemo(() => {
    let baseList = tokens;

    // Apply quick category tab filter
    if (filterTab === "verified") {
      baseList = baseList.filter((t) => checkIsVerified(t));
    } else if (filterTab === "custom") {
      baseList = baseList.filter((t) => checkIsCustom(t));
    }

    const trimmed = deferredQuery.trim();
    if (!trimmed) return baseList;

    const lowered = trimmed.toLowerCase();

    // Fast-path ranked categorization
    const exactSymbol: TokenOption[] = [];
    const symbolStarts: TokenOption[] = [];
    const symbolContains: TokenOption[] = [];
    const nameStarts: TokenOption[] = [];
    const nameContains: TokenOption[] = [];
    const addressContains: TokenOption[] = [];

    for (const token of baseList) {
      const sym = token.symbol.toLowerCase();
      const nm = token.name.toLowerCase();
      const addr = token.address.toLowerCase();

      if (sym === lowered) {
        exactSymbol.push(token);
      } else if (sym.startsWith(lowered)) {
        symbolStarts.push(token);
      } else if (sym.includes(lowered)) {
        symbolContains.push(token);
      } else if (nm.startsWith(lowered)) {
        nameStarts.push(token);
      } else if (nm.includes(lowered)) {
        nameContains.push(token);
      } else if (addr.includes(lowered)) {
        addressContains.push(token);
      }
    }

    const directMatches = [
      ...exactSymbol,
      ...symbolStarts,
      ...symbolContains,
      ...nameStarts,
      ...nameContains,
      ...addressContains,
    ];

    if (directMatches.length > 0) {
      return directMatches;
    }

    // Fallback to fuzzy search if direct matches yield no results
    if (trimmed.length >= 2) {
      const fuzzy = fuse.search(trimmed).map(({ item }) => item);
      if (filterTab === "verified") {
        return fuzzy.filter((t) => checkIsVerified(t));
      }
      if (filterTab === "custom") {
        return fuzzy.filter((t) => checkIsCustom(t));
      }
      return fuzzy;
    }

    return [];
  }, [tokens, deferredQuery, filterTab, checkIsVerified, checkIsCustom, fuse]);

  // Virtualize the list of items for 60 FPS performance over 1,000+ assets
  const rowVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 6,
    initialRect: { width: 420, height: 384 },
  });

  const handleSelect = (token: TokenOption) => {
    if (token.address === disabledAddress) return;
    onSelect(token);
    onClose();
  };

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Select a token" size="md">
      <div className="space-y-3">
        {/* Search input with prefix search icon and clear button */}
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, symbol, or address"
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] py-2.5 pl-9 pr-9 text-sm text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
            aria-label="Search tokens"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded"
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick filter tabs */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Token filters">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "all"}
              onClick={() => setFilterTab("all")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterTab === "all"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800/40 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "verified"}
              onClick={() => setFilterTab("verified")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterTab === "verified"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800/40 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <BadgeCheck size={12} className="text-blue-400" />
              Verified
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "custom"}
              onClick={() => setFilterTab("custom")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterTab === "custom"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-gray-800/40 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              Custom
            </button>
          </div>

          <span className="font-mono text-gray-500 text-[11px]" aria-live="polite">
            {results.length} {results.length === 1 ? "token" : "tokens"}
          </span>
        </div>

        {/* Virtualized list container */}
        <div
          ref={parentRef}
          className="h-80 overflow-y-auto rounded-lg border border-gray-800/80 bg-[#0d1117]/60 p-1"
          role="listbox"
          aria-label="Token results"
          tabIndex={-1}
        >
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-gray-400">
              <p>No tokens found for &ldquo;{query}&rdquo;</p>
              {onOpenImportModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenImportModal();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <PlusCircle size={14} />
                  Import custom token
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const token = results[virtualRow.index];
                if (!token) return null;

                const isDisabled = token.address === disabledAddress;
                const isSelected = token.address === selectedAddress;
                const balance = balances?.[token.address] ?? token.balance;
                const isCustom = checkIsCustom(token);
                const isVerified = checkIsVerified(token);

                return (
                  <div
                    key={token.address}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="p-0.5"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => handleSelect(token)}
                      title={
                        isDisabled
                          ? "Already selected on the other side of this swap"
                          : undefined
                      }
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all ${
                        isDisabled
                          ? "cursor-not-allowed opacity-40"
                          : isSelected
                            ? "bg-blue-500/15 border border-blue-500/30"
                            : "hover:bg-gray-800/80 hover:border-gray-700 border border-transparent"
                      }`}
                    >
                      {/* Token icon */}
                      <div className="relative shrink-0">
                        <TokenIcon src={token.iconUrl} symbol={token.symbol} size={34} />
                      </div>

                      {/* Token symbol, verified badge, custom tag, name & address */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-gray-100">
                            {token.symbol}
                          </span>

                          {/* Verified security badge */}
                          {isVerified && (
                            <span
                              className="inline-flex items-center text-blue-400 shrink-0"
                              title="Protocol-verified asset"
                              aria-label="Verified asset"
                              data-testid="verified-badge"
                            >
                              <BadgeCheck size={14} className="fill-blue-400/20 text-blue-400" />
                            </span>
                          )}

                          {/* Custom token import tag */}
                          {isCustom && (
                            <span
                              className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-medium text-amber-400 border border-amber-500/20 shrink-0"
                              title="Custom imported token"
                              data-testid="custom-token-tag"
                            >
                              Custom
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                          <span className="truncate">{token.name}</span>
                          <span className="text-gray-600">•</span>
                          <span className="font-mono text-[11px] text-gray-500 shrink-0">
                            {truncateAddress(token.address)}
                          </span>
                        </div>
                      </div>

                      {/* Token balance and selected indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {balance !== undefined && (
                          <div className="text-right">
                            <span
                              className="block font-mono text-xs font-medium text-gray-300"
                              data-testid="token-balance"
                            >
                              {formatTokenAmount(balance)}
                            </span>
                          </div>
                        )}
                        {isSelected && (
                          <Check size={16} className="text-blue-400 shrink-0 ml-1" />
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default TokenSelectorModal;
