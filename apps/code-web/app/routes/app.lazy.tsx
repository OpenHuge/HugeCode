import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import { WorkspaceBootFallback, WorkspaceClientApp } from "../components/WorkspaceClientApp";
import { WebWorkspaceOfflinePage } from "../components/WebWorkspaceOfflinePage";
import { useNavigatorOnlineStatus } from "../pwa/browserPwa";
import { WebPwaLifecycle } from "../pwa/WebPwaLifecycle";

function WorkspaceRouteClient({
  workspaceBindings,
}: {
  workspaceBindings: WorkspaceClientBindings;
}) {
  const online = useNavigatorOnlineStatus();

  if (!online) {
    return (
      <>
        <WebPwaLifecycle />
        <WebWorkspaceOfflinePage />
      </>
    );
  }

  return (
    <>
      <WebPwaLifecycle />
      <ClientOnly fallback={<WorkspaceBootFallback />}>
        <WorkspaceClientApp bindings={workspaceBindings} />
      </ClientOnly>
    </>
  );
}

function WorkspaceRoute() {
  const { workspaceBindings } = Route.useRouteContext();

  return (
    <ClientOnly fallback={<WorkspaceBootFallback />}>
      <WorkspaceRouteClient workspaceBindings={workspaceBindings} />
    </ClientOnly>
  );
}

export const Route = createLazyFileRoute("/app")({
  component: WorkspaceRoute,
});
