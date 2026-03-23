import { lazy } from "react";
import {
  BrowserRuntimeBootstrapEffects,
  createWorkspaceClientBindings,
  createWorkspaceHostRenderer,
} from "@ku0/code-application";
import {
  createBrowserWorkspaceClientHostBindings,
  createBrowserWorkspaceClientRuntimeBindings,
  createBrowserWorkspaceClientRuntimeGatewayBindings,
  WorkspaceRuntimeShell,
  type WorkspaceClientBindings,
} from "@ku0/code-workspace-client";
import type { WorkspaceNavigationAdapter } from "@ku0/code-workspace-client/workspace-shell";

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

const renderWorkspaceHost = createWorkspaceHostRenderer({
  effects: [BrowserRuntimeBootstrapEffects],
});

export function createWebWorkspaceClientBindings(
  navigation: WorkspaceNavigationAdapter
): WorkspaceClientBindings {
  return createWorkspaceClientBindings({
    navigation,
    runtimeGateway: createBrowserWorkspaceClientRuntimeGatewayBindings(),
    runtime: createBrowserWorkspaceClientRuntimeBindings(),
    host: createBrowserWorkspaceClientHostBindings(),
    platformUi: {
      WorkspaceRuntimeShell,
      WorkspaceApp: WebWorkspaceShellApp,
      renderWorkspaceHost,
      settingsShellFraming: webSettingsShellFraming,
    },
  });
}
