"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface State { error: Error | null }
interface Props { children: ReactNode }

/** Removes Stellar secret seeds, credentials, and common session token values before reporting. */
export function sanitizeErrorText(value: string): string {
  return value
    .replace(/S[A-Z2-7]{55}/g, "[REDACTED_WALLET_SECRET]")
    .replace(/((?:private[_ -]?key|secret|access[_ -]?token|session[_ -]?token|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|secret|key|session)=)[^&#\s]+/gi, "$1[REDACTED]");
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const sanitized = new Error(sanitizeErrorText(error.message));
    sanitized.name = sanitizeErrorText(error.name);
    if (error.stack) sanitized.stack = sanitizeErrorText(error.stack);
    Sentry.captureException(sanitized, {
      tags: { boundary: "global-ui" },
      extra: { componentStack: sanitizeErrorText(info.componentStack ?? "") },
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 p-8 text-center text-white">
      <h1 className="text-2xl font-bold">StellarFlow ran into a problem</h1>
      <p className="max-w-md text-gray-300">Your wallet and session remain protected. Reload the application to recover.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500">Reload Application</button>
        <a href="https://github.com/StellarFlow-Network/stellarflow-frontend/issues/new" target="_blank" rel="noreferrer" className="rounded-lg border border-gray-600 px-4 py-2 font-semibold hover:bg-gray-800">Report Issue</a>
      </div>
    </main>;
  }
}
