import { Component, type ComponentType, type PropsWithChildren, type ReactNode } from "react";

type WorkspaceHostErrorBoundaryProps = {
  children: ReactNode;
};

type WorkspaceHostErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export type WorkspaceHostProvider = ComponentType<PropsWithChildren>;
export type WorkspaceHostEffect = ComponentType;

export type CreateWorkspaceHostRendererInput = {
  effects?: readonly WorkspaceHostEffect[];
  providers?: readonly WorkspaceHostProvider[];
};

export class WorkspaceHostErrorBoundary extends Component<
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

export function applyBrowserRuntimeFlags() {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.desktopRuntime = "browser";
  document.documentElement.dataset.tauriRuntime = "false";
  document.documentElement.dataset.electronRuntime = "false";
}

export class BrowserRuntimeBootstrapEffects extends Component {
  componentDidMount() {
    applyBrowserRuntimeFlags();
  }

  componentDidUpdate() {
    applyBrowserRuntimeFlags();
  }

  render() {
    return null;
  }
}

function renderWorkspaceHostEffects(children: ReactNode, effects: readonly WorkspaceHostEffect[]) {
  let node = children;
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const Effect = effects[index]!;
    node = (
      <>
        <Effect />
        {node}
      </>
    );
  }
  return node;
}

function renderWorkspaceHostProviders(
  children: ReactNode,
  providers: readonly WorkspaceHostProvider[]
) {
  let node = children;
  for (let index = providers.length - 1; index >= 0; index -= 1) {
    const Provider = providers[index]!;
    node = <Provider>{node}</Provider>;
  }
  return node;
}

export function createWorkspaceHostRenderer(input: CreateWorkspaceHostRendererInput = {}) {
  const providers = input.providers ?? [];
  const effects = input.effects ?? [];

  return function renderWorkspaceHost(children: ReactNode) {
    const hostedChildren = renderWorkspaceHostEffects(children, effects);
    return renderWorkspaceHostProviders(
      <WorkspaceHostErrorBoundary>{hostedChildren}</WorkspaceHostErrorBoundary>,
      providers
    );
  };
}
