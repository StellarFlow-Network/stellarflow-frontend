/**
 * keyboardShortcuts.ts
 *
 * Pure, DOM-free core for StellarFlow's application-wide keyboard shortcut
 * layer. Keeping the catalogue, the key matching and the "is the user typing?"
 * detection here (instead of inside the React hook) means they can be unit
 * tested by the Node test runner without a DOM — see
 * `tests/ui/keyboardShortcuts.test.ts`.
 *
 * Conventions enforced by `resolveShortcut`:
 *  - Only the modifiers a shortcut documents are allowed. Any Ctrl / Meta / Alt
 *    combination is ignored so the shortcut layer never fights the command
 *    palette's Cmd+K handler.
 *  - Keystrokes are ignored while focus is inside a text input, textarea,
 *    select or contenteditable element.
 *  - Keys are compared on the lowercased `KeyboardEvent.key` so Caps Lock and
 *    Shift do not change which binding fires.
 */

export const KEYBOARD_SHORTCUTS_STORAGE_KEY =
  "stellarflow:keyboard-shortcuts-enabled";

/** Fired on `window` whenever the persisted preference changes. */
export const KEYBOARD_SHORTCUTS_CHANGE_EVENT =
  "stellarflow:keyboard-shortcuts-change";

/** Fired on `window` by the shortcut layer to request a chart timeframe change. */
export const CHART_TIMEFRAME_EVENT = "stellarflow:chart-timeframe";

/** Fired on `window` when the user presses Escape outside an input. */
export const CLOSE_MODALS_EVENT = "stellarflow:keyboard-shortcuts:close-modals";

/**
 * The five chart resolutions the number keys map onto, in order. This mirrors
 * `CANDLE_RESOLUTIONS` in `src/components/trading/CandlestickChart.tsx`; that
 * file validates the dispatched value against its own list before applying it.
 */
export const SHORTCUT_TIMEFRAMES = ["1m", "5m", "15m", "1h", "1d"] as const;

export type ShortcutTimeframe = (typeof SHORTCUT_TIMEFRAMES)[number];

export type ShortcutAction =
  | "open-swap"
  | "open-bridge"
  | "close-modals"
  | "open-shortcuts"
  | "set-timeframe";

export type ShortcutGroup = "navigation" | "chart" | "dialogs";

export interface KeyboardShortcutDefinition {
  id: string;
  action: ShortcutAction;
  /** Human-readable key tokens, e.g. `["Shift", "S"]`. */
  keys: string[];
  /** Lowercased `KeyboardEvent.key` value(s) this shortcut responds to. */
  key: string | readonly string[];
  /** True when Shift must be held. All other modifiers are always rejected. */
  shift?: boolean;
  label: string;
  description: string;
  group: ShortcutGroup;
  /** Present only for `set-timeframe` shortcuts. */
  timeframe?: ShortcutTimeframe;
}

export interface ShortcutEventLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * The subset of an event target needed to decide whether shortcuts should be
 * suppressed. Kept structural so it can be unit tested with plain objects.
 */
export interface KeyboardTargetLike {
  tagName?: string | null;
  isContentEditable?: boolean | null;
  type?: string | null;
  getAttribute?: ((name: string) => string | null) | null;
}

/**
 * The full set of bindings surfaced in the keyboard shortcut dialog.
 * Order here is the order they are grouped/rendered in.
 */
export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcutDefinition[] = [
  {
    id: "open-swap",
    action: "open-swap",
    keys: ["Shift", "S"],
    key: "s",
    shift: true,
    label: "Open Swap",
    description: "Jump straight to the swap workspace.",
    group: "navigation",
  },
  {
    id: "open-bridge",
    action: "open-bridge",
    keys: ["Shift", "B"],
    key: "b",
    shift: true,
    label: "Open Bridge",
    description: "Jump to the cross-chain bridge workspace.",
    group: "navigation",
  },
  {
    id: "close-modals",
    action: "close-modals",
    keys: ["Esc"],
    key: "escape",
    label: "Close dialogs",
    description: "Dismiss the topmost dialog or overlay.",
    group: "dialogs",
  },
  {
    id: "open-shortcuts",
    action: "open-shortcuts",
    keys: ["Shift", "?"],
    // Shift+/ reports "?" on layouts where it is a shifted key and "/" where it
    // is not; accept both.
    key: ["?", "/"],
    shift: true,
    label: "Keyboard shortcuts",
    description: "Show this shortcut reference.",
    group: "dialogs",
  },
  ...SHORTCUT_TIMEFRAMES.map(
    (timeframe, index): KeyboardShortcutDefinition => ({
      id: `timeframe-${timeframe}`,
      action: "set-timeframe",
      keys: [String(index + 1)],
      key: String(index + 1),
      label: `${timeframe} chart`,
      description: `Switch the price chart to the ${timeframe} timeframe.`,
      group: "chart",
      timeframe,
    }),
  ),
];

/** `<input>` types that should swallow shortcuts because the user is typing. */
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "password",
  "url",
  "tel",
  "number",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

export function normalizeEventKey(key: string): string {
  const normalized = typeof key === "string" ? key.toLowerCase() : "";
  // Legacy browsers/IE-style keyboard events report Escape as "Esc".
  return normalized === "esc" ? "escape" : normalized;
}

/**
 * True when focus sits in a field that owns the keystroke, so the shortcut
 * layer must stay out of the way. Non-text inputs (checkbox, radio, range,
 * button, file, colour) still allow shortcuts to fire.
 */
export function isEditableTarget(
  target: KeyboardTargetLike | null | undefined,
): boolean {
  if (!target) return false;

  const tagName =
    typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";

  if (tagName === "TEXTAREA" || tagName === "SELECT") return true;

  if (tagName === "INPUT") {
    const type =
      typeof target.type === "string" && target.type.length > 0
        ? target.type.toLowerCase()
        : "text";
    return TEXT_INPUT_TYPES.has(type);
  }

  if (target.isContentEditable === true) return true;

  if (typeof target.getAttribute === "function") {
    const editable = target.getAttribute("contenteditable");
    if (editable === "" || editable === "true" || editable === "plaintext-only") {
      return true;
    }
  }

  return false;
}

/**
 * Structural match for a single binding. Rejects any modifier the binding does
 * not document, including Ctrl/Meta/Alt.
 */
export function matchesShortcut(
  definition: KeyboardShortcutDefinition,
  event: ShortcutEventLike,
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (Boolean(definition.shift) !== Boolean(event.shiftKey)) return false;
  const candidates =
    typeof definition.key === "string" ? [definition.key] : definition.key;
  return candidates.includes(normalizeEventKey(event.key));
}

/** The first binding that matches the event, or `null`. */
export function getShortcutForEvent(
  event: ShortcutEventLike,
): KeyboardShortcutDefinition | null {
  for (const definition of KEYBOARD_SHORTCUTS) {
    if (matchesShortcut(definition, event)) return definition;
  }
  return null;
}

export interface ResolveShortcutOptions {
  /** Explicit override; the persisted preference is applied by the hook. */
  enabled?: boolean;
  /** `event.target`, used to suppress shortcuts while the user is typing. */
  target?: KeyboardTargetLike | null;
}

/**
 * End-to-end decision for a keydown event: applies the enabled gate, the
 * typing guard and the binding match.
 */
export function resolveShortcut(
  event: ShortcutEventLike,
  options: ResolveShortcutOptions = {},
): KeyboardShortcutDefinition | null {
  if (options.enabled === false) return null;
  if (isEditableTarget(options.target)) return null;
  return getShortcutForEvent(event);
}

// ── Preference persistence ───────────────────────────────────────────────────

/** Minimal `localStorage` surface, injected in tests. */
export interface KeyboardShortcutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): KeyboardShortcutStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Shortcuts are enabled by default and only disabled when explicitly turned off. */
export function getKeyboardShortcutsEnabled(
  storage: KeyboardShortcutStorage | null = defaultStorage(),
): boolean {
  if (!storage) return true;
  try {
    const stored = storage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setKeyboardShortcutsEnabled(
  enabled: boolean,
  storage: KeyboardShortcutStorage | null = defaultStorage(),
): void {
  if (storage) {
    try {
      storage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, String(enabled));
    } catch {
      // Storage can be unavailable in private mode / with cookies blocked.
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(KEYBOARD_SHORTCUTS_CHANGE_EVENT, {
          detail: { enabled },
        }),
      );
    } catch {
      // CustomEvent is missing in some non-browser runtimes; the setter is
      // still useful without the broadcast.
    }
  }
}

export function toggleKeyboardShortcutsEnabled(
  storage: KeyboardShortcutStorage | null = defaultStorage(),
): boolean {
  const next = !getKeyboardShortcutsEnabled(storage);
  setKeyboardShortcutsEnabled(next, storage);
  return next;
}

// ── Presentation helpers ─────────────────────────────────────────────────────

export const SHORTCUT_GROUP_ORDER: readonly ShortcutGroup[] = [
  "navigation",
  "chart",
  "dialogs",
];

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroup, string> = {
  navigation: "Navigation",
  chart: "Chart timeframes",
  dialogs: "Dialogs",
};

export interface KeyboardShortcutSection {
  id: ShortcutGroup;
  title: string;
  shortcuts: KeyboardShortcutDefinition[];
}

/** Group the catalogue for the shortcut dialog. Empty groups are dropped. */
export function getShortcutSections(
  shortcuts: readonly KeyboardShortcutDefinition[] = KEYBOARD_SHORTCUTS,
): KeyboardShortcutSection[] {
  return SHORTCUT_GROUP_ORDER.map((id) => ({
    id,
    title: SHORTCUT_GROUP_LABELS[id],
    shortcuts: shortcuts.filter((shortcut) => shortcut.group === id),
  })).filter((section) => section.shortcuts.length > 0);
}

export function formatShortcutKeys(keys: readonly string[]): string {
  return keys.join(" + ");
}
