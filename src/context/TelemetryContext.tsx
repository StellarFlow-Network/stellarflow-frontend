'use client';

/**
 * TelemetryContext — isolated leaf provider for high-frequency node telemetry.
 *
 * Keep this provider as close as possible to widgets that render live heartbeat
 * or node metric packets. Sidebars, nav, and static dashboard layout should sit
 * outside this boundary so websocket ticks do not trigger layout work there.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  SocketProvider,
  useSocketActions,
  useSocketConnection,
  useSocketData,
  type SocketProviderOptions,
} from '@/app/components/providers/SocketProvider';
import type { PriceData } from '@/types';

interface TelemetryProviderProps {
  children: ReactNode;
  options?: SocketProviderOptions;
}

interface TelemetryFeedContextType {
  lastUpdate: PriceData | null;
}

interface TelemetryConnectionContextType {
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

interface TelemetryActionsContextType {
  subscribeToAsset: (assetId: string) => void;
  unsubscribeFromAsset: (assetId: string) => void;
  reconnect: () => void;
}

const TelemetryFeedContext = createContext<TelemetryFeedContextType | null>(null);
const TelemetryConnectionContext =
  createContext<TelemetryConnectionContextType | null>(null);
const TelemetryActionsContext =
  createContext<TelemetryActionsContextType | null>(null);

function TelemetryLeaf({ children }: { children: ReactNode }) {
  const { lastUpdate } = useSocketData();
  const { isConnected, error, reconnectAttempts } = useSocketConnection();
  const { subscribeToAsset, unsubscribeFromAsset, reconnect } = useSocketActions();

  const feedValue = useMemo<TelemetryFeedContextType>(
    () => ({ lastUpdate }),
    [lastUpdate],
  );

  const connectionValue = useMemo<TelemetryConnectionContextType>(
    () => ({ isConnected, error, reconnectAttempts }),
    [isConnected, error, reconnectAttempts],
  );

  const actionsValue = useMemo<TelemetryActionsContextType>(
    () => ({ subscribeToAsset, unsubscribeFromAsset, reconnect }),
    [subscribeToAsset, unsubscribeFromAsset, reconnect],
  );

  return (
    <TelemetryConnectionContext.Provider value={connectionValue}>
      <TelemetryActionsContext.Provider value={actionsValue}>
        <TelemetryFeedContext.Provider value={feedValue}>
          {children}
        </TelemetryFeedContext.Provider>
      </TelemetryActionsContext.Provider>
    </TelemetryConnectionContext.Provider>
  );
}

export function TelemetryProvider({ children, options }: TelemetryProviderProps) {
  return (
    <SocketProvider options={options}>
      <TelemetryLeaf>{children}</TelemetryLeaf>
    </SocketProvider>
  );
}

export function useTelemetryFeed(): TelemetryFeedContextType {
  const ctx = useContext(TelemetryFeedContext);
  if (!ctx) {
    throw new Error('useTelemetryFeed must be used within a TelemetryProvider');
  }
  return ctx;
}

export function useTelemetryConnection(): TelemetryConnectionContextType {
  const ctx = useContext(TelemetryConnectionContext);
  if (!ctx) {
    throw new Error('useTelemetryConnection must be used within a TelemetryProvider');
  }
  return ctx;
}

export function useTelemetryActions(): TelemetryActionsContextType {
  const ctx = useContext(TelemetryActionsContext);
  if (!ctx) {
    throw new Error('useTelemetryActions must be used within a TelemetryProvider');
  }
  return ctx;
}
