import { ErrorInfo } from "react";

export interface TelemetryErrorPayload {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string;
  componentName: string;
  timestamp: string;
  url: string;
  userAgent: string;
}

/**
 * Sends uncaught UI crash telemetry to the backend service.
 * Uses navigator.sendBeacon when available for non-blocking transmission.
 */
export function logErrorToTelemetry(
  error: Error,
  errorInfo: ErrorInfo,
  componentName?: string
): void {
  const payload: TelemetryErrorPayload = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo.componentStack || undefined,
    componentName: componentName || "UnknownComponent",
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "SSR",
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SSR",
  };

  console.error(
    `[Telemetry Error] Uncaught error in ${payload.componentName}:`,
    error,
    errorInfo
  );

  if (typeof window !== "undefined") {
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/telemetry/error", blob);
      } else {
        fetch("/api/telemetry/error", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }).catch((fetchErr) => {
          console.warn("[Telemetry] Failed to post telemetry:", fetchErr);
        });
      }
    } catch (e) {
      console.warn("[Telemetry] Telemetry submission failed:", e);
    }
  }
}
