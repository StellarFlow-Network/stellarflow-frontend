"use client";

import React, { useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import { useSlippageTolerance } from "@/app/hooks/useSlippageTolerance";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  PRESET_SLIPPAGE_OPTIONS,
  calculateMinAmountOut,
  validateSlippagePercent,
} from "@/lib/slippage";

export interface SlippageModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Quoted output amount for the pending swap, used to preview the
   * `min_amount_out` value that will be sent to the Soroban transaction
   * builder for the selected tolerance.
   */
  quotedAmountOut?: number;
  outputAssetSymbol?: string;
  /** Called with the confirmed slippage percentage and its derived min_amount_out. */
  onConfirm?: (slippagePercent: number, minAmountOut: number | null) => void;
}

export function SlippageModal({
  isOpen,
  onClose,
  quotedAmountOut,
  outputAssetSymbol = "",
  onConfirm,
}: SlippageModalProps) {
  const { slippagePercent, setSlippagePercent } = useSlippageTolerance();
  const [customInput, setCustomInput] = useState("");
  const [touched, setTouched] = useState(false);

  const isPresetActive = (preset: number) =>
    customInput === "" && slippagePercent === preset;

  const activeValue = customInput !== "" ? Number(customInput) : slippagePercent;
  const validation = useMemo(
    () => validateSlippagePercent(activeValue),
    [activeValue],
  );

  const minAmountOut = useMemo(() => {
    if (!validation.valid || quotedAmountOut === undefined) {
      return null;
    }
    return calculateMinAmountOut(quotedAmountOut, activeValue);
  }, [validation.valid, quotedAmountOut, activeValue]);

  const selectPreset = (preset: number) => {
    setCustomInput("");
    setSlippagePercent(preset);
  };

  const handleCustomChange = (value: string) => {
    setTouched(true);
    setCustomInput(value);
    const parsed = Number(value);
    if (value !== "" && validateSlippagePercent(parsed).valid) {
      setSlippagePercent(parsed);
    }
  };

  const handleConfirm = () => {
    if (!validation.valid) return;
    onConfirm?.(activeValue, minAmountOut);
    onClose();
  };

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Slippage Tolerance"
      size="sm"
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase font-bold text-gray-500 mb-2">
            Preset Tolerance
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_SLIPPAGE_OPTIONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isPresetActive(preset)
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-gray-700 text-gray-300 hover:bg-gray-800"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="custom-slippage"
            className="text-xs uppercase font-bold text-gray-500"
          >
            Custom
          </label>
          <div className="relative">
            <input
              id="custom-slippage"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={customInput}
              onChange={(event) => handleCustomChange(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={slippagePercent.toString()}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 pr-8 text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
              aria-invalid={touched && !validation.valid}
              aria-describedby="custom-slippage-warning custom-slippage-error"
            />
            <Icon
              id={ICON_IDS.percent}
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
          </div>
          {touched && validation.error && (
            <p
              id="custom-slippage-error"
              className="text-xs text-red-400"
              role="alert"
            >
              {validation.error}
            </p>
          )}
        </div>

        {validation.valid && validation.isHighRisk && (
          <div
            id="custom-slippage-warning"
            className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-950/20 px-3 py-2.5"
            role="alert"
          >
            <Icon
              id={ICON_IDS.alertTriangle}
              size={16}
              className="mt-0.5 shrink-0 text-yellow-400"
            />
            <p className="text-xs text-yellow-300">
              High slippage tolerance. Your transaction may be frontrun or
              executed at an unfavorable rate.
            </p>
          </div>
        )}

        {quotedAmountOut !== undefined && (
          <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
            <p className="text-xs uppercase font-bold text-gray-500">
              Minimum Received
            </p>
            <p className="mt-1 font-mono text-lg text-gray-100">
              {minAmountOut !== null ? minAmountOut : "—"}{" "}
              <span className="text-sm font-normal text-gray-400">
                {outputAssetSymbol}
              </span>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!validation.valid}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default SlippageModal;
