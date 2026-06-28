'use client';

/**
 * CorridorContext — focused sub-context node for live socket stream state.
 *
 * Problem: funnelling WebSocket price-tick state through the monolithic root
 * SocketProvider triggers full component-tree re-renders on every tick,
 * including stable navigation and layout panels that have no dependency on
 * live price data.
 *
 * Solution: isolate the high-frequency socket stream state (live price data +
 * connection metadata) inside this scoped CorridorContext. Only components
 * that genuinely need live corridor price data should be wrapped in
 * <CorridorProvider>. All other layout panels (nav, stats cards, sidebar, etc.)
 * sit outside this boundary and are shielded by React.memo rendering gates.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useSocketConnection, useSocketData, useSocketActions } from '@/app/components/providers/SocketProvider';
import type { PriceData } from '@/types';

// ---------------------------------------------------------------------------
// Corridor-scoped context types
// ---------------------------------------------------------------------------

/** Live corridor price stream — updates on every WebSocket price tick. */
interface CorridorStreamContextType {
  lastUpdate: PriceData | null;
}

/** Corridor connection metadata — stable between price ticks. */
interface CorridorConnectionContextType {
  isConnected: boolean;
  error: string | null;
}

/** Stable corridor action callbacks — identity never changes after mount. */
interface CorridorActionsContextType {
  subscribeToAsset: (assetId: string) => void;
  unsubscribeFromAsset: (assetId: string) => void;
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Contexts — three independent slices to minimise re-render surface
// ---------------------------------------------------------------------------

const CorridorStreamContext =
  createContext<CorridorStreamContextType | null>(null);

const CorridorConnectionContext =
  createContext<CorridorConnectionContextType | null>(null);

const CorridorActionsContext =
  createContext<CorridorActionsContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider — bridges the global SocketProvider into corridor-scoped slices
// ---------------------------------------------------------------------------

interface CorridorProviderProps {
  children: ReactNode;
}

/**
 * Wrap only the components that consume live corridor price data inside this
 * provider. All other layout panels (Nav, FloatingSidebar, SystemStats, etc.)
 * must remain outside so they are never re-rendered by socket ticks.
 */
export function CorridorProvider({ children }: CorridorProviderProps) {
  // Pull the three independent slices from the root SocketProvider.
  // Each hook already subscribes to only its own slice, so only the relevant
  // re-render cascade is triggered inside this sub-tree.
  const { isConnected, error } = useSocketConnection();
  const { lastUpdate } = useSocketData();
  const { subscribeToAsset, unsubscribeFromAsset, reconnect } = useSocketActions();

  // Memoize each slice independently so that a price tick only invalidates
  // the stream context — the connection and actions contexts keep their
  // reference stable and their consumers are skipped by React's reconciler.
  const streamValue = useMemo<CorridorStreamContextType>(
    () => ({ lastUpdate }),
    [lastUpdate],
  );

  const connectionValue = useMemo<CorridorConnectionContextType>(
    () => ({ isConnected, error }),
    [isConnected, error],
  );

  const actionsValue = useMemo<CorridorActionsContextType>(
    () => ({ subscribeToAsset, unsubscribeFromAsset, reconnect }),
    [subscribeToAsset, unsubscribeFromAsset, reconnect],
  );

  return (
    <CorridorConnectionContext.Provider value={connectionValue}>
      <CorridorActionsContext.Provider value={actionsValue}>
        {/*
          CorridorStreamContext is the innermost provider so that high-frequency
          price tick re-renders are confined to this narrow sub-tree. Components
          subscribing only to connection or actions sit above this boundary and
          are unaffected by price ticks.
        */}
        <CorridorStreamContext.Provider value={streamValue}>
          {children}
        </CorridorStreamContext.Provider>
      </CorridorActionsContext.Provider>
    </CorridorConnectionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hooks — each narrows the subscription to one slice
// ---------------------------------------------------------------------------

/**
 * Subscribe to live corridor price stream updates.
 * Re-renders on every WebSocket price tick — use only inside price-display
 * components (e.g. PriceFeedCard). Must be used within <CorridorProvider>.
 */
export function useCorridorStream(): CorridorStreamContextType {
  const ctx = useContext(CorridorStreamContext);
  if (!ctx) {
    throw new Error('useCorridorStream must be used within a CorridorProvider');
  }
  return ctx;
}

/**
 * Subscribe to corridor connection metadata (isConnected / error).
 * Will NOT re-render on price data ticks. Must be used within <CorridorProvider>.
 */
export function useCorridorConnection(): CorridorConnectionContextType {
  const ctx = useContext(CorridorConnectionContext);
  if (!ctx) {
    throw new Error(
      'useCorridorConnection must be used within a CorridorProvider',
    );
  }
  return ctx;
}

/**
 * Subscribe to stable corridor action callbacks.
 * Identity is stable for the provider lifetime — never triggers a re-render.
 * Must be used within <CorridorProvider>.
 */
export function useCorridorActions(): CorridorActionsContextType {
  const ctx = useContext(CorridorActionsContext);
  if (!ctx) {
    throw new Error(
      'useCorridorActions must be used within a CorridorProvider',
    );
  }
  return ctx;
}
