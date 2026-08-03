/**
 * instrumentation.ts
 *
 * Server/edge-side counterpart to `instrumentation-client.ts`. Kept minimal
 * on purpose — this project's telemetry focus is client-side error tracking
 * and performance monitoring, but `onRequestError` also lets Next.js forward
 * SSR render errors (e.g. a corridor page failing to render on the server)
 * into the same Sentry project so they aren't invisible to the dashboard.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      enabled: Boolean(dsn),
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
