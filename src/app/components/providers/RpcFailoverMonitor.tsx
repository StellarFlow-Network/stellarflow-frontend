'use client';

import { useEffect } from 'react';
import { useOptionalToast } from '@/components/ui/ToastQueue';
import { rpcManager } from '@/services/rpc';

export function RpcFailoverMonitor() {
  const toast = useOptionalToast();

  useEffect(() => {
    const stopMonitoring = rpcManager.startHealthMonitor();
    const unsubscribe = rpcManager.subscribe(({ previousUrl, nextUrl }) => {
      toast?.addToast({
        status: 'confirmed',
        title: 'RPC node switched',
        description: `Automatically using ${new URL(nextUrl).hostname} after ${new URL(previousUrl).hostname} became unavailable.`,
      });
    });

    return () => {
      unsubscribe();
      stopMonitoring();
    };
  }, [toast]);

  return null;
}

export default RpcFailoverMonitor;