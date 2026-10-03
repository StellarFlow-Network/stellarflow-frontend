"use client";

import React from "react";
import { Fuel } from "lucide-react";
import { useSwapFeeEstimation } from "@/hooks/useSwapFeeEstimation";
import { formatXLM } from "@/utils/formatters";

const STROOPS_PER_XLM = 10_000_000;

export interface GasEstimateBadgeProps {
  className?: string;
  onClick?: () => void;
}

/** Compact pill showing the current estimated network fee for a swap, in XLM. */
export const GasEstimateBadge: React.FC<GasEstimateBadgeProps> = ({ className = "", onClick }) => {
  const { recommendedFee, isLoadingFee, feeError } = useSwapFeeEstimation();

  const feeXLM = formatXLM((Number(recommendedFee) / STROOPS_PER_XLM).toString());

  const content = (
    <>
      <Fuel size={12} className="text-gray-400" />
      {isLoadingFee ? (
        <span className="animate-pulse text-gray-500">Estimating...</span>
      ) : feeError ? (
        <span className="text-gray-500">Fee unavailable</span>
      ) : (
        <span className="font-mono">~{feeXLM} XLM</span>
      )}
    </>
  );

  const pillClassName = `inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs font-medium text-gray-300 ${
    onClick ? "cursor-pointer transition-colors hover:bg-gray-800" : ""
  } ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Estimated network fee for this transaction"
        className={pillClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <div title="Estimated network fee for this transaction" className={pillClassName}>
      {content}
    </div>
  );
};

export default GasEstimateBadge;
