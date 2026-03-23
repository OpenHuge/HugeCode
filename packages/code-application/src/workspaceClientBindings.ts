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
};

export type WorkspaceClientHostBindings = {
  platform: WorkspaceClientHostPlatform;
  intents: WorkspaceClientHostIntentBindings;
  notifications: WorkspaceClientHostNotificationBindings;
  shell: WorkspaceClientHostShellBindings;
};

export type CreateWorkspaceClientBindingsInput<TBindings> = TBindings;

export type CreateDesktopWorkspaceClientHostBindingsInput = {
  openExternalUrl: (url: string) => Promise<unknown> | unknown;
  waitForOauthBinding: (workspaceId: string, baselineUpdatedAt: number) => Promise<boolean>;
  testSystemNotification: () => void;
  createOauthPopupWindow?: () => Window | null;
  platform?: WorkspaceClientHostPlatform;
  platformHint?: string | null;
  testSound?: () => void;
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
    },
  };
}
