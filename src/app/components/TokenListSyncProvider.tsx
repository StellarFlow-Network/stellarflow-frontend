"use client";

import { useTokenListSync } from "@/hooks/useTokenListSync";

export function TokenListSyncProvider({ children }: { children: React.ReactNode }) {
  useTokenListSync();
  return <>{children}</>;
}
