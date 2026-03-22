import type { ReactNode } from "react";
import { RuntimeBootstrapEffects } from "../bootstrap/runtimeBootstrap";
import { RuntimePortsProvider } from "../application/runtime/ports";
import { ErrorBoundary } from "../features/app/components/ErrorBoundary";

export function renderCodeWorkspaceHost(children: ReactNode) {
  return (
    <RuntimePortsProvider>
      <ErrorBoundary>
        <RuntimeBootstrapEffects />
        {children}
      </ErrorBoundary>
    </RuntimePortsProvider>
  );
}
