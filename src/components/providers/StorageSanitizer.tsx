"use client";

/**
 * StorageSanitizer.tsx
 *
 * Client component that runs {@link sanitizeLocalStorage} once during initial
 * React initialization. Mounted in the root layout so pruning happens before
 * the user can reach any surface that reads stale cache.
 *
 * Two deliberate choices:
 *
 * - **Deferred to idle time.** The pass reads every local storage key, which is
 *   pointless work to do on the critical path. `requestIdleCallback` lets first
 *   paint win; `setTimeout` is the fallback for engines without it.
 * - **Cancelable.** The idle handle is cleared on unmount so React strict-mode
 *   double-mounts (and fast navigations) cannot leave a pass running against a
 *   half-torn-down tree.
 *
 * Failures are swallowed by design — see `src/utils/storageSanitizer.ts`.
 */

import { useEffect } from "react";
import { sanitizeLocalStorage } from "@/utils/storageSanitizer";

export function StorageSanitizer() {
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      try {
        sanitizeLocalStorage();
      } catch {
        // `sanitizeLocalStorage` is already total; this is belt-and-braces so
        // a regression here can never break application boot.
      }
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(run, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }

    const handle = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, []);

  return null;
}

export default StorageSanitizer;
