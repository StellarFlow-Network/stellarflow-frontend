/**
 * PWA Service Worker Auto-Update Guard (#761)
 *
 * Detects when a new service-worker version is available — via the
 * `controllerchange` event and the `waiting` registration state — and
 * notifies subscribers so the UI can prompt the user to reload.
 */

export type SwUpdateStatus =
  | "idle"
  | "checking"
  | "waiting"
  | "activating"
  | "ready";

export interface SwUpdateState {
  /** Current detection stage. */
  status: SwUpdateStatus;
  /** True when a new SW is waiting to activate or has just taken control. */
  updateAvailable: boolean;
  /** The ServiceWorkerRegistration that has a waiting SW, if any. */
  registration: ServiceWorkerRegistration | null;
}

export type SwUpdateListener = (state: SwUpdateState) => void;

const listeners = new Set<SwUpdateListener>();

let currentState: SwUpdateState = {
  status: "idle",
  updateAvailable: false,
  registration: null,
};

function emit(state: Partial<SwUpdateState>) {
  currentState = { ...currentState, ...state };
  listeners.forEach((l) => l(currentState));
}

/** Whether the Service Worker API is available in this browser. */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  );
}

/** Subscribe to SW update state changes (outside of React). */
export function subscribeToSwUpdates(listener: SwUpdateListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

/** Get the current SW update state. Useful for React `useSyncExternalStore` snapshots. */
export function getSwUpdateState(): SwUpdateState {
  return currentState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public imperatives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Force the waiting service worker to activate immediately and reload the
 * page so the browser serves content from the freshly cached new build.
 *
 * This achieves the "instant cache refresh" required by the acceptance
 * criteria: the new SW swaps in via `SKIP_WAITING`, takes control of all
 * clients (`clientsClaim`), and a hard reload discards the old document
 * and re-fetches everything through the new SW cache.
 *
 * @throws only in environments without a service worker registration.
 */
export async function applySwUpdate(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.waiting) {
    // next-pwa's generated sw.js listens for this message and calls
    // self.skipWaiting(), causing controllerchange to fire.
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  // Hard reload → the new SW is now the controller and serves fresh assets.
  window.location.reload();
}

/**
 * Call once (e.g. in a React `useEffect`) to wire up all service-worker
 * update listeners:
 *
 *  - `controllerchange` on `navigator.serviceWorker` — fires when a new SW
 *    takes over page control.
 *  - `updatefound` on the `ServiceWorkerRegistration` — fires when a new SW
 *    is installed and potentially waiting.
 *
 * Returns a cleanup function that removes all listeners.
 */
export function initSwUpdateListener(): () => void {
  if (!isServiceWorkerSupported()) {
    return () => {};
  }

  let registration: ServiceWorkerRegistration | null = null;

  const handleUpdateFound = () => {
    if (registration && registration.waiting) {
      emit({
        status: "waiting",
        updateAvailable: true,
        registration,
      });
    }
  };

  const handleControllerChange = () => {
    // A new SW has taken control of the page. The existing DOM is stale but
    // the SW cache is fresh — prompt for a reload.
    emit({
      status: "ready",
      updateAvailable: true,
      registration,
    });
  };

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    handleControllerChange,
  );

  navigator.serviceWorker.getRegistration().then((reg) => {
    registration = reg ?? null;
    if (reg) {
      // Immediate check — a waiting SW might already be present from a
      // previous tab that detected the update.
      if (reg.waiting) {
        emit({
          status: "waiting",
          updateAvailable: true,
          registration: reg,
        });
      }

      reg.addEventListener("updatefound", handleUpdateFound);
    }
  });

  return () => {
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      handleControllerChange,
    );
    registration?.removeEventListener("updatefound", handleUpdateFound);
  };
}
