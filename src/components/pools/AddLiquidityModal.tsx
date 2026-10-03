"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  WalletProvider,
  useWallet,
} from "@/app/components/providers/WalletProvider";
import { submitSingleSidedLiquidity } from "@/lib/liquidityOps";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolReserves {
  /** Total units of asset A currently in the pool */
  reserveA: number;
  /** Total units of asset B currently in the pool */
  reserveB: number;
  /** Total LP token supply outstanding */
  totalLpSupply: number;
}

export interface PoolAsset {
  /** Display symbol shown in the UI (e.g. "XLM", "USDC") */
  symbol: string;
  /** Soroban contract address for the asset's SAC/SEP-41 contract */
  contractId: string;
}

export interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Metadata for the first asset in the pair (base asset) */
  assetA: PoolAsset;
  /** Metadata for the second asset in the pair (quote asset) */
  assetB: PoolAsset;
  /** On-chain reserves used to compute the counter-asset amount and LP estimate */
  reserves: PoolReserves;
  /** Soroban pool contract that owns the atomic swap-and-mint entry point. */
  poolContractId?: string;
  /** Human-readable pool identifier shown in the modal header */
  poolLabel?: string;
  onDepositSuccess?: (txHash: string) => void;
  onDepositError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Approval state machine
// ---------------------------------------------------------------------------

/** Tracks on-chain approval status for a single asset. */
type ApprovalStatus = "idle" | "checking" | "approved" | "pending" | "error";

interface ApprovalState {
  assetA: ApprovalStatus;
  assetB: ApprovalStatus;
}

// ---------------------------------------------------------------------------
// Pure calculation helpers
// ---------------------------------------------------------------------------

/**
 * Given an amount for asset A, compute the proportional required amount for
 * asset B using the constant-product invariant:
 *
 *   amountB = amountA × (reserveB / reserveA)
 *
 * Returns 0 when the pool is empty or inputs are invalid.
 */
function calcCounterAmount(
  amountA: number,
  reserveA: number,
  reserveB: number,
): number {
  if (!isFinite(amountA) || amountA <= 0 || reserveA <= 0 || reserveB <= 0) {
    return 0;
  }
  return amountA * (reserveB / reserveA);
}

/**
 * Estimate LP tokens to be minted using the standard AMM formula:
 *
 *   lpOut = (amountA / reserveA) × totalLpSupply
 *
 * For a fresh pool (totalLpSupply === 0) this falls back to the geometric mean:
 *
 *   lpOut = sqrt(amountA × amountB)
 *
 * Returns 0 for invalid inputs.
 */
function calcLpMintEstimate(
  amountA: number,
  amountB: number,
  reserves: PoolReserves,
): number {
  const { reserveA, totalLpSupply } = reserves;
  if (!isFinite(amountA) || amountA <= 0 || !isFinite(amountB) || amountB <= 0) {
    return 0;
  }
  if (totalLpSupply === 0 || reserveA === 0) {
    // Geometric mean for pool initialisation
    return Math.sqrt(amountA * amountB);
  }
  return (amountA / reserveA) * totalLpSupply;
}

/**
 * Pool share percentage after deposit:
 *
 *   share% = lpOut / (totalLpSupply + lpOut) × 100
 */
function calcPoolSharePercent(lpOut: number, totalLpSupply: number): number {
  if (lpOut <= 0) return 0;
  return (lpOut / (totalLpSupply + lpOut)) * 100;
}

/**
 * Parse a string amount to a finite non-negative number.
 * Returns NaN when the string is blank or non-numeric.
 */
function parseAmount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return NaN;
  const parsed = Number(trimmed);
  return isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export interface SingleSidedDepositQuote {
  inputAmount: number;
  swapInputAmount: number;
  swapOutputAmount: number;
  finalAmountA: number;
  finalAmountB: number;
}

/** Solves the reserve-aware 50/50 split before the transaction is signed. */
export function calculateSingleSidedDepositQuote(
  inputAmount: number,
  inputAsset: "A" | "B",
  reserves: PoolReserves,
  feeBps = 30,
): SingleSidedDepositQuote {
  const reserveIn = inputAsset === "A" ? reserves.reserveA : reserves.reserveB;
  const reserveOut = inputAsset === "A" ? reserves.reserveB : reserves.reserveA;
  if (!isFinite(inputAmount) || inputAmount <= 0 || reserveIn <= 0 || reserveOut <= 0) {
    return { inputAmount: 0, swapInputAmount: 0, swapOutputAmount: 0, finalAmountA: 0, finalAmountB: 0 };
  }

  const feeFactor = 1 - feeBps / 10_000;
  const targetRatio = reserveOut / reserveIn;
  let low = 0;
  let high = inputAmount;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const swapInput = (low + high) / 2;
    const effectiveInput = swapInput * feeFactor;
    const swapOutput = (effectiveInput * reserveOut) / (reserveIn + effectiveInput);
    if (swapOutput > (inputAmount - swapInput) * targetRatio) high = swapInput;
    else low = swapInput;
  }

  const swapInputAmount = (low + high) / 2;
  const effectiveInput = swapInputAmount * feeFactor;
  const swapOutputAmount = (effectiveInput * reserveOut) / (reserveIn + effectiveInput);
  return inputAsset === "A"
    ? { inputAmount, swapInputAmount, swapOutputAmount, finalAmountA: inputAmount - swapInputAmount, finalAmountB: swapOutputAmount }
    : { inputAmount, swapInputAmount, swapOutputAmount, finalAmountA: swapOutputAmount, finalAmountB: inputAmount - swapInputAmount };
}

// ---------------------------------------------------------------------------
// Inner modal implementation (requires WalletProvider in the tree)
// ---------------------------------------------------------------------------

function AddLiquidityModalContent({
  isOpen,
  onClose,
  assetA,
  assetB,
  reserves,
  poolLabel,
  poolContractId,
  onDepositSuccess,
  onDepositError,
}: AddLiquidityModalProps) {
  // ── Input state ────────────────────────────────────────────────────────────
  const [rawAmountA, setRawAmountA] = useState("");
  const [touchedA, setTouchedA] = useState(false);
  const [inputAsset, setInputAsset] = useState<"A" | "B">("A");
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // ── Submission state ───────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ── Approval state machine ─────────────────────────────────────────────────
  const [approval, setApproval] = useState<ApprovalState>({
    assetA: "idle",
    assetB: "idle",
  });

  // ── Wallet context ─────────────────────────────────────────────────────────
  const { wallet } = useWallet();

  // ── Derived calculations (memoised) ────────────────────────────────────────
  const inputAmount = useMemo(() => parseAmount(rawAmountA), [rawAmountA]);
  const quote = useMemo(
    () => calculateSingleSidedDepositQuote(inputAmount, inputAsset, reserves),
    [inputAmount, inputAsset, reserves],
  );
  const amountA = quote.finalAmountA;
  const amountB = quote.finalAmountB;

  const lpMintEstimate = useMemo(
    () => calcLpMintEstimate(amountA, amountB, reserves),
    [amountA, amountB, reserves],
  );

  const poolSharePercent = useMemo(
    () => calcPoolSharePercent(lpMintEstimate, reserves.totalLpSupply),
    [lpMintEstimate, reserves.totalLpSupply],
  );

  const isPoolEmpty = reserves.reserveA === 0 && reserves.reserveB === 0;
  const hasValidAmounts = !isPoolEmpty && amountA > 0 && amountB > 0;

  // ── Approval helpers ───────────────────────────────────────────────────────

  const inputApprovalKey = inputAsset === "A" ? "assetA" : "assetB";
  const inputApproved = approval[inputApprovalKey] === "approved";

  /**
   * Simulate on-chain allowance check for a single asset.
   * In production this would call the SAC allowance(spender) entry point.
   */
  const checkAllowance = useCallback(
    async (asset: "assetA" | "assetB"): Promise<boolean> => {
      setApproval((prev) => ({ ...prev, [asset]: "checking" }));
      try {
        // Lazy-load Stellar SDK to keep it out of the initial bundle
        const { Horizon } = await import("@stellar/stellar-sdk");
        void Horizon; // tree-shake guard — real allowance RPC goes here
        // Simulate network latency for allowance query
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
        // Placeholder: assume no prior allowance so user always needs to approve
        return false;
      } catch {
        setApproval((prev) => ({ ...prev, [asset]: "error" }));
        return false;
      }
    },
    [],
  );

  /**
   * Request token approval (SAC `approve` invocation) for a single asset.
   * Transitions: idle/error → checking → pending → approved | error
   */
  const handleApprove = useCallback(
    async (asset: "assetA" | "assetB") => {
      if (!wallet?.connected) {
        setSubmitError("Connect your wallet before approving assets.");
        return;
      }

      const alreadyApproved = await checkAllowance(asset);
      if (alreadyApproved) {
        setApproval((prev) => ({ ...prev, [asset]: "approved" }));
        return;
      }

      setApproval((prev) => ({ ...prev, [asset]: "pending" }));
      try {
        // In production: invoke SAC approve(spender, amount, expiration_ledger)
        // via Freighter/signTransaction. Here we simulate the signing round-trip.
        const { isConnected } = await import("@stellar/freighter-api");
        const connected = await isConnected();
        if (!connected) {
          throw new Error(
            "Freighter extension is not available. Please install it.",
          );
        }
        // Simulate signing + submission delay
        await new Promise<void>((resolve) => setTimeout(resolve, 800));
        setApproval((prev) => ({ ...prev, [asset]: "approved" }));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Approval transaction failed.";
        setSubmitError(msg);
        setApproval((prev) => ({ ...prev, [asset]: "error" }));
      }
    },
    [wallet, checkAllowance],
  );

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setRawAmountA("");
      setTouchedA(false);
      setInputAsset("A");
      setIsConfirmationOpen(false);
      setSubmitError(null);
      setTxHash(null);
      setIsSubmitting(false);
      setApproval({ assetA: "idle", assetB: "idle" });
    }
  }, [isOpen]);

  // ── Submission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouchedA(true);
    setSubmitError(null);

    if (!wallet?.connected) {
      setSubmitError("No wallet connected. Please connect your Stellar wallet.");
      return;
    }

    if (!hasValidAmounts) {
      setSubmitError("Enter a valid amount for " + assetA.symbol + ".");
      return;
    }

    if (!inputApproved) {
      setSubmitError(`Approve ${inputAsset === "A" ? assetA.symbol : assetB.symbol} before depositing.`);
      return;
    }

    setIsConfirmationOpen(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      if (!poolContractId) throw new Error("This pool is missing its contract address.");
      const toAtomic = (amount: number) => BigInt(Math.floor(amount * 1_000_000));
      const result = await submitSingleSidedLiquidity({
        poolContractId,
        tokenInId: inputAsset === "A" ? assetA.contractId : assetB.contractId,
        amountIn: toAtomic(inputAmount),
        minAmountA: toAtomic(amountA * 0.995),
        minAmountB: toAtomic(amountB * 0.995),
        minLpAmount: toAtomic(lpMintEstimate * 0.995),
      });
      setTxHash(result.txHash);
      setIsConfirmationOpen(false);
      onDepositSuccess?.(result.txHash);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Deposit transaction failed.");
      setSubmitError(error.message);
      onDepositError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived UI states ──────────────────────────────────────────────────────
  const amountAError =
    touchedA && rawAmountA !== "" && (!isFinite(inputAmount) || inputAmount <= 0)
      ? "Enter a valid positive number."
      : null;

  const canSubmit =
    hasValidAmounts &&
    inputApproved &&
    !isSubmitting &&
    txHash === null &&
    wallet?.connected === true;

  const dialogTitle = poolLabel
    ? `Add Liquidity — ${poolLabel}`
    : `Add Liquidity — ${assetA.symbol} / ${assetB.symbol}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title={dialogTitle}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Pool pair summary ──────────────────────────────────────────── */}
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase font-bold text-gray-500">
                Pool Pair
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-100">
                {assetA.symbol}{" "}
                <span className="text-gray-500">/</span>{" "}
                {assetB.symbol}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-bold text-gray-500">
                Current Ratio
              </p>
              <p className="mt-1 font-mono text-sm text-gray-300">
                {reserves.reserveA > 0 && reserves.reserveB > 0
                  ? `1 ${assetA.symbol} = ${(reserves.reserveB / reserves.reserveA).toFixed(6)} ${assetB.symbol}`
                  : isPoolEmpty
                  ? "New pool — set initial price"
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Single-token input ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="add-liq-amount-a"
            className="text-xs uppercase font-bold text-gray-500"
          >
            Deposit Token
          </label>
            <div className="flex rounded-lg border border-gray-700 bg-[#0d1117] p-0.5" role="group" aria-label="Deposit token">
              {(["A", "B"] as const).map((key) => {
                const asset = key === "A" ? assetA : assetB;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setInputAsset(key); setApproval({ assetA: "idle", assetB: "idle" }); setSubmitError(null); }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md ${inputAsset === key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                    disabled={isSubmitting || txHash !== null}
                  >
                    {asset.symbol}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <input
              id="add-liq-amount-a"
              type="number"
              min="0"
              step="any"
              value={rawAmountA}
              onChange={(e) => {
                setRawAmountA(e.target.value);
                setSubmitError(null);
              }}
              onBlur={() => setTouchedA(true)}
              placeholder="0.000000"
              disabled={isSubmitting || txHash !== null}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 pr-16"
              aria-invalid={amountAError !== null}
              aria-describedby={
                amountAError ? "add-liq-amount-a-error" : undefined
              }
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
              {assetA.symbol}
            </span>
          </div>
          {amountAError && (
            <p
              id="add-liq-amount-a-error"
              className="text-xs text-red-400"
              role="alert"
            >
              {amountAError}
            </p>
          )}
        </div>

        {/* ── Calculated balanced contribution ───────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="add-liq-amount-b"
            className="text-xs uppercase font-bold text-gray-500"
          >
            Balanced Pool Contribution{" "}
            <span className="normal-case font-normal text-gray-600">
              (calculated)
            </span>
          </label>
          <div className="relative">
            <input
              id="add-liq-amount-b"
              type="text"
              readOnly
              value={
                hasValidAmounts
                  ? `${amountA.toFixed(6)} ${assetA.symbol} + ${amountB.toFixed(6)} ${assetB.symbol}`
                  : isPoolEmpty && isFinite(inputAmount) && inputAmount > 0
                  ? "—"
                  : ""
              }
              placeholder="0.000000"
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117]/60 px-3 py-2.5 font-mono text-sm text-gray-400 placeholder:text-gray-600 focus:outline-none cursor-default pr-16"
              aria-label={`Calculated balanced ${assetA.symbol} and ${assetB.symbol} contribution`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
              {assetA.symbol} / {assetB.symbol}
            </span>
          </div>
          {!isPoolEmpty && (
            <p className="text-xs text-gray-600">
              The required swap is calculated from the pool ratio before signing.
            </p>
          )}
          {isPoolEmpty && (
            <p className="text-xs text-yellow-600">
              This is a new pool. You set the initial price by providing both amounts manually.
            </p>
          )}
        </div>

        {/* ── LP estimate & pool share ───────────────────────────────────── */}
        {hasValidAmounts && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4 space-y-2.5">
            <p className="text-xs uppercase font-bold tracking-wider text-blue-400 flex items-center gap-1.5">
              <Icon id={ICON_IDS.coins} size={14} className="text-blue-400" />
              Deposit Estimate
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">LP Tokens to Receive</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-gray-100">
                  {lpMintEstimate.toFixed(6)}
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    LP
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Your Pool Share</p>
                <p
                  className={`mt-0.5 font-mono text-sm font-semibold ${
                    poolSharePercent >= 1 ? "text-emerald-400" : "text-gray-100"
                  }`}
                >
                  {poolSharePercent < 0.0001
                    ? "< 0.0001%"
                    : `${poolSharePercent.toFixed(4)}%`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-blue-500/10">
              <div>
                <p className="text-xs text-gray-500">Depositing</p>
                <p className="mt-0.5 font-mono text-xs text-gray-300">
                  {amountA.toFixed(6)}{" "}
                  <span className="text-gray-500">{assetA.symbol}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">&nbsp;</p>
                <p className="mt-0.5 font-mono text-xs text-gray-300">
                  {amountB.toFixed(6)}{" "}
                  <span className="text-gray-500">{assetB.symbol}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Input-token approval state machine ─────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs uppercase font-bold text-gray-500">
            Input Token Approval
          </p>
          <div className="grid grid-cols-1 gap-3">
            {([inputApprovalKey] as const).map((key) => {
              const asset = inputAsset === "A" ? assetA : assetB;
              const status = approval[key];
              const isApproved = status === "approved";
              const isLoading =
                status === "checking" || status === "pending";
              const isErr = status === "error";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApprove(key)}
                  disabled={
                    isApproved ||
                    isLoading ||
                    !hasValidAmounts ||
                    isSubmitting ||
                    txHash !== null
                  }
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    isApproved
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
                      : isErr
                      ? "border-red-500/40 bg-red-950/20 text-red-400 hover:bg-red-950/30"
                      : isLoading
                      ? "border-gray-700 bg-gray-800/40 text-gray-400"
                      : "border-gray-700 bg-[#0d1117] text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                  }`}
                  aria-label={`Approve ${asset.symbol}`}
                >
                  {isApproved && (
                    <Icon
                      id={ICON_IDS.checkCircle}
                      size={15}
                      className="text-emerald-400 shrink-0"
                    />
                  )}
                  {isLoading && (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {isErr && (
                    <Icon
                      id={ICON_IDS.alertTriangle}
                      size={15}
                      className="text-red-400 shrink-0"
                    />
                  )}
                  {!isApproved && !isLoading && !isErr && (
                    <Icon
                      id={ICON_IDS.lock}
                      size={15}
                      className="text-gray-500 shrink-0"
                    />
                  )}
                  <span className="truncate">
                    {isApproved
                      ? `${asset.symbol} Approved`
                      : isLoading
                      ? `Approving ${asset.symbol}…`
                      : isErr
                      ? `Retry ${asset.symbol}`
                      : `Approve ${asset.symbol}`}
                  </span>
                </button>
              );
            })}
          </div>
          {!wallet?.connected && (
            <p className="text-xs text-yellow-600 flex items-center gap-1">
              <Icon
                id={ICON_IDS.alertTriangle}
                size={12}
                className="text-yellow-500 shrink-0"
              />
              Connect your wallet to approve assets and deposit liquidity.
            </p>
          )}
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {submitError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {isConfirmationOpen && hasValidAmounts && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 space-y-3" role="region" aria-label="Deposit confirmation">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-amber-400">Review atomic deposit</p>
              <p className="mt-1 text-xs text-gray-400">One transaction performs the internal swap and LP mint.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><span className="text-gray-400">Internal swap</span><span className="font-mono text-gray-200">{quote.swapInputAmount.toFixed(6)} {inputAsset === "A" ? assetA.symbol : assetB.symbol}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-400">Swap receives</span><span className="font-mono text-gray-200">{quote.swapOutputAmount.toFixed(6)} {inputAsset === "A" ? assetB.symbol : assetA.symbol}</span></div>
              <div className="flex justify-between gap-4 border-t border-amber-500/10 pt-2"><span className="text-gray-400">LP token mint</span><span className="font-mono font-semibold text-emerald-400">{lpMintEstimate.toFixed(6)} LP</span></div>
            </div>
          </div>
        )}

        {/* ── Success banner ─────────────────────────────────────────────── */}
        {txHash && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            Liquidity added successfully. Transaction:{" "}
            <span className="font-mono break-all">{txHash}</span>
          </div>
        )}

        {/* ── Action row ────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {txHash ? "Close" : "Cancel"}
          </button>
          {!txHash && (
            <button
              type={isConfirmationOpen ? "button" : "submit"}
              onClick={isConfirmationOpen ? handleConfirm : undefined}
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Confirming…" : isConfirmationOpen ? "Confirm Deposit" : "Review Deposit"}
            </button>
          )}
        </div>
      </form>
    </OptimizedDialog>
  );
}

// ---------------------------------------------------------------------------
// Public export — self-contained with its own WalletProvider boundary
// ---------------------------------------------------------------------------

/**
 * AddLiquidityModal
 *
 * Proportional two-asset deposit interface for StellarFlow liquidity pools.
 *
 * Features:
 * - Calculates required counter-asset amount from pool reserve ratio
 * - Displays estimated LP tokens to be minted and resulting pool share %
 * - Enforces sequential dual-asset approval before submission is enabled
 * - Validates wallet connection before any on-chain action
 * - Lazy-loads Stellar SDK and Freighter API to keep the initial bundle small
 *
 * @example
 * ```tsx
 * <AddLiquidityModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   assetA={{ symbol: "XLM",  contractId: "CXLM..." }}
 *   assetB={{ symbol: "USDC", contractId: "CUSDC..." }}
 *   reserves={{ reserveA: 100_000, reserveB: 12_000, totalLpSupply: 34_641 }}
 *   poolLabel="XLM / USDC"
 *   onDepositSuccess={(hash) => console.log("Deposit hash:", hash)}
 * />
 * ```
 */
export function AddLiquidityModal(props: AddLiquidityModalProps) {
  return (
    <WalletProvider>
      <AddLiquidityModalContent {...props} />
    </WalletProvider>
  );
}

export default AddLiquidityModal;
