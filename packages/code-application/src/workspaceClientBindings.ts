import type { ComponentType } from "react";
import { createBindingFactory, createCapabilityRegistry } from "@ku0/code-platform-interfaces";
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

type WorkspaceClientHostCapabilityMap = {
  "host.oauth.openExternalUrl": CreateDesktopWorkspaceClientHostBindingsInput["openExternalUrl"];
  "host.oauth.waitForBinding": CreateDesktopWorkspaceClientHostBindingsInput["waitForOauthBinding"];
  "host.oauth.createPopupWindow": NonNullable<
    CreateDesktopWorkspaceClientHostBindingsInput["createOauthPopupWindow"]
  >;
  "host.notification.system": CreateDesktopWorkspaceClientHostBindingsInput["testSystemNotification"];
  "host.notification.sound": NonNullable<
    CreateDesktopWorkspaceClientHostBindingsInput["testSound"]
  >;
  "host.shell.readStartupStatus": NonNullable<
    CreateDesktopWorkspaceClientHostBindingsInput["readShellStartupStatus"]
  >;
};

export function createWorkspaceClientBindings<TBindings extends Record<string, unknown>>(
  input: CreateWorkspaceClientBindingsInput<TBindings>
) {
  return input;
}

export function createDesktopWorkspaceClientHostBindings(
  input: CreateDesktopWorkspaceClientHostBindingsInput
): WorkspaceClientHostBindings {
  const registry = createCapabilityRegistry<WorkspaceClientHostCapabilityMap>([
    {
      key: "host.oauth.openExternalUrl",
      capability: input.openExternalUrl,
      source: "desktop-host",
    },
    {
      key: "host.oauth.waitForBinding",
      capability: input.waitForOauthBinding,
      source: "desktop-host",
    },
    {
      key: "host.oauth.createPopupWindow",
      capability: input.createOauthPopupWindow ?? (() => null),
      source: "desktop-host",
    },
    {
      key: "host.notification.system",
      capability: input.testSystemNotification,
      source: "desktop-host",
    },
    {
      key: "host.notification.sound",
      capability: input.testSound ?? (() => undefined),
      source: "desktop-host",
    },
    ...(input.readShellStartupStatus
      ? ([
          {
            key: "host.shell.readStartupStatus",
            capability: input.readShellStartupStatus,
            source: "desktop-host",
          },
        ] as const)
      : []),
  ]);

  return createBindingFactory(registry)((capabilities) => ({
    platform: input.platform ?? "desktop",
    intents: {
      openOauthAuthorizationUrl: async (url) => {
        await capabilities.require("host.oauth.openExternalUrl")(url);
      },
      createOauthPopupWindow: capabilities.require("host.oauth.createPopupWindow"),
      waitForOauthBinding: capabilities.require("host.oauth.waitForBinding"),
    },
    notifications: {
      testSound: capabilities.require("host.notification.sound"),
      testSystemNotification: capabilities.require("host.notification.system"),
    },
    shell: {
      platformHint: input.platformHint ?? "desktop",
      readStartupStatus: capabilities.optional("host.shell.readStartupStatus"),
    },
  }));
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
