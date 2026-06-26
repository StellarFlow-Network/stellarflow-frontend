"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "../../lib/queryClient";
import { localStoragePersister } from "../../lib/persister";

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        /**
         * CACHE-EVICTION POLICY:
         * Enforces a strict 5-minute (300,000ms) time-to-live for persisted cache data.
         * If the local storage cache bucket exceeds this age across sessions, it is aggressively
         * pruned prior to hydration. This strictly mitigates unbounded memory creep and
         * prevents stale metrics from flashing on the UI during cold starts.
         */
        maxAge: 5 * 60 * 1000,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};