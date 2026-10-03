"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Utility to generate a storage key for a given proposal ID.
 */
function storageKey(id: string): string {
  return `proposal-cache-${id}`;
}

/**
 * Retrieve cached proposal data from sessionStorage.
 * Returns the parsed object or null if not present / unparsable.
 */
export function getCachedProposal<T>(id: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Store proposal data into sessionStorage.
 */
export function setCachedProposal<T>(id: string, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = JSON.stringify(data);
    sessionStorage.setItem(storageKey(id), raw);
  } catch {
    // Silently ignore storage errors (quota, etc.)
  }
}

/**
 * React hook that synchronises a proposal object with session storage.
 * It provides the current cached value, a setter that updates both state and storage,
 * and a boolean indicating whether a fresh fetch may be required.
 */
export function useProposalCache<T>(id: string, initial?: T) {
  const [cached, setCached] = useState<T | null>(() => {
    const existing = getCachedProposal<T>(id);
    return existing ?? initial ?? null;
  });

  const set = useCallback(
    (value: T) => {
      setCached(value);
      setCachedProposal(id, value);
    },
    [id]
  );

  // Optional: listen for storage events from other tabs to keep sync.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey(id) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as T;
          setCached(parsed);
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [id]);

  return { cached, set };
}
