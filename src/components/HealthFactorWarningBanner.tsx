// src/components/HealthFactorWarningBanner.tsx
import React from 'react';

interface HealthFactorWarningBannerProps {
  healthFactor: number;
  onAddCollateralClick: (shortfallAmount: number) => void;
}

export const HealthFactorWarningBanner: React.FC<HealthFactorWarningBannerProps> = ({
  healthFactor,
  onAddCollateralClick,
}) => {
  if (healthFactor >= 1.1) return null;

  const shortfall = Math.max(0, Number((1.15 - healthFactor).toFixed(2)));

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-rose-600 px-4 py-3 text-white shadow-lg animate-pulse">
      <div className="flex items-center gap-2">
        <span className="text-lg">🚨</span>
        <span className="text-xs font-bold uppercase tracking-wider">Liquidation Risk Warning:</span>
        <span className="text-xs font-medium">
          Your Health Factor is critically low (<strong className="underline">{healthFactor.toFixed(2)}</strong>). Immediate deposit required to prevent liquidation.
        </span>
      </div>
      <button
        onClick={() => onAddCollateralClick(shortfall)}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-600 shadow hover:bg-slate-100 transition-colors"
      >
        Add Collateral Now
      </button>
    </div>
  );
};