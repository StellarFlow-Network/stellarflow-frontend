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
  if (!Number.isFinite(healthFactor) || healthFactor >= 1.1) return null;

  const shortfall = Math.max(0, Number((1.15 - healthFactor).toFixed(2)));
  const critical = healthFactor <= 1;

  return (
    <div role="alert" aria-live="assertive" className={`sticky top-0 z-50 flex flex-col gap-3 border-b px-4 py-3 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between ${critical ? 'border-rose-300/30 bg-rose-700' : 'border-amber-300/30 bg-amber-700'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="text-lg">{critical ? '!' : '⚠'}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider">{critical ? 'Liquidation imminent' : 'Liquidation risk warning'}</p>
          <p className="mt-1 text-sm font-medium">
            Health factor is <strong className="underline">{healthFactor.toFixed(2)}</strong>. {critical ? 'Add collateral or repay debt immediately.' : 'Your position is approaching its liquidation threshold.'}
          </p>
          <p className="mt-1 text-xs text-white/75">Target health factor: 1.15 · Current gap: {shortfall.toFixed(2)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAddCollateralClick(shortfall)}
        className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow hover:bg-gray-100 transition-colors"
      >
        Add collateral
      </button>
    </div>
  );
};