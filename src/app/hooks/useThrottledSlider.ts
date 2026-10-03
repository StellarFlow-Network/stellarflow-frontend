"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MAX_FPS_INTERVAL_MS = 1000 / 30;

export interface UseThrottledSliderReturn {
  /** Bind to <input value> — always reflects the latest raw position */
  displayValue: number;
  /** Bind to calculation engine inputs — updates at most 30 FPS */
  committedValue: number;
  /** Attach to <input onChange> */
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Dual-state slider hook.
 *
 * - Raw position is stored in a ref (sliderRef) — zero re-renders on drag.
 * - A single frame timer guard flushes the accumulated value into React state
 *   (committedValue) at most once per 33.33 ms frame (30 FPS).
 * - displayValue mirrors committedValue and is updated inside the same guarded
 *   callback so the <input> reflects the latest flushed position.
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

  // Explicit 30 FPS frame timer guard. null = no commit scheduled.
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React state consumed by the Calculation_Engine.
  const [committedValue, setCommittedValue] = useState<number>(initialValue);

  // Separate state for the <input value> binding so the thumb tracks the finger.
  const [displayValue, setDisplayValue] = useState<number>(initialValue);

  // Dev-mode: timestamp of the last commit for over-commit detection.
  const lastCommitTimeRef = useRef<number | null>(null);

  // Cleanup: cancel any outstanding timer on unmount.
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(e.target.value);

      // 1. Store raw value synchronously — no setState, no render.
      sliderRef.current = raw;

      // 2. Schedule a commit only if no guarded 30 FPS frame is already pending.
      if (pendingTimerRef.current !== null) return;

      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;

        // Dev-mode over-commit detection (tree-shaken in production).
        if (process.env.NODE_ENV !== "production") {
          const now = performance.now();
          if (lastCommitTimeRef.current !== null) {
            const interval = now - lastCommitTimeRef.current;
            if (interval < MAX_FPS_INTERVAL_MS - 1) {
              console.warn(
                `[useThrottledSlider${debugLabel ? ` "${debugLabel}"` : ""}] ` +
                `Throttled commit interval ${interval.toFixed(2)} ms exceeds 30 FPS guard. ` +
                `Consider reducing slider event frequency.`
              );
            }
          }
          lastCommitTimeRef.current = now;
        }

        // Flush accumulated value to React state — single setState per frame.
        setCommittedValue(sliderRef.current);
        setDisplayValue(sliderRef.current);
      }, MAX_FPS_INTERVAL_MS);
    },
    [debugLabel],
  );

  return { displayValue, committedValue, handleChange };
}
