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
  useCallback,
  useEffect,
  useRef,
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

interface BugReportContextType {
  downloadBugReportLog: () => void;
}

const TelemetryFeedContext = createContext<TelemetryFeedContextType | null>(null);
const TelemetryConnectionContext =
  createContext<TelemetryConnectionContextType | null>(null);
const TelemetryActionsContext =
  createContext<TelemetryActionsContextType | null>(null);
const BugReportContext = createContext<BugReportContextType | null>(null);

// Keys that contain sensitive information and should be redacted in bug reports.
const SENSITIVE_KEYS = new Set([
  'privateKey',
  'secretKey',
  'mnemonic',
  'seed',
  'password',
  'passphrase',
  'authToken',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'email',
  'phone',
  'phoneNumber',
  'ssn',
  'socialSecurityNumber',
  'address',
  'dateOfBirth',
  'firstName',
  'lastName',
  'fullName',
  'personalCode',
  'taxId',
  'bankAccount',
  'creditCard',
  'cvv'/
]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEYS.has(lower.replace(/[^a-z0-9]/g, ''));
}

function sanitize(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, key));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = sanitize(v, k);
      }
    }
    return result;
  }
  return value;
}

function getWalletExtensionState(): Record<string, unknown> {
  // Attempt to read basic state from common wallet extensions (i.e., MetaMask).
  const ethereum = (typeof window !== 'undefined' && (window as any).ethereum) || undefined;
  if (!ethereum) return { provider: 'none' };
  return {
    provider: 'ethereum',
    isConnected: typeof ethereum.isConnected === 'function' ? ethereum.isConnected() : ethereum.isConnected ?? null,
    chainId: ethereum.chainId ?? null,
    networkVersion: ethereum.networkVersion ?? null,
    // Do not include accounts/addresses to avoid PII; we only expose connection state.
  };
}

function TelemetryLeaf({ children }: { children: ReactNode }) {
  const { lastUpdate } = useSocketData();
  const { isConnected, error, reconnectAttempts } = useSocketConnection();
  const { subscribeToAsset, unsubscribeFromAsset, reconnect } = useSocketActions();

  // Refs to accumulate recent RPC responses and console warnings.
  const recentRpcResponses = useRef<PriceData[]>([]);
  const consoleWarnings = useRef<Array<{ type: string; message: string; timestamp: string; stack?: string }>>([]);
  const maxLogEntries = 10;

  // Keep a rolling buffer of the latest rpc responses.
  useEffect(() => {
    if (lastUpdate) {
      recentRpcResponses.current.push(lastUpdate);
      if (recentRpcResponses.current.length > maxLogEntries) {
        recentRpcResponses.current.shift();
      }
    }
  }, [lastUpdate]);

  // Capture console warnings/errors globally.
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;

    const capture = (type: 'warn' | 'error') => (...args: unknown[]) => {
      const message = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');

      consoleWarnings.current.push({
        type,
        message,
        timestamp: new Date().toISOString(),
        stack: type === 'error' ? new Error().stack : undefined,
      });
      if (consoleWarnings.current.length > maxLogEntries) {
        consoleWarnings.current.shift();
      }
    };

    console.warn = capture('warn');
    console.error = capture('error');

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  const downloadBugReportLog = useCallback(() => {
    const log = {
      timestamp: new Date().toISOString(),
      system: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      },
      telemetry: {
        lastUpdate: sanitize(lastUpdate),
        connection: sanitize({ isConnected, error, reconnectAttempts }),
      },
      recentRpcResponses: sanitize(recentRpcResponses.current),
      consoleWarnings: sanitize(consoleWarnings.current),
      walletExtension: sanitize(getWalletExtensionState()),
    };

    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug-report-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [lastUpdate, isConnected, error, reconnectAttempts]);

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

  const bugReportValue = useMemo<BugReportContextType>(
    () => ({ downloadBugReportLog }),
    [downloadBugReportLog],
  );

  return (
    <TelemetryConnectionContext.Provider value={connectionValue}>
      <TelemetryActionsContext.Provider value={actionsValue}>
        <TelemetryFeedContext.Provider value={FeedValue}>
          <BugReportContext.Provider value={bugReportValue}>
            {children}
          </BugReportContext.Provider>
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

export function useBugReportLog(): BugReportContextType {
  const ctx = useContext(BugReportContext);
  if (!ctx) {
    throw new Error('useBugReportLog must be used within a TelemetryProvider');
  }
  return ctx;
}
