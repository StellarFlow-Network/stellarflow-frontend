/**
 * KeyboardShortcutsDialogContent.ts
 *
 * Hook-free presentational body of the keyboard shortcut dialog. It is authored
 * with `createElement` (instead of JSX) so the Node-only test runner — which
 * cannot load `.tsx` — can render it with `renderToStaticMarkup` and assert the
 * accessible dialog markup and every listed binding.
 *
 * `KeyboardShortcutsModal.tsx` owns the stateful parts (open/close, Escape,
 * focus management) and forwards them as props.
 */

import { createElement, type ReactElement, type Ref } from "react";
import type {
  KeyboardShortcutDefinition,
  KeyboardShortcutSection,
} from "@/lib/keyboardShortcuts";

export const KEYBOARD_SHORTCUTS_DIALOG_TITLE_ID =
  "keyboard-shortcuts-dialog-title";

export interface KeyboardShortcutsDialogContentProps {
  sections: KeyboardShortcutSection[];
  enabled: boolean;
  onToggleEnabled: () => void;
  onClose: () => void;
  dialogRef?: Ref<HTMLDivElement>;
}

function renderShortcut(
  shortcut: KeyboardShortcutDefinition,
): ReactElement {
  return createElement(
    "li",
    {
      key: shortcut.id,
      className:
        "flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2",
    },
    createElement(
      "div",
      { className: "min-w-0" },
      createElement(
        "p",
        { className: "text-sm font-medium text-foreground" },
        shortcut.label,
      ),
      createElement(
        "p",
        { className: "mt-0.5 text-xs text-foreground/50" },
        shortcut.description,
      ),
    ),
    createElement(
      "kbd",
      {
        className:
          "shrink-0 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-foreground/70",
      },
      shortcut.keys.join(" + "),
    ),
  );
}

export function KeyboardShortcutsDialogContent({
  sections,
  enabled,
  onToggleEnabled,
  onClose,
  dialogRef,
}: KeyboardShortcutsDialogContentProps): ReactElement {
  return createElement(
    "div",
    { className: "fixed inset-0 z-[210] flex items-center justify-center p-4" },
    createElement("div", {
      className: "absolute inset-0 bg-black/60 backdrop-blur-sm",
      onClick: onClose,
      "aria-hidden": "true",
    }),
    createElement(
      "div",
      {
        ref: dialogRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": KEYBOARD_SHORTCUTS_DIALOG_TITLE_ID,
        tabIndex: -1,
        className:
          "relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl focus:outline-none",
      },
      createElement(
        "div",
        {
          className:
            "flex items-center justify-between border-b border-border px-5 py-4",
        },
        createElement(
          "h2",
          {
            id: KEYBOARD_SHORTCUTS_DIALOG_TITLE_ID,
            className: "text-lg font-semibold text-foreground",
          },
          "Keyboard shortcuts",
        ),
        createElement(
          "button",
          {
            type: "button",
            onClick: onClose,
            "aria-label": "Close keyboard shortcuts",
            className:
              "rounded-lg p-1.5 text-lg leading-none text-foreground/50 transition-colors hover:bg-control-hover hover:text-foreground",
          },
          createElement("span", { "aria-hidden": "true" }, "\u00d7"),
        ),
      ),
      createElement(
        "div",
        {
          className:
            "flex items-center justify-between gap-4 border-b border-border px-5 py-3",
        },
        createElement(
          "div",
          null,
          createElement(
            "p",
            { className: "text-sm font-medium text-foreground" },
            "Enable keyboard shortcuts",
          ),
          createElement(
            "p",
            { className: "text-xs text-foreground/50" },
            "Turn every binding below on or off.",
          ),
        ),
        createElement(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": enabled,
            "aria-label": "Enable keyboard shortcuts",
            onClick: onToggleEnabled,
            className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              enabled ? "bg-blue-600" : "bg-gray-700"
            }`,
          },
          createElement("span", {
            "aria-hidden": "true",
            className: `absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
              enabled ? "left-6" : "left-1"
            }`,
          }),
        ),
      ),
      createElement(
        "div",
        { className: "space-y-5 overflow-y-auto px-5 py-4" },
        sections.map((section) =>
          createElement(
            "section",
            {
              key: section.id,
              "aria-labelledby": `keyboard-shortcuts-group-${section.id}`,
            },
            createElement(
              "h3",
              {
                id: `keyboard-shortcuts-group-${section.id}`,
                className:
                  "mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/40",
              },
              section.title,
            ),
            createElement(
              "ul",
              { className: "space-y-2" },
              section.shortcuts.map(renderShortcut),
            ),
          ),
        ),
      ),
    ),
  );
}

export default KeyboardShortcutsDialogContent;
