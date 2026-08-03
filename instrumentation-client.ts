/**
 * instrumentation-client.ts
 *
 * Client-side Sentry initialisation — error tracking + performance monitoring
 * for everything that runs in the browser (React render errors, unhandled
 * promise rejections, WebSocket/RPC failures, route transitions).
 *
 * This file is picked up automatically by Next.js (App Router) and executed
 * once before hydration. It intentionally has no dependency on `src/config/env`
 * — the DSN is optional so local development without a Sentry project still
 * works: when `NEXT_PUBLIC_SENTRY_DSN` is unset, the SDK is initialised in a
 * disabled state and all calls become no-ops.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,

  // Performance monitoring — trace navigation, fetch/XHR (WS upgrade requests,
  // Horizon/Soroban RPC calls) and React component renders.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Session Replay — captures a lightweight DOM recording around errors so
  // issues are reproducible without shipping real user data.
  replaysSessionSampleRate: 0.02,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Drop noisy, non-actionable browser errors (extension conflicts, aborted
  // fetches from unmounted components, etc.) before they count against quota.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    "AbortError",
  ],
});

// Instruments App Router navigations as Sentry performance spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
