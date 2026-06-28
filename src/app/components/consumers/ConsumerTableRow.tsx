import React, { useMemo, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Core data structure for a single consumer row in the matrix/grid table.
 * All fields are considered in the memoization comparison to prevent stale state.
 */
export interface ConsumerTableRecord {
  id: string;
  projectName: string;
  contractAddress: string;
  shortenedAddress: string;
  tier: 'Enterprise' | 'Developer' | 'Staging';
  status: 'active' | 'expired' | 'paused';
  monthlyRequests: string;
  balanceXLM: number;
}

/**
 * Optional callback interface for row interactions.
 * When passing callbacks from parent, ensure they are memoized with useCallback
 * to prevent breaking the row's memoization boundaries.
 */
export interface ConsumerTableRowCallbacks {
  onViewContract?: (consumerId: string, contractAddress: string) => void;
}

export interface ConsumerTableRowProps {
  consumer: ConsumerTableRecord;
  callbacks?: ConsumerTableRowCallbacks;
}

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE-CRITICAL: Precomputed style variants (moved outside component)
// These static lookups eliminate repeated string concatenation in render cycles
// ══════════════════════════════════════════════════════════════════════════════

const CONSUMER_TIER_BADGE_CLASS =
  'px-3 py-1.5 rounded-full text-xs font-medium inline-block';

const CONSUMER_TIER_VARIANTS: Record<ConsumerTableRecord['tier'], string> = {
  Enterprise: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  Developer: 'bg-purple-900/40 text-purple-300 border border-purple-700/50',
  Staging: 'bg-gray-700/40 text-gray-300 border border-gray-600/50',
};

const CONSUMER_STATUS_TEXT_VARIANTS: Record<ConsumerTableRecord['status'], string> = {
  active: 'text-green-400',
  expired: 'text-red-400',
  paused: 'text-yellow-400',
};

const CONSUMER_STATUS_DOT_VARIANTS: Record<ConsumerTableRecord['status'], string> = {
  active: 'bg-green-500',
  expired: 'bg-red-500',
  paused: 'bg-yellow-500',
};

/**
 * OPTIMIZATION: Pure function for balance color classification
 * Extracted to module scope for inline caching by V8 engine
 */
function getBalanceColorClass(balance: number): string {
  if (balance >= 500) return 'text-green-400';
  if (balance >= 200) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * RIGID MEMOIZATION BOUNDARY: Custom props comparison function
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * This function creates a structural memoization barrier that prevents re-renders
 * when:
 * - Sibling rows update (different consumer.id)
 * - Parent container re-renders without data changes
 * - Unrelated state in the parent changes (sorting, filtering UI state, etc.)
 * 
 * Re-renders ONLY occur when:
 * - Any field in the consumer record changes
 * - Callback references change (callback identity is checked separately)
 * 
 * CORRECTNESS GUARANTEE: All fields are explicitly compared to avoid stale state bugs
 */
function consumerRowPropsAreEqual(
  prev: ConsumerTableRowProps,
  next: ConsumerTableRowProps,
): boolean {
  const a = prev.consumer;
  const b = next.consumer;
  
  // Primary data comparison - all consumer fields must match
  const dataUnchanged = (
    a.id === b.id &&
    a.projectName === b.projectName &&
    a.contractAddress === b.contractAddress &&
    a.shortenedAddress === b.shortenedAddress &&
    a.tier === b.tier &&
    a.status === b.status &&
    a.monthlyRequests === b.monthlyRequests &&
    a.balanceXLM === b.balanceXLM
  );
  
  if (!dataUnchanged) return false;
  
  // Callback reference comparison - prevents re-render if callbacks are stable
  // Note: Parent should memoize callbacks with useCallback for optimal performance
  const prevCallbacks = prev.callbacks;
  const nextCallbacks = next.callbacks;
  
  // If both undefined/null, callbacks unchanged
  if (!prevCallbacks && !nextCallbacks) return true;
  
  // If one is defined and other isn't, props changed
  if (!prevCallbacks || !nextCallbacks) return false;
  
  // Compare callback function references (identity check)
  return prevCallbacks.onViewContract === nextCallbacks.onViewContract;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * OPTIMIZED MATRIX ROW COMPONENT: ConsumerTableRow
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * PERFORMANCE OPTIMIZATIONS APPLIED:
 * 
 * 1. React.memo() with custom comparison function (consumerRowPropsAreEqual)
 *    → Prevents re-renders when sibling rows or parent container updates
 * 
 * 2. useMemo() for expensive text transformations
 *    → balanceLabel: toFixed(2) + string concatenation cached
 *    → balanceColorClass: conditional color logic cached
 *    → tierBadgeClass: combined className string cached
 *    → statusIndicatorClass: combined status className cached
 * 
 * 3. useCallback() for event handlers
 *    → Prevents child components from re-rendering when row data is stable
 *    → Critical for preventing React from re-creating inline functions
 * 
 * 4. Computed primitives cached (showLowRefillAlert)
 *    → Simple boolean comparison, minimal overhead but improves readability
 * 
 * VERIFICATION:
 * - Use React DevTools Profiler to confirm zero renders when sibling rows update
 * - Set REACT_APP_LOG_RENDERS=true environment variable to enable render logging
 * - Check browser console for "ConsumerTableRow rendered: [id]" messages
 * 
 * PARENT COMPONENT REQUIREMENTS:
 * - Consumer data should be stable references (not recreated on each parent render)
 * - Callbacks passed via `callbacks` prop MUST be memoized with useCallback
 * - Example:
 *   const handleViewContract = useCallback((id: string, address: string) => {
 *     // ... action
 *   }, []);
 *   
 *   <ConsumerTableRow 
 *     consumer={consumer} 
 *     callbacks={{ onViewContract: handleViewContract }} 
 *   />
 */
export const ConsumerTableRow = React.memo(
  function ConsumerTableRow({ consumer, callbacks }: ConsumerTableRowProps) {
    // ──────────────────────────────────────────────────────────────────────────
    // MEMOIZED TEXT TRANSFORMATIONS: Expensive string operations cached
    // ──────────────────────────────────────────────────────────────────────────
    
    const balanceLabel = useMemo(
      () => `${consumer.balanceXLM.toFixed(2)} XLM`,
      [consumer.balanceXLM],
    );
    
    const balanceColorClass = useMemo(
      () => getBalanceColorClass(consumer.balanceXLM),
      [consumer.balanceXLM],
    );
    
    const tierBadgeClass = useMemo(
      () => `${CONSUMER_TIER_BADGE_CLASS} ${CONSUMER_TIER_VARIANTS[consumer.tier]}`,
      [consumer.tier],
    );
    
    const statusIndicatorClass = useMemo(
      () => `flex items-center gap-1.5 text-xs font-medium ${CONSUMER_STATUS_TEXT_VARIANTS[consumer.status]}`,
      [consumer.status],
    );
    
    const statusDotClass = useMemo(
      () => `w-1.5 h-1.5 rounded-full ${CONSUMER_STATUS_DOT_VARIANTS[consumer.status]}`,
      [consumer.status],
    );
    
    // Simple computed boolean - minimal overhead, improves readability
    const showLowRefillAlert = consumer.balanceXLM < 200;

    // ──────────────────────────────────────────────────────────────────────────
    // MEMOIZED EVENT HANDLERS: Prevents child component re-renders
    // ──────────────────────────────────────────────────────────────────────────
    
    const handleViewContract = useCallback(() => {
      if (callbacks?.onViewContract) {
        callbacks.onViewContract(consumer.id, consumer.contractAddress);
      } else {
        // Default behavior: log or navigate
        console.log(`View contract: ${consumer.contractAddress}`);
      }
    }, [callbacks, consumer.id, consumer.contractAddress]);

    // Optional: Render count logger for development (disabled in production)
    if (process.env.REACT_APP_LOG_RENDERS === 'true') {
      console.log(`ConsumerTableRow rendered: ${consumer.id}`);
    }

    return (
      <tr className="hover:bg-[#1c2128] transition-colors group">
        <td className="px-6 py-4">
          <div className="font-medium text-gray-200">{consumer.projectName}</div>
          <div className="text-xs text-gray-500 font-mono">{consumer.shortenedAddress}</div>
        </td>
        <td className="px-6 py-4">
          <span className={tierBadgeClass}>
            {consumer.tier}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className={statusIndicatorClass}>
            <span className={statusDotClass} />
            <span className="capitalize">{consumer.status}</span>
          </span>
        </td>
        <td className="px-6 py-4 text-sm font-mono text-gray-300">{consumer.monthlyRequests}</td>
        <td className="px-6 py-4">
          <div className={`text-sm font-mono ${balanceColorClass}`}>{balanceLabel}</div>
          {showLowRefillAlert && (
            <span className="text-[10px] text-yellow-600 block leading-none mt-0.5">
              Low Refill Alert
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          <button 
            onClick={handleViewContract}
            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs"
          >
            <span>View Contract</span>
            <ExternalLink size={12} />
          </button>
        </td>
      </tr>
    );
  },
  consumerRowPropsAreEqual,
);

ConsumerTableRow.displayName = 'ConsumerTableRow';
