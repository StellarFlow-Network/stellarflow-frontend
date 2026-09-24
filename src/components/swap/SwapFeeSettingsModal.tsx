"use client";

import React, { useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

export interface SwapFeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendedFee: string;
  currentFee: string;
  onConfirm: (fee: string) => void;
}

export function SwapFeeSettingsModal({
  isOpen,
  onClose,
  recommendedFee,
  currentFee,
  onConfirm,
}: SwapFeeSettingsModalProps) {
  const [customFee, setCustomFee] = useState(currentFee);
  const [touched, setTouched] = useState(false);

  const numericFee = Number(customFee);
  const isValid = !isNaN(numericFee) && numericFee >= Number(recommendedFee);

  const handleSave = () => {
    if (!isValid) return;
    onConfirm(customFee);
    onClose();
  };

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Network Fee Settings"
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
          <p className="text-xs uppercase font-bold text-gray-500">
            Recommended Base Fee
          </p>
          <p className="mt-1 font-mono text-base text-gray-200">
            {recommendedFee} stroops
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="custom-fee-input"
            className="text-xs uppercase font-bold text-gray-500"
          >
            Custom / Priority Fee (stroops)
          </label>
          <input
            id="custom-fee-input"
            type="number"
            min={recommendedFee}
            value={customFee}
            onChange={(e) => {
              setCustomFee(e.target.value);
              setTouched(true);
            }}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          />
          {touched && !isValid && (
            <p className="text-xs text-red-400">
              Fee must be at least the recommended base fee ({recommendedFee} stroops).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save Fee
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default SwapFeeSettingsModal;
