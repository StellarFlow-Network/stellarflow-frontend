"use client";

/**
 * KeyboardShortcutsSettings
 *
 * Settings card for the global hotkey layer. Reuses the shared preference hook
 * (localStorage-backed) so the toggle here, the one inside the shortcut dialog
 * and the listener in the root layout always agree.
 */

import { useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { useKeyboardShortcutsPreference } from "@/hooks/useKeyboardShortcuts";
import { KEYBOARD_SHORTCUTS } from "@/lib/keyboardShortcuts";

export function KeyboardShortcutsSettings() {
  const { isEnabled, toggleEnabled } = useKeyboardShortcutsPreference();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Icon id={ICON_IDS.settings} size={20} className="text-purple-400" />
          Keyboard Shortcuts
        </h2>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="text-xs text-blue-500 hover:underline"
        >
          View all {KEYBOARD_SHORTCUTS.length} shortcuts
        </button>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-gray-200">
            Power-user hotkeys
          </p>
          <p className="text-xs text-gray-500">
            Place orders and switch chart timeframes without leaving the
            keyboard. Hotkeys are ignored while you are typing in a field.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label="Enable keyboard shortcuts"
          onClick={toggleEnabled}
          className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
            isEnabled ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${
              isEnabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      <KeyboardShortcutsModal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </section>
  );
}

export default KeyboardShortcutsSettings;
