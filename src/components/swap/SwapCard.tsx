"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useWallet, useWalletActions } from "@/app/components/providers/WalletProvider";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useSlippageTolerance } from "@/app/hooks/useSlippageTolerance";
import { formatTokenAmount } from "@/utils/formatters";
import { HIGH_SLIPPAGE_WARNING_THRESHOLD, calculateMinAmountOut } from "@/lib/slippage";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { PathVisualizer } from "./PathVisualizer";
import { GasEstimateBadge } from "./GasEstimateBadge";
import { TokenSelectorModal } from "./TokenSelectorModal";
import { SlippageSettingsModal } from "./SlippageSettingsModal";
import { triggerHaptic } from "@/lib/haptics";
import type { TokenOption } from "./SwapForm";
import { SlippageVisualizer } from "@/components/trading/SlippageVisualizer";

interface SwapCardProps {
  tokens: TokenOption[];
  onSwapSuccess?: () => void;
}

type ActiveField = "from" | "to" | null;

interface SubmitButtonState {
  text: string;
  disabled: boolean;
  reason?: string | null;
  action?: () => Promise<unknown>;
}

export const SwapCard: React.FC<SwapCardProps> = ({ tokens, onSwapSuccess }) => {
  const { wallet } = useWallet();
  const { refreshWalletState } = useWalletActions();
  const isConnected = wallet?.connected || false;
  const { executeSwap, isSwapping } = useSwapExecution();
  const { slippagePercent, setSlippagePercent } = useSlippageTolerance();

  const [fromToken, setFromToken] = useState<TokenOption>(tokens[0]);
  const [toToken, setToToken] = useState<TokenOption>(tokens[1]);

  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");

  const [fromBalance, setFromBalance] = useState<string>("0");
  const [toBalance, setToBalance] = useState<string>("0");

  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);

  const [activeSelector, setActiveSelector] = useState<ActiveField>(null);
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [acknowledgedPriceImpact, setAcknowledgedPriceImpact] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!wallet?.connected || !wallet.publicKey) return;
    try {
      const [resFrom, resTo] = await Promise.all([
        fetch(`/api/v1/balances?account=${wallet.publicKey}&token=${fromToken.address}`),
        fetch(`/api/v1/balances?account=${wallet.publicKey}&token=${toToken.address}`),
      ]);
      const dataFrom = await resFrom.json();
      const dataTo = await resTo.json();

      setFromBalance(dataFrom.balance || "0");
      setToBalance(dataTo.balance || "0");
    } catch (err) {
      console.error("Error fetching token balances:", err);
    }
  }, [wallet?.connected, wallet?.publicKey, fromToken, toToken]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    let isMounted = true;
    const fetchQuote = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount("");
        setPriceImpact(0);
        return;
      }

      setIsLoadingRate(true);
      try {
        const response = await fetch(
          `/api/v1/swap/quote?from=${fromToken.address}&to=${toToken.address}&amount=${fromAmount}`,
        );
        const data = await response.json();

        if (isMounted && data) {
          setToAmount(data.estimatedOutput || "");
          setPriceImpact(data.priceImpact || 0);
        }
      } catch (err) {
        console.error("Error fetching swap quote:", err);
      } finally {
        if (isMounted) setIsLoadingRate(false);
      }
    };

    const timer = setTimeout(fetchQuote, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [fromAmount, fromToken, toToken]);

  // A new quote supersedes any prior high price-impact acknowledgement.
  useEffect(() => {
    setAcknowledgedPriceImpact(false);
  }, [fromAmount, fromToken.address, toToken.address, slippagePercent]);

  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSetMax = () => {
    setFromAmount(fromBalance);
  };

  const handleSelectToken = (field: "from" | "to") => (token: TokenOption) => {
    if (field === "from") setFromToken(token);
    else setToToken(token);
  };

  const handleSlippageConfirm = (percent: number) => {
    setSlippagePercent(percent);
  };

  const parsedFromAmount = parseFloat(fromAmount) || 0;
  const parsedFromBalance = parseFloat(fromBalance) || 0;
  const hasInsufficientBalance = parsedFromAmount > parsedFromBalance;
  const isValidAmount = parsedFromAmount > 0;
  const isHighPriceImpact = isValidAmount && priceImpact > HIGH_SLIPPAGE_WARNING_THRESHOLD;
  const isHighSlippage = slippagePercent > 3;
  const requiresPriceImpactAck = (isHighPriceImpact || isHighSlippage) && !acknowledgedPriceImpact;

  const minAmountOut = useMemo(() => {
    const quoted = parseFloat(toAmount);
    if (!isValidAmount || !Number.isFinite(quoted) || quoted <= 0) return null;
    return calculateMinAmountOut(quoted, slippagePercent);
  }, [toAmount, isValidAmount, slippagePercent]);

  const submitButtonState = useMemo<SubmitButtonState>(() => {
    if (!isConnected) return { text: "Connect Wallet", disabled: false, action: refreshWalletState };
    if (!isValidAmount) return { text: "Enter an Amount", disabled: true };
    if (hasInsufficientBalance)
      return {
        text: `Insufficient ${fromToken.symbol} Balance`,
        disabled: true,
        reason: `Your wallet only holds ${formatTokenAmount(fromBalance)} ${fromToken.symbol}.`,
      };
    if (requiresPriceImpactAck)
      return { text: "Confirm Price Impact to Continue", disabled: true };
    if (isSwapping) return { text: "Executing Swap...", disabled: true };
    return { text: "Swap Tokens", disabled: false };
  }, [
    isConnected,
    isValidAmount,
    hasInsufficientBalance,
    requiresPriceImpactAck,
    isSwapping,
    fromToken.symbol,
    fromBalance,
    refreshWalletState,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic("lightTap");
    if (!isConnected) {
      await submitButtonState.action?.();
      return;
    }
    if (submitButtonState.disabled) return;

    try {
      await executeSwap({
        fromToken: fromToken.address,
        toToken: toToken.address,
        amount: fromAmount,
        minOutput: minAmountOut !== null ? minAmountOut.toString() : toAmount,
      });

      triggerHaptic("successChime");
      setFromAmount("");
      setToAmount("");
      fetchBalances();
      onSwapSuccess?.();
    } catch (err) {
      triggerHaptic("errorAlert");
      console.error("Swap execution failed:", err);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Swap</h2>
        <div className="flex items-center gap-2">
          <GasEstimateBadge />
          <button
            type="button"
            onClick={() => setIsSlippageModalOpen(true)}
            className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
          >
            {slippagePercent}% slippage
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TokenField
          label="You Pay"
          amount={fromAmount}
          onAmountChange={setFromAmount}
          balance={fromBalance}
          token={fromToken}
          onOpenSelector={() => setActiveSelector("from")}
          onMax={handleSetMax}
        />

        <div className="flex justify-center -my-2 z-10 relative">
          <button
            type="button"
            onClick={handleSwitchTokens}
            aria-label="Switch tokens"
            className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-all shadow-md"
          >
            <ArrowDown size={16} />
          </button>
        </div>

        <TokenField
          label="You Receive (Estimated)"
          amount={toAmount}
          balance={toBalance}
          token={toToken}
          onOpenSelector={() => setActiveSelector("to")}
          readOnly
        />

        {isValidAmount && (
          <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Price Impact</span>
              <span
                className={`font-semibold font-mono ${
                  priceImpact > 5 ? "text-red-400" : priceImpact > 2 ? "text-yellow-400" : "text-green-400"
                }`}
              >
                {isLoadingRate ? "Calculating..." : `${priceImpact.toFixed(2)}%`}
              </span>
            </div>
            {minAmountOut !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Minimum Received</span>
                <span className="font-mono text-gray-200">
                  {minAmountOut} {toToken.symbol}
                </span>
              </div>
            )}
          </div>
        )}

        {isValidAmount && minAmountOut !== null && (
          <SlippageVisualizer expectedOutput={Number(toAmount) || 0} outputSymbol={toToken.symbol} slippagePercent={slippagePercent} onSlippageChange={setSlippagePercent} />
        )}

        {isValidAmount && <PathVisualizer fromToken={fromToken} toToken={toToken} amount={fromAmount} />}

        {(isHighPriceImpact || isHighSlippage) && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 p-3 space-y-2"
            role="alert"
          >
            <p className="text-xs font-semibold text-red-300">
              {isHighSlippage
                ? `Slippage tolerance is ${slippagePercent}%, above the 3% danger threshold. You may receive significantly less value than expected.`
                : `This swap has a price impact of ${priceImpact.toFixed(2)}%. You may receive significantly less value than you put in.`}
            </p>
            <label className="flex items-start gap-2 text-xs text-red-200">
              <input
                type="checkbox"
                checked={acknowledgedPriceImpact}
                onChange={(e) => setAcknowledgedPriceImpact(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-red-500/60 bg-transparent text-red-500 focus:ring-red-500"
              />
              I understand the risks and want to proceed anyway.
            </label>
          </div>
        )}

        <SubmitButton state={submitButtonState} />
      </form>

      <TokenSelectorModal
        isOpen={activeSelector !== null}
        onClose={() => setActiveSelector(null)}
        tokens={tokens}
        onSelect={handleSelectToken(activeSelector ?? "from")}
        selectedAddress={activeSelector === "from" ? fromToken.address : toToken.address}
        disabledAddress={activeSelector === "from" ? toToken.address : fromToken.address}
        balances={{ [fromToken.address]: fromBalance, [toToken.address]: toBalance }}
      />

      <SlippageSettingsModal
        isOpen={isSlippageModalOpen}
        onClose={() => setIsSlippageModalOpen(false)}
        quotedAmountOut={toAmount ? parseFloat(toAmount) : undefined}
        outputAssetSymbol={toToken.symbol}
        onConfirm={handleSlippageConfirm}
      />
    </div>
  );
};

interface TokenFieldProps {
  label: string;
  amount: string;
  onAmountChange?: (value: string) => void;
  balance: string;
  token: TokenOption;
  onOpenSelector: () => void;
  onMax?: () => void;
  readOnly?: boolean;
}

const TokenField: React.FC<TokenFieldProps> = ({
  label,
  amount,
  onAmountChange,
  balance,
  token,
  onOpenSelector,
  onMax,
  readOnly,
}) => (
  <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800 focus-within:border-blue-500 transition-all">
    <div className="flex justify-between text-xs text-gray-400 mb-2">
      <span>{label}</span>
      <span>
        Balance: {formatTokenAmount(balance)} {token.symbol}
      </span>
    </div>

    <div className="flex items-center gap-3">
      <input
        type="number"
        placeholder="0.0"
        value={amount}
        readOnly={readOnly}
        onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
        className={`w-full bg-transparent text-2xl font-bold text-white outline-none font-mono ${
          readOnly ? "opacity-80" : ""
        }`}
      />
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold hover:bg-blue-600/30"
        >
          MAX
        </button>
      )}
      <button
        type="button"
        onClick={onOpenSelector}
        className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
      >
        <TokenIcon src={token.iconUrl} symbol={token.symbol} size={20} />
        {token.symbol}
      </button>
    </div>
  </div>
);

const SubmitButton: React.FC<{ state: SubmitButtonState }> = ({ state }) => {
  const button = (
    <button
      type="submit"
      disabled={state.disabled}
      className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
        state.disabled
          ? "bg-gray-800 text-gray-500 cursor-not-allowed"
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-600/20"
      }`}
    >
      {state.text}
    </button>
  );

  if (!state.reason) return button;

  return (
    <span className="block" title={state.reason}>
      {button}
    </span>
  );
};

export default SwapCard;
