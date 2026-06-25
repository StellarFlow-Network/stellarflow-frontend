"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "../../lib/queryClient";
import { localStoragePersister } from "../../lib/persister";

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};