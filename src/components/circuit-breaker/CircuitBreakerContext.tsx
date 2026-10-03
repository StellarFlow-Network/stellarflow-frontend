'use client';

/**
 * CircuitBreakerContext — global mirror of on-chain circuit breaker state.
 *
 * Problem: a `CircuitBreakerTriggered` event has to reach two very different
 * places at once — a banner pinned to the top of the root layout, and the
 * action CTA of whichever module view the breaker halted. Without a shared
 * owner, every view would have to open its own socket subscription and they
 * would disagree about which modules are halted.
 *
 * Solution: one provider, mounted once in the root layout, owns the realtime
 * subscription and the set of active pauses. Consumers read it through
 * {@link useCircuitBreakerState} (for the banner) or {@link useModulePause}
 * (for module views), and lock their CTAs with {@link PausedActionButton}.
 *
 * A pause is removed when the indexer mirrors a `CircuitBreakerCleared` event
 * for the module, or when a self-resuming breaker passes its recovery ETA.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { WebSocketManager } from '@/utils/WebSocketManager';
import {
  comparePauses,
  hasPauseElapsed,
  normalizeCircuitBreakerModule,
  parseCircuitBreakerFrame,
  toActiveModulePause,
} from '@/lib/circuitBreakerEvents';
import type { ActiveModulePause, CircuitBreakerModule } from '@/types/circuitBreaker';

export interface CircuitBreakerContextValue {
  /** Every pause currently in force, most severe first. */
  readonly activePauses: readonly ActiveModulePause[];
  /** True while the realtime feed is connected. */
  readonly isMonitoring: boolean;
  /** Look up the pause blocking a module, if any. */
  readonly getPause: (module: CircuitBreakerModule) => ActiveModulePause | undefined;
  /** Convenience predicate over {@link getPause}. */
  readonly isModulePaused: (module: CircuitBreakerModule) => boolean;
}

const CircuitBreakerContext = createContext<CircuitBreakerContextValue | null>(null);

export interface CircuitBreakerProviderProps {
  children: ReactNode;
}

export function CircuitBreakerProvider({ children }: CircuitBreakerProviderProps) {
  // Keyed by module rather than by array: a re-trigger of the same module
  // replaces its entry instead of stacking duplicate banners.
  const [pausesByModule, setPausesByModule] = useState<Record<string, ActiveModulePause>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);

  const wsManager = WebSocketManager.getInstance();

  useEffect(() => {
    const handleIndexerEvent = (message: { type: string; data?: unknown }) => {
      const event = parseCircuitBreakerFrame(message);
      if (event === null) return;

      const pausedModule = normalizeCircuitBreakerModule(event.module);
      if (pausedModule === null) return;

      setPausesByModule((previous) => {
        if (event.type === 'CircuitBreakerCleared') {
          if (!(pausedModule in previous)) return previous;
          const next = { ...previous };
          delete next[pausedModule];
          return next;
        }

        const pause = toActiveModulePause(event);
        return pause === null ? previous : { ...previous, [pausedModule]: pause };
      });
    };

    const handleStatusChange = (connected: boolean) => setIsMonitoring(connected);

    wsManager.subscribeToIndexerEvents(handleIndexerEvent);
    wsManager.subscribeToStatus(handleStatusChange);
    wsManager.addConsumer();

    return () => {
      wsManager.unsubscribeFromIndexerEvents(handleIndexerEvent);
      wsManager.unsubscribeFromStatus(handleStatusChange);
      wsManager.removeConsumer();
    };
  }, [wsManager]);

  // Self-resuming breakers lift themselves once the recovery ETA passes. This
  // is a safety net for the case where the `CircuitBreakerCleared` event is
  // missed (reconnect, dropped frame) — the UI must never keep a module
  // locked for longer than the contract would have halted it.
  useEffect(() => {
    if (Object.keys(pausesByModule).length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setPausesByModule((previous) => {
        const entries = Object.entries(previous);
        const kept = entries.filter(([, pause]) => !hasPauseElapsed(pause, now));
        if (kept.length === entries.length) return previous;
        return Object.fromEntries(kept);
      });
    }, 15_000);

    return () => clearInterval(interval);
  }, [pausesByModule]);

  const activePauses = useMemo(
    () => Object.values(pausesByModule).sort(comparePauses),
    [pausesByModule],
  );

  const getPause = useCallback(
    (module: CircuitBreakerModule) => pausesByModule[module],
    [pausesByModule],
  );

  const isModulePaused = useCallback(
    (module: CircuitBreakerModule) => pausesByModule[module] !== undefined,
    [pausesByModule],
  );

  const value = useMemo<CircuitBreakerContextValue>(
    () => ({ activePauses, isMonitoring, getPause, isModulePaused }),
    [activePauses, isMonitoring, getPause, isModulePaused],
  );

  return <CircuitBreakerContext.Provider value={value}>{children}</CircuitBreakerContext.Provider>;
}

/**
 * Read the full circuit breaker state.
 *
 * Must be used within `<CircuitBreakerProvider>`. Re-renders on every pause
 * transition, so prefer {@link useModulePause} inside module views.
 */
export function useCircuitBreakerState(): CircuitBreakerContextValue {
  const ctx = useContext(CircuitBreakerContext);
  if (!ctx) {
    throw new Error('useCircuitBreakerState must be used within a CircuitBreakerProvider');
  }
  return ctx;
}

/**
 * Read the pause blocking one protocol module.
 *
 * This is the hook module views use to lock their own CTAs. It returns a
 * stable `false` / `undefined` pair whenever the module is running normally,
 * so it costs nothing on the happy path.
 */
export function useModulePause(module: CircuitBreakerModule): ActiveModulePause | undefined {
  return useCircuitBreakerState().getPause(module);
}
