import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import { WorkspaceBootFallback, WorkspaceClientApp } from "../components/WorkspaceClientApp";

function WorkspaceRoute() {
  const { workspaceBindings } = Route.useRouteContext();
  return (
    <ClientOnly fallback={<WorkspaceBootFallback />}>
      <WorkspaceClientApp bindings={workspaceBindings} />
    </ClientOnly>
  );
}

export const Route = createLazyFileRoute("/app")({
  component: WorkspaceRoute,
});
