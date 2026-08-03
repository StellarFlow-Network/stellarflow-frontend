import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import type { TokenOption } from './SwapForm';

export interface PathHop {
  poolId: string;
  poolLabel?: string;
  poolIcon?: string;
  tokenOutSymbol: string;
  tokenOutIcon?: string;
  priceImpact: number;
}

export interface SwapRoute {
  hops: PathHop[];
  totalPriceImpact: number;
}

interface PathVisualizerProps {
  fromToken: TokenOption;
  toToken: TokenOption;
  amount: string;
  className?: string;
}

const getImpactColorClass = (impact: number): string => {
  if (impact > 5) return 'text-red-400';
  if (impact > 2) return 'text-yellow-400';
  return 'text-green-400';
};

export const PathVisualizer: React.FC<PathVisualizerProps> = ({
  fromToken,
  toToken,
  amount,
  className = '',
}) => {
  const [route, setRoute] = useState<SwapRoute | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async (from: string, to: string, value: string, isMountedRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/swap/route?from=${from}&to=${to}&amount=${value}`);
      if (!response.ok) throw new Error('Failed to resolve swap path');
      const data: SwapRoute = await response.json();

      if (!isMountedRef.current) return;

      if (!data?.hops?.length) {
        setRoute(null);
        setError('No route found for this pair');
      } else {
        setRoute(data);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching swap route:', err);
      setRoute(null);
      setError('Unable to load routing path');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const isMountedRef = { current: true };

    const timer = setTimeout(() => {
      if (!amount || parseFloat(amount) <= 0 || fromToken.address === toToken.address) {
        setRoute(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      fetchRoute(fromToken.address, toToken.address, amount, isMountedRef);
    }, 300);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, [fromToken.address, toToken.address, amount, fetchRoute]);

  if (!amount || parseFloat(amount) <= 0 || fromToken.address === toToken.address) {
    return null;
  }

  return (
    <div
      className={`rounded-xl bg-gray-800/30 border border-gray-800 p-4 ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Route {route && `(${route.hops.length} hop${route.hops.length > 1 ? 's' : ''})`}
        </span>
        {route && !isLoading && (
          <span className={`text-xs font-mono font-semibold ${getImpactColorClass(route.totalPriceImpact)}`}>
            {route.totalPriceImpact.toFixed(2)}% total impact
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-5">
          <span className="text-xs text-gray-500 animate-pulse">Finding best route...</span>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex items-center justify-center py-5">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {!isLoading && !error && route && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <TokenBadge symbol={fromToken.symbol} iconUrl={fromToken.iconUrl} />

          {route.hops.map((hop, index) => (
            <React.Fragment key={`${hop.poolId}-${index}`}>
              <HopConnector hop={hop} />
              <TokenBadge
                symbol={hop.tokenOutSymbol}
                iconUrl={hop.tokenOutIcon}
                isDestination={index === route.hops.length - 1}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

interface TokenBadgeProps {
  symbol: string;
  iconUrl?: string;
  isDestination?: boolean;
}

const TokenBadge: React.FC<TokenBadgeProps> = ({ symbol, iconUrl, isDestination }) => (
  <div className="flex flex-col items-center gap-1 shrink-0">
    <div
      className={`flex items-center justify-center w-8 h-8 rounded-full border overflow-hidden ${
        isDestination ? 'border-blue-500 bg-blue-600/10' : 'border-gray-700 bg-gray-800'
      }`}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt={symbol} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold text-gray-300">{symbol.slice(0, 3)}</span>
      )}
    </div>
    <span className="text-[10px] font-semibold text-gray-300 whitespace-nowrap">{symbol}</span>
  </div>
);

interface HopConnectorProps {
  hop: PathHop;
}

const HopConnector: React.FC<HopConnectorProps> = ({ hop }) => (
  <div className="flex flex-col items-center gap-1 px-1 shrink-0 min-w-[56px]">
    <div className="flex items-center gap-1 text-gray-600">
      <ArrowRight size={14} />
      {hop.poolIcon ? (
        <div className="flex items-center justify-center w-4 h-4 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hop.poolIcon} alt={hop.poolLabel || hop.poolId} className="w-full h-full object-cover" />
        </div>
      ) : null}
    </div>
    <span
      className={`text-[10px] font-mono font-semibold ${getImpactColorClass(hop.priceImpact)}`}
      title={hop.poolLabel || hop.poolId}
    >
      {hop.priceImpact.toFixed(2)}%
    </span>
  </div>
);
