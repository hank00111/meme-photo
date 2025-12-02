/**
 * ErrorBoundary Component - Phase 3.8
 * 
 * React Error Boundary to catch rendering errors and display fallback UI.
 * Implements error logging and retry mechanism.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Log error details to console
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ERROR_BOUNDARY: Component error caught:', error);
    console.error('ERROR_BOUNDARY: Error info:', errorInfo);
  }

  /**
   * Reset error state and retry rendering
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p>The application encountered an error. Please try again.</p>
            {this.state.error && (
              <details>
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <button 
              className="retry-button"
              onClick={this.handleReset}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
