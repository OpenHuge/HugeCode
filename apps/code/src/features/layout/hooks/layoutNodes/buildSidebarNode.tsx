import { Suspense, lazy } from "react";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { openMissionTargetFromDesktopShell } from "../../../missions/utils/missionNavigation";
import type { LayoutNodesOptions, LayoutNodesResult } from "./types";

type SidebarLayoutNodes = Pick<LayoutNodesResult, "sidebarNode">;

const LazySidebarNode = lazy(async () => {
  const module = await import("./SidebarNode");
  return { default: module.SidebarNode };
});

export function buildSidebarNode(options: LayoutNodesOptions): SidebarLayoutNodes["sidebarNode"] {
  const openSidebarMissionTarget = (target: MissionNavigationTarget) => {
    openMissionTargetFromDesktopShell({
      target,
      source: "sidebar",
      onOpenReviewPack: options.gitReview.onOpenReviewPack,
      onSelectWorkspace: options.shell.onSelectWorkspace,
      onSelectThread: options.shell.onSelectThread,
      onSelectReviewTab: () => options.shell.onSelectTab("review"),
    });
  };

  return (
    <Suspense fallback={null}>
      <LazySidebarNode options={options} onOpenMissionTarget={openSidebarMissionTarget} />
    </Suspense>
  );
}
