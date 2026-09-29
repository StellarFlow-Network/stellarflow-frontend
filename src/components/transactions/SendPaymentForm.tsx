'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Send, Clock } from 'lucide-react';
import { uriToPrefillData, formatExpiryTime, type SEP7PaymentData } from '@/utils/sep7';

export interface SendPaymentFormProps {
  publicKey: string;
  xlmBalance: string;
  /** Optional SEP-0007 URI to prefill the form */
  paymentUri?: string;
  onSuccess?: (data: { destination: string; amount: string; memo?: string }) => void;
  onCancel?: () => void;
}

export default function SendPaymentForm({
  publicKey,
  xlmBalance,
  paymentUri,
  onSuccess,
  onCancel,
}: SendPaymentFormProps) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [asset, setAsset] = useState('XLM');
  const [sep7Data, setSep7Data] = useState<SEP7PaymentData | null>(null);

  // Parse SEP-0007 URI on mount or when it changes
  useEffect(() => {
    if (paymentUri) {
      const parsed = uriToPrefillData(paymentUri);
      if (parsed) {
        setSep7Data(parsed);
        setDestination(parsed.destination);
        setAmount(parsed.amount || '');
        setMemo(parsed.memo || '');
        setAsset(parsed.asset || 'XLM');
      }
    }
  }, [paymentUri]);

  const isValidAddress = useCallback((addr: string) => {
    return /^G[A-Z2-7]{55}$/.test(addr);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!destination || !amount || !isValidAddress(destination)) {
      return;
    }

    onSuccess?.({
      destination,
      amount,
      memo: memo || undefined,
    });
  }, [destination, amount, memo, isValidAddress, onSuccess]);

  const isFormValid =
    destination &&
    amount &&
    isValidAddress(destination) &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(xlmBalance);

  const canSubmit = isFormValid && !sep7Data?.isExpired;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send Payment</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Send Stellar assets to another address
        </p>
      </div>

      {/* Expired Link Warning */}
      {sep7Data?.isExpired && (
        <div className="flex items-start gap-3 p-4 bg-red-600 border border-red-700 rounded-lg text-white animate-pulse">
          <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm uppercase tracking-wide mb-1">
              Payment Link Has Expired
            </p>
            <p className="text-sm">
              This payment link expired on {formatExpiryTime(sep7Data.validAfter!)}.
              The payment cannot be submitted.
            </p>
          </div>
        </div>
      )}

      {/* Valid After Info (if not expired) */}
      {sep7Data?.validAfter && !sep7Data.isExpired && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400">
          <Clock size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-1">Time-Restricted Payment</p>
            <p>This payment link is valid after {formatExpiryTime(sep7Data.validAfter)}</p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Destination Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Destination Address
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G..."
            disabled={!!paymentUri}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {destination && !isValidAddress(destination) && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              Invalid Stellar address
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.0000001"
              min="0"
              disabled={!!paymentUri && !!sep7Data?.amount}
              className="w-full px-4 py-3 pr-16 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {asset}
            </span>
          </div>
          {parseFloat(amount) > parseFloat(xlmBalance) && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              Amount exceeds available balance
            </p>
          )}
        </div>

        {/* Asset (if not XLM) */}
        {asset !== 'XLM' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asset
            </label>
            <input
              type="text"
              value={asset}
              disabled
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm opacity-60 cursor-not-allowed"
            />
          </div>
        )}

        {/* Memo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Memo (optional)
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Optional memo"
            disabled={!!paymentUri && !!sep7Data?.memo}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Balance Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-700 dark:text-gray-300">Your Balance:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {parseFloat(xlmBalance).toFixed(7)} XLM
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          title={sep7Data?.isExpired ? 'Payment link has expired' : undefined}
        >
          <Send size={18} />
          {sep7Data?.isExpired ? 'Link Expired' : 'Send Payment'}
        </button>
      </div>

      {/* Expiry Explanation */}
      {sep7Data?.isExpired && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium mb-1">Why is this disabled?</p>
          <p>
            This payment link included a <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">valid_after</code> timestamp
            that has passed. The sender intended this link to expire after a certain time.
          </p>
        </div>
      )}
    </div>
  );
}
