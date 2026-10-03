"use client";

/**
 * ReceiveAssetModal — share your Stellar address as a scannable QR code.
 *
 * Built for #998. Two QR modes, both rendered as inline SVG (no raster
 * scaling blur, no `dangerouslySetInnerHTML`):
 *
 *   1. **Address mode** (default) — the QR encodes the bare active public key.
 *      A payer scanning it just needs a destination.
 *   2. **Payment request mode** — as soon as the payer-facing form carries an
 *      amount or a non-native asset, the QR is re-encoded as a SEP-7
 *      `web+stellar:pay` link so the amount and asset are pre-filled in the
 *      sender's wallet.
 *
 * The `web+stellar:pay` parameter names match the parser in
 * `src/components/remittance/QrScannerModal.tsx`, so a request generated here
 * round-trips through this app's own scanner.
 *
 * `qrcode` is imported dynamically (as elsewhere in the app) because QR
 * encoding is only needed once the modal is actually open.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QrCode as QrCodeIcon } from "lucide-react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { truncateAddress } from "@/components/ui/AddressBadge";
import { useOptionalToast } from "@/components/ui/ToastQueue";
import { useOptionalWallet } from "@/app/components/providers/WalletProvider";
import { useAccountBalances } from "@/hooks/useAccountBalances";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A Stellar asset that can be requested in a payment link. */
export interface ReceiveAssetOption {
  /** Asset ticker shown in the picker, e.g. "XLM" or "USDC". */
  code: string;
  /**
   * Issuing account for a SEP-41 asset. Omitted for the native asset (XLM),
   * which has no issuer and is therefore always sendable.
   */
  issuer?: string;
  /** Optional human-readable name used in the picker's secondary line. */
  name?: string;
}

export interface ReceiveAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Address to encode. Defaults to the connected wallet's active public key,
   * so the modal stays usable when mounted outside a `WalletProvider`.
   */
  publicKey?: string;
  /**
   * Assets offered in the picker. Defaults to the native asset plus whatever
   * trustlines the connected account already holds.
   */
  assets?: ReceiveAssetOption[];
  /** Fired after a successful clipboard write of the full public key. */
  onCopyPublicKey?: (publicKey: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Native Stellar asset — no issuer required. */
const NATIVE_ASSET_CODE = "XLM";

/** Stellar public keys are 56 chars: a `G` plus 55 base32 characters. */
const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

/** How long the inline "Copied" tick stays lit before reverting. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Rendered edge length of the QR in CSS pixels. The SVG viewBox is the module
 * count, so the browser scales it to any size without resampling artefacts.
 */
const QR_DISPLAY_SIZE = 256;

/** Rounded to 7 dp before hitting the URI — avoids float noise in the link. */
function normalizeAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  // toFixed switches to exponential notation at 1e21, which would smuggle a
  // non-numeric amount into the payment link. Reject instead of truncating.
  if (parsed >= 1e21) return null;

  // toFixed keeps the value decimal; drop the trailing zero padding manually.
  // Number#toString would return "1e-7" here, which is not a valid amount.
  const fixed = parsed.toFixed(7).replace(/\.?0+$/, "");
  return fixed === "" || fixed === "0" ? null : fixed;
}

/**
 * Encode a payment request as a SEP-7 link.
 *
 * `asset_code`/`asset_issuer` (snake case) are the SEP-7 parameter names and
 * are what `QrScannerModal` reads back. The native asset is sent as an
 * untrusted default with no issuer, which is how wallets expect XLM requests.
 */
function buildPaymentUri(
  destination: string,
  amount: string,
  assetCode: string,
  assetIssuer?: string,
  memo?: string,
): string {
  const params = new URLSearchParams();
  params.set("destination", destination);
  params.set("amount", amount);
  params.set("asset_code", assetCode);
  if (assetIssuer) params.set("asset_issuer", assetIssuer);
  if (memo) params.set("memo", memo);
  return `web+stellar:pay?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// QR matrix → SVG
// ---------------------------------------------------------------------------

/** A QR symbol reduced to what rendering needs: module count plus dark flags. */
interface QrMatrix {
  /** Modules per edge, excluding the quiet zone. */
  size: number;
  /** Row-major dark-module flags, `size * size` entries. */
  data: Uint8Array;
}

/** Quiet zone in modules. The spec requires at least 4. */
const QR_QUIET_ZONE = 4;

/**
 * Flatten the module matrix into a single SVG path.
 *
 * Consecutive dark modules in a row are merged into one rectangle so a
 * version-4 code emits a few dozen commands instead of several hundred — the
 * DOM stays small enough that the code can be re-rendered on every keystroke
 * of the amount field without a measurable frame cost.
 */
function buildModulePath(matrix: QrMatrix): string {
  const { size, data } = matrix;
  const commands: string[] = [];

  for (let row = 0; row < size; row++) {
    let runStart = -1;

    for (let col = 0; col <= size; col++) {
      const isDark = col < size && data[row * size + col] === 1;

      if (isDark && runStart === -1) {
        runStart = col;
        continue;
      }

      if (!isDark && runStart !== -1) {
        commands.push(`M${runStart} ${row}h${col - runStart}v1h-${col - runStart}z`);
        runStart = -1;
      }
    }
  }

  return commands.join("");
}

interface QrSvgMatrixProps {
  matrix: QrMatrix | null;
  /** Rendered edge length in CSS pixels. */
  size?: number;
  isEncoding: boolean;
  hasPayload: boolean;
  /** Accessible description of the encoded payload. */
  label: string;
}

/**
 * Renders a QR matrix as a resolution-independent SVG.
 *
 * `shapeRendering="crispEdges"` stops the browser anti-aliasing module edges,
 * which is what keeps a scaled QR scannable. Drawing every module as its own
 * `<rect>` would also be correct, but a single merged path is markedly
 * cheaper to mount and diff.
 */
function QrSvgMatrix({
  matrix,
  size = QR_DISPLAY_SIZE,
  isEncoding,
  hasPayload,
  label,
}: QrSvgMatrixProps) {
  const path = useMemo(() => (matrix ? buildModulePath(matrix) : ""), [matrix]);

  if (!matrix || !hasPayload) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
        role="status"
      >
        {isEncoding && <span className="text-xs text-gray-600">Generating…</span>}
      </div>
    );
  }

  const viewBox = matrix.size + QR_QUIET_ZONE * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      style={{ display: "block" }}
    >
      <rect width={viewBox} height={viewBox} fill="#0d1117" />
      <g transform={`translate(${QR_QUIET_ZONE} ${QR_QUIET_ZONE})`}>
        <path d={path} fill="#ffffff" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReceiveAssetModal({
  isOpen,
  onClose,
  publicKey,
  assets,
  onCopyPublicKey,
}: ReceiveAssetModalProps) {
  const wallet = useOptionalWallet();
  const toast = useOptionalToast();

  // `useOptionalWallet` returns the context slice, which wraps the wallet
  // state: `{ wallet, isConnected }`. The key therefore lives one level down.
  const activePublicKey = publicKey ?? wallet?.wallet?.publicKey ?? "";
  const isValidAddress = PUBLIC_KEY_RE.test(activePublicKey);

  // Resolve trustlines for the picker. Gated on `isOpen` so a modal that is
  // merely mounted does not spend a request on balances nobody can see yet.
  const { balances } = useAccountBalances(
    isOpen && !publicKey ? (wallet?.wallet?.publicKey ?? null) : null,
  );

  const [rawAmount, setRawAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [assetCode, setAssetCode] = useState(NATIVE_ASSET_CODE);
  const [customIssuer, setCustomIssuer] = useState("");
  const [memo, setMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrMatrix, setQrMatrix] = useState<QrMatrix | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Asset picker options ──────────────────────────────────────────────────
  // Explicit `assets` prop wins; otherwise offer native XLM plus the
  // trustlines the account already holds. Untrusted issuers are still shown so
  // the user can request them, but the issuer stays editable to correct one.
  const assetOptions = useMemo<ReceiveAssetOption[]>(() => {
    if (assets && assets.length > 0) {
      return [
        { code: NATIVE_ASSET_CODE, name: "Stellar Lumens" },
        ...assets.filter((a) => a.code !== NATIVE_ASSET_CODE),
      ];
    }

    const discovered = balances
      .map(({ asset }) => asset.trim())
      .filter((asset) => asset.length > 0 && asset.toUpperCase() !== NATIVE_ASSET_CODE)
      .map((code) => ({ code }));

    const seen = new Set<string>();
    return [{ code: NATIVE_ASSET_CODE, name: "Stellar Lumens" }].concat(
      discovered.filter(({ code }) => {
        const key = code.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }, [assets, balances]);

  // Keep the selection valid if the option list changes underneath it.
  useEffect(() => {
    if (assetOptions.length === 0) return;
    if (!assetOptions.some((option) => option.code === assetCode)) {
      setAssetCode(NATIVE_ASSET_CODE);
    }
  }, [assetOptions, assetCode]);

  const selectedAsset = useMemo(
    () => assetOptions.find((option) => option.code === assetCode),
    [assetOptions, assetCode],
  );

  // Discovered trustlines carry no issuer (the balances endpoint only returns
  // a code), so an issuer typed by the user is what gets encoded. Anything the
  // caller passed in explicitly is authoritative.
  const assetIssuer = (selectedAsset?.issuer ?? customIssuer).trim();
  const isNativeAsset = assetCode === NATIVE_ASSET_CODE;
  const needsIssuer = !isNativeAsset && !selectedAsset?.issuer;

  // ── Payment request state ─────────────────────────────────────────────────
  const normalizedAmount = useMemo(() => normalizeAmount(rawAmount), [rawAmount]);
  const amountError =
    amountTouched && rawAmount.trim() !== "" && normalizedAmount === null
      ? "Enter an amount greater than zero."
      : null;

  /**
   * Payment-request mode engages as soon as the form carries an amount or a
   * non-native asset — matching the "updates dynamically when the user inputs a
   * requested asset or amount" requirement.
   */
  const isPaymentRequest = normalizedAmount !== null || (!isNativeAsset && assetIssuer !== "");

  const memoText = memo.trim();
  const requestSummary = useMemo(() => {
    if (!isPaymentRequest) return "Address only — payers choose the amount and asset.";
    const amountPart = normalizedAmount ? `${normalizedAmount} ${assetCode}` : `Any amount of ${assetCode}`;
    return `Payment request — ${amountPart}${memoText ? ` · memo: ${memoText}` : ""}`;
  }, [isPaymentRequest, normalizedAmount, assetCode, memoText]);

  // ── QR encoding ───────────────────────────────────────────────────────────
  // The payload is derived state; encoding runs in an effect so the (async,
  // dynamically imported) encoder is not called during render.
  const payload = useMemo(() => {
    if (!isValidAddress) return "";
    if (!isPaymentRequest) return activePublicKey;
    if (!normalizedAmount && (!assetIssuer || isNativeAsset)) return activePublicKey;
    return buildPaymentUri(
      activePublicKey,
      normalizedAmount ?? "0",
      assetCode,
      isNativeAsset ? undefined : assetIssuer,
      memoText || undefined,
    );
  }, [
    isValidAddress,
    isPaymentRequest,
    activePublicKey,
    normalizedAmount,
    assetIssuer,
    isNativeAsset,
    assetCode,
    memoText,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!payload) {
      setQrPayload(null);
      setQrMatrix(null);
      setQrError(null);
      return;
    }

    let cancelled = false;
    setIsEncoding(true);

    void (async () => {
      try {
        const QRCode = await import("qrcode");
        // `create` is synchronous and hands back the module matrix, which we
        // turn into a single SVG path — no data URL, no inner HTML.
        const matrix = QRCode.create(payload, { errorCorrectionLevel: "M" });
        if (cancelled) return;
        setQrPayload(payload);
        setQrError(null);
        setQrMatrix({ size: matrix.modules.size, data: matrix.modules.data });
      } catch (cause) {
        if (cancelled) return;
        setQrPayload(null);
        setQrMatrix(null);
        setQrError(
          cause instanceof Error && /capacity|too (long|big)/i.test(cause.message)
            ? "This request is too long to encode. Shorten the memo and try again."
            : "Could not generate the QR code. Please try again.",
        );
      } finally {
        if (!cancelled) setIsEncoding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, payload]);

  // ── Copy public key ───────────────────────────────────────────────────────
  const handleCopyPublicKey = useCallback(async () => {
    if (!isValidAddress || copied) return;

    try {
      // The full key is what a payer needs; the truncated form is display-only.
      await navigator.clipboard.writeText(activePublicKey);
      setCopied(true);
      onCopyPublicKey?.(activePublicKey);
      toast?.addToast({
        title: "Public key copied",
        description: `${truncateAddress(activePublicKey)} is ready to paste.`,
        status: "confirmed",
      });

      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      toast?.addToast({
        title: "Could not copy public key",
        description: "Your browser blocked clipboard access. Select the address manually.",
        status: "failed",
      });
    }
  }, [isValidAddress, copied, activePublicKey, onCopyPublicKey, toast]);

  // ── Reset on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) return;
    setRawAmount("");
    setAmountTouched(false);
    setAssetCode(NATIVE_ASSET_CODE);
    setCustomIssuer("");
    setMemo("");
    setCopied(false);
    setQrPayload(null);
    setQrMatrix(null);
    setQrError(null);
  }, [isOpen]);

  // Clear the copy timer on unmount.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Receive" size="lg">
      {/*
        The dialog card is centred in a fixed overlay with no internal scroll, so
        a content-heavy modal would be clipped on short viewports. Cap the body
        and let it scroll instead — the form plus the memo warning do not fit in
        844px on a phone otherwise.
      */}
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {!isValidAddress ? (
          <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200">
            Connect a wallet to show a QR code for your Stellar address.
          </div>
        ) : (
          <>
            {/* ── QR code ────────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-xl border border-gray-800 bg-[#0d1117] p-4"
                aria-live="polite"
              >
                {qrError ? (
                  <div
                    className="flex items-center justify-center text-center text-xs text-rose-400"
                    style={{ width: QR_DISPLAY_SIZE, height: QR_DISPLAY_SIZE }}
                  >
                    {qrError}
                  </div>
                ) : (
                  <QrSvgMatrix
                    matrix={qrMatrix}
                    size={QR_DISPLAY_SIZE}
                    isEncoding={isEncoding}
                    hasPayload={qrPayload !== null}
                    label={
                      isPaymentRequest
                        ? `QR code for a payment request to ${truncateAddress(activePublicKey)}`
                        : `QR code for Stellar address ${truncateAddress(activePublicKey)}`
                    }
                  />
                )}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <QrCodeIcon size={14} className="shrink-0" aria-hidden />
                {requestSummary}
              </p>
            </div>

            {/* ── Public key + copy ──────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs uppercase font-bold text-gray-500">Your Public Key</p>
              <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5">
                <span
                  className="min-w-0 flex-1 truncate font-mono text-sm text-gray-200"
                  title={activePublicKey}
                >
                  {truncateAddress(activePublicKey)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPublicKey}
                  aria-label="Copy public key"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    copied
                      ? "bg-emerald-900/40 text-emerald-300"
                      : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  <Icon id={copied ? ICON_IDS.check : ICON_IDS.copy} size={14} aria-hidden />
                  {copied ? "Copied" : "Copy Public Key"}
                </button>
              </div>
            </div>

            {/* ── Payment request form ───────────────────────────────── */}
            <fieldset className="space-y-4 rounded-lg border border-gray-800 bg-[#0d1117]/60 p-4">
              <legend className="px-1 text-xs uppercase font-bold text-gray-500">
                Request a Specific Payment
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="receive-asset-amount"
                    className="text-xs uppercase font-bold text-gray-500"
                  >
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      id="receive-asset-amount"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={rawAmount}
                      onChange={(e) => setRawAmount(e.target.value)}
                      onBlur={() => setAmountTouched(true)}
                      placeholder="Any amount"
                      aria-invalid={amountError !== null}
                      aria-describedby={amountError ? "receive-asset-amount-error" : undefined}
                      className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 pr-16 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                      {assetCode}
                    </span>
                  </div>
                  {amountError && (
                    <p id="receive-asset-amount-error" className="text-xs text-red-400" role="alert">
                      {amountError}
                    </p>
                  )}
                </div>

                {/* Asset */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="receive-asset-code"
                    className="text-xs uppercase font-bold text-gray-500"
                  >
                    Asset
                  </label>
                  <select
                    id="receive-asset-code"
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                  >
                    {assetOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code}
                        {option.name ? ` — ${option.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Issuer — only meaningful for non-native assets */}
              {!isNativeAsset && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="receive-asset-issuer"
                    className="text-xs uppercase font-bold text-gray-500"
                  >
                    Issuer{" "}
                    <span className="normal-case font-normal text-gray-600">
                      (required for {assetCode})
                    </span>
                  </label>
                  <input
                    id="receive-asset-issuer"
                    type="text"
                    value={needsIssuer ? customIssuer : (selectedAsset?.issuer ?? "")}
                    onChange={(e) => setCustomIssuer(e.target.value)}
                    readOnly={!needsIssuer}
                    placeholder={selectedAsset?.issuer ? selectedAsset.issuer : "G…"}
                    className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none read-only:opacity-70"
                  />
                  {needsIssuer && customIssuer.trim() !== "" && !PUBLIC_KEY_RE.test(customIssuer.trim()) && (
                    <p className="text-xs text-amber-400">
                      This does not look like a Stellar account ID. Double-check the issuer.
                    </p>
                  )}
                </div>
              )}

              {/* Memo */}
              <div className="space-y-1.5">
                <label
                  htmlFor="receive-asset-memo"
                  className="text-xs uppercase font-bold text-gray-500"
                >
                  Memo{" "}
                  <span className="normal-case font-normal text-gray-600">(optional)</span>
                </label>
                <input
                  id="receive-asset-memo"
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Required by some exchanges"
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {!isPaymentRequest && (
                <p className="text-xs text-gray-600">
                  The QR encodes your bare address. Add an amount or pick a non-native asset to
                  generate a SEP-7 payment request instead.
                </p>
              )}
            </fieldset>

            {/* ── Exchange memo warning ─────────────────────────────── */}
            <div className="flex gap-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
              <Icon
                id={ICON_IDS.alertTriangle}
                size={18}
                className="mt-0.5 shrink-0 text-amber-400"
                aria-hidden
              />
              <div className="space-y-1 text-sm text-amber-100">
                <p className="font-semibold">Always verify the destination memo</p>
                <p className="text-xs leading-relaxed text-amber-200/80">
                  Some exchanges route deposits to your account only when a memo is attached. Always
                  confirm the memo a sender must include — funds sent without it can land on an
                  unrelated address and cannot be recovered. P2P transfers on Stellar need no memo.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </OptimizedDialog>
  );
}

export default ReceiveAssetModal;
