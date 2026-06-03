"use client";

import { useCallback, useEffect, useRef } from "react";

const areArgsEqual = (a: any[] | null, b: any[] | null) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Returns a callback that throttles calls to `fn` to at most one per animation frame
 * (approx. 60 FPS) using requestAnimationFrame. Useful for throttling rapid
 * input change handlers before committing state updates.
 */
export function useRafThrottle<T extends (...args: any[]) => void>(fn: T) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<any[] | null>(null);
  const lastProcessedArgsRef = useRef<any[] | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return useCallback((...args: any[]) => {
    if (areArgsEqual(args, lastArgsRef.current)) {
      return;
    }

    lastArgsRef.current = args;

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        if (lastArgsRef.current && !areArgsEqual(lastArgsRef.current, lastProcessedArgsRef.current)) {
          fnRef.current(...lastArgsRef.current);
          lastProcessedArgsRef.current = lastArgsRef.current;
        }

        lastArgsRef.current = null;
      });
    }
  }, []) as unknown as T;
}
