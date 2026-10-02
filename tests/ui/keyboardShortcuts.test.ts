/**
 * keyboardShortcuts.test.ts
 *
 * Unit tests for the pure shortcut core (#949). These run on Node's built-in
 * test runner with no DOM and no test framework:
 *
 *   node --test tests/ui/keyboardShortcuts.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  SHORTCUT_TIMEFRAMES,
  formatShortcutKeys,
  getKeyboardShortcutsEnabled,
  getShortcutForEvent,
  getShortcutSections,
  isEditableTarget,
  matchesShortcut,
  resolveShortcut,
  setKeyboardShortcutsEnabled,
  toggleKeyboardShortcutsEnabled,
} from "../../src/lib/keyboardShortcuts.ts";
import type {
  KeyboardShortcutStorage,
  ShortcutEventLike,
} from "../../src/lib/keyboardShortcuts.ts";

function memoryStorage(): {
  storage: KeyboardShortcutStorage;
  read: () => string | null;
} {
  const store = new Map<string, string>();
  return {
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
    },
    read: () => store.get(KEYBOARD_SHORTCUTS_STORAGE_KEY) ?? null,
  };
}

describe("keyboard shortcut matching", () => {
  it("binds Shift+S to open swap", () => {
    assert.equal(getShortcutForEvent({ key: "S", shiftKey: true })?.id, "open-swap");
  });

  it("binds Shift+B to open bridge", () => {
    assert.equal(getShortcutForEvent({ key: "b", shiftKey: true })?.id, "open-bridge");
  });

  it("binds Escape to close dialogs", () => {
    assert.equal(getShortcutForEvent({ key: "Escape" })?.action, "close-modals");
    // Legacy "Esc" key value is normalised.
    assert.equal(getShortcutForEvent({ key: "Esc" })?.action, "close-modals");
  });

  it("binds Shift+? to open the shortcut reference", () => {
    assert.equal(getShortcutForEvent({ key: "?", shiftKey: true })?.action, "open-shortcuts");
  });

  it("maps digits 1-5 onto the five chart timeframes in order", () => {
    SHORTCUT_TIMEFRAMES.forEach((timeframe, index) => {
      const shortcut = getShortcutForEvent({ key: String(index + 1) });
      assert.equal(shortcut?.action, "set-timeframe");
      assert.equal(shortcut?.timeframe, timeframe);
    });
  });

  it("ignores keys with an undocumented modifier held", () => {
    assert.equal(getShortcutForEvent({ key: "s", shiftKey: true, ctrlKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "s", shiftKey: true, metaKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "s", shiftKey: true, altKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "b", shiftKey: true, ctrlKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "1", ctrlKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "Escape", metaKey: true }), null);
  });

  it("does not fire shift shortcuts without shift, or digit shortcuts with shift", () => {
    assert.equal(getShortcutForEvent({ key: "s" }), null);
    assert.equal(getShortcutForEvent({ key: "b" }), null);
    assert.equal(getShortcutForEvent({ key: "!" , shiftKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "1", shiftKey: true }), null);
  });

  it("leaves unmapped keys alone", () => {
    assert.equal(getShortcutForEvent({ key: "0" }), null);
    assert.equal(getShortcutForEvent({ key: "6" }), null);
    assert.equal(getShortcutForEvent({ key: "a" }), null);
    // Cmd/Ctrl+K belongs to the command palette.
    assert.equal(getShortcutForEvent({ key: "k", metaKey: true }), null);
    assert.equal(getShortcutForEvent({ key: "k", ctrlKey: true }), null);
  });

  it("rejects multi-character keys that only share a prefix", () => {
    const shiftS = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === "open-swap");
    assert.ok(shiftS);
    assert.equal(matchesShortcut(shiftS, { key: "Shift", shiftKey: true }), false);
    assert.equal(matchesShortcut(shiftS, { key: "s", shiftKey: true }), true);
  });
});

describe("resolveShortcut ignore rules", () => {
  const editableTargets = [
    { label: "text input", target: { tagName: "INPUT", type: "text" } },
    { label: "input without a type", target: { tagName: "input" } },
    { label: "search input", target: { tagName: "INPUT", type: "search" } },
    { label: "number input", target: { tagName: "INPUT", type: "number" } },
    { label: "textarea", target: { tagName: "TEXTAREA" } },
    { label: "select", target: { tagName: "SELECT" } },
    { label: "contenteditable element", target: { tagName: "DIV", isContentEditable: true } },
    {
      label: "contenteditable attribute",
      target: {
        tagName: "DIV",
        getAttribute: (name: string) => (name === "contenteditable" ? "true" : null),
      },
    },
    {
      label: "bare contenteditable attribute",
      target: {
        tagName: "DIV",
        getAttribute: (name: string) => (name === "contenteditable" ? "" : null),
      },
    },
  ];

  for (const { label, target } of editableTargets) {
    it(`ignores Shift+S while focus is in a ${label}`, () => {
      assert.equal(isEditableTarget(target), true);
      assert.equal(
        resolveShortcut({ key: "s", shiftKey: true }, { target }),
        null,
      );
    });
  }

  it("still fires when focus is on a non-text control", () => {
    const checkbox = { tagName: "INPUT", type: "checkbox" };
    const button = { tagName: "BUTTON" };
    assert.equal(isEditableTarget(checkbox), false);
    assert.equal(isEditableTarget(button), false);
    assert.equal(
      resolveShortcut({ key: "s", shiftKey: true }, { target: checkbox })?.action,
      "open-swap",
    );
    assert.equal(
      resolveShortcut({ key: "3" }, { target: button })?.timeframe,
      "15m",
    );
  });

  it("treats a missing target (document body) as not editable", () => {
    assert.equal(isEditableTarget(null), false);
    assert.equal(isEditableTarget(undefined), false);
    assert.equal(resolveShortcut({ key: "Escape" }, { target: null })?.action, "close-modals");
  });

  it("returns nothing at all while shortcuts are disabled", () => {
    const event: ShortcutEventLike = { key: "s", shiftKey: true };
    assert.equal(resolveShortcut(event, { enabled: false }), null);
    assert.equal(resolveShortcut({ key: "1" }, { enabled: false }), null);
    assert.equal(resolveShortcut({ key: "Escape" }, { enabled: false }), null);
    // ...and still resolves when explicitly enabled.
    assert.equal(resolveShortcut(event, { enabled: true })?.action, "open-swap");
  });

  it("disabled beats the typing guard regardless of order", () => {
    assert.equal(
      resolveShortcut(
        { key: "s", shiftKey: true },
        { enabled: false, target: { tagName: "DIV" } },
      ),
      null,
    );
  });
});

describe("shortcut catalogue", () => {
  it("exposes unique ids and non-empty key tokens", () => {
    const ids = new Set<string>();
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      assert.equal(ids.has(shortcut.id), false, `duplicate id ${shortcut.id}`);
      ids.add(shortcut.id);
      assert.ok(shortcut.keys.length > 0);
      assert.ok(shortcut.label.length > 0);
    }
  });

  it("builds one section per group with all bindings accounted for", () => {
    const sections = getShortcutSections();
    assert.deepEqual(
      sections.map((section) => section.id),
      ["navigation", "chart", "dialogs"],
    );
    const total = sections.reduce((sum, section) => sum + section.shortcuts.length, 0);
    assert.equal(total, KEYBOARD_SHORTCUTS.length);
    const chart = sections.find((section) => section.id === "chart");
    assert.deepEqual(
      chart?.shortcuts.map((shortcut) => shortcut.timeframe),
      [...SHORTCUT_TIMEFRAMES],
    );
  });

  it("formats key tokens for display", () => {
    assert.equal(formatShortcutKeys(["Shift", "S"]), "Shift + S");
    assert.equal(formatShortcutKeys(["Esc"]), "Esc");
    assert.equal(formatShortcutKeys(["1"]), "1");
  });
});

describe("preference persistence", () => {
  it("defaults to enabled when nothing is stored", () => {
    const { storage } = memoryStorage();
    assert.equal(getKeyboardShortcutsEnabled(storage), true);
    assert.equal(getKeyboardShortcutsEnabled(null), true);
  });

  it("persists a disabled preference", () => {
    const { storage, read } = memoryStorage();
    setKeyboardShortcutsEnabled(false, storage);
    assert.equal(read(), "false");
    assert.equal(getKeyboardShortcutsEnabled(storage), false);
  });

  it("toggles from the stored value", () => {
    const { storage } = memoryStorage();
    assert.equal(toggleKeyboardShortcutsEnabled(storage), false);
    assert.equal(getKeyboardShortcutsEnabled(storage), false);
    assert.equal(toggleKeyboardShortcutsEnabled(storage), true);
    assert.equal(getKeyboardShortcutsEnabled(storage), true);
  });

  it("does not throw when storage is unavailable", () => {
    assert.doesNotThrow(() => setKeyboardShortcutsEnabled(false, null));
    assert.equal(getKeyboardShortcutsEnabled(null), true);
  });
});
