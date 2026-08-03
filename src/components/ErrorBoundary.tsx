"use client";

/**
 * ErrorBoundary — Sentry-backed boundary for isolating render errors to a
 * single widget/section instead of taking down the whole page. Use this
 * around independently-failing panels (price feeds, order book, charts)
 * where a render bug in one shouldn't blank out the rest of the dashboard.
 *
 * `global-error.tsx` remains the last-resort catch-all for errors that
 * escape every nested boundary.
 */

import React from "react";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Extra context tags attached to the captured Sentry event, e.g. { section: "order-book" }. */
  tags?: Record<string, string>;
}

const DEFAULT_FALLBACK = (
  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-400">
    Something went wrong rendering this section.
  </div>
);

export function ErrorBoundary({ children, fallback, tags }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={fallback ?? DEFAULT_FALLBACK}
      showDialog={false}
      beforeCapture={(scope) => {
        if (tags) scope.setTags(tags);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
