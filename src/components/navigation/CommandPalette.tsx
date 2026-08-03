"use client";

/**
 * CommandPalette — Cmd+K / Ctrl+K global quick-action and asset search.
 *
 * Searches routes, live liquidity pools, tokens, documentation, and wallet
 * actions through one fuzzy index, and is driveable entirely from the keyboard:
 * arrows move, Enter executes, Escape dismisses.
 *
 * Open state can be owned here (the palette registers the hotkey itself) or
 * lifted by a parent via `isOpen` / `onOpenChange` — `CommandPaletteMount` uses
 * the controlled form so the hotkey can live in a tiny always-mounted listener
 * while this heavier module loads on demand.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useWalletCommands } from "@/hooks/useWalletCommands";
import {
  DOC_COMMANDS,
  GROUP_LABELS,
  NAVIGATION_COMMANDS,
  PRICE_FEED_COMMANDS,
  createCommandIndex,
  groupResults,
  poolCommand,
  searchCommands,
  titleSegments,
  tokenCommand,
  type CommandItem,
  type CommandResult,
  type PoolSummary,
  type TokenSummary,
} from "@/lib/commandRegistry";

export interface CommandPaletteProps {
  /** Controlled open state; omit to let the palette own the hotkey itself */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Live pools folded into the index */
  pools?: PoolSummary[];
  /**
   * Live tokens folded into the index. Defaults to the oracle price feeds from
   * the asset registry; pass a list to search real token balances instead.
   */
  tokens?: TokenSummary[];
  /** Additional app-specific rows, e.g. contextual actions for the current page */
  extraCommands?: CommandItem[];
  /** Reports action outcomes and navigation for host-level toasts or analytics */
  onFeedback?: (feedback: { ok: boolean; message: string }) => void;
}

const KIND_ACCENTS: Record<string, string> = {
  action: "text-[#CBF34D]",
  page: "text-blue-400",
  pool: "text-violet-400",
  token: "text-amber-400",
  doc: "text-gray-400",
};

export function CommandPalette({
  isOpen: controlledOpen,
  onOpenChange,
  pools,
  tokens,
  extraCommands,
  onFeedback,
}: CommandPaletteProps) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The element focus should return to once the palette closes.
  const restoreFocusRef = useRef<Element | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setUncontrolledOpen(next);
        onOpenChange?.(next);
      }
    },
    [isControlled, onOpenChange],
  );

  const walletCommands = useWalletCommands({ onResult: onFeedback });

  const items = useMemo<CommandItem[]>(
    () => [
      ...walletCommands,
      ...(extraCommands ?? []),
      ...NAVIGATION_COMMANDS,
      ...(pools ?? []).map(poolCommand),
      // Supplied tokens replace the built-in feed rows rather than stacking with
      // them, so a caller with real balances does not get both.
      ...(tokens ? tokens.map(tokenCommand) : PRICE_FEED_COMMANDS),
      ...DOC_COMMANDS,
    ],
    [walletCommands, extraCommands, pools, tokens],
  );

  const index = useMemo(() => createCommandIndex(items), [items]);

  const results = useMemo(
    () => searchCommands(index, items, query),
    [index, items, query],
  );

  // Clamped on read rather than corrected in an effect, so a shrinking result
  // list never triggers a second render pass.
  const activeIndex = results.length
    ? Math.min(selected, results.length - 1)
    : 0;
  const activeResult: CommandResult | undefined = results[activeIndex];

  const groups = useMemo(() => groupResults(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
    // Hand focus back to whatever the user was on before the hotkey fired.
    const target = restoreFocusRef.current;
    if (target instanceof HTMLElement) {
      target.focus();
    }
    restoreFocusRef.current = null;
  }, [setOpen]);

  const execute = useCallback(
    async (item: CommandItem) => {
      if (item.run) {
        setIsRunning(true);
        try {
          await item.run();
        } catch (err) {
          onFeedback?.({
            ok: false,
            message:
              err instanceof Error ? err.message : `"${item.title}" failed to run.`,
          });
        } finally {
          setIsRunning(false);
        }
        close();
        return;
      }

      if (!item.href) {
        close();
        return;
      }

      if (item.external) {
        window.open(item.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(item.href);
      }
      close();
    },
    [close, router, onFeedback],
  );

  // ── Global hotkey ─────────────────────────────────────────────────────────
  // Only registered when uncontrolled; otherwise the parent owns the listener.
  useEffect(() => {
    if (isControlled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setUncontrolledOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isControlled]);

  // Remember what had focus, then take it. Capturing here rather than in the
  // hotkey handler covers the controlled case too, where the parent owns the
  // shortcut and this component never sees the keypress.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  // Lock background scroll for as long as the overlay is up.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Keep the highlighted row visible during keyboard traversal.
  useEffect(() => {
    if (!isOpen || !activeResult) return;
    const node = listRef.current?.querySelector(
      `[data-command-id="${CSS.escape(activeResult.item.id)}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeResult]);

  // Warm the route for the highlighted row so Enter feels instant, matching the
  // prefetch-on-hover behaviour of the sidebars.
  useEffect(() => {
    if (!isOpen) return;
    const href = activeResult?.item.href;
    if (!href || activeResult?.item.external) return;
    try {
      router.prefetch(href);
    } catch {
      // Prefetch is best-effort; a failure must never block the palette.
    }
  }, [isOpen, activeResult, router]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "ArrowDown":
        event.preventDefault();
        if (results.length) {
          setSelected((activeIndex + 1) % results.length);
        }
        return;
      case "ArrowUp":
        event.preventDefault();
        if (results.length) {
          setSelected((activeIndex - 1 + results.length) % results.length);
        }
        return;
      case "Home":
        event.preventDefault();
        setSelected(0);
        return;
      case "End":
        event.preventDefault();
        setSelected(Math.max(0, results.length - 1));
        return;
      case "Enter":
        event.preventDefault();
        if (activeResult && !isRunning) {
          void execute(activeResult.item);
        }
        return;
      default:
        return;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-60 flex items-start justify-center p-4 pt-[12vh]"
          onKeyDown={handleKeyDown}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Query input */}
            <div className="flex items-center gap-3 border-b border-gray-800 px-4">
              <Icon
                id={ICON_IDS.search}
                size={16}
                className="shrink-0 text-gray-500"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  // A new query invalidates the old cursor position.
                  setSelected(0);
                }}
                placeholder="Search pages, pools, tokens, docs, or actions…"
                spellCheck={false}
                autoComplete="off"
                role="combobox"
                aria-expanded
                aria-controls="command-palette-list"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeResult ? `command-${activeResult.item.id}` : undefined
                }
                className="w-full bg-transparent py-4 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none"
              />
              <kbd className="shrink-0 rounded border border-gray-700 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              id="command-palette-list"
              role="listbox"
              aria-label="Search results"
              className="max-h-[52vh] overflow-y-auto py-2"
            >
              {results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  No matches for{" "}
                  <span className="font-mono text-gray-400">{query}</span>
                </p>
              )}

              {groups.map((group) => (
                <div key={group.kind} className="mb-1 last:mb-0">
                  <p className="px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider text-gray-600">
                    {GROUP_LABELS[group.kind]}
                  </p>
                  {group.results.map((result) => {
                    const isActive = result.item.id === activeResult?.item.id;
                    return (
                      <CommandRow
                        key={result.item.id}
                        result={result}
                        isActive={isActive}
                        isRunning={isRunning && isActive}
                        onSelect={() => {
                          setSelected(results.indexOf(result));
                        }}
                        onExecute={() => {
                          if (!isRunning) void execute(result.item);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Keyboard legend */}
            <div className="flex items-center gap-4 border-t border-gray-800 px-4 py-2.5 text-[11px] text-gray-500">
              <LegendKey keys={["↑", "↓"]} label="Navigate" />
              <LegendKey keys={["↵"]} label="Execute" />
              <LegendKey keys={["esc"]} label="Close" />
              <span className="ml-auto tabular-nums">
                {results.length} {results.length === 1 ? "result" : "results"}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function LegendKey({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((key) => (
        <kbd
          key={key}
          className="rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-gray-400"
        >
          {key}
        </kbd>
      ))}
      {label}
    </span>
  );
}

interface CommandRowProps {
  result: CommandResult;
  isActive: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onExecute: () => void;
}

const CommandRow = React.memo(function CommandRow({
  result,
  isActive,
  isRunning,
  onSelect,
  onExecute,
}: CommandRowProps) {
  const { item } = result;
  const segments = titleSegments(result);

  return (
    <div
      id={`command-${item.id}`}
      data-command-id={item.id}
      role="option"
      aria-selected={isActive}
      // Pointer-driven selection mirrors keyboard selection so both share one
      // highlighted row; the click itself executes.
      onMouseMove={isActive ? undefined : onSelect}
      onClick={onExecute}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
        isActive ? "bg-gray-800/70" : "hover:bg-gray-800/30"
      }`}
    >
      <Icon
        id={isRunning ? ICON_IDS.refreshCcw : item.iconId}
        size={16}
        className={`shrink-0 ${isRunning ? "animate-spin text-gray-400" : KIND_ACCENTS[item.kind]}`}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-100">
          {segments.map((segment, i) =>
            segment.matched ? (
              <mark
                key={i}
                className="bg-transparent font-semibold text-[#CBF34D]"
              >
                {segment.text}
              </mark>
            ) : (
              <React.Fragment key={i}>{segment.text}</React.Fragment>
            ),
          )}
        </span>
        {item.subtitle && (
          <span className="block truncate text-xs text-gray-500">
            {item.subtitle}
          </span>
        )}
      </span>

      {item.meta && (
        <span className="shrink-0 font-mono text-xs text-gray-400">
          {item.meta}
        </span>
      )}

      {item.external && (
        <Icon
          id={ICON_IDS.externalLink}
          size={12}
          className="shrink-0 text-gray-600"
        />
      )}

      {isActive && !item.external && (
        <kbd className="shrink-0 rounded border border-gray-700 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
          ↵
        </kbd>
      )}
    </div>
  );
});

export default CommandPalette;
