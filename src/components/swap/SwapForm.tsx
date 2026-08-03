import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/app/components/providers/WalletProvider';
import { useSwapExecution } from '@/hooks/useSwapExecution';
import { formatTokenAmount } from '@/utils/formatters';
import { PathVisualizer } from './PathVisualizer';

export interface TokenOption {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  iconUrl?: string;
}

interface SwapFormProps {
  tokens: TokenOption[];
  onSwapSuccess?: () => void;
}

export const SwapForm: React.FC<SwapFormProps> = ({ tokens, onSwapSuccess }) => {
  const { isConnected, connectWallet, address } = useWallet();
  const { executeSwap, isSwapping } = useSwapExecution();

  const [fromToken, setFromToken] = useState<TokenOption>(tokens[0]);
  const [toToken, setToToken] = useState<TokenOption>(tokens[1]);

  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');

  const [fromBalance, setFromBalance] = useState<string>('0');
  const [toBalance, setToBalance] = useState<string>('0');

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);

  // Fetch token balances on asset or account change
  const fetchBalances = useCallback(async () => {
    if (!isConnected || !address) return;
    try {
      const [resFrom, resTo] = await Promise.all([
        fetch(`/api/v1/balances?account=${address}&token=${fromToken.address}`),
        fetch(`/api/v1/balances?account=${address}&token=${toToken.address}`),
      ]);
      const dataFrom = await resFrom.json();
      const dataTo = await resTo.json();

      setFromBalance(dataFrom.balance || '0');
      setToBalance(dataTo.balance || '0');
    } catch (err) {
      console.error('Error fetching token balances:', err);
    }
  }, [isConnected, address, fromToken, toToken]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Fetch swap quote and auto-balance ratio calculation
  useEffect(() => {
    let isMounted = true;
    const fetchQuote = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        setPriceImpact(0);
        return;
      }

      setIsLoadingRate(true);
      try {
        const response = await fetch(
          `/api/v1/swap/quote?from=${fromToken.address}&to=${toToken.address}&amount=${fromAmount}`
        );
        const data = await response.json();

        if (isMounted && data) {
          setToAmount(data.estimatedOutput || '');
          setExchangeRate(data.rate || null);
          setPriceImpact(data.priceImpact || 0);
        }
      } catch (err) {
        console.error('Error fetching swap quote:', err);
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

  // Swap Token A and Token B selections
  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // Max balance auto-fill
  const handleSetMax = () => {
    setFromAmount(fromBalance);
  };

  // Parameter and Balance Validations
  const parsedFromAmount = parseFloat(fromAmount) || 0;
  const parsedFromBalance = parseFloat(fromBalance) || 0;
  const hasInsufficientBalance = parsedFromAmount > parsedFromBalance;
  const isValidAmount = parsedFromAmount > 0;

  const submitButtonState = useMemo(() => {
    if (!isConnected) return { text: 'Connect Wallet', disabled: false, action: connectWallet };
    if (!isValidAmount) return { text: 'Enter an Amount', disabled: true };
    if (hasInsufficientBalance) return { text: `Insufficient ${fromToken.symbol} Balance`, disabled: true };
    if (isSwapping) return { text: 'Executing Swap...', disabled: true };
    return { text: 'Swap Tokens', disabled: false };
  }, [isConnected, isValidAmount, hasInsufficientBalance, isSwapping, fromToken.symbol, connectWallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitButtonState.action) {
      submitButtonState.action();
      return;
    }

    if (submitButtonState.disabled) return;

    try {
      await executeSwap({
        fromToken: fromToken.address,
        toToken: toToken.address,
        amount: fromAmount,
        minOutput: toAmount, // Apply slippage bounds in hook
      });

      setFromAmount('');
      setToAmount('');
      fetchBalances();
      if (onSwapSuccess) onSwapSuccess();
    } catch (err) {
      console.error('Swap execution failed:', err);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Swap Assets</h2>
        {exchangeRate && (
          <span className="text-xs font-mono text-gray-400">
            1 {fromToken.symbol} ≈ {exchangeRate.toFixed(4)} {toToken.symbol}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pay Field */}
        <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800 focus-within:border-blue-500 transition-all">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>You Pay</span>
            <span>
              Balance: {formatTokenAmount(fromBalance)} {fromToken.symbol}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-white outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleSetMax}
              className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold hover:bg-blue-600/30"
            >
              MAX
            </button>
            <select
              value={fromToken.address}
              onChange={(e) => {
                const selected = tokens.find((t) => t.address === e.target.value);
                if (selected) setFromToken(selected);
              }}
              className="bg-gray-700 text-white font-semibold rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
            >
              {tokens.map((t) => (
                <option key={t.address} value={t.address} disabled={t.address === toToken.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Switch Tokens Trigger */}
        <div className="flex justify-center -my-2 z-10 relative">
          <button
            type="button"
            onClick={handleSwitchTokens}
            className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-all shadow-md"
          >
            ↓↑
          </button>
        </div>

        {/* Receive Field */}
        <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800 transition-all">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>You Receive (Estimated)</span>
            <span>
              Balance: {formatTokenAmount(toBalance)} {toToken.symbol}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="w-full bg-transparent text-2xl font-bold text-white outline-none font-mono opacity-80"
            />
            <select
              value={toToken.address}
              onChange={(e) => {
                const selected = tokens.find((t) => t.address === e.target.value);
                if (selected) setToToken(selected);
              }}
              className="bg-gray-700 text-white font-semibold rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
            >
              {tokens.map((t) => (
                <option key={t.address} value={t.address} disabled={t.address === fromToken.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Price Impact & Details */}
        {isValidAmount && (
          <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Price Impact</span>
              <span
                className={`font-semibold font-mono ${
                  priceImpact > 5 ? 'text-red-400' : priceImpact > 2 ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                {isLoadingRate ? 'Calculating...' : `${priceImpact.toFixed(2)}%`}
              </span>
            </div>
          </div>
        )}

        {/* Multi-Hop Route Visualization */}
        {isValidAmount && (
          <PathVisualizer fromToken={fromToken} toToken={toToken} amount={fromAmount} />
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitButtonState.disabled}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
            submitButtonState.disabled
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-600/20'
          }`}
        >
          {submitButtonState.text}
        </button>
      </form>
    </div>
  );
};