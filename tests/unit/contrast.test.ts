/**
 * contrast.test.ts
 *
 * Automated WCAG validation for the high-contrast accessibility theme (#991).
 * Runs with Node's built-in test runner — no extra dependencies:
 *
 *   node --test tests/unit/contrast.test.ts
 *
 * The suite verifies the contrast maths itself, then asserts that every pair in
 * the high-contrast palette clears the promised ratio, and finally cross-checks
 * that `src/app/globals.css` declares the same token values as the TypeScript
 * palette so the stylesheet cannot silently drift.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HIGH_CONTRAST_BACKGROUND,
  HIGH_CONTRAST_CSS_VARIABLES,
  HIGH_CONTRAST_FOREGROUND,
  HIGH_CONTRAST_NON_TEXT_PAIRS,
  HIGH_CONTRAST_STATUS,
  HIGH_CONTRAST_TEXT_PAIRS,
  WCAG_AAA_NORMAL_TEXT,
  contrastRatio,
  findContrastFailures,
  getChartSeries,
  getStatusBadgeClassName,
  getStatusToneStyle,
  meetsContrastRatio,
  meetsNonTextContrast,
  meetsWcagAA,
  meetsWcagAAA,
  parseHexColor,
  relativeLuminance,
  roundContrastRatio,
} from "../../src/lib/contrast.ts";

const GLOBALS_CSS = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

describe("WCAG contrast maths", () => {
  it("parses 3- and 6-digit hex colours", () => {
    assert.deepEqual(parseHexColor("#fff"), { r: 255, g: 255, b: 255 });
    assert.deepEqual(parseHexColor("000000"), { r: 0, g: 0, b: 0 });
    assert.deepEqual(parseHexColor("#66d9ff"), { r: 0x66, g: 0xd9, b: 0xff });
  });

  it("rejects malformed colours instead of guessing", () => {
    assert.throws(() => parseHexColor("#12345"), /Invalid hex colour/);
    assert.throws(() => parseHexColor("not-a-colour"), /Invalid hex colour/);
  });

  it("computes the canonical relative-luminance extremes", () => {
    assert.equal(roundContrastRatio(relativeLuminance("#000000")), 0);
    assert.equal(roundContrastRatio(relativeLuminance("#ffffff")), 1);
  });

  it("yields the canonical 21:1 ratio for black on white", () => {
    assert.equal(roundContrastRatio(contrastRatio("#ffffff", "#000000")), 21);
    assert.equal(roundContrastRatio(contrastRatio("#000000", "#ffffff")), 21);
  });

  it("is symmetric and returns 1:1 for identical colours", () => {
    assert.equal(contrastRatio("#66d9ff", "#ff8080"), contrastRatio("#ff8080", "#66d9ff"));
    assert.equal(roundContrastRatio(contrastRatio("#00ff88", "#00ff88")), 1);
  });

  it("threshold helpers match the WCAG 2.2 levels", () => {
    assert.equal(meetsWcagAA("#767676", "#ffffff"), true); // ~4.54:1
    assert.equal(meetsWcagAAA("#767676", "#ffffff"), false);
    assert.equal(meetsWcagAAA("#595959", "#ffffff"), true); // ~7.0:1
    assert.equal(meetsNonTextContrast("#767676", "#ffffff"), true);
    assert.equal(meetsContrastRatio("#ffffff", "#000000", 21), true);
  });
});

describe("high-contrast palette meets WCAG AAA", () => {
  it("has no text pair below its promised ratio", () => {
    const failures = findContrastFailures(HIGH_CONTRAST_TEXT_PAIRS);
    assert.deepEqual(
      failures,
      [],
      `contrast failures: ${JSON.stringify(failures, null, 2)}`,
    );
  });

  it("has no non-text pair below its promised ratio", () => {
    const failures = findContrastFailures(HIGH_CONTRAST_NON_TEXT_PAIRS);
    assert.deepEqual(failures, []);
  });

  it("keeps every text pair at or above 7:1", () => {
    for (const pair of HIGH_CONTRAST_TEXT_PAIRS) {
      const ratio = roundContrastRatio(contrastRatio(pair.foreground, pair.background));
      assert.ok(
        ratio >= WCAG_AAA_NORMAL_TEXT,
        `${pair.label} is ${ratio}:1 (needs >= ${WCAG_AAA_NORMAL_TEXT}:1)`,
      );
      assert.ok(meetsWcagAAA(pair.foreground, pair.background));
    }
  });

  it("keeps the focus ring and every chart series visible on black", () => {
    for (const pair of HIGH_CONTRAST_NON_TEXT_PAIRS) {
      assert.ok(
        meetsContrastRatio(pair.foreground, pair.background, pair.minimum),
        `${pair.label} fails ${pair.minimum}:1`,
      );
    }
  });

  it("uses a black surface with white text as its base pair", () => {
    assert.equal(HIGH_CONTRAST_BACKGROUND, "#000000");
    assert.equal(HIGH_CONTRAST_FOREGROUND, "#ffffff");
    assert.equal(roundContrastRatio(contrastRatio(HIGH_CONTRAST_FOREGROUND, HIGH_CONTRAST_BACKGROUND)), 21);
  });

  it("reserves status hues that all clear 7:1 on the base surface", () => {
    for (const [tone, color] of Object.entries(HIGH_CONTRAST_STATUS)) {
      assert.ok(
        meetsWcagAAA(color, HIGH_CONTRAST_BACKGROUND),
        `status "${tone}" (${color}) fails AAA`,
      );
    }
  });
});

describe("contrast-aware component helpers", () => {
  it("switches chart series between default and high-contrast palettes", () => {
    const normal = getChartSeries(false);
    const boosted = getChartSeries(true);
    assert.notDeepEqual(normal, boosted);
    assert.ok(boosted.length >= 6);
    for (const color of boosted) {
      assert.ok(meetsWcagAAA(color, HIGH_CONTRAST_BACKGROUND));
    }
  });

  it("returns AAA colours for every status tone in high-contrast mode", () => {
    for (const tone of Object.keys(HIGH_CONTRAST_STATUS) as Array<keyof typeof HIGH_CONTRAST_STATUS>) {
      const style = getStatusToneStyle(tone, true);
      assert.ok(style.minimum >= WCAG_AAA_NORMAL_TEXT);
      assert.ok(meetsWcagAAA(style.color, style.background));
      assert.equal(style.border, style.color);
    }
  });

  it("emits the reusable hc-status-badge classes only in high-contrast mode", () => {
    assert.equal(
      getStatusBadgeClassName("success", true),
      "hc-status-badge hc-status-badge--success",
    );
    assert.equal(getStatusBadgeClassName("success", false), "status-badge status-badge--success");
  });
});

describe("globals.css mirrors the TypeScript palette", () => {
  it("declares the [data-contrast=\"high\"] layer with a legacy class fallback", () => {
    assert.match(GLOBALS_CSS, /\[data-contrast="high"\]/);
    assert.match(GLOBALS_CSS, /\.high-contrast/);
  });

  it("declares every high-contrast token with the palette value", () => {
    for (const [token, value] of Object.entries(HIGH_CONTRAST_CSS_VARIABLES)) {
      assert.ok(
        GLOBALS_CSS.includes(`${token}: ${value};`),
        `globals.css is missing "${token}: ${value};"`,
      );
    }
  });

  it("enforces a 3px focus indicator inside the high-contrast layer", () => {
    assert.match(GLOBALS_CSS, /outline:\s*3px solid var\(--contrast-focus\)/);
  });
});
