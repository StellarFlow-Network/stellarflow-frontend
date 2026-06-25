"use client";

import { useState } from "react";
import { useDebounce } from "./useDebounce";

/**
 * Hook that returns the current input value (updates instantly) and a debounced version
 * of that value which updates after the specified delay. Useful for separating UI responsiveness
 * from expensive calculations that should only run after the user stops typing.
 *
 * @param initial Initial value of the input.
 * @param delay Debounce delay in milliseconds (default 250ms).
 */
export function useDebouncedInput<T>(initial: T, delay = 250) {
  const [value, setValue] = useState<T>(initial);
  const debounced = useDebounce<T>(value, delay);
  return { value, setValue, debounced };
}
