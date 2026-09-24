# Implementation Plan: Form Throttling — Bond Allocation Calculator

## Overview

Implement the dual-state RAF-throttled bond allocation calculator for the staking page. The work breaks into four sequential layers: the core hook, the two new components, and the staking page integration. No existing files are modified except `src/app/staking/page.tsx`.

## Tasks

- [x] 1. Create `useThrottledSlider` hook
  - [x] 1.1 Create `src/app/hooks/useThrottledSlider.ts`
    - Implement `UseThrottledSliderReturn` interface with `displayValue`, `committedValue`, `handleChange`
    - Implement `sliderRef` (`useRef<number>`) initialized to `initialValue` — raw position store, no renders
    - Implement `pendingRafRef` (`useRef<number | null>`) — guards against duplicate `rAF` calls
    - Implement `committedValue` (`useState<number>`) — Calculation_Engine input
    - Implement `displayValue` (`useState<number>`) — `<input value>` binding
    - In `handleChange`: write `sliderRef.current = raw` synchronously; if `pendingRafRef.current !== null` return early; otherwise schedule `requestAnimationFrame` that calls `setCommittedValue` + `setDisplayValue` then clears `pendingRafRef`
    - Add `useEffect` cleanup that cancels any outstanding `pendingRafRef` on unmount
    - Wrap dev-mode instrumentation (`performance.now()` interval check + `console.warn`) in `process.env.NODE_ENV !== "production"` guard
    - Accept optional `debugLabel?: string` parameter included in the warning message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Create `SliderRow` component
  - [x] 2.1 Create `src/app/components/staking/SliderRow.tsx`
    - Mark as `'use client'`
    - Define `SliderRowProps`: `node: StakerTableRecord`, `maxAllocation: number`, `onCommit: (nodeId: string, value: number) => void`
    - Call `useThrottledSlider(0, node.nodeName)` to get `{ displayValue, committedValue, handleChange }`
    - Use a `useRef` + `useEffect` to call `onCommit(node.id, committedValue)` only when `committedValue` changes (not on mount)
    - Render `<input type="range">` with `value={displayValue}`, `onChange={handleChange}`, `min={0}`, `max={maxAllocation}`, `step={100}`
    - Add `aria-label={`Allocate XLM to ${node.nodeName}`}`, `aria-valuenow={displayValue}`, `aria-valuemin={0}`, `aria-valuemax={maxAllocation}`
    - Show committed value and percentage label next to the node name
    - Wrap in `React.memo` with `displayName = 'SliderRow'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2, 4.3, 7.1, 7.2, 7.3_

- [x] 3. Create `BondAllocationCalculator` component
  - [x] 3.1 Create `src/app/components/staking/BondAllocationCalculator.tsx`
    - Mark as `'use client'`
    - Define props: `nodes: StakerTableRecord[]`, `availableBalance: number`, `onConfirm: (allocations: Record<string, number>) => void`
    - Initialize `allocations` state as `Record<string, number>` with all values `0`
    - Implement `handleCommit` with `useCallback` — calls `setAllocations(prev => ({ ...prev, [nodeId]: value }))`
    - Implement `projectReward(allocationXLM, healthFactor)` — `allocationXLM * 0.07 * (healthFactor / 100)`
    - Implement `useMemo` Calculation_Engine: compute `totalAllocated`, `perNodeRewards` (per-node projected annual XLM), `isOverAllocated` (total > availableBalance) — only runs on `allocations` or `nodes` change
    - Render one `<SliderRow>` per node, passing `node`, `maxAllocation={availableBalance}`, `onCommit={handleCommit}`
    - Render total allocated display with `id` tied to `warningId` from `useId()`
    - Render per-node projected reward rows
    - Render distribution percentage bars (width driven by committed share, `transition-[width] duration-75`)
    - Render over-allocation `role="alert"` div with `aria-describedby={warningId}` when `isOverAllocated`
    - Render "Confirm Allocation" button: `aria-disabled={isOverAllocated}`, calls `onConfirm(allocations)` only when not over-allocated
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.4, 7.5_

- [x] 4. Integrate calculator into staking page
  - [x] 4.1 Modify `src/app/staking/page.tsx` to add the calculator and confirmation toast
    - Add import: `import { BondAllocationCalculator } from '@/app/components/staking/BondAllocationCalculator'`
    - Add import: `useCallback` to the existing React import
    - Add `confirmationMsg` state: `const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null)`
    - Add `handleConfirm` with `useCallback`: sets `confirmationMsg` to confirmation string, calls `setTimeout(() => setConfirmationMsg(null), 2000)`
    - Add confirmation toast below the slashing warning section: `role="status"`, `aria-live="polite"`, visible only when `confirmationMsg !== null`
    - Add `<BondAllocationCalculator nodes={MOCK_STAKERS} availableBalance={100_000} onConfirm={handleConfirm} />` below the toast
    - Leave all existing code (search, `useDebounce`, `useRafThrottle`, `displayedStakers`, `StatCard`, `StakerTableRow`) completely unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Final checkpoint — verify integration
  - Ensure the staking page renders without TypeScript errors
  - Verify `useRafThrottle` search path is unmodified
  - Verify no static imports of `useThrottledSlider` appear outside `SliderRow.tsx`

## Task Dependency Graph

```
Task 1 (useThrottledSlider hook)
  └─► Task 2 (SliderRow — consumes the hook)
        └─► Task 3 (BondAllocationCalculator — renders SliderRow)
              └─► Task 4 (Staking page — renders the calculator)
                    └─► Task 5 (checkpoint)
```

## Notes

- Tasks are strictly sequential — each layer depends on the previous.
- `src/app/hooks/useRafThrottle.ts`, `src/app/hooks/useRAFInterval.ts`, and `src/app/components/staking/StakerTableRow.tsx` must NOT be modified.
- The only permitted timing primitive inside `useThrottledSlider` is `requestAnimationFrame` — no `setTimeout`, no `useDebounce`.
- React 18 automatic batching means `setCommittedValue` + `setDisplayValue` inside the same `rAF` callback produce a single re-render.
- The dev-mode `console.warn` path is behind `process.env.NODE_ENV !== "production"` and will be statically eliminated by the Next.js/webpack production build.
