"use client";

/**
 * KeyboardShortcutsRoot
 *
 * Always-mounted client component that turns the shared hotkey logic into real
 * navigation/actions. Mounted once from the root layout next to the command
 * palette so every route gets the shortcuts without re-registering listeners.
 *
 * Wires:
 *  - Shift+S  → /swap
 *  - Shift+B  → bridge workspace
 *  - Escape   → close the shortcut dialog and broadcast CLOSE_MODALS_EVENT
 *  - 1–5      → dispatch CHART_TIMEFRAME_EVENT (CandlestickChart listens)
 *  - Shift+?  → open the shortcut reference dialog
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  CHART_TIMEFRAME_EVENT,
  CLOSE_MODALS_EVENT,
  type ShortcutTimeframe,
} from "@/lib/keyboardShortcuts";

const SWAP_ROUTE = "/swap";
const BRIDGE_ROUTE = "/bridge/refunds";

export function KeyboardShortcutsRoot() {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const openSwap = useCallback(() => {
    setIsHelpOpen(false);
    router.push(SWAP_ROUTE);
  }, [router]);

  const openBridge = useCallback(() => {
    setIsHelpOpen(false);
    router.push(BRIDGE_ROUTE);
  }, [router]);

  const closeModals = useCallback(() => {
    setIsHelpOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CLOSE_MODALS_EVENT));
    }
  }, []);

  const openShortcuts = useCallback(() => setIsHelpOpen(true), []);

  const closeShortcuts = useCallback(() => setIsHelpOpen(false), []);

  const changeTimeframe = useCallback((timeframe: ShortcutTimeframe) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(CHART_TIMEFRAME_EVENT, { detail: { timeframe } }),
    );
  }, []);

  useKeyboardShortcuts({
    onOpenSwap: openSwap,
    onOpenBridge: openBridge,
    onCloseModals: closeModals,
    onOpenShortcuts: openShortcuts,
    onTimeframeChange: changeTimeframe,
  });

  return (
    <KeyboardShortcutsModal isOpen={isHelpOpen} onClose={closeShortcuts} />
  );
}

export default KeyboardShortcutsRoot;
