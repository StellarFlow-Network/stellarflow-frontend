"use client";

import { useOfflineDraftQueue } from "@/app/hooks/useOfflineDraftQueue";

import { OfflineDraftBanner } from "./OfflineDraftBanner";
import { OfflineDraftQueueDrawer } from "./OfflineDraftQueueDrawer";
import { OfflineDraftSyncModal } from "./OfflineDraftSyncModal";

/**
 * Global mount point for the offline transaction draft UX (#995).
 *
 * Subscribing here keeps the IndexedDB queue hydrated app-wide and arms the
 * "connection restored" prompt even when no compose flow is mounted, so drafts
 * queued in a previous session are never lost.
 */
export function OfflineDraftSyncRoot() {
  useOfflineDraftQueue();

  return (
    <>
      <OfflineDraftBanner />
      <OfflineDraftSyncModal />
      <OfflineDraftQueueDrawer />
    </>
  );
}
