"use client";

/**
 * CommandPalette
 *
 * Global quick-action palette opened with Cmd+K / Ctrl+K.
 *
 * Features:
 *  - Fuzzy search across navigation links, asset pairs, and commands.
 *  - Keyboard arrow selection + Enter to trigger, Escape to close.
 *  - Completely removed from the DOM while closed (SSR-safe).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import Fuse from "fuse.js";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { IconId } from "@/components/icons/iconIds";
import { useMounted } from "@/app/hooks/useMounted";
import { useThemeContext } from "@/context/ThemeContext";
import {
  ALL_COMMANDS,
  COMMAND_GROUPS,
  type Command,
  type CommandKind,
} from "./commands";

const GROUP_ORDER: Record<CommandKind, number> = {
  navigate: 0,
  asset: 1,
  action: 2,
};

interface GroupedCommand {
  command: Command;
  groupIndex: number;
  flatIndex: number;
}

const kindIcon: Record<CommandKind, IconId | undefined> = {
  navigate: ICON_IDS.layoutDashboard,
  asset: ICON_IDS.coins,
  action: ICON_IDS.zap,
};

export function CommandPalette() {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const { toggleTheme } = useThemeContext();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fuzzy index ─────────────────────────────────────────────────────────
  const fuse = useMemo(
    () =>
      new Fuse(ALL_COMMANDS, {
        keys: ["label", "keywords"],
        threshold: 0.38,
        ignoreLocation: true,
        includeScore: true,
      }),
    [],
  );

  // Results preserve the registry's group/ordering (no re-sorting by score
  // so keyboard navigation stays stable across keystrokes).
  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return ALL_COMMANDS.map((command, flatIndex) => ({
        command,
        groupIndex: GROUP_ORDER[command.kind],
        flatIndex,
      }));
    }
    return fuse
      .search(trimmed)
      .map(({ item }) => ({
        command: item,
        groupIndex: GROUP_ORDER[item.kind],
        flatIndex: ALL_COMMANDS.indexOf(item),
      }))
      .sort(
        (a, b) =>
          a.groupIndex - b.groupIndex || a.flatIndex - b.flatIndex,
      );
  }, [query, fuse]);

  // Grouped renderable rows (with stable headers).
  const rows = useMemo(() => {
    const out: (GroupedCommand | { type: "header"; title: string; key: string })[] = [];
    let lastGroup: number | null = null;
    for (const result of results) {
      const { command, groupIndex, flatIndex } = result;
      if (lastGroup !== groupIndex) {
        const meta = COMMAND_GROUPS.find((g) => GROUP_ORDER[g.key] === groupIndex);
        out.push({
          type: "header",
          key: `header-${groupIndex}`,
          title: meta?.title ?? "Commands",
        });
        lastGroup = groupIndex;
      }
      out.push({ command, groupIndex, flatIndex });
    }
    return out;
  }, [results]);

  const selectableCount = useMemo(
    () => rows.filter((r) => r.type !== "header").length,
    [rows],
  );

  // ── Execution ───────────────────────────────────────────────────────────
  const execute = useCallback(
    (command: Command) => {
      setIsOpen(false);
      setQuery("");
      if (command.run) {
        command.run();
        return;
      }
      if (command.href) {
        router.push(command.href);
      }
    },
    [router],
  );

  // Resolve runtime-only handlers (theme toggling needs mounted context).
  const runAction = useCallback(
    (id: string) => {
      if (id === "action-theme") {
        toggleTheme();
        return true;
      }
      return false;
    },
    [toggleTheme],
  );

  const handleSelect = useCallback(
    (command: Command) => {
      if (command.kind === "action") {
        const handled = runAction(command.id);
        if (handled) {
          setIsOpen(false);
          setQuery("");
          return;
        }
      }
      execute(command);
    },
    [execute, runAction],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  // ── Global hotkey: Cmd/Ctrl + K ─────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mounted]);

  // Manage focus when opened/closed.
  useEffect(() => {
    if (isOpen) {
      // Defer so the input is mounted before focusing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keyboard navigation within the palette.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(selectableCount, 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + Math.max(selectableCount, 1)) % Math.max(selectableCount, 1),
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const selected = rows
          .filter((r) => r.type !== "header")
          .find((_, i) => i === activeIndex);
        if (selected && selected.type !== "header") {
          handleSelect(selected.command);
        }
      }
    },
    [close, activeIndex, selectableCount, rows, handleSelect],
  );

  // Reset highlighted index when the query changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close when navigating away.
  useEffect(() => {
    if (isOpen && pathname) close();
  }, [pathname, isOpen, close]);

  // Prevent body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Icon id={ICON_IDS.search} size={18} className="shrink-0 text-foreground/50" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, page, or asset pair…"
                aria-label="Search commands"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="shrink-0 rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground/50">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <ul
              className="max-h-[46vh] overflow-y-auto py-2"
              role="listbox"
              aria-label="Results"
            >
              {rows.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-foreground/50">
                  No results for “{query}”
                </li>
              )}

              {rows.map((row, rowIndex) => {
                if (row.type === "header") {
                  return (
                    <li
                      key={row.key}
                      className="select-none px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40"
                    >
                      {row.title}
                    </li>
                  );
                }

                const { command } = row;
                const selectableIndex = rows
                  .slice(0, rowIndex)
                  .filter((r) => r.type !== "header").length;
                const isActive = selectableIndex === activeIndex;
                const icon = command.iconId ?? kindIcon[command.kind];

                return (
                  <li key={command.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onMouseMove={() => setActiveIndex(selectableIndex)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(command);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-control-hover text-foreground"
                          : "text-foreground/80 hover:bg-control-hover"
                      }`}
                    >
                      {icon && (
                        <Icon
                          id={icon}
                          size={16}
                          strokeWidth={isActive ? 2.1 : 1.8}
                          className="shrink-0 text-foreground/60"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      <kbd
                        className={`shrink-0 rounded border px-1 font-mono text-[10px] ${
                          isActive
                            ? "border-border bg-surface-raised text-foreground/60"
                            : "border-transparent text-foreground/30"
                        }`}
                      >
                        {"\u21B5"}
                      </kbd>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer hint */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-foreground/40">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-raised px-1 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-raised px-1 font-mono">↵</kbd>
                select
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-raised px-1 font-mono">esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default CommandPalette;
