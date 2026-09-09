import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly declare properties to satisfy compiler
  public props: Props;
  public state: State;
  public setState: any;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in component [${this.props.name || 'Unknown'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 bg-slate-950 border border-red-500/20 rounded-2xl text-center space-y-4 shadow-xl my-4">
          <div className="inline-flex p-3 bg-red-500/10 text-red-500 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Showroom Identity Load Failure</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            An error occurred while loading this section. Check the console or retry loading.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-200 text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all duration-300"
          >
            Retry Loading Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
