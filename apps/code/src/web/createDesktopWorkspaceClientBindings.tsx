import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import { WorkspaceRuntimeShell } from "@ku0/code-workspace-client/runtime-shell";
import { openUrl, showDesktopNotification } from "../application/runtime/facades/desktopHostFacade";
import { createRuntimeKernel } from "../application/runtime/kernel/createRuntimeKernel";
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
    runtimeGateway: kernel.workspaceClientRuntimeGateway,
    runtime: kernel.workspaceClientRuntime,
    host: {
      platform: "desktop",
      intents: {
        openOauthAuthorizationUrl: async (url) => {
          await openUrl(url);
        },
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async (workspaceId, baselineUpdatedAt) =>
          waitForCodexOauthBinding(
            {
              getAccountInfo: kernel.workspaceClientRuntime.oauth.getAccountInfo,
              readCodexAccountsForOauthSync: () =>
                kernel.workspaceClientRuntime.oauth.listAccounts("codex"),
            },
            workspaceId,
            baselineUpdatedAt
          ),
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
