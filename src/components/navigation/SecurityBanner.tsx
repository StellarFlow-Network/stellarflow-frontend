"use client";

/**
 * SecurityBanner.tsx
 *
 * Anti-phishing domain verification indicator.
 *
 * Two independent signals are checked on mount:
 *   1. `window.location.hostname` is compared against a registry of official
 *      StellarFlow domains. A match renders a small "verified" badge in the
 *      top navigation bar; a mismatch renders a "not verified" badge instead.
 *   2. The page is checked for being framed (`window.self !== window.top`,
 *      guarded by a try/catch for cross-origin frame access errors) or
 *      loaded on a hostname outside the registry. Either condition raises a
 *      full-screen warning overlay that blocks interaction with the page
 *      until the user explicitly acknowledges the risk.
 *
 * Cross-origin framing intentionally throws when reading `window.top.location`,
 * so any access error is itself treated as evidence of framing rather than
 * being swallowed silently.
 */

import React, { useEffect, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useMounted } from "@/app/hooks/useMounted";

// ─────────────────────────────────────────────────────────────────────────────
// Official domain registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hostnames the app is officially served from. Extend this list when a new
 * production or staging domain is provisioned.
 */
export const OFFICIAL_DOMAINS: readonly string[] = [
  "app.stellarflow.network",
  "stellarflow.network",
  "staging.stellarflow.network",
  // Local development
  "localhost",
  "127.0.0.1",
];

function isOfficialHostname(hostname: string): boolean {
  const normalised = hostname.trim().toLowerCase();
  return OFFICIAL_DOMAINS.some(
    (domain) => normalised === domain || normalised.endsWith(`.${domain}`),
  );
}

/**
 * Detects whether the current document is rendered inside a frame.
 * Reading `window.top` across an origin boundary throws in most browsers,
 * so that failure is itself treated as "framed" rather than "unknown".
 */
function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityBannerProps {
  /** Additional CSS class names applied to the badge's outer wrapper */
  className?: string;
}

interface DomainCheckResult {
  hostname: string;
  verified: boolean;
  framed: boolean;
}

function runDomainCheck(): DomainCheckResult {
  const hostname = window.location.hostname;
  return {
    hostname,
    verified: isOfficialHostname(hostname),
    framed: isFramed(),
  };
}

/**
 * SecurityBanner
 *
 * Renders a compact domain-verification badge for the top navigation bar and,
 * when the app is loaded inside an iframe or on a hostname outside the
 * official registry, a blocking full-screen warning overlay.
 *
 * @example
 * ```tsx
 * <nav>
 *   <Logo />
 *   <SecurityBanner />
 * </nav>
 * ```
 */
export const SecurityBanner = React.memo(function SecurityBanner({
  className = "",
}: SecurityBannerProps) {
  const mounted = useMounted();
  const [check, setCheck] = useState<DomainCheckResult | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    setCheck(runDomainCheck());
  }, [mounted]);

  if (!mounted || !check) return null;

  const showOverlay = (check.framed || !check.verified) && !overlayDismissed;

  return (
    <>
      {/* ── Navigation badge ─────────────────────────────────────────────── */}
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          check.verified
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
            : "border-red-500/40 bg-red-950/20 text-red-400",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        title={
          check.verified
            ? `Verified official domain: ${check.hostname}`
            : `Unrecognised domain: ${check.hostname}`
        }
      >
        <Icon
          id={check.verified ? ICON_IDS.shieldCheck : ICON_IDS.shieldAlert}
          size={13}
          aria-hidden
        />
        {check.verified ? "Verified Domain" : "Unverified Domain"}
      </span>

      {/* ── Blocking warning overlay ─────────────────────────────────────── */}
      {showOverlay && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="phishing-guard-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950/40 text-red-400">
                <Icon id={ICON_IDS.shieldAlert} size={20} aria-hidden />
              </span>
              <h2
                id="phishing-guard-title"
                className="text-lg font-semibold text-red-300"
              >
                Possible Phishing Site
              </h2>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed mb-2">
              {check.framed
                ? "This page is being displayed inside another site's frame. Official StellarFlow pages are never embedded in a frame."
                : `This domain ("${check.hostname}") is not on the official StellarFlow domain registry.`}
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              Do not connect your wallet, enter your seed phrase, or sign any
              transaction here. Only trust:{" "}
              <span className="font-mono text-gray-200">
                {OFFICIAL_DOMAINS.filter(
                  (d) => d !== "localhost" && d !== "127.0.0.1",
                ).join(", ")}
              </span>
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <a
                href={`https://${OFFICIAL_DOMAINS[0]}`}
                className="rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Go to official site
              </a>
              <button
                type="button"
                onClick={() => setOverlayDismissed(true)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
              >
                I understand the risk, continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

SecurityBanner.displayName = "SecurityBanner";

export default SecurityBanner;
