import { describe, expect, it } from "vitest";
import {
  rgbToHex,
  hexToRgb,
  getRelativeLuminance,
  rgbToHsl,
  hslToRgb,
  adaptColorForDarkTheme,
  buildExtractedColor,
  DEFAULT_PROTOCOL_BLUE_HEX,
  DEFAULT_PROTOCOL_BLUE_RGB,
} from "@/hooks/ui/useAssetThemeColor";

describe("useAssetThemeColor Color Math & Contrast Compliance", () => {
  it("converts RGB to Hex and Hex to RGB accurately", () => {
    expect(rgbToHex(59, 130, 246)).toBe("#3b82f6");
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");

    const parsed = hexToRgb("#3b82f6");
    expect(parsed).toEqual({ r: 59, g: 130, b: 246 });

    const shortParsed = hexToRgb("#fff");
    expect(shortParsed).toEqual({ r: 255, g: 255, b: 255 });

    const invalidParsed = hexToRgb("invalid");
    expect(invalidParsed).toEqual(DEFAULT_PROTOCOL_BLUE_RGB);
  });

  it("calculates relative luminance accurately according to WCAG sRGB formula", () => {
    const whiteLuminance = getRelativeLuminance(255, 255, 255);
    expect(whiteLuminance).toBeCloseTo(1, 4);

    const blackLuminance = getRelativeLuminance(0, 0, 0);
    expect(blackLuminance).toBeCloseTo(0, 4);

    const protocolBlueLuminance = getRelativeLuminance(59, 130, 246);
    expect(protocolBlueLuminance).toBeGreaterThan(0.2);
    expect(protocolBlueLuminance).toBeLessThan(0.3);
  });

  it("converts RGB to HSL and back losslessly", () => {
    const [h, s, l] = rgbToHsl(59, 130, 246);
    expect(h).toBeCloseTo(217, 0);
    expect(s).toBeCloseTo(0.91, 1);
    expect(l).toBeCloseTo(0.60, 1);

    const rgbBack = hslToRgb(h, s, l);
    expect(rgbBack.r).toBeCloseTo(59, 0);
    expect(rgbBack.g).toBeCloseTo(130, 0);
    expect(rgbBack.b).toBeCloseTo(246, 0);
  });

  describe("Dark Background Contrast Compliance (adaptColorForDarkTheme)", () => {
    it("boosts excessively dark colors so they glow visibly against #0d1117", () => {
      // Very dark logo color (e.g. pitch black or dark grey logo)
      const darkLogoRgb = { r: 10, g: 12, b: 15 };
      const { color: adapted, adapted: wasAdapted } = adaptColorForDarkTheme(darkLogoRgb);

      expect(wasAdapted).toBe(true);
      // Adapted color should have boosted luminance and lightness
      const adaptedLuminance = getRelativeLuminance(adapted.r, adapted.g, adapted.b);
      expect(adaptedLuminance).toBeGreaterThan(0.18);
      expect(adapted.r + adapted.g + adapted.b).toBeGreaterThan(150);
    });

    it("preserves vibrant brand colors that already contrast well on dark mode", () => {
      // Vibrant USDC blue
      const usdcBlue = { r: 39, g: 117, b: 202 };
      const { color: usdcResult, adapted: usdcAdapted } = adaptColorForDarkTheme(usdcBlue);
      expect(usdcAdapted).toBe(false);
      expect(usdcResult).toEqual(usdcBlue);

      // Vibrant Bitcoin Orange
      const btcOrange = { r: 247, g: 147, b: 26 };
      const { color: btcResult, adapted: btcAdapted } = adaptColorForDarkTheme(btcOrange);
      expect(btcAdapted).toBe(false);
      expect(btcResult).toEqual(btcOrange);
    });
  });

  describe("Extracted Color Object Builder & Styles", () => {
    it("builds extracted color object with rgba helper and hex", () => {
      const extracted = buildExtractedColor(59, 130, 246, false);
      expect(extracted.hex).toBe(DEFAULT_PROTOCOL_BLUE_HEX);
      expect(extracted.rgb).toBe("rgb(59, 130, 246)");
      expect(extracted.rgba(0.5)).toBe("rgba(59, 130, 246, 0.5)");
      expect(extracted.rgba(0)).toBe("rgba(59, 130, 246, 0)");
      expect(extracted.rgba(1)).toBe("rgba(59, 130, 246, 1)");
    });

    it("verifies protocol blue fallback values", () => {
      expect(DEFAULT_PROTOCOL_BLUE_HEX).toBe("#3b82f6");
      expect(DEFAULT_PROTOCOL_BLUE_RGB).toEqual({ r: 59, g: 130, b: 246 });
    });
  });
});
