"use client";

/**
 * XBullWalletProvider.tsx
 *
 * xBull Hardware Wallet Extension Connect Provider Component
 *
 * Responsibilities
 * ────────────────
 * 1. Detect xBull browser extension presence via `window.xBullSDK`.
 * 2. Connect to xBull Wallet and obtain a Stellar public key.
 * 3. Poll for active account changes and propagate them to WalletProvider
 *    context via the onConnected / onDisconnected callbacks.
 * 4. Support Soroban XDR transaction signing with testnet / mainnet network
 *    parameter declarations.
 * 5. Show descriptive error toasts when connection is rejected or signing
 *    fails.
 *
 * Design notes
 * ────────────
 * - Follows the same modal / dialog pattern as LedgerConnectModal.tsx.
 * - All window/browser API access is SSR-guarded (typeof window checks).
 * - The xBullWalletConnect bridge instance is created per operation then
 *   closed immediately — the library recommends creating a fresh bridge
 *   for each interaction to avoid stale event listeners.
 * - Account-switch detection uses a polling approach (every POLL_INTERVAL_MS)
 *   calling connect() silently; when the returned publicKey differs from the
 *   current one the parent is notified via onAccountSwitch.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { xBullWalletConnect } from "@creit.tech/xbull-wallet-connect";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** xBull extension injection key on the browser window. */
const XBULL_SDK_KEY = "xBullSDK" as const;

/** How often to poll for account changes while the wallet is connected (ms). */
const POLL_INTERVAL_MS = 3_000;

/** Stellar testnet network passphrase. */
export const STELLAR_TESTNET_PASSPHRASE =
  "Test SDF Network ; September 2015" as const;

/** Stellar mainnet (public) network passphrase. */
export const STELLAR_MAINNET_PASSPHRASE =
  "Public Global Stellar Network ; September 2015" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported Stellar networks for xBull signing. */
export type XBullNetwork = "testnet" | "mainnet";

/** Connection lifecycle state. */
export type XBullConnectionStep =
  | "idle"
  | "detecting"
  | "connecting"
  | "connected"
  | "signing"
  | "error";

/** Internal state slice managed by this component. */
interface XBullState {
  step: XBullConnectionStep;
  publicKey: string | null;
  errorMessage: string | null;
}

export interface XBullWalletProviderProps {
  /** Controls dialog visibility. */
  isOpen: boolean;
  /** Called when the user dismisses the dialog. */
  onClose: () => void;
  /**
   * Fires once after a successful connection with the public key.
   * Consumers should store this in app-level wallet state.
   */
  onConnected?: (publicKey: string) => void;
  /**
   * Fires when the active account inside xBull changes while the wallet is
   * connected.  The component will continuously poll while connected, so callers
   * can update their session state to the new key.
   */
  onAccountSwitch?: (newPublicKey: string) => void;
  /**
   * Fires if the wallet disconnects / extension becomes unavailable while
   * connected.
   */
  onDisconnected?: () => void;
  /**
   * Fires after a transaction is successfully signed, passing back the signed
   * XDR string to the caller.
   */
  onSignTransaction?: (signedXdr: string, publicKey: string) => void;
  /** Default network to use for signing. Defaults to "testnet". */
  defaultNetwork?: XBullNetwork;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension detection helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the xBull browser extension is currently injected into the
 * page.  Detection is based on `window.xBullSDK` per the official integration
 * spec.  SSR-safe: returns false on the server.
 */
function isXBullExtensionInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return XBULL_SDK_KEY in window && window[XBULL_SDK_KEY] != null;
}

/**
 * Creates a new xBullWalletConnect bridge instance targeting the extension.
 * Always prefer the extension over the webapp fallback so users get the
 * native hardware signing experience.
 */
function createBridge(): xBullWalletConnect {
  return new xBullWalletConnect({ preferredTarget: "extension" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Network passphrase helper
// ─────────────────────────────────────────────────────────────────────────────

function networkPassphrase(network: XBullNetwork): string {
  return network === "mainnet"
    ? STELLAR_MAINNET_PASSPHRASE
    : STELLAR_TESTNET_PASSPHRASE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status labels
// ─────────────────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<XBullConnectionStep, string> = {
  idle: "Ready to connect",
  detecting: "Detecting xBull extension...",
  connecting: "Waiting for authorization in xBull...",
  connected: "xBull connected",
  signing: "Review transaction in xBull extension...",
  error: "Connection failed",
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function XBullWalletProvider({
  isOpen,
  onClose,
  onConnected,
  onAccountSwitch,
  onDisconnected,
  onSignTransaction,
  defaultNetwork = "testnet",
}: XBullWalletProviderProps) {
  const { addToast, updateToast } = useToast();

  // ── Component state ────────────────────────────────────────────────────
  const [state, setState] = useState<XBullState>({
    step: "idle",
    publicKey: null,
    errorMessage: null,
  });

  // Transaction signing form state
  const [txXdr, setTxXdr] = useState("");
  const [txNetwork, setTxNetwork] = useState<XBullNetwork>(defaultNetwork);
  const [signError, setSignError] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────
  /** Guard against state updates after unmount. */
  const mountedRef = useRef(true);
  /** Ref to the active account-switch polling interval. */
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * Ref holding the last known publicKey for account-switch diffing inside
   * the polling callback (avoids a stale closure over state).
   */
  const currentPublicKeyRef = useRef<string | null>(null);

  // Whether the extension was found in the browser
  const [extensionInstalled, setExtensionInstalled] = useState<
    boolean | null
  >(null);

  // ── Extension detection on open ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    // Detection runs client-side only
    const found = isXBullExtensionInstalled();
    setExtensionInstalled(found);

    if (!found) {
      setState({
        step: "error",
        publicKey: null,
        errorMessage:
          "xBull extension is not installed. Please install it from https://xbull.app and reload the page.",
      });
    } else {
      setState({ step: "idle", publicKey: null, errorMessage: null });
    }
  }, [isOpen]);

  // ── Reset on close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setState({ step: "idle", publicKey: null, errorMessage: null });
      setTxXdr("");
      setSignError(null);
      currentPublicKeyRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling helpers ────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Start an interval that silently calls connect() to check the active
   * account.  When the returned key differs from the last-known key we
   * treat it as an account switch and notify the parent.
   */
  const startPolling = useCallback(() => {
    stopPolling();

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      if (!isXBullExtensionInstalled()) {
        // Extension disappeared (e.g. user disabled it)
        stopPolling();
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            step: "error",
            errorMessage:
              "xBull extension is no longer available. Please reload the page.",
          }));
          currentPublicKeyRef.current = null;
          onDisconnected?.();
        }
        return;
      }

      let bridge: xBullWalletConnect | null = null;
      try {
        bridge = createBridge();
        // Use silent re-connect — the extension returns the current active key
        // without re-prompting if the site is already authorised.
        const polledKey = await bridge.connect({
          canRequestPublicKey: true,
          canRequestSign: false,
        });
        bridge.closeConnections();
        bridge = null;

        if (!mountedRef.current) return;

        if (polledKey && polledKey !== currentPublicKeyRef.current) {
          currentPublicKeyRef.current = polledKey;
          setState((prev) => ({ ...prev, publicKey: polledKey }));
          onAccountSwitch?.(polledKey);
        }
      } catch {
        // Swallow errors from silent poll — don't disrupt the UI for transient
        // failures (e.g. extension temporarily busy).  The next tick will retry.
        bridge?.closeConnections();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, onAccountSwitch, onDisconnected]);

  // ── Connect handler ────────────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    if (!mountedRef.current) return;

    setState({ step: "detecting", publicKey: null, errorMessage: null });

    if (!isXBullExtensionInstalled()) {
      setState({
        step: "error",
        publicKey: null,
        errorMessage:
          "xBull extension is not installed. Please install it from https://xbull.app and reload the page.",
      });
      addToast({
        title: "xBull not found",
        description:
          "Install the xBull browser extension from https://xbull.app and reload.",
        status: "failed",
      });
      return;
    }

    setState((prev) => ({ ...prev, step: "connecting" }));

    let bridge: xBullWalletConnect | null = null;
    try {
      bridge = createBridge();

      const publicKey = await bridge.connect({
        canRequestPublicKey: true,
        canRequestSign: true,
      });

      bridge.closeConnections();
      bridge = null;

      if (!mountedRef.current) return;

      if (!publicKey) {
        throw new Error("xBull returned an empty public key.");
      }

      currentPublicKeyRef.current = publicKey;
      setState({ step: "connected", publicKey, errorMessage: null });
      onConnected?.(publicKey);

      // Begin polling for account switches
      startPolling();
    } catch (err: unknown) {
      bridge?.closeConnections();

      if (!mountedRef.current) return;

      const raw = err instanceof Error ? err.message : String(err);
      // Normalise common rejection / cancellation messages
      const isRejection =
        raw.toLowerCase().includes("reject") ||
        raw.toLowerCase().includes("cancel") ||
        raw.toLowerCase().includes("denied") ||
        raw.toLowerCase().includes("user refused");

      const userMessage = isRejection
        ? "Connection was rejected in xBull. Please approve the connection request in the extension."
        : `Failed to connect to xBull: ${raw}`;

      setState({ step: "error", publicKey: null, errorMessage: userMessage });

      addToast({
        title: isRejection ? "xBull connection rejected" : "xBull connection failed",
        description: userMessage,
        status: "failed",
      });
    }
  }, [addToast, onConnected, startPolling]);

  // ── Sign transaction handler ───────────────────────────────────────────

  const handleSign = useCallback(async () => {
    if (!state.publicKey || !txXdr.trim() || !mountedRef.current) return;

    setSignError(null);
    setState((prev) => ({ ...prev, step: "signing" }));

    const toastId = addToast({
      title: "xBull signing",
      description: "Review and approve the transaction in your xBull extension.",
      status: "processing",
    });

    let bridge: xBullWalletConnect | null = null;
    try {
      bridge = createBridge();

      const signedXdr = await bridge.sign({
        xdr: txXdr.trim(),
        publicKey: state.publicKey,
        network: networkPassphrase(txNetwork),
      });

      bridge.closeConnections();
      bridge = null;

      if (!mountedRef.current) return;

      updateToast(toastId, {
        status: "confirmed",
        title: "Transaction signed",
        description: "xBull has signed your transaction successfully.",
      });

      setState((prev) => ({ ...prev, step: "connected" }));
      onSignTransaction?.(signedXdr, state.publicKey);
      setTxXdr("");
    } catch (err: unknown) {
      bridge?.closeConnections();

      if (!mountedRef.current) return;

      const raw = err instanceof Error ? err.message : String(err);
      const isRejection =
        raw.toLowerCase().includes("reject") ||
        raw.toLowerCase().includes("cancel") ||
        raw.toLowerCase().includes("denied") ||
        raw.toLowerCase().includes("user refused");

      const userMessage = isRejection
        ? "Transaction was rejected in xBull extension."
        : `Signing failed: ${raw}`;

      setSignError(userMessage);
      setState((prev) => ({ ...prev, step: "connected" }));

      updateToast(toastId, {
        status: "failed",
        title: isRejection ? "Signing rejected" : "Signing failed",
        description: userMessage,
      });
    }
  }, [
    state.publicKey,
    txXdr,
    txNetwork,
    addToast,
    updateToast,
    onSignTransaction,
  ]);

  // ── Retry handler ──────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    stopPolling();
    setState({ step: "idle", publicKey: null, errorMessage: null });
    setSignError(null);
  }, [stopPolling]);

  // ── Computed status indicators ─────────────────────────────────────────

  const isConnecting = state.step === "detecting" || state.step === "connecting";
  const isSigning = state.step === "signing";
  const isConnected = state.step === "connected";
  const hasError = state.step === "error";

  // Whether the sign button should be active
  const canSign = useMemo(
    () => isConnected && Boolean(state.publicKey) && txXdr.trim().length > 0,
    [isConnected, state.publicKey, txXdr],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Connect xBull Wallet"
      size="lg"
    >
      <div className="space-y-5">

        {/* ── Extension not installed warning ──────────────────────────── */}
        {extensionInstalled === false && (
          <div
            role="alert"
            className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-300"
          >
            <span className="font-semibold">xBull extension not detected.</span>{" "}
            Install it from{" "}
            <a
              href="https://xbull.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-amber-200"
            >
              xbull.app
            </a>{" "}
            then reload this page.
          </div>
        )}

        {/* ── Connection guide steps ───────────────────────────────────── */}
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4">
          <p className="mb-3 text-xs uppercase font-bold text-gray-500">
            Connection Guide
          </p>
          <div className="space-y-3">
            {[
              {
                label: "Ensure xBull extension is installed & unlocked",
                icon: ICON_IDS.shieldCheck,
                doneWhen: isConnecting || isConnected,
              },
              {
                label: "Approve connection request in xBull",
                icon: ICON_IDS.key,
                doneWhen: isConnected,
              },
              {
                label: "Active account is synced to StellarFlow",
                icon: ICON_IDS.wallet,
                doneWhen: isConnected,
              },
            ].map(({ label, icon, doneWhen }, idx) => {
              const isActive =
                (idx === 0 && isConnecting) ||
                (idx === 1 && state.step === "connecting") ||
                (idx === 2 && state.step === "connected");

              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? "bg-blue-950/30 border border-blue-500/30"
                      : doneWhen
                        ? "bg-emerald-950/10"
                        : "bg-transparent"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      doneWhen
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    <Icon
                      id={doneWhen ? ICON_IDS.check : icon}
                      size={14}
                    />
                  </div>
                  <span
                    className={`text-sm ${
                      doneWhen
                        ? "text-emerald-300"
                        : isActive
                          ? "text-blue-300 font-medium"
                          : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Status card ──────────────────────────────────────────────── */}
        <div
          className={`rounded-lg border p-4 ${
            isConnected
              ? "border-emerald-500/40 bg-emerald-950/20"
              : hasError
                ? "border-red-500/40 bg-red-950/20"
                : isConnecting || isSigning
                  ? "border-blue-500/30 bg-blue-950/10"
                  : "border-gray-800 bg-[#0d1117]"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon
              id={
                isConnected
                  ? ICON_IDS.checkCircle
                  : hasError
                    ? ICON_IDS.alertTriangle
                    : ICON_IDS.wallet
              }
              size={16}
              className={
                isConnected
                  ? "text-emerald-400"
                  : hasError
                    ? "text-red-400"
                    : "text-blue-400"
              }
            />
            <p className="text-sm font-semibold text-gray-200">
              {STEP_LABELS[state.step]}
            </p>
            {(isConnecting || isSigning) && (
              <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
            )}
          </div>

          {state.publicKey && (
            <p className="mt-2 font-mono text-xs text-gray-400 break-all">
              {state.publicKey}
            </p>
          )}

          {state.errorMessage && (
            <p className="mt-2 text-sm text-red-300">{state.errorMessage}</p>
          )}
        </div>

        {/* ── Transaction signing section (only when connected) ─────────── */}
        {isConnected && state.publicKey && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="xbull-tx-xdr"
                className="text-xs uppercase font-bold text-gray-500"
              >
                Soroban Transaction XDR
              </label>

              {/* Network selector */}
              <div className="flex items-center gap-1 rounded-md border border-gray-700 bg-[#0d1117] p-0.5">
                {(["testnet", "mainnet"] as XBullNetwork[]).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setTxNetwork(net)}
                    disabled={isSigning}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      txNetwork === net
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="xbull-tx-xdr"
              value={txXdr}
              onChange={(e) => setTxXdr(e.target.value)}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste a Soroban transaction XDR to sign with xBull..."
              disabled={isSigning}
              className="w-full resize-none rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            {signError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
              >
                {signError}
              </div>
            )}

            {txXdr.trim() && (
              <button
                type="button"
                onClick={handleSign}
                disabled={!canSign || isSigning}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSigning
                  ? "Waiting for xBull approval..."
                  : `Sign Transaction (${txNetwork})`}
              </button>
            )}
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {isConnected ? "Done" : "Cancel"}
          </button>

          {!isConnected && (
            <button
              type="button"
              onClick={hasError ? handleRetry : handleConnect}
              disabled={isConnecting || extensionInstalled === false}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting
                ? "Connecting..."
                : hasError
                  ? "Retry"
                  : "Connect xBull"}
            </button>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default XBullWalletProvider;
