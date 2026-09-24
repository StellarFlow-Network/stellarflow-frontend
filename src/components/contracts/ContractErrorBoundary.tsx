"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ContractErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface ContractErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ContractErrorBoundary extends Component<
  ContractErrorBoundaryProps,
  ContractErrorBoundaryState
> {
  constructor(props: ContractErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ContractErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Soroban Contract Interaction Error:", error, errorInfo);
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
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback && error) {
        return fallback(error, this.resetErrorBoundary);
      }

      const errorMessage = error?.message || "Unknown contract interaction error";
      const errorCodeMatch = errorMessage.match(/(?:error|code|status)[:\s]+([a-zA-Z0-9_-]+)/i);
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : "SOROBAN_RPC_ERROR";

      return (
        <div
          className="flex flex-col items-center justify-center p-6 rounded-2xl border border-rose-500/30 bg-rose-950/10 backdrop-blur-md shadow-lg text-center w-full min-h-[220px] transition-all"
          role="alert"
        >
          <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 mb-3">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Smart Contract Execution Failed
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            An RPC or contract invocation error occurred during execution.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-300">
            <span className="text-rose-400 font-semibold">Error Code:</span>
            <span>{errorCode}</span>
          </div>
          <pre className="mt-2 text-[10px] font-mono text-rose-300 bg-black/40 p-2 rounded-lg max-w-full overflow-x-auto select-all max-h-[80px] border border-white/5">
            {errorMessage}
          </pre>
          <button
            onClick={this.resetErrorBoundary}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Retry Action</span>
          </button>
        </div>
      );
    }

    return children;
  }
}
