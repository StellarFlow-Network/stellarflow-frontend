"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onStoreChange: () => void) => {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
};

const getSnapshot = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}