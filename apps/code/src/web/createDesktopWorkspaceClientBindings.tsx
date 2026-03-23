import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import { WorkspaceRuntimeShell } from "@ku0/code-workspace-client/runtime-shell";
import { createRuntimeKernel } from "../application/runtime/kernel/createRuntimeKernel";
import {
  openExternalUrlWithFallback,
  showDesktopNotification,
} from "../application/runtime/ports/tauriEnvironment";
import { desktopSettingsShellFraming } from "../features/settings/components/desktopSettingsShellFraming";
import { waitForCodexOauthBinding } from "../features/settings/components/sections/settings-codex-accounts-card/codexOauthBinding";
import { desktopWorkspaceNavigation } from "../features/workspaces/hooks/workspaceRoute";
import DesktopWorkspaceSurface from "./DesktopWorkspaceSurface";
import { renderCodeWorkspaceHost } from "./renderCodeWorkspaceHost";

export function createDesktopWorkspaceClientBindings(
  kernel = createRuntimeKernel()
): WorkspaceClientBindings {
  return {
    navigation: desktopWorkspaceNavigation,
    runtimeGateway: kernel.workspaceClientRuntimeGateway,
    runtime: kernel.workspaceClientRuntime,
    host: {
      platform: "desktop",
      intents: {
        openOauthAuthorizationUrl: async (url) => {
          await openExternalUrlWithFallback(url);
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
      notifications: {
        testSound: () => undefined,
        testSystemNotification: () => {
          void showDesktopNotification({
            title: "HugeCode desktop notifications",
            body: "Electron desktop notifications are connected.",
          });
        },
      },
      shell: {
        platformHint: "desktop",
      },
    },
    platformUi: {
      WorkspaceRuntimeShell,
      WorkspaceApp: DesktopWorkspaceSurface,
      renderWorkspaceHost: renderCodeWorkspaceHost,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}
