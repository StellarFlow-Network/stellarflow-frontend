/**
 * tests/unit/glassTheme.test.ts
 *
 * Unit tests for the glassmorphism theme composition helpers.
 *
 * Run with Node's built-in test runner (Node >= 24, no extra dependencies):
 *
 *   node --test tests/unit/glassTheme.test.ts
 *
 * The module under test is plain TypeScript with no JSX and no DOM access, so
 * it loads directly under Node's type stripping.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GLASS_BASE_CLASS,
  GLASS_DEFAULT_BLUR,
  GLASS_DEFAULT_SATURATE,
  GLASS_MAX_BLUR,
  GLASS_MAX_SATURATE,
  GLASS_MIN_BLUR,
  GLASS_MIN_SATURATE,
  GLASS_TOKEN,
  GLASS_VARIANTS,
  GLASS_VARIANT_CLASS,
  buildGlassStyle,
  clampGlassBlur,
  clampGlassSaturate,
  isGlassVariant,
  resolveGlassClassName,
  splitGlassProps,
} from "../../src/components/glass/glassTheme.ts";

describe("glassTheme variant contract", () => {
  it("maps every declared variant to a distinct glass class", () => {
    const classes = GLASS_VARIANTS.map(
      (variant) => GLASS_VARIANT_CLASS[variant],
    );

    assert.equal(classes.length, GLASS_VARIANTS.length);
    assert.equal(new Set(classes).size, GLASS_VARIANTS.length);
    for (const className of classes) {
      assert.match(className, /^glass-[a-z]+$/);
      assert.notEqual(className, GLASS_BASE_CLASS);
    }
  });

  it("recognises only declared variants", () => {
    for (const variant of GLASS_VARIANTS) {
      assert.equal(isGlassVariant(variant), true);
    }

    assert.equal(isGlassVariant("glass"), false);
    assert.equal(isGlassVariant("super-modal"), false);
    assert.equal(isGlassVariant(undefined), false);
    assert.equal(isGlassVariant(null), false);
    assert.equal(isGlassVariant(42), false);
  });
});

describe("resolveGlassClassName", () => {
  it("defaults to the base layer plus the panel preset", () => {
    assert.equal(
      resolveGlassClassName(),
      `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.panel}`,
    );
  });

  it("places the base layer first and appends caller classes", () => {
    const result = resolveGlassClassName({
      variant: "modal",
      className: "rounded-2xl border p-6",
    });

    assert.equal(
      result,
      `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.modal} rounded-2xl border p-6`,
    );
  });

  it("normalises whitespace and drops duplicate tokens", () => {
    const result = resolveGlassClassName({
      variant: "modal",
      className: "  rounded-xl   rounded-xl  \t\n ",
    });

    assert.equal(
      result,
      `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.modal} rounded-xl`,
    );
  });

  it("drops caller duplicates of the base and variant layers", () => {
    const result = resolveGlassClassName({
      variant: "nav",
      className: `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.nav} custom`,
    });

    assert.equal(
      result,
      `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.nav} custom`,
    );
  });

  it("falls back to the panel preset for an unknown variant", () => {
    const result = resolveGlassClassName({
      variant: "hologram" as never,
      className: "rounded-lg",
    });

    assert.equal(
      result,
      `${GLASS_BASE_CLASS} ${GLASS_VARIANT_CLASS.panel} rounded-lg`,
    );
  });
});

describe("clampGlassBlur", () => {
  it("passes through in-range values", () => {
    assert.equal(clampGlassBlur(GLASS_MIN_BLUR), GLASS_MIN_BLUR);
    assert.equal(clampGlassBlur(GLASS_DEFAULT_BLUR), GLASS_DEFAULT_BLUR);
    assert.equal(clampGlassBlur(GLASS_MAX_BLUR), GLASS_MAX_BLUR);
  });

  it("clamps values outside the sustained-perf range", () => {
    assert.equal(clampGlassBlur(-12), GLASS_MIN_BLUR);
    assert.equal(clampGlassBlur(GLASS_MAX_BLUR + 60), GLASS_MAX_BLUR);
  });

  it("falls back to the default for missing or non-finite input", () => {
    assert.equal(clampGlassBlur(undefined), GLASS_DEFAULT_BLUR);
    assert.equal(clampGlassBlur(null), GLASS_DEFAULT_BLUR);
    assert.equal(clampGlassBlur(Number.NaN), GLASS_DEFAULT_BLUR);
    assert.equal(clampGlassBlur(Number.POSITIVE_INFINITY), GLASS_DEFAULT_BLUR);
  });
});

describe("clampGlassSaturate", () => {
  it("clamps to the supported saturation window", () => {
    assert.equal(clampGlassSaturate(GLASS_MIN_SATURATE), GLASS_MIN_SATURATE);
    assert.equal(clampGlassSaturate(GLASS_MAX_SATURATE), GLASS_MAX_SATURATE);
    assert.equal(clampGlassSaturate(10), GLASS_MIN_SATURATE);
    assert.equal(clampGlassSaturate(900), GLASS_MAX_SATURATE);
  });

  it("falls back to the default for missing or non-finite input", () => {
    assert.equal(clampGlassSaturate(undefined), GLASS_DEFAULT_SATURATE);
    assert.equal(clampGlassSaturate(Number.NaN), GLASS_DEFAULT_SATURATE);
  });
});

describe("buildGlassStyle", () => {
  it("emits nothing when no tuning is supplied", () => {
    assert.deepEqual(buildGlassStyle(), {});
    assert.deepEqual(buildGlassStyle({}), {});
  });

  it("emits only the tokens the caller supplied", () => {
    assert.deepEqual(buildGlassStyle({ blur: 20 }), {
      [GLASS_TOKEN.blur]: "20px",
    });

    assert.deepEqual(buildGlassStyle({ saturate: 180 }), {
      [GLASS_TOKEN.saturate]: "180%",
    });
  });

  it("emits both tokens and clamps out-of-range values", () => {
    assert.deepEqual(buildGlassStyle({ blur: 999, saturate: 5 }), {
      [GLASS_TOKEN.blur]: `${GLASS_MAX_BLUR}px`,
      [GLASS_TOKEN.saturate]: `${GLASS_MIN_SATURATE}%`,
    });
  });

  it("never emits a non-finite CSS value", () => {
    const style = buildGlassStyle({ blur: Number.NaN, saturate: Number.NaN });

    assert.deepEqual(style, {
      [GLASS_TOKEN.blur]: `${GLASS_DEFAULT_BLUR}px`,
      [GLASS_TOKEN.saturate]: `${GLASS_DEFAULT_SATURATE}%`,
    });
    for (const value of Object.values(style)) {
      assert.doesNotMatch(value, /NaN|Infinity/);
    }
  });
});

describe("splitGlassProps", () => {
  it("separates glass tuning from DOM props", () => {
    const props = { blur: 24, saturate: 140, id: "panel", role: "region" };
    const { glass, rest } = splitGlassProps(props);

    assert.deepEqual(glass, { blur: 24, saturate: 140 });
    assert.deepEqual(rest, { id: "panel", role: "region" });
    assert.equal("blur" in rest, false);
    assert.equal("saturate" in rest, false);
  });

  it("omits absent tuning keys so CSS tokens stay in control", () => {
    const { glass, rest } = splitGlassProps({ className: "custom" });

    assert.deepEqual(glass, {});
    assert.deepEqual(Object.keys(glass), []);
    assert.deepEqual(rest, { className: "custom" });
  });

  it("does not mutate the input object", () => {
    const props = { blur: 12, id: "surface" };
    splitGlassProps(props);

    assert.deepEqual(props, { blur: 12, id: "surface" });
  });
});
