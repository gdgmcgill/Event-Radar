"use client";

import type { ReactNode } from "react";
import { Component } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  private renderFallback() {
    const { fallback, fallbackMessage } = this.props;
    const { error } = this.state;

    if (typeof fallback === "function") {
      return fallback(error ?? new Error("Unknown error"), this.reset);
    }

    if (fallback) {
      return fallback;
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-card px-6 py-10 text-center">
        <div className="text-lg font-semibold text-foreground">Something went wrong</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {fallbackMessage ?? "Please try again in a moment."}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40"
        >
          Try again
        </button>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}
