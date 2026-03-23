import {
  createWorkspaceHostRenderer,
  createDesktopWorkspaceClientHostBindings,
  createWorkspaceClientBindings,
} from "@ku0/code-application";
import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import { WorkspaceRuntimeShell } from "@ku0/code-workspace-client";
import { openUrl, showDesktopNotification } from "../application/runtime/facades/desktopHostFacade";
import type { RuntimeKernel } from "../application/runtime/kernel/runtimeKernelTypes";
import { RuntimePortsProvider } from "../application/runtime/ports";
import { RuntimeBootstrapEffects } from "../bootstrap/runtimeBootstrap";
import { desktopSettingsShellFraming } from "../features/settings/components/desktopSettingsShellFraming";
import { waitForCodexOauthBinding } from "../features/settings/components/sections/settings-codex-accounts-card/codexOauthBinding";
import { desktopWorkspaceNavigation } from "../features/workspaces/hooks/workspaceRoute";
import DesktopWorkspaceSurface from "./DesktopWorkspaceSurface";

const renderWorkspaceHost = createWorkspaceHostRenderer({
  effects: [RuntimeBootstrapEffects],
  providers: [RuntimePortsProvider],
});

export function createDesktopWorkspaceClientBindings(
  runtimeKernel: RuntimeKernel
): WorkspaceClientBindings {
  return createWorkspaceClientBindings({
    navigation: desktopWorkspaceNavigation,
    runtimeGateway: runtimeKernel.workspaceClientRuntimeGateway,
    runtime: runtimeKernel.workspaceClientRuntime,
    host: createDesktopWorkspaceClientHostBindings({
      openExternalUrl: openUrl,
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
    }),
    platformUi: {
      WorkspaceRuntimeShell,
      WorkspaceApp: DesktopWorkspaceSurface,
      renderWorkspaceHost,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  });
}
