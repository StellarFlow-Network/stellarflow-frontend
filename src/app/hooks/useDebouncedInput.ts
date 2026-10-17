"use client";

import { useCallback, useState } from "react";
import { useDebounce } from "./useDebounce";

/**
 * Hook that returns the current input value (updates instantly) and a debounced version
 * of that value which updates after the specified delay. Useful for separating UI responsiveness
 * from expensive calculations that should only run after the user stops typing.
 *
 * @param initial Initial value of the input.
 * @param delay Debounce delay in milliseconds (default 250ms).
 */
export function useDebouncedInput<T>(initial: T, delay = 300) {
  const [value, setValue] = useState<T>(initial);
  const debounced = useDebounce<T>(value, delay);

  // Stable setter that accepts either a value or an updater function, mirroring
  // React's setState signature so consumers can avoid unnecessary re-renders.
  const setInputValue = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) =>
      typeof next === "function" ? (next as (prev: T) => T)(prev) : next
    );
  }, []);

  return { value, setValue: setInputValue, debounced };
}