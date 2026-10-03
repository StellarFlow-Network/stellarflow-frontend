import React, { useMemo, useCallback } from 'react';
import { shortenAddress } from '@/utils/addressUtils';
import {
  getHealthBarColor,
  STAKER_SLASHING_NO_EVENTS,
  STAKER_SLASHING_WITH_EVENTS,
} from '@/lib/classNameVariants';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';

/**
 * Core data structure for a single staker node row in the matrix/grid table.
 * All fields are considered in the memoization comparison to prevent stale state.
 */
export interface StakerTableRecord {
  id: string;
  nodeName: string;
  operatorAddress: string;
  stakedAmountXLM: number;
  accruedRewardsXLM: number;
  totalSlashingEvents: number;
  healthFactor: number;
}

/**
 * Optional callback interface for row interactions.
 * When passing callbacks from parent, ensure they are memoized with useCallback
 * to prevent breaking the row's memoization boundaries.
 */
export interface StakerTableRowCallbacks {
  onManageNode?: (nodeId: string, nodeName: string) => void;
}

export interface StakerTableRowProps {
  node: StakerTableRecord;
  callbacks?: StakerTableRowCallbacks;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * RIGID MEMOIZATION BOUNDARY: Custom props comparison function
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * This function creates a structural memoization barrier that prevents re-renders
 * when:
 * - Sibling rows update (different node.id)
 * - Parent container re-renders without data changes
 * - Unrelated state in the parent changes (sorting, filtering UI state, etc.)
 * 
 * Re-renders ONLY occur when:
 * - Any field in the node record changes
 * - Callback references change (callback identity is checked separately)
 * 
 * CORRECTNESS GUARANTEE: All fields are explicitly compared to avoid stale state bugs
 */
function stakerRowPropsAreEqual(
  prev: StakerTableRowProps,
  next: StakerTableRowProps,
): boolean {
  const a = prev.node;
  const b = next.node;
  
  // Primary data comparison - all node fields must match
  const dataUnchanged = (
    a.id === b.id &&
    a.nodeName === b.nodeName &&
    a.operatorAddress === b.operatorAddress &&
    a.stakedAmountXLM === b.stakedAmountXLM &&
    a.accruedRewardsXLM === b.accruedRewardsXLM &&
    a.totalSlashingEvents === b.totalSlashingEvents &&
    a.healthFactor === b.healthFactor
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
  return prevCallbacks.onManageNode === nextCallbacks.onManageNode;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * OPTIMIZED MATRIX ROW COMPONENT: StakerTableRow
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * PERFORMANCE OPTIMIZATIONS APPLIED:
 * 
 * 1. React.memo() with custom comparison function (stakerRowPropsAreEqual)
 *    → Prevents re-renders when sibling rows or parent container updates
 * 
 * 2. useMemo() for expensive text transformations
 *    → shortenedAddress: string slicing operation cached
 *    → stakedLabel: toLocaleString() + string concatenation cached
 *    → rewardsLabel: toLocaleString() + string concatenation cached
 *    → healthBarColor: conditional color classification cached
 *    → slashingLabel: string template cached
 *    → healthBarStyle: inline CSS object cached (prevents object recreation)
 * 
 * 3. useCallback() for event handlers
 *    → Prevents child components from re-rendering when row data is stable
 *    → Critical for preventing React from re-creating inline functions
 * 
 * VERIFICATION:
 * - Use React DevTools Profiler to confirm zero renders when sibling rows update
 * - Set REACT_APP_LOG_RENDERS=true environment variable to enable render logging
 * - Check browser console for "StakerTableRow rendered: [id]" messages
 * 
 * PARENT COMPONENT REQUIREMENTS:
 * - Node data should be stable references (not recreated on each parent render)
 * - Callbacks passed via `callbacks` prop MUST be memoized with useCallback
 * - Example:
 *   const handleManageNode = useCallback((id: string, name: string) => {
 *     // ... action
 *   }, []);
 *   
 *   <StakerTableRow 
 *     node={node} 
 *     callbacks={{ onManageNode: handleManageNode }} 
 *   />
 */
export const StakerTableRow = React.memo(
  function StakerTableRow({ node, callbacks }: StakerTableRowProps) {
    // ──────────────────────────────────────────────────────────────────────────
    // MEMOIZED TEXT TRANSFORMATIONS: Expensive string operations cached
    // ──────────────────────────────────────────────────────────────────────────
    
    const shortenedAddress = useMemo(
      () => shortenAddress(node.operatorAddress),
      [node.operatorAddress],
    );
    
    const stakedLabel = useMemo(
      () => `${node.stakedAmountXLM.toLocaleString()} XLM`,
      [node.stakedAmountXLM],
    );
    
    const rewardsLabel = useMemo(
      () => `+${node.accruedRewardsXLM.toLocaleString()} XLM`,
      [node.accruedRewardsXLM],
    );
    
    const healthBarColor = useMemo(
      () => getHealthBarColor(node.healthFactor),
      [node.healthFactor],
    );
    
    const slashingBadgeClass = useMemo(
      () => node.totalSlashingEvents === 0 
        ? STAKER_SLASHING_NO_EVENTS 
        : STAKER_SLASHING_WITH_EVENTS,
      [node.totalSlashingEvents],
    );
    
    const slashingLabel = useMemo(
      () => `${node.totalSlashingEvents} slash events`,
      [node.totalSlashingEvents],
    );
    
    // CRITICAL: Inline style object memoization prevents React from recreating
    // the object on every render, which would break PureComponent optimizations
    // in child components and trigger unnecessary style recalculations
    const healthBarStyle = useMemo(
      () => ({ '--scale-x': node.healthFactor / 100 } as React.CSSProperties),
      [node.healthFactor],
    );

    // ──────────────────────────────────────────────────────────────────────────
    // MEMOIZED EVENT HANDLERS: Prevents child component re-renders
    // ──────────────────────────────────────────────────────────────────────────
    
    const handleManageNode = useCallback(() => {
      if (callbacks?.onManageNode) {
        callbacks.onManageNode(node.id, node.nodeName);
      } else {
        // Default behavior: log or navigate
        console.log(`Manage node: ${node.nodeName} (${node.id})`);
      }
    }, [callbacks, node.id, node.nodeName]);

    // Optional: Render count logger for development (disabled in production)
    if (process.env.REACT_APP_LOG_RENDERS === 'true') {
      console.log(`StakerTableRow rendered: ${node.id}`);
    }

    return (
      <tr className="hover:bg-[#1c2128] transition-colors group">
        <td className="px-6 py-4">
          <div className="font-medium text-gray-200">{node.nodeName}</div>
          <div className="text-xs text-gray-500 font-mono">{shortenedAddress}</div>
        </td>
        <td className="px-6 py-4 text-sm font-mono text-gray-300">{stakedLabel}</td>
        <td className="px-6 py-4 text-sm font-mono text-emerald-400">{rewardsLabel}</td>
        <td className="px-6 py-4 node-status-cell">
          <div className="flex items-center gap-2 metric-indicator">
            <div className="w-16 bg-gray-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full dynamic-scale-x ${healthBarColor}`}
                style={healthBarStyle}
              />
            </div>
            <span className="text-xs font-semibold numeric-value">{node.healthFactor}%</span>
          </div>
        </td>
        <td className="px-6 py-4 node-status-cell">
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono font-bold high-frequency-badge ${slashingBadgeClass}`}
          >
            {slashingLabel}
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <button 
            onClick={handleManageNode}
            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs font-medium"
          >
            <span>Manage Node</span>
            <Icon id={ICON_IDS.arrowUpRight} size={12} />
          </button>
        </td>
      </tr>
    );
  },
  stakerRowPropsAreEqual,
);

StakerTableRow.displayName = 'StakerTableRow';
