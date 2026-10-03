/**
 * KeyboardShortcutsModal.test.ts
 *
 * Renders the shortcut dialog body with `renderToStaticMarkup` and checks the
 * accessible dialog markup plus every listed binding. The dialog content is a
 * hook-free `.ts` component (see
 * `src/components/keyboard-shortcuts/KeyboardShortcutsDialogContent.ts`) so the
 * Node test runner can load it: Node cannot import `.tsx`.
 *
 *   node --test tests/ui/KeyboardShortcutsModal.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KeyboardShortcutsDialogContent } from "../../src/components/keyboard-shortcuts/KeyboardShortcutsDialogContent.ts";
import {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_GROUP_LABELS,
  formatShortcutKeys,
  getShortcutSections,
} from "../../src/lib/keyboardShortcuts.ts";

const noop = () => {};

function renderDialog(enabled = true): string {
  return renderToStaticMarkup(
    createElement(KeyboardShortcutsDialogContent, {
      sections: getShortcutSections(),
      enabled,
      onToggleEnabled: noop,
      onClose: noop,
    }),
  );
}

describe("KeyboardShortcutsModal markup", () => {
  const html = renderDialog();

  it("renders an accessible modal dialog labelled by its heading", () => {
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-labelledby="keyboard-shortcuts-dialog-title"/);
    assert.match(html, /id="keyboard-shortcuts-dialog-title"/);
    assert.match(html, /Keyboard shortcuts/);
  });

  it("exposes a switch that reflects the enabled preference", () => {
    assert.match(html, /role="switch"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(renderDialog(false), /aria-checked="false"/);
  });

  it("lists every active binding with its keys and label", () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      assert.ok(
        html.includes(shortcut.label),
        `missing label for ${shortcut.id}`,
      );
      assert.ok(
        html.includes(formatShortcutKeys(shortcut.keys)),
        `missing key tokens for ${shortcut.id}`,
      );
    }
  });

  it("groups the bindings under their section headings", () => {
    const sections = getShortcutSections();
    for (const title of Object.values(SHORTCUT_GROUP_LABELS)) {
      assert.ok(html.includes(title), `missing section heading ${title}`);
    }
    assert.equal((html.match(/<section/g) ?? []).length, sections.length);
  });

  it("renders a labelled close control", () => {
    assert.match(html, /aria-label="Close keyboard shortcuts"/);
  });
});
