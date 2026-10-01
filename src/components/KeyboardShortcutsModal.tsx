"use client";

/**
 * KeyboardShortcutsModal
 *
 * Accessible dialog that lists every active hotkey and lets the user flip the
 * whole shortcut layer on or off. Opened with `Shift + ?` (or the Settings
 * card) and dismissed with Escape, the backdrop, or the close button.
 *
 * The rendered markup lives in `KeyboardShortcutsDialogContent.ts` so it can be
 * snapshot-rendered by the Node test runner; this component owns the stateful
 * behaviour: Escape handling, focus trapping/restoration and scroll locking.
 */

import { useCallback, useEffect, useRef } from "react";
import { KeyboardShortcutsDialogContent } from "@/components/keyboard-shortcuts/KeyboardShortcutsDialogContent";
import { useKeyboardShortcutsPreference } from "@/hooks/useKeyboardShortcuts";
import { getShortcutSections } from "@/lib/keyboardShortcuts";

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const { isEnabled, toggleEnabled } = useKeyboardShortcutsPreference();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const sections = getShortcutSections();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    // Capture phase so Escape wins even when an inner element stops propagation.
    document.addEventListener("keydown", handleKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <KeyboardShortcutsDialogContent
      dialogRef={dialogRef}
      sections={sections}
      enabled={isEnabled}
      onToggleEnabled={toggleEnabled}
      onClose={onClose}
    />
  );
}

export default KeyboardShortcutsModal;
