import { WorkspaceDesktopAppHost } from "./features/app/components/WorkspaceDesktopAppHost";
import { useDesktopWorkspaceFeatureComposition } from "./features/app/composition/useDesktopWorkspaceFeatureComposition";

export default function MainAppContainerCore() {
  const desktopHostProps = useDesktopWorkspaceFeatureComposition();
  return <WorkspaceDesktopAppHost {...desktopHostProps} />;
}
