"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="sticky top-0 z-50 flex min-h-10 w-full items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <WifiOff aria-hidden="true" size={16} />
      <span>You are offline. Live network data is paused until connection is restored.</span>
    </div>
  );
}