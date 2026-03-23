import { WorkspaceShellApp } from "@ku0/code-workspace-client/workspace-shell";
import { lazy, Suspense } from "react";
import { workspaceBootState } from "../appBoot";
import { AppBootFallback } from "../features/app/components/AppBootFallback";
import {
  useDesktopMissionHomeRoute,
  useWorkspaceRouteSelection,
} from "../features/workspaces/hooks/workspaceRoute";

const mainAppContainerCoreModulePromise = import("../MainAppContainerCore");
const MainAppContainerCore = lazy(() => mainAppContainerCoreModulePromise);

export default function DesktopWorkspaceSurface() {
  const routeSelection = useWorkspaceRouteSelection();
  const showMissionHomeRoute = useDesktopMissionHomeRoute();

  if (
    routeSelection.kind === "workspace" ||
    routeSelection.kind === "home" ||
    showMissionHomeRoute
  ) {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <MainAppContainerCore />
      </Suspense>
    );
  }

  return <WorkspaceShellApp />;
}
