"use client";

import { useSyncExternalStore } from "react";

export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
