import { buildTopbarChromeNodes } from "../utils/topbarChromeNodes";
import { useMainAppLayoutProps } from "./useMainAppLayoutProps";
import { useMainAppModalsProps } from "./useMainAppModalsProps";
import { useMainAppSettingsSectionProps } from "./useMainAppSettingsSectionProps";

type UseMainAppShellSurfacePropsParams = {
  chromeInput: Parameters<typeof buildTopbarChromeNodes>[0];
  settingsInput: Parameters<typeof useMainAppSettingsSectionProps>[0];
  layoutInput: Omit<
    Parameters<typeof useMainAppLayoutProps>[0],
    "desktopTopbarLeftNode" | "codexTopbarActionsNode"
  >;
  modalsInput: Omit<Parameters<typeof useMainAppModalsProps>[0], "settingsProps">;
};

export function useMainAppShellSurfaceProps({
  chromeInput,
  settingsInput,
  layoutInput,
  modalsInput,
}: UseMainAppShellSurfacePropsParams) {
  const { desktopTopbarLeftNodeWithToggle, titlebarControlsNode, codexTopbarActionsNode } =
    buildTopbarChromeNodes(chromeInput);
  const mainAppSettingsProps = useMainAppSettingsSectionProps(settingsInput);
  const mainAppLayoutProps = useMainAppLayoutProps({
    ...layoutInput,
    desktopTopbarLeftNode: desktopTopbarLeftNodeWithToggle,
    codexTopbarActionsNode,
  });
  const mainAppModalsProps = useMainAppModalsProps({
    ...modalsInput,
    settingsProps: mainAppSettingsProps,
  });

  return {
    mainAppLayoutProps,
    mainAppModalsProps,
    titlebarControlsNode,
  };
}
