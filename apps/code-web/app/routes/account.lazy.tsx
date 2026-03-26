import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import {
  AccountCenterDashboard,
  type WorkspaceClientBindings,
  WorkspaceClientBindingsProvider,
} from "@ku0/code-workspace-client";
import { WebWorkspaceUnavailablePage } from "../components/WebWorkspaceUnavailablePage";
import { hasConfiguredWebRuntimeGateway } from "@ku0/shared/runtimeGatewayEnv";
import { WebPwaLifecycle } from "../pwa/WebPwaLifecycle";

function AccountRouteClient({ workspaceBindings }: { workspaceBindings: WorkspaceClientBindings }) {
  if (!hasConfiguredWebRuntimeGateway()) {
    return (
      <>
        <WebPwaLifecycle />
        <WebWorkspaceUnavailablePage />
      </>
    );
  }

  return (
    <>
      <WebPwaLifecycle />
      <ClientOnly fallback={<div>Loading account center...</div>}>
        <WorkspaceClientBindingsProvider bindings={workspaceBindings}>
          <AccountCenterDashboard />
        </WorkspaceClientBindingsProvider>
      </ClientOnly>
    </>
  );
}

function AccountRoute() {
  const { workspaceBindings } = Route.useRouteContext();

  return (
    <ClientOnly fallback={<div>Loading account center...</div>}>
      <AccountRouteClient workspaceBindings={workspaceBindings} />
    </ClientOnly>
  );
}

export const Route = createLazyFileRoute("/account")({
  component: AccountRoute,
});
