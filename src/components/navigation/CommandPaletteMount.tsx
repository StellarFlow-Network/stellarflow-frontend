"use client";

/**
 * CommandPaletteMount — the always-mounted half of the command palette.
 *
 * Keeping the hotkey listener here rather than in `CommandPalette` means the
 * heavy module (Fuse index, registry, result rows) is only fetched the first
 * time someone actually presses Cmd+K, so a global palette costs the initial
 * bundle nothing but this listener.
 *
 * Also publishes open/close controls on a context, letting any component — a
 * header search affordance, an empty-state prompt — raise the palette without
 * duplicating the shortcut.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useOptionalToast } from "@/components/ui/ToastQueue";
import type { PoolSummary, TokenSummary } from "@/lib/commandRegistry";

const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

export interface CommandPaletteControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteControls | null>(null);

/**
 * Controls for the app-wide palette. Returns `null` when no mount is present,
 * so optional call sites can hide their trigger instead of crashing.
 */
export function useCommandPalette(): CommandPaletteControls | null {
  return useContext(CommandPaletteContext);
}

export interface CommandPaletteMountProps {
  children?: React.ReactNode;
  pools?: PoolSummary[];
  tokens?: TokenSummary[];
}

export function CommandPaletteMount({
  children,
  pools,
  tokens,
}: CommandPaletteMountProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Latches on first activation: once true the palette chunk stays mounted so
  // reopening is instant.
  const [hasActivated, setHasActivated] = useState(false);

  const open = useCallback(() => {
    setHasActivated(true);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    setHasActivated(true);
    setIsOpen((current) => !current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K elsewhere. `event.key` is compared lowercased so
      // the shortcut still fires with caps lock or shift held.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHasActivated(true);
        setIsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const controls = useMemo<CommandPaletteControls>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  // Actions execute as the palette closes, so their outcome has to surface
  // somewhere the user is still looking — the shared toast queue.
  const toast = useOptionalToast();
  const handleFeedback = useCallback(
    ({ ok, message }: { ok: boolean; message: string }) => {
      toast?.addToast({
        title: ok ? "Action completed" : "Action failed",
        description: message,
        status: ok ? "confirmed" : "failed",
      });
    },
    [toast],
  );

  return (
    <CommandPaletteContext.Provider value={controls}>
      {children}
      {hasActivated && (
        <CommandPalette
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          pools={pools}
          tokens={tokens}
          onFeedback={handleFeedback}
        />
      )}
    </CommandPaletteContext.Provider>
  );
}

export default CommandPaletteMount;
