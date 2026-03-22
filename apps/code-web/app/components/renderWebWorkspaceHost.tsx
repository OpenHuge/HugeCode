import { Component, type ReactNode, useEffect } from "react";

type WorkspaceHostErrorBoundaryProps = {
  children: ReactNode;
};

type WorkspaceHostErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class WorkspaceHostErrorBoundary extends Component<
  WorkspaceHostErrorBoundaryProps,
  WorkspaceHostErrorBoundaryState
> {
  constructor(props: WorkspaceHostErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WorkspaceHostErrorBoundaryState {
    return { hasError: true, error };
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__message">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button className="error-boundary__button" onClick={this.handleReload} type="button">
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function WebWorkspaceBootstrapEffects() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.tauriRuntime = "false";
    }
  }, []);

  return null;
}

export function renderWebWorkspaceHost(children: ReactNode) {
  return (
    <WorkspaceHostErrorBoundary>
      <WebWorkspaceBootstrapEffects />
      {children}
    </WorkspaceHostErrorBoundary>
  );
}
