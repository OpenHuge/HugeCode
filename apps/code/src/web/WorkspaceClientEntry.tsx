import { createDesktopWorkspaceBootstrap } from "@ku0/code-application";
import { WorkspaceClientBoot } from "@ku0/code-workspace-client";
import {
  openUrl,
  resolveDesktopShellStartupStatus,
  showDesktopNotification,
} from "../application/runtime/facades/desktopHostFacade";
import { createRuntimeKernel } from "../application/runtime/kernel/createRuntimeKernel";
import { RuntimePortsProvider } from "../application/runtime/ports";
import { RuntimeBootstrapEffects } from "../bootstrap/runtimeBootstrap";
import { desktopSettingsShellFraming } from "../features/settings/components/desktopSettingsShellFraming";
import { waitForCodexOauthBinding } from "../features/settings/components/sections/settings-codex-accounts-card/codexOauthBinding";
import { desktopWorkspaceNavigation } from "../features/workspaces/hooks/workspaceRoute";
import DesktopWorkspaceSurface from "./DesktopWorkspaceSurface";

const runtimeKernel = createRuntimeKernel();

const workspaceClientBindings = createDesktopWorkspaceBootstrap({
  navigation: desktopWorkspaceNavigation,
  runtimeKernel,
  openExternalUrl: openUrl,
  readShellStartupStatus: resolveDesktopShellStartupStatus,
  waitForOauthBinding: (workspaceId, baselineUpdatedAt) =>
    waitForCodexOauthBinding(
      {
        getAccountInfo: runtimeKernel.workspaceClientRuntime.oauth.getAccountInfo,
        readCodexAccountsForOauthSync: () =>
          runtimeKernel.workspaceClientRuntime.oauth.listAccounts("codex"),
      },
      workspaceId,
      baselineUpdatedAt
    ),
  testSystemNotification: () => {
    void showDesktopNotification({
      title: "HugeCode desktop notifications",
      body: "Electron desktop notifications are connected.",
    });
  },
  WorkspaceApp: DesktopWorkspaceSurface,
  settingsShellFraming: desktopSettingsShellFraming,
  hostEffects: [RuntimeBootstrapEffects],
  hostProviders: [RuntimePortsProvider],
});

export function WorkspaceClientEntry() {
  return <WorkspaceClientBoot bindings={workspaceClientBindings} />;
}

export default WorkspaceClientEntry;
