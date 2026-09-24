"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logErrorToTelemetry } from "@/utils/telemetry";

type FallbackRender = (props: {
  error: Error | null;
  resetErrorBoundary: () => void;
}) => ReactNode;

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | FallbackRender;
  name?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export function DefaultErrorFallback({
  error,
  resetErrorBoundary,
  name,
}: {
  error: Error | null;
  resetErrorBoundary: () => void;
  name?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center p-6 rounded-[24px] border border-rose-500/20 bg-rose-950/5 backdrop-blur-md shadow-[0_12px_40px_rgba(239,68,68,0.1)] text-center w-full min-h-[200px] transition-all"
      role="alert"
    >
      <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 mb-3">
        <AlertTriangle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
        {name ? `${name} Failed` : "Section Failed"}
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
        An unexpected UI crash occurred in this section.
      </p>
      {error && (
        <pre className="mt-2 text-[10px] font-mono text-rose-300 bg-black/40 p-2 rounded-lg max-w-full overflow-x-auto select-all max-h-[80px] border border-white/5">
          {error.message || "Unknown error"}
        </pre>
      )}
      <button
        onClick={resetErrorBoundary}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 rounded-xl transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] cursor-pointer"
      >
        <RefreshCw size={12} />
        <span>Retry Section</span>
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logErrorToTelemetry(error, errorInfo, this.props.name);
  }

  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, name } = this.props;

    if (hasError) {
      if (fallback) {
        if (typeof fallback === "function") {
          return (fallback as FallbackRender)({
            error,
            resetErrorBoundary: this.resetErrorBoundary,
          });
        }
        return fallback;
      }

      return (
        <DefaultErrorFallback
          error={error}
          resetErrorBoundary={this.resetErrorBoundary}
          name={name}
        />
      );
    }

    return children;
  }
}
