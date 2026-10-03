"use client";

import { useCallback, useEffect, useRef } from "react";

const areArgsEqual = <T extends readonly unknown[]>(
  a: T | null,
  b: T | null,
): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};

/**
 * Returns a callback that throttles calls to `callback`
 * to at most one per animation frame.
 */
export function useRafThrottle<T extends readonly unknown[]>(
  callback: (...args: T) => void,
): (...args: T) => void {
  const fnRef = useRef(callback);

  useEffect(() => {
    fnRef.current = callback;
  }, [callback]);

  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<T | null>(null);
  const lastProcessedArgsRef = useRef<T | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return useCallback((...args: T) => {
    if (areArgsEqual(args, lastArgsRef.current)) {
      return;
    }

    lastArgsRef.current = args;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        if (
          lastArgsRef.current &&
          !areArgsEqual(lastArgsRef.current, lastProcessedArgsRef.current)
        ) {
          fnRef.current(...lastArgsRef.current);
          lastProcessedArgsRef.current = lastArgsRef.current;
        }

        lastArgsRef.current = null;
      });
    }
  }, []);
}