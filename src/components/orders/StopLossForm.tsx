"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useWallet } from '@/app/components/providers/WalletProvider';
import OptimizedDialog from '@/app/components/OptimizedDialog';
import { useSocket } from '@/app/hooks/useSocket';
import { ASSET_SYMBOL_LIST, type AssetSymbol } from '@/config/assetSymbols';

export interface StopLossCondition {
  id: string;
  assetSymbol: string;
  triggerPrice: number;
  currentSpotPrice: number;
  percentageDistance: number;
  maxSlippage: number;
  positionSize: string;
  createdAt: number;
  isActive: boolean;
}

interface StopLossFormProps {
  selectedAsset?: string;
  onStopLossCreated?: (condition: StopLossCondition) => void;
  pendingStopLosses?: StopLossCondition[];
}

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

export const StopLossForm: React.FC<StopLossFormProps> = ({
  selectedAsset,
  onStopLossCreated,
  pendingStopLosses = [],
}) => {
  const { isConnected, address } = useWallet();
  const { lastUpdate } = useSocket({
    assetIds: [...ASSET_SYMBOL_LIST] as AssetSymbol[],
    enableDeltaUpdates: true,
  });

  // Form state
  const [assetSymbol, setAssetSymbol] = useState<string>(selectedAsset || ASSET_SYMBOL_LIST[0]);
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [positionSize, setPositionSize] = useState<string>('');
  const [maxSlippage, setMaxSlippage] = useState<string>('1.0');
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [livePrices, setLivePrices] = useState<Map<string, number>>(new Map());
  const [formDataToSubmit, setFormDataToSubmit] = useState<{
    assetSymbol: string;
    triggerPrice: number;
    positionSize: string;
    maxSlippage: number;
  } | null>(null);

  // Update live prices from WebSocket
  useEffect(() => {
    if (lastUpdate && 'assetPair' in lastUpdate && 'price' in lastUpdate) {
      setLivePrices(prev => {
        const newPrices = new Map(prev);
        newPrices.set(lastUpdate.assetPair, lastUpdate.price);
        return newPrices;
      });
    }
  }, [lastUpdate]);

  // Current spot price for selected asset
  const currentSpotPrice = useMemo(() => {
    return livePrices.get(assetSymbol) || 0;
  }, [assetSymbol, livePrices]);

  // Calculate percentage distance from current spot price
  const percentageDistance = useMemo(() => {
    const parsedTriggerPrice = parseFloat(triggerPrice);
    if (!currentSpotPrice || !parsedTriggerPrice || parsedTriggerPrice <= 0) return null;
    
    // Calculate percentage difference from current price (stop loss is always below current price)
    const distance = ((currentSpotPrice - parsedTriggerPrice) / currentSpotPrice) * 100;
    return distance;
  }, [triggerPrice, currentSpotPrice]);

  // Quick percentage buttons for common stop-loss levels
  const quickPercentageButtons = [5, 10, 15, 20];

  const handleQuickPercentage = (percentage: number) => {
    if (!currentSpotPrice) return;
    const calculatedTriggerPrice = currentSpotPrice * (1 - percentage / 100);
    setTriggerPrice(calculatedTriggerPrice.toFixed(4));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedTriggerPrice = parseFloat(triggerPrice);
    const parsedMaxSlippage = parseFloat(maxSlippage) || 1.0;
    
    if (!parsedTriggerPrice || !currentSpotPrice || parsedTriggerPrice >= currentSpotPrice) {
      return;
    }

    // Store form data and open warning modal
    setFormDataToSubmit({
      assetSymbol,
      triggerPrice: parsedTriggerPrice,
      positionSize,
      maxSlippage: parsedMaxSlippage,
    });
    setIsWarningModalOpen(true);
  };

  const confirmStopLossCreation = async () => {
    if (!formDataToSubmit) return;
    
    setIsSubmitting(true);
    
    try {
      // Create new stop-loss condition
      const newCondition: StopLossCondition = {
        id: crypto.randomUUID(),
        assetSymbol: formDataToSubmit.assetSymbol,
        triggerPrice: formDataToSubmit.triggerPrice,
        currentSpotPrice,
        percentageDistance: percentageDistance || 0,
        maxSlippage: formDataToSubmit.maxSlippage,
        positionSize: formDataToSubmit.positionSize,
        createdAt: Date.now(),
        isActive: true,
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onStopLossCreated?.(newCondition);
      
      // Reset form
      setTriggerPrice('');
      setPositionSize('');
      setMaxSlippage('1.0');
    } catch (err) {
      console.error('Failed to create stop-loss:', err);
    } finally {
      setIsSubmitting(false);
      setIsWarningModalOpen(false);
      setFormDataToSubmit(null);
    }
  };

  const cancelStopLossCreation = () => {
    setIsWarningModalOpen(false);
    setFormDataToSubmit(null);
  };

  // Validation
  const parsedTriggerPrice = parseFloat(triggerPrice);
  const isValidTrigger = currentSpotPrice > 0 && parsedTriggerPrice > 0 && parsedTriggerPrice < currentSpotPrice;
  const isValidPosition = parseFloat(positionSize) > 0;
  const canSubmit = isConnected && isValidTrigger && isValidPosition;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Stop Loss Creation Form */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Set Stop-Loss Trigger</h2>
          {currentSpotPrice > 0 && (
            <span className="text-xs font-mono text-gray-400">
              Spot Price: ${currentSpotPrice.toFixed(4)}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Asset Selection */}
          <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800">
            <label className="block text-xs text-gray-400 mb-2">Asset</label>
            <select
              value={assetSymbol}
              onChange={(e) => setAssetSymbol(e.target.value)}
              className="w-full bg-gray-700 text-white font-semibold rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
            >
              {ASSET_SYMBOL_LIST.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Price Input */}
          <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800 focus-within:border-blue-500 transition-all">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Trigger Price</span>
              {percentageDistance !== null && percentageDistance > 0 && (
                <span className={`font-mono ${percentageDistance > 15 ? 'text-red-400' : 'text-green-400'}`}>
                  {percentageDistance.toFixed(2)}% below current price
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.0001"
              placeholder="0.0000"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-white outline-none font-mono"
            />
            
            {/* Quick percentage buttons */}
            <div className="flex gap-2 mt-3">
              {quickPercentageButtons.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercentage(pct)}
                  className="px-3 py-1 rounded bg-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-600 transition-colors"
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Position Size */}
          <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800">
            <label className="block text-xs text-gray-400 mb-2">Position Size</label>
            <input
              type="number"
              step="0.0001"
              placeholder="0.0000"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-white outline-none font-mono"
            />
          </div>

          {/* Max Slippage */}
          <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Max Slippage Tolerance</span>
              <span className="font-mono text-blue-400">{maxSlippage}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={maxSlippage}
              onChange={(e) => setMaxSlippage(e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.1%</span>
              <span>5%</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
              !canSubmit
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-red-600/20'
            }`}
          >
            {!isConnected ? 'Connect Wallet to Continue' : 'Create Stop-Loss'}
          </button>
        </form>
      </div>

      {/* Pending Stop-Loss Conditions Display */}
      {pendingStopLosses.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-4">Active Stop-Loss Conditions</h3>
          <div className="space-y-3">
            {pendingStopLosses.map((condition) => (
              <div
                key={condition.id}
                className="rounded-lg bg-gray-800/60 p-4 border border-gray-800"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-green-600/20 text-green-400 text-xs font-semibold">
                      Active
                    </span>
                    <span className="text-white font-semibold">{condition.assetSymbol}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    Created {new Date(condition.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Trigger Price:</span>
                    <span className="text-white font-mono ml-2">${condition.triggerPrice.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Distance:</span>
                    <span className="text-yellow-400 font-mono ml-2">{condition.percentageDistance.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Slippage:</span>
                    <span className="text-blue-400 font-mono ml-2">{condition.maxSlippage}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Size:</span>
                    <span className="text-white font-mono ml-2">{condition.positionSize}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Modal */}
      <OptimizedDialog
        isOpen={isWarningModalOpen}
        onClose={cancelStopLossCreation}
        title="⚠️ Stop-Loss Execution Warning"
        size="lg"
      >
        <div className="space-y-4 text-gray-300">
          <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-700/50">
            <h4 className="text-yellow-400 font-semibold mb-2">Important Information</h4>
            <p className="text-sm leading-relaxed">
              Stop-loss orders are executed as market orders once the trigger price is reached. 
              In conditions of high market volatility, the execution price may differ significantly 
              from your trigger price.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-semibold">Execution Mechanics</h4>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li>Your stop-loss will monitor the oracle price feed in real-time</li>
              <li>When the price drops to or below your trigger price, the order will be submitted</li>
              <li>Execution is not guaranteed - network congestion may delay or prevent submission</li>
              <li>Your position will be sold at the best available market price</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-semibold">Max Slippage: {formDataToSubmit?.maxSlippage}%</h4>
            <p className="text-sm leading-relaxed">
              Your order will only execute if the execution price is within your specified slippage tolerance. 
              If the market price has fallen beyond your maximum slippage, the order will be cancelled to 
              protect you from excessive losses.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={cancelStopLossCreation}
              className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmStopLossCreation}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Confirm & Create'}
            </button>
          </div>
        </div>
      </OptimizedDialog>
    </div>
  );
};

export default StopLossForm;