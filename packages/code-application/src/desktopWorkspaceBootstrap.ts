import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import type {
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeGatewayBindings,
} from "@ku0/code-workspace-client/workspace-bindings";
import type { WorkspaceNavigationAdapter } from "@ku0/code-workspace-client/workspace-navigation";
import {
  createDesktopWorkspaceClientBindings,
  type CreateDesktopWorkspaceClientHostBindingsInput,
  type WorkspaceClientPlatformUiInput,
} from "./workspaceClientBindings";

export type DesktopWorkspaceRuntimeKernel = {
  workspaceClientRuntimeGateway: WorkspaceClientRuntimeGatewayBindings;
  workspaceClientRuntime: WorkspaceClientRuntimeBindings;
};

export type CreateDesktopWorkspaceBootstrapInput = WorkspaceClientPlatformUiInput &
  CreateDesktopWorkspaceClientHostBindingsInput & {
    navigation: WorkspaceNavigationAdapter;
    runtimeKernel: DesktopWorkspaceRuntimeKernel;
  };

export function createDesktopWorkspaceBootstrap(
  input: CreateDesktopWorkspaceBootstrapInput
): WorkspaceClientBindings {
  return createDesktopWorkspaceClientBindings({
    navigation: input.navigation,
    runtimeGateway: input.runtimeKernel.workspaceClientRuntimeGateway,
    runtime: input.runtimeKernel.workspaceClientRuntime,
    openExternalUrl: input.openExternalUrl,
    waitForOauthBinding: input.waitForOauthBinding,
    testSystemNotification: input.testSystemNotification,
    createOauthPopupWindow: input.createOauthPopupWindow,
    platform: input.platform,
    platformHint: input.platformHint,
    readShellStartupStatus: input.readShellStartupStatus,
    testSound: input.testSound,
    WorkspaceApp: input.WorkspaceApp,
    WorkspaceRuntimeShell: input.WorkspaceRuntimeShell,
    settingsShellFraming: input.settingsShellFraming,
    hostEffects: input.hostEffects,
    hostProviders: input.hostProviders,
  });
}
