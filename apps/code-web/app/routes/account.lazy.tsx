import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import {
  AccountCenterDashboard,
  WorkspaceClientBindingsProvider,
} from "@ku0/code-workspace-client";
import { WebWorkspaceUnavailablePage } from "../components/WebWorkspaceUnavailablePage";
import { hasConfiguredWebRuntimeGateway } from "@ku0/shared/runtimeGatewayEnv";

function AccountRoute() {
  const { workspaceBindings } = Route.useRouteContext();
  if (!hasConfiguredWebRuntimeGateway()) {
    return <WebWorkspaceUnavailablePage />;
  }

  return (
    <ClientOnly fallback={<div>Loading account center...</div>}>
      <WorkspaceClientBindingsProvider bindings={workspaceBindings}>
        <AccountCenterDashboard />
      </WorkspaceClientBindingsProvider>
    </ClientOnly>
  );
}

export const Route = createLazyFileRoute("/account")({
  component: AccountRoute,
});
