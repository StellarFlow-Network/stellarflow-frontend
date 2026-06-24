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
