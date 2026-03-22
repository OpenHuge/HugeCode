import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/tauriOauth";

export type CodexOAuthAction =
  | {
      kind: "add";
    }
  | {
      kind: "reauth";
      account: Pick<OAuthAccountSummary, "accountId" | "externalAccountId">;
    };

export type CodexOAuthWorkspace = {
  id: string;
  connected: boolean;
};

export class CodexOAuthPopupBlockedError extends Error {
  constructor() {
    super("OAuth popup was blocked. Please allow pop-ups for this site and try again.");
    this.name = "CodexOAuthPopupBlockedError";
  }
}

export class CodexOAuthSyncNotDetectedError extends Error {
  constructor() {
    super(
      "OAuth completed but account sync was not detected. Check runtime service logs and retry."
    );
    this.name = "CodexOAuthSyncNotDetectedError";
  }
}

type CodexLoginResult = {
  authUrl: string;
  immediateSuccess?: boolean;
};

type LaunchCodexOAuthFlowDeps = {
  shouldUseWebOAuthPopup(): boolean;
  openOAuthPopupWindow(): Window | null;
  listWorkspacesForOauth(): Promise<CodexOAuthWorkspace[]>;
  runCodexLogin(workspaceId: string, options: { forceOAuth: true }): Promise<CodexLoginResult>;
  openOAuthUrl(authUrl: string, popup: Window | null): Promise<void>;
  waitForCodexOauthBinding(workspaceId: string, baselineUpdatedAt: number): Promise<boolean>;
  refreshOAuthState(): Promise<void>;
};

type LaunchCodexOAuthFlowInput = {
  action: CodexOAuthAction;
  defaultWorkspaceId: string;
  baselineUpdatedAt: number;
};

type LaunchCodexOAuthFlowResult = {
  workspaceId: string;
  pendingSync: Promise<void> | null;
};

function closePopupWindow(popup: Window | null): void {
  if (!popup || popup.closed) {
    return;
  }
  popup.close();
}

export function resolveCodexOAuthWorkspaceId(input: {
  action: CodexOAuthAction;
  workspaces: readonly CodexOAuthWorkspace[];
  defaultWorkspaceId: string;
}): string {
  const preferredWorkspaceId =
    input.action.kind === "reauth" ? input.action.account.externalAccountId?.trim() || null : null;
  const preferredWorkspace =
    preferredWorkspaceId === null
      ? null
      : (input.workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? null);
  const connectedWorkspace = input.workspaces.find((workspace) => workspace.connected) ?? null;
  return (
    preferredWorkspace?.id ??
    connectedWorkspace?.id ??
    input.workspaces[0]?.id ??
    input.defaultWorkspaceId
  );
}

export async function launchCodexOAuthFlow(
  deps: LaunchCodexOAuthFlowDeps,
  input: LaunchCodexOAuthFlowInput
): Promise<LaunchCodexOAuthFlowResult> {
  const popup = deps.shouldUseWebOAuthPopup() ? deps.openOAuthPopupWindow() : null;
  if (deps.shouldUseWebOAuthPopup() && !popup) {
    throw new CodexOAuthPopupBlockedError();
  }

  try {
    const workspaces = await deps.listWorkspacesForOauth().catch(() => []);
    const workspaceId = resolveCodexOAuthWorkspaceId({
      action: input.action,
      workspaces,
      defaultWorkspaceId: input.defaultWorkspaceId,
    });
    const { authUrl, immediateSuccess } = await deps.runCodexLogin(workspaceId, {
      forceOAuth: true,
    });

    if (immediateSuccess) {
      closePopupWindow(popup);
      await deps.refreshOAuthState();
      return {
        workspaceId,
        pendingSync: null,
      };
    }

    await deps.openOAuthUrl(authUrl, popup);

    return {
      workspaceId,
      pendingSync: (async () => {
        const synced = await deps.waitForCodexOauthBinding(workspaceId, input.baselineUpdatedAt);
        if (!synced) {
          throw new CodexOAuthSyncNotDetectedError();
        }
        await deps.refreshOAuthState();
      })(),
    };
  } catch (error) {
    closePopupWindow(popup);
    throw error;
  }
}
