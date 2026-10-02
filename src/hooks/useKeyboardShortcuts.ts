"use client";

/**
 * useKeyboardShortcuts.ts
 *
 * Global power-user hotkey layer.
 *
 * Two hooks are exported:
 *  - `useKeyboardShortcutsPreference` owns the persisted enabled/disabled flag
 *    and stays in sync across every mounted consumer (and across browser tabs).
 *    Settings toggles and the shortcut dialog use this one.
 *  - `useKeyboardShortcuts` composes the preference with a document-level
 *    `keydown` listener and dispatches the documented actions.
 *
 * The matching / "user is typing" logic lives in `@/lib/keyboardShortcuts` and
 * is pure, so it is unit tested without a DOM. This file only wires it to React
 * and the browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KEYBOARD_SHORTCUTS_CHANGE_EVENT,
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  getKeyboardShortcutsEnabled,
  resolveShortcut,
  setKeyboardShortcutsEnabled,
  toggleKeyboardShortcutsEnabled,
  type KeyboardShortcutDefinition,
  type KeyboardTargetLike,
  type ShortcutTimeframe,
} from "@/lib/keyboardShortcuts";

export interface KeyboardShortcutPreference {
  /** Whether shortcuts are currently active. Enabled by default. */
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Flips the preference and returns the new value. */
  toggleEnabled: () => boolean;
}

/** Persisted, cross-component/cross-tab enabled flag. */
export function useKeyboardShortcutsPreference(): KeyboardShortcutPreference {
  const [isEnabled, setIsEnabledState] = useState(true);

  useEffect(() => {
    setIsEnabledState(getKeyboardShortcutsEnabled());

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setIsEnabledState(
        typeof detail?.enabled === "boolean"
          ? detail.enabled
          : getKeyboardShortcutsEnabled(),
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== KEYBOARD_SHORTCUTS_STORAGE_KEY) return;
      setIsEnabledState(event.newValue !== "false");
    };

    window.addEventListener(KEYBOARD_SHORTCUTS_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(KEYBOARD_SHORTCUTS_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setKeyboardShortcutsEnabled(enabled);
    setIsEnabledState(enabled);
  }, []);

  const toggleEnabled = useCallback(() => {
    const next = toggleKeyboardShortcutsEnabled();
    setIsEnabledState(next);
    return next;
  }, []);

  return { isEnabled, setEnabled, toggleEnabled };
}

export interface UseKeyboardShortcutsOptions {
  /**
   * Optional controlled override. When omitted the persisted preference is
   * used and the returned `isEnabled` reflects it.
   */
  enabled?: boolean;
  /** Receives the matched binding. When provided it takes precedence. */
  onAction?: (shortcut: KeyboardShortcutDefinition) => void;
  onOpenSwap?: () => void;
  onOpenBridge?: () => void;
  onCloseModals?: () => void;
  onOpenShortcuts?: () => void;
  onTimeframeChange?: (timeframe: ShortcutTimeframe) => void;
}

export type UseKeyboardShortcutsResult = KeyboardShortcutPreference;

function dispatchShortcut(
  shortcut: KeyboardShortcutDefinition,
  options: UseKeyboardShortcutsOptions,
): boolean {
  if (options.onAction) {
    options.onAction(shortcut);
    return true;
  }

  switch (shortcut.action) {
    case "open-swap":
      if (!options.onOpenSwap) return false;
      options.onOpenSwap();
      return true;
    case "open-bridge":
      if (!options.onOpenBridge) return false;
      options.onOpenBridge();
      return true;
    case "close-modals":
      if (!options.onCloseModals) return false;
      options.onCloseModals();
      return true;
    case "open-shortcuts":
      if (!options.onOpenShortcuts) return false;
      options.onOpenShortcuts();
      return true;
    case "set-timeframe":
      if (!shortcut.timeframe || !options.onTimeframeChange) return false;
      options.onTimeframeChange(shortcut.timeframe);
      return true;
    default:
      return false;
  }
}

/**
 * Binds the documented hotkeys on `document` and dispatches their actions.
 *
 * Non-matching keystrokes — including anything with Ctrl/Meta/Alt, anything
 * typed into a field, and any binding without a handler — are left untouched,
 * so `preventDefault` is only called for shortcuts that actually ran.
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {},
): UseKeyboardShortcutsResult {
  const preference = useKeyboardShortcutsPreference();
  const { enabled: enabledOverride } = options;
  const isEnabled = enabledOverride ?? preference.isEnabled;

  // Latest handlers without re-binding the listener on every render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = resolveShortcut(event, {
        enabled: isEnabled,
        target: event.target as KeyboardTargetLike | null,
      });
      if (!shortcut) return;
      if (dispatchShortcut(shortcut, optionsRef.current)) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isEnabled]);

  return preference;
}

export default useKeyboardShortcuts;
