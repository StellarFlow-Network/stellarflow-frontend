"use client";

import React, { useCallback } from "react";
import { useSwUpdate } from "@/hooks/useSwUpdate";
import { RefreshCw, X } from "lucide-react";

/**
 * SwUpdateBanner
 *
 * Subtle top-of-screen notification banner (#761).
 *
 * Listens for service-worker `controllerchange` and `waiting` events via
 * {@link useSwUpdate}, then renders a banner:
 *   'A new version of StellarFlow is available.'
 * along with an 'Update Now' button that triggers an instant cache
 * refresh (SKIP_WAITING → hard reload).
 *
 * The banner auto-dismisses after the user is redirected and is also
 * dismissible via a close button.
 */
export function SwUpdateBanner() {
  const { updateAvailable, applyUpdate } = useSwUpdate();
  const [visible, setVisible] = React.useState(true);

  const handleUpdate = useCallback(() => {
    void applyUpdate();
  }, [applyUpdate]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  if (!updateAvailable || !visible) return null;

  return (
    <div className="fixed top-0 left-0 z-[60] w-full border-b border-[#39ff14]/20 bg-[#0a0f1e]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-[#39ff14] animate-spin" />
          <span className="font-medium text-white">
            A new version of StellarFlow is available.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUpdate}
            className="rounded-lg bg-[#39ff14] px-3 py-1.5 text-xs font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
          >
            Update Now
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Dismiss update banner"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
