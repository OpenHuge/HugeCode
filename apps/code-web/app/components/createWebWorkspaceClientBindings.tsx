import { lazy } from "react";
import { createWebWorkspaceClientBindings as createSharedWebWorkspaceClientBindings } from "@ku0/code-application";
import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
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

export function createWebWorkspaceClientBindings(
  navigation: WorkspaceNavigationAdapter
): WorkspaceClientBindings {
  return createSharedWebWorkspaceClientBindings({
    navigation,
    WorkspaceApp: WebWorkspaceShellApp,
    settingsShellFraming: webSettingsShellFraming,
  });
}
