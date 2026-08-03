"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@/app/components/providers/WalletProvider";
import { useSocket } from "@/app/hooks/useSocket";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { ASSET_SYMBOLS } from "@/config/assetSymbols";
import {
  submitLimitOrder,
  cancelLimitOrder,
  fetchActiveOrders,
  type ActiveLimitOrder,
} from "@/lib/limitOrderOps";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stellar limit-order contract address (testnet). */
const LIMIT_ORDER_CONTRACT_ID =
  "CBMGTKUBZGD4NRPS2BFGSBEJHSCV6FDZEGTXXFNTHK35CCYPWCHQLBQD";

/** Available trading pairs for limit orders. */
const TRADING_PAIRS = [
  { label: "XLM / USDC", sellAsset: "native", buyAsset: "USDC", pairId: "XLM-USDC", assetSymbol: ASSET_SYMBOLS.USD_XLM },
  { label: "USDC / XLM", sellAsset: "USDC", buyAsset: "native", pairId: "USDC-XLM", assetSymbol: ASSET_SYMBOLS.USD_XLM },
  { label: "XLM / EURC", sellAsset: "native", buyAsset: "EURC", pairId: "XLM-EURC", assetSymbol: ASSET_SYMBOLS.EUR_XLM },
] as const;

/** Expiry window presets (in hours). */
const EXPIRY_PRESETS = [
  { label: "1 Hour", value: 1 },
  { label: "6 Hours", value: 6 },
  { label: "24 Hours", value: 24 },
  { label: "3 Days", value: 72 },
  { label: "7 Days", value: 168 },
] as const;

/** Price-preset offsets relative to current spot price. */
const PRICE_PRESETS = [
  { label: "+1%", percent: 1 },
  { label: "+5%", percent: 5 },
  { label: "+10%", percent: 10 },
] as const;

const PRICE_PRESETS_BELOW = [
  { label: "-1%", percent: -1 },
  { label: "-5%", percent: -5 },
  { label: "-10%", percent: -10 },
] as const;

/** Default decimals for limit order price display. */
const DEFAULT_DECIMALS = 6;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a string to a finite number. Returns NaN for blank or non-finite input.
 * Zero and negative values are returned as-is so the component can validate them.
 */
function parsePositive(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return NaN;
  const parsed = Number(trimmed);
  return isFinite(parsed) ? parsed : NaN;
}

/**
 * Format a numeric value to the given decimal places without unnecessary
 * trailing zeros (but always show at least 2 decimal places).
 */
function formatPrice(value: number, decimals: number): string {
  const minDecimals = 2;
  const fixed = value.toFixed(decimals);
  const dotIndex = fixed.indexOf(".");
  if (dotIndex === -1) return fixed + ".00";
  let end = fixed.length;
  while (end > dotIndex + minDecimals + 1 && fixed[end - 1] === "0") {
    end--;
  }
  return fixed.slice(0, end);
}

/**
 * Convert hours to a Unix timestamp (seconds) offset from now.
 */
function hoursToTimestamp(hours: number): number {
  return Math.floor(Date.now() / 1000) + hours * 3600;
}

/**
 * Format a Unix timestamp (seconds) to a human-readable expiry string.
 */
function formatExpiry(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = timestamp - now;

  if (diff <= 0) return "Expired";

  const hours = diff / 3600;
  if (hours < 1) return `${Math.ceil(diff / 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface LimitOrderFormProps {
  /** Optional trading pair override (defaults to first pair). */
  defaultPairIndex?: number;
  /** Called after a successful order submission. */
  onOrderPlaced?: (txHash: string) => void;
  /** Called after a successful cancellation. */
  onOrderCancelled?: (txHash: string) => void;
}

export function LimitOrderForm({
  defaultPairIndex = 0,
  onOrderPlaced,
  onOrderCancelled,
}: LimitOrderFormProps) {
  // ── Wallet ────────────────────────────────────────────────────────────────
  const { wallet } = useWallet();

  // ── Spot price via WebSocket ──────────────────────────────────────────────
  const [selectedPairIndex, setSelectedPairIndex] = useState(defaultPairIndex);
  const selectedPair = TRADING_PAIRS[selectedPairIndex];

  const {
    lastUpdate,
    subscribeToAsset,
    unsubscribeFromAsset,
  } = useSocket();

  const subscribedSymbolRef = useRef<string | null>(null);

  // Keep the WebSocket subscription in sync with the selected trading pair.
  useEffect(() => {
    const symbol = selectedPair.assetSymbol;

    if (subscribedSymbolRef.current && subscribedSymbolRef.current !== symbol) {
      unsubscribeFromAsset(subscribedSymbolRef.current);
    }

    subscribeToAsset(symbol);
    subscribedSymbolRef.current = symbol;

    return () => {
      if (subscribedSymbolRef.current) {
        unsubscribeFromAsset(subscribedSymbolRef.current);
        subscribedSymbolRef.current = null;
      }
    };
  }, [selectedPair.assetSymbol, subscribeToAsset, unsubscribeFromAsset]);

  const spotPrice: number | null = useMemo(
    () => (lastUpdate ? lastUpdate.price : null),
    [lastUpdate],
  );

  // ── Form state ────────────────────────────────────────────────────────────
  const [rawPrice, setRawPrice] = useState("");
  const [rawAmount, setRawAmount] = useState("");
  const [touchedPrice, setTouchedPrice] = useState(false);
  const [touchedAmount, setTouchedAmount] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  // ── Submission state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // ── Orders state ──────────────────────────────────────────────────────────
  const [activeOrders, setActiveOrders] = useState<ActiveLimitOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // ── Cancellation tracking (per-order) ─────────────────────────────────────
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ── Derived validation ────────────────────────────────────────────────────
  const parsedPrice = useMemo(() => parsePositive(rawPrice), [rawPrice]);
  const parsedAmount = useMemo(() => parsePositive(rawAmount), [rawAmount]);

  const priceError =
    touchedPrice && rawPrice !== "" && !isFinite(parsedPrice)
      ? "Enter a valid positive target price."
      : touchedPrice && rawPrice !== "" && parsedPrice <= 0
        ? "Price must be greater than zero."
        : null;

  const amountError =
    touchedAmount && rawAmount !== "" && !isFinite(parsedAmount)
      ? "Enter a valid positive trade amount."
      : touchedAmount && rawAmount !== "" && parsedAmount <= 0
        ? "Amount must be greater than zero."
        : null;

  const canSubmit =
    isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !isSubmitting &&
    wallet?.connected === true;

  const decimals = DEFAULT_DECIMALS;

  // ── Load active orders ────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    if (!wallet?.connected || !wallet.publicKey) {
      setActiveOrders([]);
      return;
    }

    setIsLoadingOrders(true);
    setOrdersError(null);

    try {
      const orders = await fetchActiveOrders(wallet.publicKey);
      setActiveOrders(orders);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load active orders.";
      setOrdersError(message);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [wallet?.connected, wallet?.publicKey]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // ── Price presets ─────────────────────────────────────────────────────────
  const applyPreset = useCallback(
    (percent: number) => {
      if (spotPrice === null) return;
      const newPrice = spotPrice * (1 + percent / 100);
      setRawPrice(
        formatPrice(newPrice, decimals),
      );
      setSubmitError(null);
    },
    [spotPrice, decimals],
  );

  // ── Handle submission ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setTouchedPrice(true);
      setTouchedAmount(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      if (!wallet?.connected) {
        setSubmitError(
          "No wallet connected. Please connect your Stellar wallet.",
        );
        return;
      }

      if (!canSubmit) {
        setSubmitError("Please provide a valid target price and trade amount.");
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await submitLimitOrder({
          contractId: LIMIT_ORDER_CONTRACT_ID,
          sellAsset: selectedPair.sellAsset,
          buyAsset: selectedPair.buyAsset,
          sellAmount: parsedAmount.toFixed(6),
          targetPrice: parsedPrice.toFixed(6),
          expiryTimestamp: hoursToTimestamp(expiryHours),
        });

        setSubmitSuccess(result.txHash);
        setRawPrice("");
        setRawAmount("");
        setTouchedPrice(false);
        setTouchedAmount(false);
        onOrderPlaced?.(result.txHash);

        // Refresh active orders
        void loadOrders();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Order submission failed.";
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      wallet?.connected,
      canSubmit,
      selectedPair,
      parsedAmount,
      parsedPrice,
      expiryHours,
      onOrderPlaced,
      loadOrders,
    ],
  );

  // ── Cancel order ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(
    async (order: ActiveLimitOrder) => {
      setCancelError(null);
      setCancellingIds((prev) => new Set(prev).add(order.id));

      try {
        const result = await cancelLimitOrder({
          contractId: order.contractId,
          orderId: order.id,
        });
        onOrderCancelled?.(result.txHash);

        // Refresh orders after cancellation
        void loadOrders();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Order cancellation failed.";
        setCancelError(message);
      } finally {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(order.id);
          return next;
        });
      }
    },
    [onOrderCancelled, loadOrders],
  );

  // ── Status badge helper ───────────────────────────────────────────────────
  const getStatusBadge = (status: ActiveLimitOrder["status"]) => {
    const styles: Record<string, string> = {
      open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      filled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
      expired: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* ─── Placement Form ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-[#0d1117] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-100">Limit Order</h2>
          {spotPrice !== null && (
            <span className="text-xs font-mono text-gray-400">
              Spot: {formatPrice(spotPrice, decimals)}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Trading pair selector ──────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="limit-order-pair"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Trading Pair
            </label>
            <select
              id="limit-order-pair"
              value={selectedPairIndex}
              onChange={(e) => {
                setSelectedPairIndex(Number(e.target.value));
                setSubmitError(null);
              }}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Select trading pair"
            >
              {TRADING_PAIRS.map((pair, idx) => (
                <option key={pair.pairId} value={idx}>
                  {pair.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Target price input ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="limit-order-price"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Target Execution Price
            </label>
            <div className="relative">
              <input
                id="limit-order-price"
                type="number"
                min="0"
                step="any"
                value={rawPrice}
                onChange={(e) => {
                  setRawPrice(e.target.value);
                  setSubmitError(null);
                  setSubmitSuccess(null);
                }}
                onBlur={() => setTouchedPrice(true)}
                placeholder="0.000000"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={priceError !== null}
                aria-describedby={
                  priceError ? "limit-order-price-error" : undefined
                }
              />
            </div>
            {priceError && (
              <p
                id="limit-order-price-error"
                className="text-xs text-red-400"
                role="alert"
              >
                {priceError}
              </p>
            )}
          </div>

          {/* ── Price presets ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-bold text-gray-500">
              Quick Presets{" "}
              <span className="normal-case font-normal text-gray-600">
                (based on spot)
              </span>
            </p>

            {/* Above spot */}
            <div className="flex flex-wrap gap-2">
              {PRICE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.percent)}
                  disabled={spotPrice === null || isSubmitting}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-950/25 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Set target price ${preset.percent}% above spot`}
                >
                  {preset.label}
                </button>
              ))}

              <span className="mx-1 self-center text-gray-700" aria-hidden="true">
                |
              </span>

              {/* Below spot */}
              {PRICE_PRESETS_BELOW.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.percent)}
                  disabled={spotPrice === null || isSubmitting}
                  className="rounded-lg border border-red-500/30 bg-red-950/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/25 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Set target price ${Math.abs(preset.percent)}% below spot`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {spotPrice === null && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Icon
                  id={ICON_IDS.wifiOff}
                  size={12}
                  className="text-gray-500 shrink-0"
                />
                Price feed unavailable. Presets are disabled until spot price
                data loads.
              </p>
            )}
          </div>

          {/* ── Trade amount input ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="limit-order-amount"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Total Trade Amount
            </label>
            <div className="relative">
              <input
                id="limit-order-amount"
                type="number"
                min="0"
                step="any"
                value={rawAmount}
                onChange={(e) => {
                  setRawAmount(e.target.value);
                  setSubmitError(null);
                  setSubmitSuccess(null);
                }}
                onBlur={() => setTouchedAmount(true)}
                placeholder="0.000000"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={amountError !== null}
                aria-describedby={
                  amountError ? "limit-order-amount-error" : undefined
                }
              />
            </div>
            {amountError && (
              <p
                id="limit-order-amount-error"
                className="text-xs text-red-400"
                role="alert"
              >
                {amountError}
              </p>
            )}
          </div>

          {/* ── Expiry selector ────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="limit-order-expiry"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Expiry Window
            </label>
            <select
              id="limit-order-expiry"
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Select expiry window"
            >
              {EXPIRY_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Order summary ──────────────────────────────────────────── */}
          {canSubmit && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4 space-y-2">
              <p className="text-xs uppercase font-bold tracking-wider text-blue-400">
                Order Summary
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Pair</span>
                  <p className="font-mono text-gray-200">{selectedPair.label}</p>
                </div>
                <div>
                  <span className="text-gray-500">Side</span>
                  <p className="font-mono text-gray-200">
                    {selectedPair.sellAsset === "native" ? "Sell XLM" : "Buy XLM"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Target Price</span>
                  <p className="font-mono text-gray-200">
                    {formatPrice(parsedPrice, decimals)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Amount</span>
                  <p className="font-mono text-gray-200">
                    {parsedAmount.toFixed(6)}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Expires In</span>
                  <p className="font-mono text-gray-200">
                    {EXPIRY_PRESETS.find((p) => p.value === expiryHours)?.label ??
                      `${expiryHours}h`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Error banner ───────────────────────────────────────────── */}
          {submitError && (
            <div
              className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {submitError}
            </div>
          )}

          {/* ── Success banner ─────────────────────────────────────────── */}
          {submitSuccess && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
              Order placed successfully. Transaction:{" "}
              <span className="font-mono break-all">{submitSuccess}</span>
            </div>
          )}

          {/* ── Wallet not connected prompt ────────────────────────────── */}
          {!wallet?.connected && (
            <p className="text-xs text-yellow-600 flex items-center gap-1">
              <Icon
                id={ICON_IDS.alertTriangle}
                size={12}
                className="text-yellow-500 shrink-0"
              />
              Connect your wallet to place limit orders.
            </p>
          )}

          {/* ── Submit button ──────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                  Placing Order…
                </span>
              ) : (
                "Place Limit Order"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Active Orders ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-[#0d1117] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-100">Active Orders</h2>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={isLoadingOrders || !wallet?.connected}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh active orders"
          >
            <span className="flex items-center gap-1.5">
              <Icon id={ICON_IDS.refreshCcw} size={12} className="shrink-0" />
              Refresh
            </span>
          </button>
        </div>

        {/* ── Loading state ────────────────────────────────────────────── */}
        {isLoadingOrders && (
          <div className="flex items-center justify-center py-12">
            <span
              className="h-5 w-5 shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <span className="ml-3 text-sm text-gray-400">
              Loading active orders…
            </span>
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {!isLoadingOrders && ordersError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {ordersError}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {!isLoadingOrders && !ordersError && activeOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon
              id={ICON_IDS.layers}
              size={32}
              className="text-gray-600 mb-3"
            />
            <p className="text-sm text-gray-500">No active limit orders</p>
            <p className="text-xs text-gray-600 mt-1">
              Place a limit order above to get started.
            </p>
          </div>
        )}

        {/* ── Orders table ─────────────────────────────────────────────── */}
        {!isLoadingOrders && !ordersError && activeOrders.length > 0 && (
          <>
            {cancelError && (
              <div
                className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300 mb-3"
                role="alert"
              >
                {cancelError}
              </div>
            )}
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3">
              {activeOrders.map((order) => {
                const isCancelling = cancellingIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    className="rounded-lg border border-gray-800 bg-[#0d1117] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-gray-400">
                        {order.id}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Pair</span>
                        <p className="font-mono text-gray-200">{order.pair}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Side</span>
                        <p className="font-mono text-gray-200">{order.side}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Target</span>
                        <p className="font-mono text-gray-200">
                          {order.targetPrice}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount</span>
                        <p className="font-mono text-gray-200">
                          {order.amount}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Expiry</span>
                        <p className="font-mono text-gray-200">
                          {formatExpiry(order.expiryTimestamp)}
                        </p>
                      </div>
                    </div>
                    {order.status === "open" && (
                      <button
                        type="button"
                        onClick={() => handleCancel(order)}
                        disabled={isCancelling}
                        className="w-full rounded-lg border border-red-500/40 bg-red-950/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/25 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Cancel order ${order.id}`}
                      >
                        {isCancelling ? "Cancelling…" : "Cancel Order"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" aria-label="Active limit orders">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs uppercase font-bold text-gray-500">
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Order ID
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Pair
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Side
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Target Price
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Amount
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">
                      Expiry
                    </th>
                    <th scope="col" className="pb-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {activeOrders.map((order) => {
                    const isCancelling = cancellingIds.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-900/40 transition-colors"
                      >
                        <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                          {order.id}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-200">
                          {order.pair}
                        </td>
                        <td className="py-3 pr-4 text-gray-200 capitalize">
                          {order.side}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-200">
                          {order.targetPrice}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-200">
                          {order.amount}
                        </td>
                        <td className="py-3 pr-4">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                          {formatExpiry(order.expiryTimestamp)}
                        </td>
                        <td className="py-3 text-right">
                          {order.status === "open" && (
                            <button
                              type="button"
                              onClick={() => handleCancel(order)}
                              disabled={isCancelling}
                              className="rounded-lg border border-red-500/40 bg-red-950/15 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/25 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Cancel order ${order.id}`}
                            >
                              {isCancelling ? "Cancelling…" : "Cancel"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Not connected state (orders) ───────────────────────────────── */}
        {!isLoadingOrders && !ordersError && !wallet?.connected && (
          <p className="text-xs text-gray-600 text-center py-8">
            Connect your wallet to view active orders.
          </p>
        )}
      </div>
    </div>
  );
}

export default LimitOrderForm;
