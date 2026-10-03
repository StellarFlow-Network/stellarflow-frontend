# Requirements Document

## Introduction

The validator staking page (`src/app/staking/page.tsx`) currently exposes a bond allocation calculator where users adjust slider inputs to model stake distributions across validator nodes. Each slider micro-increment synchronously dispatches a React state update that immediately triggers the heavy calculation engine — producing dozens of state writes per second during a fast drag. This floods the React reconciler, stalls UI frames, and degrades perceived responsiveness for all users on the page regardless of whether they are actively interacting with the calculator.

This feature introduces a dual-state architecture for the bond allocation calculator: a fast, ref-backed local layer that tracks raw slider positions without triggering re-renders, paired with a RAF-throttled commit layer that flushes the accumulated value to the global calculation engine at a maximum rate of 60 FPS. The existing `useRafThrottle` hook (`src/app/hooks/useRafThrottle.ts`) and `useRAFInterval` infrastructure are leveraged and extended. The staking page's search throttling (which already uses `useRafThrottle` correctly) is left untouched.

## Glossary

- **Allocation_Slider**: An `<input type="range">` element inside the bond allocation calculator that controls the percentage or absolute XLM amount bonded to a specific validator node.
- **Calculation_Engine**: The `useMemo`-derived or callback-derived function that computes projected rewards, APY, slashing exposure, and distribution totals from the current bond allocation values. It is the expensive operation that must be protected from high-frequency updates.
- **Commit_Layer**: The throttled state update path that writes the accumulated slider value from the Slider_Ref into React state, thereby triggering the Calculation_Engine at most once per animation frame.
- **Dual_State_Architecture**: The design pattern where slider position is tracked in two places simultaneously — a mutable `useRef` (fast, zero-render-cost) for raw input events, and a React `useState` (render-triggering) for the value the Calculation_Engine consumes.
- **Frame_Budget**: The 16.67 ms window (1000 ms ÷ 60 FPS) within which all JavaScript work for a single frame must complete to maintain smooth animation.
- **RAF_Throttle**: The technique of gating state commits behind a `requestAnimationFrame` callback so that at most one commit occurs per display refresh cycle.
- **Slider_Ref**: The `useRef<number>` that holds the latest raw slider value between animation frames without causing a re-render on every micro-increment.
- **Throttled_Commit**: The single `setState` call that fires inside a `requestAnimationFrame` callback, transferring the value from Slider_Ref into React state.
- **Calculator_Panel**: The UI panel component (`BondAllocationCalculator`) that renders one or more Allocation_Sliders and displays the live Calculation_Engine output.
- **Pending_Frame**: The outstanding `requestAnimationFrame` handle stored in a ref. If a Pending_Frame already exists, new slider events update only the Slider_Ref and do not schedule an additional frame.

## Requirements

### Requirement 1: Dual-State Slider Architecture

**User Story:** As a frontend engineer, I want each Allocation_Slider to track its raw position in a ref rather than in React state, so that fast drag gestures do not flood the React reconciler with synchronous state updates.

#### Acceptance Criteria

1. WHEN a user drags an Allocation_Slider, THE slider's current position SHALL be written to a Slider_Ref (`useRef<number>`) on every `onChange` event without calling any React state setter.
2. THE Slider_Ref SHALL be initialized to the same value as the corresponding React state at component mount.
3. THE `<input type="range">` element's `value` prop SHALL be bound to the Slider_Ref's current value for immediate visual feedback, not to the React state value.
4. THE Slider_Ref SHALL be the single source of truth for the raw in-flight slider position during an active drag gesture.
5. WHEN no drag gesture is active, THE Slider_Ref value SHALL equal the committed React state value.

---

### Requirement 2: RAF-Throttled Commit Layer

**User Story:** As a performance-conscious engineer, I want the Calculation_Engine to receive slider updates at most once per animation frame (≤ 60 FPS), so that the React reconciler is not overwhelmed during fast drag gestures.

#### Acceptance Criteria

1. WHEN a Slider_Ref value changes, THE Commit_Layer SHALL schedule a Throttled_Commit using `requestAnimationFrame` if no Pending_Frame is already scheduled.
2. IF a Pending_Frame is already scheduled WHEN a new slider event arrives, THE new value SHALL be stored in the Slider_Ref and no additional `requestAnimationFrame` call SHALL be made.
3. WHEN the Pending_Frame fires, THE Commit_Layer SHALL call the React state setter with the current Slider_Ref value, then clear the Pending_Frame ref.
4. THE Commit_Layer SHALL cancel any outstanding Pending_Frame on component unmount to prevent state updates on unmounted components.
5. THE maximum rate of React state updates driven by slider drag SHALL NOT exceed one update per animation frame (approximately 16.67 ms at 60 Hz displays).

---

### Requirement 3: `useThrottledSlider` Hook

**User Story:** As a developer, I want a reusable hook that encapsulates the Dual_State_Architecture and RAF-throttle logic, so that each Allocation_Slider in the calculator can opt in with a single call rather than duplicating ref and frame management code.

#### Acceptance Criteria

1. THE hook SHALL be named `useThrottledSlider` and SHALL reside at `src/app/hooks/useThrottledSlider.ts`.
2. THE hook SHALL accept an `initialValue: number` parameter and SHALL return a tuple of `[displayValue, committedValue, handleChange]` where:
   - `displayValue` is the Slider_Ref's current value (for binding to the `<input value>` prop via a controlled-uncontrolled bridge).
   - `committedValue` is the React state value consumed by the Calculation_Engine.
   - `handleChange` is the `onChange` handler to attach to the `<input type="range">` element.
3. WHEN `handleChange` is called with an input event, THE hook SHALL update the Slider_Ref synchronously and schedule a Throttled_Commit if no Pending_Frame is outstanding.
4. THE hook SHALL cancel its Pending_Frame in the cleanup function of the effect that registers it.
5. THE hook SHALL NOT use `useDebounce` or `setTimeout` internally — the only timing mechanism permitted is `requestAnimationFrame`.

---

### Requirement 4: Bond Allocation Calculator Component

**User Story:** As a staking page user, I want a bond allocation calculator panel that lets me distribute my XLM stake across validator nodes using sliders, with live projected reward output that remains smooth even during fast slider adjustments.

#### Acceptance Criteria

1. THE Calculator_Panel SHALL be implemented as `src/app/components/staking/BondAllocationCalculator.tsx` and SHALL be a `'use client'` component.
2. THE Calculator_Panel SHALL render one Allocation_Slider per validator node currently listed in the staking page's node roster.
3. EACH Allocation_Slider SHALL use `useThrottledSlider` to manage its value, binding `displayValue` to the `<input value>` prop and `committedValue` to the Calculation_Engine input.
4. THE Calculator_Panel SHALL display the following computed outputs, recalculated only when any `committedValue` changes:
   - Total allocated XLM (sum of all committed slider values).
   - Per-node projected annual reward in XLM, using the node's `healthFactor` as a proxy APY weight.
   - A distribution percentage bar showing each node's share of the total allocation.
5. WHEN the total allocation across all sliders exceeds the user's available balance (passed as a prop), THE Calculator_Panel SHALL render a visible over-allocation warning and SHALL disable the "Confirm Allocation" action button.
6. THE Calculator_Panel SHALL expose a `onConfirm: (allocations: Record<string, number>) => void` prop that is called with the final committed values when the user clicks "Confirm Allocation".

---

### Requirement 5: Staking Page Integration

**User Story:** As a user of the staking page, I want the bond allocation calculator to appear inline within the existing staking collateral pool view, so that I can model allocations in context without navigating away.

#### Acceptance Criteria

1. THE `Calculator_Panel` (`BondAllocationCalculator`) SHALL be rendered inside `src/app/staking/page.tsx` below the node performance roster table.
2. THE `Calculator_Panel` SHALL receive the list of staker nodes as a prop derived from the page's existing `MOCK_STAKERS` data array.
3. THE `Calculator_Panel` SHALL receive a `availableBalance` prop; for the initial implementation this SHALL be a static value of `100_000` XLM.
4. THE existing search throttling logic in `StakingPage` (which uses `useRafThrottle` on the search input) SHALL remain unmodified.
5. WHEN the `onConfirm` callback fires, THE staking page SHALL display a transient confirmation toast or inline status message for at least 2 seconds before clearing.

---

### Requirement 6: Frame Budget Instrumentation

**User Story:** As a performance engineer, I want the throttle hook to expose a way to measure whether commits are staying within the Frame_Budget, so that regressions can be detected in development without requiring a profiler.

#### Acceptance Criteria

1. WHEN `process.env.NODE_ENV === 'development'`, THE `useThrottledSlider` hook SHALL measure the elapsed time between consecutive Throttled_Commits using `performance.now()`.
2. IF the elapsed time between two consecutive Throttled_Commits is less than 16 ms (faster than 60 FPS), THE hook SHALL emit a `console.warn` identifying the slider instance and the actual interval.
3. THE instrumentation code SHALL be tree-shaken from production builds — it SHALL be wrapped in a `process.env.NODE_ENV !== 'production'` guard so that bundlers can eliminate it statically.
4. THE instrumentation SHALL NOT affect the timing or correctness of the Throttled_Commit in any environment.
5. THE `useThrottledSlider` hook SHALL accept an optional `debugLabel?: string` parameter that is included in the development warning message to identify which slider instance is over-committing.

---

### Requirement 7: Accessibility and Keyboard Support

**User Story:** As a keyboard or assistive-technology user, I want the Allocation_Sliders to remain fully operable and responsive to keyboard arrow-key adjustments, so that the throttle mechanism does not break standard range input accessibility behavior.

#### Acceptance Criteria

1. THE Allocation_Sliders SHALL be standard `<input type="range">` elements with no custom key-event interception, ensuring native browser keyboard step behavior is preserved.
2. EACH Allocation_Slider SHALL have an `aria-label` describing the node it controls (e.g., `"Allocate XLM to VTPass Lagos Edge"`).
3. EACH Allocation_Slider SHALL have `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` attributes kept in sync with the `displayValue` (Slider_Ref value) so screen readers announce the current position during drag.
4. THE "Confirm Allocation" button SHALL have `aria-disabled="true"` (not the HTML `disabled` attribute) when the over-allocation condition is active, so that screen readers can still focus and describe the button state.
5. THE over-allocation warning message SHALL be associated with the total allocation output via `aria-describedby` so that screen readers surface the warning when the user focuses the total field.
