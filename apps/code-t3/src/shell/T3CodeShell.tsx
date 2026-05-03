import { useEffect, useMemo } from "react";
import { BrowserLaunchPage } from "../components/BrowserLaunchPage";
import { T3WorkspaceApp } from "../components/T3WorkspaceApp";
import { createHugeCodeT3RuntimeBridge } from "../runtime/hugeCodeRuntimeBridge";
import { resolveT3CodeShellRoute, resolveT3CodeShellTitle } from "./t3CodeShellRoute";

export function T3CodeShell() {
  const route = useMemo(() => resolveT3CodeShellRoute(window.location.search), []);
  const runtimeBridge = useMemo(() => createHugeCodeT3RuntimeBridge(), []);

  useEffect(() => {
    document.title = resolveT3CodeShellTitle(route);
  }, [route]);

  if (route.kind === "browser") {
    return <BrowserLaunchPage {...route.browserProps} />;
  }

  return <T3WorkspaceApp runtimeBridge={runtimeBridge} />;
}
