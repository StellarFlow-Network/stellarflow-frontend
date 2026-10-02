"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, ShieldAlert, ArrowRight, X } from "lucide-react";

export interface HighPriceImpactModalProps {
  isOpen: boolean;
  priceImpact: number;
  fromAmount: string;
  fromSymbol: string;
  toAmount: string;
  toSymbol: string;
  estimatedUsdLoss: number | null;
  onConfirmSwap: () => void;
  onAdjustTradeSize: () => void;
  onClose: () => void;
}

export const HighPriceImpactModal: React.FC<HighPriceImpactModalProps> = ({
  isOpen,
  priceImpact,
  fromAmount,
  fromSymbol,
  toAmount,
  toSymbol,
  estimatedUsdLoss,
  onConfirmSwap,
  onAdjustTradeSize,
  onClose,
}) => {
  const [confirmInput, setConfirmInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset input and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim() === "CONFIRM";

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmed) {
      onConfirmSwap();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="high-impact-modal-title"
    >
      <div ref={dialogRef} className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-500/40 bg-gray-950 p-6 shadow-2xl shadow-red-950/50">
        {/* Top Decorative Warning Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 text-red-500 border border-red-500/30">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h3
              id="high-impact-modal-title"
              className="text-xl font-extrabold text-white tracking-tight"
            >
              High Price Impact Warning
            </h3>
            <p className="text-xs text-red-400 font-medium">
              Trade execution safety threshold exceeded (&gt;5.0%)
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="space-y-4">
          {/* Price Impact Metric Badge */}
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-center">
            <div className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-1">
              Calculated Price Impact
            </div>
            <div className="text-4xl font-black text-red-500 font-mono tracking-tight">
              {priceImpact.toFixed(2)}%
            </div>
            <p className="mt-2 text-xs text-gray-300">
              This trade will cause a severe price movement in the liquidity pool, resulting in significant slippage loss.
            </p>
          </div>

          {/* Trade Details & Estimated USD Loss */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Pay Amount</span>
              <span className="font-mono text-gray-200 font-semibold">
                {fromAmount} {fromSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Estimated Receive</span>
              <span className="font-mono text-gray-200 font-semibold">
                {toAmount} {toSymbol}
              </span>
            </div>
            <div className="border-t border-gray-800 pt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 inline text-amber-400" />
                Est. USD Lost to Slippage:
              </span>
              <span className="text-sm font-extrabold text-red-400 font-mono">
                {estimatedUsdLoss == null ? "Unavailable" : `-$${estimatedUsdLoss.toFixed(2)} USD`}
              </span>
            </div>
          </div>

          {/* Confirmation Input Gate */}
          <form onSubmit={handleConfirmSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="confirm-impact-input"
                className="block text-xs font-semibold text-gray-300 mb-1.5"
              >
                Type <span className="font-mono font-bold text-red-400">CONFIRM</span> to bypass safety lock:
              </label>
              <input
                ref={inputRef}
                id="confirm-impact-input"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type CONFIRM"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-mono font-bold text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={onAdjustTradeSize}
                className="w-full sm:w-1/2 rounded-xl border border-gray-700 bg-gray-800 py-3 text-xs font-bold text-gray-200 hover:bg-gray-700 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                Adjust Trade Size
              </button>
              <button
                type="submit"
                disabled={!isConfirmed}
                className={`w-full sm:w-1/2 rounded-xl py-3 text-xs font-extrabold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                  isConfirmed
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 cursor-pointer"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-800"
                }`}
              >
                Confirm Swap <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
