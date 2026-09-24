# Design Document — Form Throttling: Bond Allocation Calculator

## Overview

This document describes the technical design for throttling the bond allocation calculator's slider inputs on the staking page. The solution introduces one new hook and two new components, and makes a minimal additive change to the staking page. Nothing in the existing search throttling path, `StakerTableRow`, or `useRafThrottle` is modified.

---

## Architecture

```
src/app/staking/page.tsx
│
│  (existing: search input → useRafThrottle → setSearchTerm)   ← UNCHANGED
│
└─► <BondAllocationCalculator nodes={MOCK_STAKERS} availableBalance={100_000} onConfirm={...} />
        │
        │  one <SliderRow> per node
        │
        └─► <SliderRow node={node} />
                │
                └─► useThrottledSlider(initialValue, debugLabel)
                        │
                        ├─ sliderRef (useRef<number>)          ← raw position, zero renders
                        ├─ pendingRafRef (useRef<number|null>) ← outstanding rAF handle
                        ├─ displayValue (local state mirror)   ← drives <input value>
                        ├─ committedValue (useState<number>)   ← drives Calculation_Engine
                        └─ handleChange (onChange handler)
```

### Data flow during a drag gesture

```
User drags slider
      │
      ▼
onChange fires (every micro-increment)
      │
      ├─► sliderRef.current = newValue        [sync, zero cost]
      │
      └─► pendingRafRef.current === null?
              │ YES → requestAnimationFrame(commit)
              │       pendingRafRef.current = rafHandle
              └ NO  → (no-op — frame already pending)

          ┌── ~16.67 ms later ──┐
          ▼
    rAF callback fires
      │
      ├─► setCommittedValue(sliderRef.current)   [single setState per frame]
      ├─► setDisplayValue(sliderRef.current)     [keeps <input> in sync]
      └─► pendingRafRef.current = null
```

---

## `useThrottledSlider` Hook

**File:** `src/app/hooks/useThrottledSlider.ts`

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseThrottledSliderReturn {
  /** Bind to <input value> — always reflects the latest raw position */
  displayValue: number;
  /** Bind to calculation engine inputs — updates at most once per rAF */
  committedValue: number;
  /** Attach to <input onChange> */
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Dual-state slider hook.
 *
 * - Raw position is stored in a ref (sliderRef) — zero re-renders on drag.
 * - A single requestAnimationFrame gate flushes the accumulated value into
 *   React state (committedValue) at most once per ~16.67 ms frame.
 * - displayValue mirrors committedValue but is updated inside the same rAF
 *   callback so the <input> reflects the latest position without lag.
 *
 * @param initialValue  Starting slider position.
 * @param debugLabel    Optional label included in dev-mode over-commit warnings.
 */
export function useThrottledSlider(
  initialValue: number,
  debugLabel?: string,
): UseThrottledSliderReturn {
  // The fast, zero-render-cost store for the raw slider position.
  const sliderRef = useRef<number>(initialValue);

  // The pending rAF handle. null = no frame scheduled.
  const pendingRafRef = useRef<number | null>(null);

  // React state consumed by the Calculation_Engine.
  const [committedValue, setCommittedValue] = useState<number>(initialValue);

  // Separate state for the <input value> binding so the thumb tracks the finger.
  const [displayValue, setDisplayValue] = useState<number>(initialValue);

  // Dev-mode: timestamp of the last commit for over-commit detection.
  const lastCommitTimeRef = useRef<number | null>(null);

  // Cleanup: cancel any outstanding rAF on unmount.
  useEffect(() => {
    return () => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(e.target.value);

      // 1. Store raw value synchronously — no setState, no render.
      sliderRef.current = raw;

      // 2. Schedule a commit only if no frame is already pending.
      if (pendingRafRef.current !== null) return;

      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;

        // Dev-mode over-commit detection (tree-shaken in production).
        if (process.env.NODE_ENV !== "production") {
          const now = performance.now();
          if (lastCommitTimeRef.current !== null) {
            const interval = now - lastCommitTimeRef.current;
            if (interval < 16) {
              console.warn(
                `[useThrottledSlider${debugLabel ? ` "${debugLabel}"` : ""}] ` +
                `Throttled commit interval ${interval.toFixed(2)} ms < 16 ms. ` +
                `Consider reducing slider event frequency.`
              );
            }
          }
          lastCommitTimeRef.current = now;
        }

        // Flush accumulated value to React state — single setState per frame.
        setCommittedValue(sliderRef.current);
        setDisplayValue(sliderRef.current);
      });
    },
    [debugLabel],
  );

  return { displayValue, committedValue, handleChange };
}
```

### Key invariants

| Property | Guarantee |
|---|---|
| Re-renders per drag frame | ≤ 1 (from `setCommittedValue` + `setDisplayValue` batched in React 18) |
| `requestAnimationFrame` calls per drag frame | ≤ 1 (`pendingRafRef` guard) |
| Timing mechanism | `requestAnimationFrame` only — no `setTimeout`, no `useDebounce` |
| Production bundle impact | `console.warn` and `performance.now` calls are behind `process.env.NODE_ENV !== "production"` |

---

## `SliderRow` Component

**File:** `src/app/components/staking/SliderRow.tsx`

A thin, memoized wrapper that renders a single labelled slider for one node. Keeps the `BondAllocationCalculator` render function clean.

```typescript
"use client";

import React from "react";
import { useThrottledSlider } from "@/app/hooks/useThrottledSlider";
import type { StakerTableRecord } from "./StakerTableRow";

interface SliderRowProps {
  node: StakerTableRecord;
  maxAllocation: number;
  /** Receives the committed value whenever the Calculation_Engine should update */
  onCommit: (nodeId: string, value: number) => void;
}

export const SliderRow = React.memo(function SliderRow({
  node,
  maxAllocation,
  onCommit,
}: SliderRowProps) {
  const { displayValue, committedValue, handleChange } = useThrottledSlider(
    0,
    node.nodeName,
  );

  // Notify parent only when committedValue changes (not on every raw drag event).
  const prevCommittedRef = React.useRef<number>(committedValue);
  React.useEffect(() => {
    if (committedValue !== prevCommittedRef.current) {
      prevCommittedRef.current = committedValue;
      onCommit(node.id, committedValue);
    }
  }, [committedValue, node.id, onCommit]);

  const pct = maxAllocation > 0 ? (committedValue / maxAllocation) * 100 : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <label
          htmlFor={`slider-${node.id}`}
          className="text-gray-300 font-medium"
        >
          {node.nodeName}
        </label>
        <span className="text-gray-400 font-mono text-xs">
          {committedValue.toLocaleString()} XLM ({pct.toFixed(1)}%)
        </span>
      </div>
      <input
        id={`slider-${node.id}`}
        type="range"
        min={0}
        max={maxAllocation}
        step={100}
        value={displayValue}
        onChange={handleChange}
        aria-label={`Allocate XLM to ${node.nodeName}`}
        aria-valuenow={displayValue}
        aria-valuemin={0}
        aria-valuemax={maxAllocation}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
});

SliderRow.displayName = "SliderRow";
```

---

## `BondAllocationCalculator` Component

**File:** `src/app/components/staking/BondAllocationCalculator.tsx`

```typescript
"use client";

import React, { useState, useMemo, useCallback, useId } from "react";
import type { StakerTableRecord } from "./StakerTableRow";
import { SliderRow } from "./SliderRow";

interface BondAllocationCalculatorProps {
  nodes: StakerTableRecord[];
  availableBalance: number;
  onConfirm: (allocations: Record<string, number>) => void;
}

/**
 * Projected annual reward for a single node.
 * Uses healthFactor (0–100) as a proxy APY weight: healthFactor% of 7% base APY.
 */
function projectReward(allocationXLM: number, healthFactor: number): number {
  const baseApy = 0.07;
  const weightedApy = baseApy * (healthFactor / 100);
  return allocationXLM * weightedApy;
}

export function BondAllocationCalculator({
  nodes,
  availableBalance,
  onConfirm,
}: BondAllocationCalculatorProps) {
  // Map of nodeId → committed allocation value (XLM).
  // Updated by SliderRow only on Throttled_Commits, not on every drag event.
  const [allocations, setAllocations] = useState<Record<string, number>>(
    () => Object.fromEntries(nodes.map((n) => [n.id, 0])),
  );

  const handleCommit = useCallback((nodeId: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  // Calculation_Engine — only re-runs when committed allocations change.
  const { totalAllocated, perNodeRewards, isOverAllocated } = useMemo(() => {
    const total = Object.values(allocations).reduce((s, v) => s + v, 0);
    const rewards = Object.fromEntries(
      nodes.map((n) => [n.id, projectReward(allocations[n.id] ?? 0, n.healthFactor)]),
    );
    return {
      totalAllocated: total,
      perNodeRewards: rewards,
      isOverAllocated: total > availableBalance,
    };
  }, [allocations, nodes, availableBalance]);

  const warningId = useId();

  return (
    <section
      className="mt-8 bg-[#161b22] border border-gray-800 rounded-xl p-6 space-y-6"
      aria-labelledby="bac-heading"
    >
      <h2 id="bac-heading" className="text-lg font-semibold text-white">
        Bond Allocation Calculator
      </h2>

      {/* Sliders — one per node */}
      <div className="space-y-5">
        {nodes.map((node) => (
          <SliderRow
            key={node.id}
            node={node}
            maxAllocation={availableBalance}
            onCommit={handleCommit}
          />
        ))}
      </div>

      {/* Calculation Engine output */}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Allocated</span>
          <span
            id={warningId}
            className={`font-mono font-semibold ${
              isOverAllocated ? "text-red-400" : "text-white"
            }`}
          >
            {totalAllocated.toLocaleString()} / {availableBalance.toLocaleString()} XLM
          </span>
        </div>

        {/* Per-node projected reward rows */}
        {nodes.map((node) => (
          <div key={node.id} className="flex justify-between text-xs text-gray-400">
            <span>{node.nodeName}</span>
            <span className="font-mono text-emerald-400">
              +{(perNodeRewards[node.id] ?? 0).toFixed(2)} XLM / yr
            </span>
          </div>
        ))}

        {/* Distribution bars */}
        <div className="space-y-1 pt-1">
          {nodes.map((node) => {
            const share =
              totalAllocated > 0
                ? ((allocations[node.id] ?? 0) / totalAllocated) * 100
                : 0;
            return (
              <div key={node.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-36 truncate">{node.nodeName}</span>
                <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-[width] duration-75"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 w-10 text-right">
                  {share.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Over-allocation warning */}
      {isOverAllocated && (
        <div
          role="alert"
          aria-describedby={warningId}
          className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm"
        >
          <span>⚠</span>
          <span>
            Allocation exceeds available balance by{" "}
            <span className="font-mono font-semibold">
              {(totalAllocated - availableBalance).toLocaleString()} XLM
            </span>
            . Reduce one or more sliders before confirming.
          </span>
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={() => !isOverAllocated && onConfirm(allocations)}
        aria-disabled={isOverAllocated}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
          isOverAllocated
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        Confirm Allocation
      </button>
    </section>
  );
}
```

---

## Staking Page Integration

**File:** `src/app/staking/page.tsx` — additive changes only.

Two additions to the existing file:

1. Import `BondAllocationCalculator` and `useState` for the confirmation toast.
2. Render `<BondAllocationCalculator>` below the slashing warning block.
3. Add a `confirmationMsg` state + handler for the 2-second toast.

```typescript
// New imports (added to existing import block)
import { BondAllocationCalculator } from '@/app/components/staking/BondAllocationCalculator';

// Inside StakingPage() — add alongside existing state:
const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);

const handleConfirm = useCallback((allocations: Record<string, number>) => {
  setConfirmationMsg('Allocation confirmed. Submitting to network…');
  setTimeout(() => setConfirmationMsg(null), 2000);
}, []);

// Added below the slashing warning section:
{confirmationMsg && (
  <div
    role="status"
    aria-live="polite"
    className="mt-4 p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-emerald-400 text-sm"
  >
    {confirmationMsg}
  </div>
)}

<BondAllocationCalculator
  nodes={MOCK_STAKERS}
  availableBalance={100_000}
  onConfirm={handleConfirm}
/>
```

The existing `throttledSetSearchTerm` / `useRafThrottle` / `useDebounce` search path is completely untouched.

---

## File Changeset Summary

| File | Action | Purpose |
|---|---|---|
| `src/app/hooks/useThrottledSlider.ts` | **Create** | Dual-state + RAF-throttle hook |
| `src/app/components/staking/SliderRow.tsx` | **Create** | Memoized single-node slider row |
| `src/app/components/staking/BondAllocationCalculator.tsx` | **Create** | Calculator panel with Calculation_Engine |
| `src/app/staking/page.tsx` | **Modify** | Add `BondAllocationCalculator` + confirmation toast |
| `src/app/hooks/useRafThrottle.ts` | **No change** | Existing hook, already correct |
| `src/app/hooks/useRAFInterval.ts` | **No change** | Existing interval loop, not involved |
| `src/app/components/staking/StakerTableRow.tsx` | **No change** | Existing memoized row, not involved |

---

## Render Budget Analysis

| Event | React renders triggered | `rAF` calls scheduled |
|---|---|---|
| Single slider micro-increment | 0 (ref write only) | 1 (if none pending) |
| 10 micro-increments within one frame | 0 | 1 (subsequent 9 are no-ops) |
| rAF fires | 1 (batched `setCommittedValue` + `setDisplayValue`) | 0 |
| `onCommit` propagates to parent | 1 (`setAllocations` in BondAllocationCalculator) | 0 |

At 60 Hz the maximum React render rate for the calculator is **60 renders/second regardless of how fast the user drags**, down from potentially hundreds per second with naive `onChange → setState`.
