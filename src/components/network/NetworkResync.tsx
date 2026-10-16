"use client";

import { useQueryClient } from "@tanstack/react-query";
import { resyncAppState, useReconnectResync } from "@/hooks/useReconnectResync";
import { WebSocketManager } from "@/utils/WebSocketManager";

/**
 * Invisible companion to `OfflineBanner` (#1146): when the browser comes back
 * online it invalidates the query cache and reconnects the shared WebSocket.
 * Must render inside the TanStack `QueryClientProvider`.
 */
export function NetworkResync() {
  const queryClient = useQueryClient();

  useReconnectResync(() => {
    void resyncAppState({ queryClient, socket: WebSocketManager.getInstance() });
  });

  return null;
}

export default NetworkResync;
