import { useRef, useState, useCallback } from "react";

/**
 * Prevents Freighter signature spam by enforcing a strict pending lock.
 * While a cryptographic request is in-flight, `isPending` is true and
 * `withLock` rejects any new invocation — no queuing, no re-entry.
 */
export function useFreighterLock() {
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);

  const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (pendingRef.current) return undefined;

    pendingRef.current = true;
    setIsPending(true);
    try {
      return await fn();
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  return { isPending, withLock };
}
