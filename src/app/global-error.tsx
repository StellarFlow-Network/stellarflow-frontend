"use client";

/**
 * global-error.tsx
 *
 * Next.js App Router last-resort error boundary — catches any error that
 * escapes the root layout (including layout.tsx itself). Reports the error
 * to Sentry before rendering the fallback shell, since this boundary replaces
 * the entire <html> document and the normal component tree (and any nested
 * ErrorBoundary from `@/components/ErrorBoundary`) is gone by this point.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#020817] text-white">
        <div className="max-w-md space-y-3 text-center px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            StellarFlow
          </p>
          <h1 className="text-xl font-black">Something went wrong</h1>
          <p className="text-sm text-gray-400">
            The error has been reported. Please try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-4 py-2 text-xs font-semibold text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
