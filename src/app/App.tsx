import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Providers } from './providers';
import { Router } from './router';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error.message, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg p-8 text-sm">
        <h1 className="mb-2 text-base font-semibold">Something went wrong</h1>
        <p className="mb-3 text-muted">
          The interface hit an unexpected error. Your saved sessions are not affected.
        </p>
        <button
          type="button"
          className="rounded border border-line px-3 py-1.5"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <div className="h-full">
          <Router />
        </div>
      </Providers>
    </ErrorBoundary>
  );
}
