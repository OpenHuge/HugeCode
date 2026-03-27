import type { ComponentType } from "react";
import {
  createBrowserWorkspaceClientHostBindings,
  createBrowserWorkspaceClientRuntimeBindings,
  createBrowserWorkspaceClientRuntimeGatewayBindings,
} from "@ku0/code-workspace-client/workspace-browser-bindings";
import type {
  WorkspaceClientBindings,
  WorkspaceClientHostStartupStatus,
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeGatewayBindings,
} from "@ku0/code-workspace-client/workspace-bindings";
import { WorkspaceRuntimeShell } from "@ku0/code-workspace-client/runtime-shell";
import type { SettingsShellFraming } from "@ku0/code-workspace-client/settings-shell-types";
import type { WorkspaceNavigationAdapter } from "@ku0/code-workspace-client/workspace-navigation";
import {
  BrowserRuntimeBootstrapEffects,
  createWorkspaceHostRenderer,
  type WorkspaceHostEffect,
  type WorkspaceHostProvider,
} from "./workspaceHostRenderer";

export type WorkspaceClientHostPlatform = "desktop" | "web";

export type WorkspaceClientHostIntentBindings = {
  openOauthAuthorizationUrl: (url: string, popup: Window | null) => Promise<void>;
  createOauthPopupWindow: () => Window | null;
  waitForOauthBinding: (workspaceId: string, baselineUpdatedAt: number) => Promise<boolean>;
};

export type WorkspaceClientHostNotificationBindings = {
  testSound: () => void;
  testSystemNotification: () => void;
};

export type WorkspaceClientHostShellBindings = {
  platformHint?: string | null;
  readStartupStatus?: () => Promise<WorkspaceClientHostStartupStatus | null>;
};

export type WorkspaceClientHostBindings = {
  platform: WorkspaceClientHostPlatform;
  intents: WorkspaceClientHostIntentBindings;
  notifications: WorkspaceClientHostNotificationBindings;
  shell: WorkspaceClientHostShellBindings;
};

export type CreateWorkspaceClientBindingsInput<TBindings> = TBindings;

export type WorkspaceClientPlatformUiInput = {
  WorkspaceApp: ComponentType;
  WorkspaceRuntimeShell?: ComponentType;
  settingsShellFraming: SettingsShellFraming;
  hostEffects?: readonly WorkspaceHostEffect[];
  hostProviders?: readonly WorkspaceHostProvider[];
};

export type CreateDesktopWorkspaceClientHostBindingsInput = {
  openExternalUrl: (url: string) => Promise<unknown> | unknown;
  waitForOauthBinding: (workspaceId: string, baselineUpdatedAt: number) => Promise<boolean>;
  testSystemNotification: () => void;
  createOauthPopupWindow?: () => Window | null;
  platform?: WorkspaceClientHostPlatform;
  platformHint?: string | null;
  readShellStartupStatus?: () => Promise<WorkspaceClientHostStartupStatus | null>;
  testSound?: () => void;
};

export type CreateWebWorkspaceClientBindingsInput = WorkspaceClientPlatformUiInput & {
  navigation: WorkspaceNavigationAdapter;
};

export type CreateDesktopWorkspaceClientBindingsInput = WorkspaceClientPlatformUiInput &
  CreateDesktopWorkspaceClientHostBindingsInput & {
    navigation: WorkspaceNavigationAdapter;
    runtimeGateway: WorkspaceClientRuntimeGatewayBindings;
    runtime: WorkspaceClientRuntimeBindings;
  };

export function createWorkspaceClientBindings<TBindings extends Record<string, unknown>>(
  input: CreateWorkspaceClientBindingsInput<TBindings>
) {
  return input;
}

export function createDesktopWorkspaceClientHostBindings(
  input: CreateDesktopWorkspaceClientHostBindingsInput
): WorkspaceClientHostBindings {
  return {
    platform: input.platform ?? "desktop",
    intents: {
      openOauthAuthorizationUrl: async (url) => {
        await input.openExternalUrl(url);
      },
      createOauthPopupWindow: input.createOauthPopupWindow ?? (() => null),
      waitForOauthBinding: input.waitForOauthBinding,
    },
    notifications: {
      testSound: input.testSound ?? (() => undefined),
      testSystemNotification: input.testSystemNotification,
    },
    shell: {
      platformHint: input.platformHint ?? "desktop",
      readStartupStatus: input.readShellStartupStatus,
    },
  };
}

function createPlatformUiBindings(
  input: WorkspaceClientPlatformUiInput,
  bootstrapEffects: readonly WorkspaceHostEffect[] = []
) {
  return {
    WorkspaceRuntimeShell: input.WorkspaceRuntimeShell ?? WorkspaceRuntimeShell,
    WorkspaceApp: input.WorkspaceApp,
    renderWorkspaceHost: createWorkspaceHostRenderer({
      effects: [...bootstrapEffects, ...(input.hostEffects ?? [])],
      providers: input.hostProviders,
    }),
    settingsShellFraming: input.settingsShellFraming,
  };
}

export function createWebWorkspaceClientBindings(
  input: CreateWebWorkspaceClientBindingsInput
): WorkspaceClientBindings {
  return createWorkspaceClientBindings({
    navigation: input.navigation,
    runtimeGateway: createBrowserWorkspaceClientRuntimeGatewayBindings(),
    runtime: createBrowserWorkspaceClientRuntimeBindings(),
    host: createBrowserWorkspaceClientHostBindings(),
    platformUi: createPlatformUiBindings(input, [BrowserRuntimeBootstrapEffects]),
  });
}

export function createDesktopWorkspaceClientBindings(
  input: CreateDesktopWorkspaceClientBindingsInput
): WorkspaceClientBindings {
  return createWorkspaceClientBindings({
    navigation: input.navigation,
    runtimeGateway: input.runtimeGateway,
    runtime: input.runtime,
    host: createDesktopWorkspaceClientHostBindings(input),
    platformUi: createPlatformUiBindings(input),
  });
}
