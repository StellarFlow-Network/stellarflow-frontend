import { describe, expect, it, beforeEach } from "vitest";
import {
  formatCspPayload,
  isBrowserExtensionViolation,
  type CspViolationMetadata,
} from "@/utils/cspReporter";
import {
  cspViolationStore,
  calculateCspSeverity,
} from "@/lib/security/cspViolationStore";

describe("cspReporter Client Handler & Filter", () => {
  it("captures blockedURI, violatedDirective, and documentURI metadata accurately", () => {
    const rawViolation: Partial<CspViolationMetadata> = {
      blockedURI: "https://evil-tracker.com/malicious.js",
      violatedDirective: "script-src",
      effectiveDirective: "script-src-elem",
      documentURI: "https://stellarflow.io/swap",
      referrer: "https://google.com",
      disposition: "enforce",
      statusCode: 200,
      lineNumber: 120,
      columnNumber: 45,
      sourceFile: "https://stellarflow.io/_next/static/chunks/main.js",
      originalPolicy: "default-src 'self'; script-src 'self'",
    };

    const formatted = formatCspPayload(rawViolation);

    expect(formatted.blockedURI).toBe("https://evil-tracker.com/malicious.js");
    expect(formatted.violatedDirective).toBe("script-src");
    expect(formatted.effectiveDirective).toBe("script-src-elem");
    expect(formatted.documentURI).toBe("https://stellarflow.io/swap");
    expect(formatted.referrer).toBe("https://google.com");
    expect(formatted.disposition).toBe("enforce");
    expect(formatted.statusCode).toBe(200);
    expect(formatted.lineNumber).toBe(120);
    expect(formatted.columnNumber).toBe(45);
    expect(formatted.isExtensionNoise).toBe(false);
  });

  describe("Browser Extension False Positive Filtering", () => {
    it("identifies chrome-extension:// schemes as extension noise", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);

      expect(
        isBrowserExtensionViolation({
          blockedURI: "https://legitimate.org/app.js",
          sourceFile: "chrome-extension://abcdefghijklmnop/content.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);
    });

    it("identifies moz-extension:// schemes as extension noise", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "moz-extension://d6b797ff-2e65-4f24-be00-111111111111/page.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);
    });

    it("identifies safari-web-extension:// schemes as extension noise", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "safari-web-extension://12345-6789/script.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);
    });

    it("identifies known extension filenames like inpage.js or contentscript", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "https://unknown.com/contentscript.js",
          sourceFile: "contentscript.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);

      expect(
        isBrowserExtensionViolation({
          blockedURI: "https://domain.com/inpage.js",
          violatedDirective: "script-src",
        })
      ).toBe(true);
    });

    it("identifies web3 wallet injected samples as extension noise", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "eval",
          violatedDirective: "script-src",
          sample: "window.ethereum = new MetaMaskProvider()",
        })
      ).toBe(true);
    });

    it("does NOT filter legitimate application violations", () => {
      expect(
        isBrowserExtensionViolation({
          blockedURI: "https://attacker-cdn.com/exfiltrate.php",
          sourceFile: "https://stellarflow.io/bundle.js",
          documentURI: "https://stellarflow.io/swap",
          violatedDirective: "connect-src",
        })
      ).toBe(false);

      expect(
        isBrowserExtensionViolation({
          blockedURI: "https://untrusted-fonts.xyz/font.woff2",
          violatedDirective: "font-src",
          documentURI: "https://stellarflow.io/governance",
        })
      ).toBe(false);
    });
  });
});

describe("cspViolationStore Server Aggregation", () => {
  beforeEach(() => {
    cspViolationStore.clear();
  });

  it("assigns appropriate severity to directives", () => {
    expect(calculateCspSeverity("script-src")).toBe("Critical");
    expect(calculateCspSeverity("object-src")).toBe("Critical");
    expect(calculateCspSeverity("base-uri")).toBe("Critical");
    expect(calculateCspSeverity("connect-src")).toBe("High");
    expect(calculateCspSeverity("style-src")).toBe("Medium");
    expect(calculateCspSeverity("frame-ancestors")).toBe("Medium");
    expect(calculateCspSeverity("img-src")).toBe("Low");
    expect(calculateCspSeverity("font-src")).toBe("Low");
  });

  it("accurately aggregates violation counts by violated directive", () => {
    // Record multiple incidents
    cspViolationStore.recordViolation({
      blockedURI: "https://evil-1.com/xss.js",
      violatedDirective: "script-src",
      documentURI: "https://stellarflow.io/swap",
      disposition: "enforce",
    });

    cspViolationStore.recordViolation({
      blockedURI: "https://evil-2.com/xss.js",
      violatedDirective: "script-src",
      documentURI: "https://stellarflow.io/governance",
      disposition: "enforce",
    });

    cspViolationStore.recordViolation({
      blockedURI: "wss://unauthorized-stream.io",
      violatedDirective: "connect-src",
      documentURI: "https://stellarflow.io/relayers",
      disposition: "enforce",
    });

    cspViolationStore.recordViolation({
      blockedURI: "https://bad-image.com/pixel.gif",
      violatedDirective: "img-src",
      documentURI: "https://stellarflow.io/dashboard",
      disposition: "report",
    });

    const metrics = cspViolationStore.getAggregatedMetrics();

    expect(metrics.totalViolations).toBe(4);
    expect(metrics.directives["script-src"]).toBe(2);
    expect(metrics.directives["connect-src"]).toBe(1);
    expect(metrics.directives["img-src"]).toBe(1);
    expect(metrics.enforcedViolations).toBe(3);
    expect(metrics.reportOnlyViolations).toBe(1);

    // Verify directive metrics percentages
    const scriptMetric = metrics.directiveMetrics.find((m) => m.directive === "script-src");
    expect(scriptMetric).toBeDefined();
    expect(scriptMetric?.count).toBe(2);
    expect(scriptMetric?.percentage).toBe(50);
    expect(scriptMetric?.severity).toBe("Critical");
  });

  it("filters extension violations from real totals while incrementing filtered count", () => {
    // 1 real violation
    cspViolationStore.recordViolation({
      blockedURI: "https://real-bad-domain.com/steal.js",
      violatedDirective: "script-src",
      documentURI: "https://stellarflow.io/swap",
    });

    // 2 extension false positives
    cspViolationStore.recordViolation({
      blockedURI: "chrome-extension://12345/inject.js",
      violatedDirective: "script-src",
      documentURI: "https://stellarflow.io/swap",
    });

    cspViolationStore.recordViolation({
      blockedURI: "moz-extension://abcdef/contentscript.js",
      violatedDirective: "script-src",
      documentURI: "https://stellarflow.io/swap",
    });

    const metrics = cspViolationStore.getAggregatedMetrics();

    // Total non-noise violations should be 1
    expect(metrics.totalViolations).toBe(1);
    // Filtered count should be 2
    expect(metrics.extensionNoiseFiltered).toBe(2);
  });

  it("catalogs top offending blocked URIs", () => {
    for (let i = 0; i < 3; i++) {
      cspViolationStore.recordViolation({
        blockedURI: "https://repeated-attacker.com/beacon",
        violatedDirective: "connect-src",
        documentURI: "https://stellarflow.io/swap",
      });
    }

    cspViolationStore.recordViolation({
      blockedURI: "https://once-seen.com/pixel",
      violatedDirective: "img-src",
      documentURI: "https://stellarflow.io/swap",
    });

    const metrics = cspViolationStore.getAggregatedMetrics();

    expect(metrics.topBlockedURIs[0].uri).toBe("https://repeated-attacker.com/beacon");
    expect(metrics.topBlockedURIs[0].count).toBe(3);
    expect(metrics.topBlockedURIs[1].uri).toBe("https://once-seen.com/pixel");
    expect(metrics.topBlockedURIs[1].count).toBe(1);
  });
});
