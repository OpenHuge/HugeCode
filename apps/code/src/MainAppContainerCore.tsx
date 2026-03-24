import { useEffect } from "react";
import { WorkspaceDesktopAppHost } from "./features/app/components/WorkspaceDesktopAppHost";
import { useDesktopWorkspaceFeatureComposition } from "./features/app/composition/useDesktopWorkspaceFeatureComposition";
import { markFeatureVisible } from "./features/shared/featurePerformance";

export default function MainAppContainerCore() {
  const desktopHostProps = useDesktopWorkspaceFeatureComposition();

  useEffect(() => {
    const frameHandle = window.requestAnimationFrame(() => {
      markFeatureVisible("workspace_shell");
    });
    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, []);

  return <WorkspaceDesktopAppHost {...desktopHostProps} />;
}
