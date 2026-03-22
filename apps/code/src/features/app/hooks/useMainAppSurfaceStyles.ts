import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { AppSettings } from "../../../types";

type UseMainAppSurfaceStylesParams = {
  appSettings: Pick<AppSettings, "uiFontFamily" | "codeFontFamily" | "codeFontSize">;
  isCompact: boolean;
  isPhone: boolean;
  shouldReduceTransparency: boolean;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  planPanelHeight: number;
  terminalPanelHeight: number;
  debugPanelHeight: number;
};

export function useMainAppSurfaceStyles({
  appSettings,
  isCompact,
  isPhone,
  shouldReduceTransparency,
  sidebarCollapsed,
  rightPanelCollapsed,
  sidebarWidth,
  rightPanelWidth,
  planPanelHeight,
  terminalPanelHeight,
  debugPanelHeight,
}: UseMainAppSurfaceStylesParams): { appClassName: string; appStyle: CSSProperties } {
  return useMemo(() => {
    const appClassName = `app ${isCompact ? "layout-compact" : "layout-desktop"}${
      isPhone ? " layout-phone" : ""
    }${shouldReduceTransparency ? " reduced-transparency" : ""}${
      !isCompact && sidebarCollapsed ? " sidebar-collapsed" : ""
    }${!isCompact && rightPanelCollapsed ? " right-panel-collapsed" : ""}`;

    const appStyle: CSSProperties = {
      "--sidebar-width": `${isPhone ? sidebarWidth : sidebarCollapsed ? 0 : sidebarWidth}px`,
      "--sidebar-resize-handle-width": `${!isPhone && sidebarCollapsed ? 0 : 12}px`,
      "--right-panel-width": `${isCompact ? rightPanelWidth : rightPanelCollapsed ? 0 : rightPanelWidth}px`,
      "--plan-panel-height": `${planPanelHeight}px`,
      "--terminal-panel-height": `${terminalPanelHeight}px`,
      "--debug-panel-height": `${debugPanelHeight}px`,
      "--ui-font-family": appSettings.uiFontFamily,
      "--code-font-family": appSettings.codeFontFamily,
      "--code-font-size": `${appSettings.codeFontSize}px`,
    } as CSSProperties;

    return { appClassName, appStyle };
  }, [
    appSettings.codeFontFamily,
    appSettings.codeFontSize,
    appSettings.uiFontFamily,
    debugPanelHeight,
    isCompact,
    isPhone,
    planPanelHeight,
    rightPanelCollapsed,
    rightPanelWidth,
    shouldReduceTransparency,
    sidebarCollapsed,
    sidebarWidth,
    terminalPanelHeight,
  ]);
}
