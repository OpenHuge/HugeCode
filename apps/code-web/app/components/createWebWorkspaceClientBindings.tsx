import { lazy } from "react";
import {
  createBrowserWorkspaceClientHostBindings,
  createBrowserWorkspaceClientRuntimeBindings,
  createBrowserWorkspaceClientRuntimeGatewayBindings,
  type WorkspaceClientBindings,
} from "@ku0/code-workspace-client";
import { WorkspaceRuntimeShell } from "@ku0/code-workspace-client/runtime-shell";
import type { WorkspaceNavigationAdapter } from "@ku0/code-workspace-client/workspace-shell";
import { renderWebWorkspaceHost } from "./renderWebWorkspaceHost";

const webSettingsShellFraming = {
  kickerLabel: "Gateway session",
  contextLabel: "Web workspace",
  title: "Workspace settings",
  subtitle: "Browser defaults for the connected runtime session.",
};

const LazyWebWorkspaceShellApp = lazy(async () => {
  return await import("./WebWorkspaceShellApp");
});

function WebWorkspaceShellApp() {
  return <LazyWebWorkspaceShellApp />;
}

export function createWebWorkspaceClientBindings(
  navigation: WorkspaceNavigationAdapter
): WorkspaceClientBindings {
  return {
    navigation,
    runtimeGateway: createBrowserWorkspaceClientRuntimeGatewayBindings(),
    runtime: createBrowserWorkspaceClientRuntimeBindings(),
    host: createBrowserWorkspaceClientHostBindings(),
    platformUi: {
      WorkspaceRuntimeShell,
      WorkspaceApp: WebWorkspaceShellApp,
      renderWorkspaceHost: renderWebWorkspaceHost,
      settingsShellFraming: webSettingsShellFraming,
    },
  };
}
