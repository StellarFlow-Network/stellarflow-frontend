'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Headset, Loader2, RefreshCw, X, XCircle } from 'lucide-react';

export type SEP24InterruptionReason = 'cancelled' | 'iframe_error' | 'anchor_error';

export interface SEP24ErrorFallbackModalProps {
  isOpen: boolean;
  reason: SEP24InterruptionReason;
  /** Optional safe-to-display detail from the anchor or iframe handler. */
  detail?: string;
  /** Must request a fresh SEP-24 interactive URL and resume the flow. */
  onRetry: () => void | Promise<void>;
  onClose: () => void;
  /** Opens the appropriate anchor support channel for the current flow. */
  onContactSupport: () => void;
}

const INTERRUPTION_COPY: Record<
  SEP24InterruptionReason,
  { title: string; description: string }
> = {
  cancelled: {
    title: 'Onboarding cancelled',
    description:
      'The anchor onboarding page was closed before the process finished. No transfer was submitted.',
  },
  iframe_error: {
    title: 'Onboarding page unavailable',
    description:
      'The anchor onboarding page could not be loaded or stopped responding. Your transfer was not submitted.',
  },
  anchor_error: {
    title: 'Anchor could not complete onboarding',
    description:
      'The anchor reported a problem while preparing your onboarding session. You can request a fresh session or contact support.',
  },
};

export function SEP24ErrorFallbackModal({
  isOpen,
  reason,
  detail,
  onRetry,
  onClose,
  onContactSupport,
}: SEP24ErrorFallbackModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const trackedReasonRef = useRef<SEP24InterruptionReason | null>(null);
  const isCancellation = reason === 'cancelled';
  const copy = INTERRUPTION_COPY[reason];

  useEffect(() => {
    if (!isOpen) {
      trackedReasonRef.current = null;
      return;
    }
    if (trackedReasonRef.current === reason) return;
    trackedReasonRef.current = reason;

    // Send only the interruption category, never anchor URLs, wallet data, or
    // raw error details. The existing telemetry API forwards/records UI events.
    void fetch('/api/telemetry/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'sep24_onboarding',
        event: isCancellation ? 'sep24_flow_cancelled' : 'sep24_flow_failed',
        reason,
        occurredAt: new Date().toISOString(),
      }),
    }).catch(() => {
      // Analytics must not prevent the user from retrying or contacting support.
    });
  }, [isOpen, isCancellation, reason]);

  useEffect(() => {
    if (isOpen) {
      setRetryError(null);
      setIsRetrying(false);
    }
  }, [isOpen, reason]);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await onRetry();
      onClose();
    } catch {
      setRetryError('A new onboarding session could not be started. Please try again or contact anchor support.');
      setIsRetrying(false);
    }
  }, [isRetrying, onRetry, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sep24-fallback-title"
        aria-describedby="sep24-fallback-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <header className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-xl p-2 ${
                isCancellation
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {isCancellation ? <XCircle size={22} /> : <AlertTriangle size={22} />}
            </span>
            <h2 id="sep24-fallback-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRetrying}
            aria-label="Close onboarding message"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div>
            <p id="sep24-fallback-description" className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {copy.description}
            </p>
            {detail && (
              <p className="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">{detail}</p>
            )}
          </div>

          {retryError && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
              {retryError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={isRetrying}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isRetrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {isRetrying ? 'Restarting…' : 'Retry Onboarding Flow'}
            </button>
            <button
              type="button"
              onClick={onContactSupport}
              disabled={isRetrying}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Headset size={16} />
              Contact Anchor Support
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SEP24ErrorFallbackModal;