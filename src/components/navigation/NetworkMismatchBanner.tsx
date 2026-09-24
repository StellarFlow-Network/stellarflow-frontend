"use client";

/**
 * NetworkMismatchBanner.tsx
 *
 * Displays a non-blocking warning strip when the connected wallet's active
 * network differs from the app-level target network set in `NetworkProvider`.
 *
 * Detection strategy
 * ──────────────────
 * Freighter exposes `getNetwork()` which returns the currently-selected
 * network name (e.g. "TESTNET" or "PUBLIC").  We compare that against the
 * `networkPassphrase` from the active `NetworkConfig` to detect a mismatch.
 *
 * The check runs:
 *   1. On mount (once the component is hydrated).
 *   2. Whenever the app-level network target changes (user flips the selector).
 *   3. On a 10-second polling interval while the banner is visible, in case
 *      the user switches networks inside their wallet extension.
 *
 * The banner is entirely removed from the DOM when there is no mismatch so it
 * does not affect layout or accessibility trees during normal operation.
 *
 * Wallet detection
 * ────────────────
 * `@stellar/freighter-api` is lazy-imported to keep it out of the initial
 * bundle (consistent with the rest of the codebase).  If Freighter is not
 * installed the banner stays hidden — it only warns when there is a concrete
 * conflict, not when the wallet is absent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  NETWORK_CONFIGS,
  useNetwork,
  useNetworkActions,
  type NetworkTarget,
} from "@/app/components/providers/NetworkProvider";
import { useMounted } from "@/app/hooks/useMounted";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** How often (ms) to re-check the wallet's network while the banner is showing */
const POLL_INTERVAL_MS = 10_000;

/**
 * Maps the string returned by `getNetwork()` (Freighter) or the network
 * passphrase to a canonical `NetworkTarget`.
 *
 * Freighter returns a short name such as "TESTNET" or "PUBLIC".
 * We also handle passphrases in case other wallets/integrations expose them.
 */
function normaliseWalletNetwork(raw: string): NetworkTarget | null {
  const upper = raw.trim().toUpperCase();

  // Short name form
  if (upper === "TESTNET" || upper === "TEST") return "testnet";
  if (upper === "PUBLIC" || upper === "MAINNET" || upper === "MAIN") return "mainnet";

  // Passphrase form
  if (raw.includes("Test SDF Network")) return "testnet";
  if (raw.includes("Public Global Stellar Network")) return "mainnet";

  return null; // unknown / custom network
}

// ─────────────────────────────────────────────────────────────────────────────
// Freighter query helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the wallet's currently-selected network as a `NetworkTarget`, or
 * `null` if Freighter is not installed or the query fails.
 *
 * Lazily imports `@stellar/freighter-api` to keep it out of the main bundle.
 */
async function queryWalletNetwork(): Promise<NetworkTarget | null> {
  try {
    const freighter = await import("@stellar/freighter-api");

    // Guard: freighter must be connected before we can read the network.
    const connected = await freighter.isConnected();
    if (!connected) return null;

    // `getNetwork` returns an object `{ network: string, networkPassphrase: string }`
    // in newer versions, or a plain string in older ones.  Handle both.
    const result = await freighter.getNetwork();
    if (!result) return null;

    const rawNetwork =
      typeof result === "string"
        ? result
        : (result as { network?: string; networkPassphrase?: string }).network ??
          (result as { networkPassphrase?: string }).networkPassphrase ??
          "";

    return normaliseWalletNetwork(rawNetwork);
  } catch {
    // Freighter not installed, or query timed out — treat as no wallet.
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkMismatchBannerProps {
  /** Additional CSS class names applied to the outermost wrapper when visible */
  className?: string;
}

/**
 * NetworkMismatchBanner
 *
 * Renders a sticky amber warning strip whenever the Freighter wallet's active
 * network differs from the app's selected network target.
 *
 * - Hidden when there is no mismatch or no wallet connected.
 * - Offers a one-click "Switch app to {walletNetwork}" action so the user can
 *   resolve the mismatch without leaving the page.
 * - Offers a dismiss button that hides the banner for the current session.
 *
 * Must be rendered inside both a `<NetworkProvider>` and, if you want wallet
 * state, a `<WalletProvider>`.  The banner works independently of
 * `<WalletProvider>` — it queries Freighter directly.
 *
 * @example
 * ```tsx
 * // Placed just below the nav bar, outside the page-level scroll container:
 * <Nav />
 * <NetworkMismatchBanner />
 * <main>...</main>
 * ```
 */
export const NetworkMismatchBanner = React.memo(function NetworkMismatchBanner({
  className = "",
}: NetworkMismatchBannerProps) {
  const mounted = useMounted();
  const { network: appNetwork } = useNetwork();
  const { switchNetwork } = useNetworkActions();

  /** The wallet's detected network, or null if undetectable */
  const [walletNetwork, setWalletNetwork] = useState<NetworkTarget | null>(null);
  /** True while the first query hasn't resolved yet */
  const [isChecking, setIsChecking] = useState(false);
  /** User manually dismissed the banner for this session */
  const [dismissed, setDismissed] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Query helper ────────────────────────────────────────────────────────
  const checkWalletNetwork = useCallback(async () => {
    setIsChecking(true);
    const detected = await queryWalletNetwork();
    setWalletNetwork(detected);
    setIsChecking(false);
  }, []);

  // ── Schedule polling ────────────────────────────────────────────────────
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
    }
    pollTimerRef.current = setTimeout(() => {
      void checkWalletNetwork().then(schedulePoll);
    }, POLL_INTERVAL_MS);
  }, [checkWalletNetwork]);

  // ── Initial check + restart on network target change ────────────────────
  useEffect(() => {
    if (!mounted) return;
    setDismissed(false); // A network target change resets the dismissal
    void checkWalletNetwork().then(schedulePoll);

    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // Re-run whenever the app network changes so the banner refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, appNetwork]);

  // ── Resolve mismatch: switch app to wallet's network ────────────────────
  const handleSwitchApp = useCallback(() => {
    if (walletNetwork) {
      void switchNetwork(walletNetwork);
      setDismissed(true);
    }
  }, [walletNetwork, switchNetwork]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // ── Visibility logic ────────────────────────────────────────────────────
  const hasMismatch =
    walletNetwork !== null && walletNetwork !== appNetwork;

  const isVisible = hasMismatch && !dismissed && !isChecking;

  if (!mounted || !isVisible) return null;

  const walletConfig = NETWORK_CONFIGS[walletNetwork!];
  const appConfig = NETWORK_CONFIGS[appNetwork];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        "w-full bg-amber-950/60 border-b border-amber-500/30",
        "px-4 py-2.5 flex items-center gap-3 flex-wrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ contain: "layout style" }}
    >
      {/* Warning icon */}
      <Icon
        id={ICON_IDS.alertTriangle}
        size={16}
        className="text-amber-400 shrink-0"
        aria-hidden
      />

      {/* Message */}
      <p className="flex-1 min-w-0 text-xs text-amber-200 leading-snug">
        <span className="font-semibold">Network mismatch: </span>
        your wallet is on{" "}
        <span className="font-mono font-semibold text-amber-300">
          {walletConfig.label}
        </span>{" "}
        but the app is targeting{" "}
        <span className="font-mono font-semibold text-amber-300">
          {appConfig.label}
        </span>
        . Transactions will fail until both match.
      </p>

      {/* Action: align app to wallet */}
      <button
        type="button"
        onClick={handleSwitchApp}
        className={[
          "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold",
          "transition-colors duration-150",
          walletNetwork === "mainnet"
            ? "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            : "border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
        ].join(" ")}
      >
        Switch app to {walletConfig.label}
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss network mismatch warning"
        className="shrink-0 p-1 rounded text-amber-500/70 hover:text-amber-300 hover:bg-amber-500/10 transition-colors duration-150"
      >
        <Icon id={ICON_IDS.xCircle} size={14} aria-hidden />
      </button>
    </div>
  );
});

NetworkMismatchBanner.displayName = "NetworkMismatchBanner";

export default NetworkMismatchBanner;
