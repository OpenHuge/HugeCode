import { WorkspaceShellApp } from "@ku0/code-workspace-client/workspace-shell";
import { lazy, Suspense } from "react";
import { useWorkspaceRouteSelection } from "../features/workspaces/hooks/workspaceRoute";

const mainAppContainerCoreModulePromise = import("../MainAppContainerCore");
const MainAppContainerCore = lazy(() => mainAppContainerCoreModulePromise);

export default function DesktopWorkspaceSurface() {
  const routeSelection = useWorkspaceRouteSelection();

  if (routeSelection.kind === "workspace") {
    return (
      <Suspense fallback={<WorkspaceShellApp />}>
        <MainAppContainerCore />
      </Suspense>
    );
  }

  return <WorkspaceShellApp />;
}
