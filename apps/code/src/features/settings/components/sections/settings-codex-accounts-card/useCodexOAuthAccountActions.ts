import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import {
  runCodexLogin,
  type OAuthAccountSummary,
} from "../../../../../application/runtime/ports/tauriOauth";
import { formatError } from "../settingsCodexAccountsCardUtils";
import { launchCodexOAuthFlow } from "./codexOauthFlow";
import {
  listWorkspacesForOauth,
  maxCodexAccountTimestamp,
  OAUTH_LOGIN_DEFAULT_WORKSPACE_ID,
  openOAuthPopupWindow,
  openOAuthUrl,
  shouldUseWebOAuthPopup,
} from "./oauthHelpers";
import type { FormBusyAction } from "./types";

type UseCodexOAuthAccountActionsParams = {
  accounts: OAuthAccountSummary[];
  refreshOAuthState: () => Promise<void>;
  waitForCodexOauthBinding: (workspaceId: string, baselineUpdatedAt: number) => Promise<boolean>;
  setBusyAction: Dispatch<SetStateAction<FormBusyAction>>;
  setError: Dispatch<SetStateAction<string | null>>;
  isMountedRef: MutableRefObject<boolean>;
};

export function useCodexOAuthAccountActions({
  accounts,
  refreshOAuthState,
  waitForCodexOauthBinding,
  setBusyAction,
  setError,
  isMountedRef,
}: UseCodexOAuthAccountActionsParams) {
  const runCodexOAuthAction = useCallback(
    async ({
      action,
      busyToken,
      startErrorMessage,
    }: {
      action:
        | {
            kind: "add";
          }
        | {
            kind: "reauth";
            account: OAuthAccountSummary;
          };
      busyToken: FormBusyAction;
      startErrorMessage: string;
    }) => {
      setBusyAction(busyToken);
      setError(null);

      try {
        const { pendingSync } = await launchCodexOAuthFlow(
          {
            shouldUseWebOAuthPopup,
            openOAuthPopupWindow,
            listWorkspacesForOauth,
            runCodexLogin,
            openOAuthUrl,
            waitForCodexOauthBinding,
            refreshOAuthState,
          },
          {
            action,
            defaultWorkspaceId: OAUTH_LOGIN_DEFAULT_WORKSPACE_ID,
            baselineUpdatedAt: maxCodexAccountTimestamp(accounts),
          }
        );

        if (pendingSync) {
          void pendingSync.catch((nextError) => {
            if (isMountedRef.current) {
              setError(formatError(nextError, "Unable to refresh OAuth account state."));
            }
          });
        }
      } catch (nextError) {
        setError(formatError(nextError, startErrorMessage));
      } finally {
        setBusyAction(null);
      }
    },
    [accounts, isMountedRef, refreshOAuthState, setBusyAction, setError, waitForCodexOauthBinding]
  );

  const handleReauthenticateAccount = useCallback(
    async (account: OAuthAccountSummary) => {
      if (account.provider !== "codex") {
        return;
      }
      await runCodexOAuthAction({
        action: {
          kind: "reauth",
          account,
        },
        busyToken: `reauth-account:${account.accountId}`,
        startErrorMessage: `Unable to re-authenticate account ${account.accountId}.`,
      });
    },
    [runCodexOAuthAction]
  );

  const handleAddCodexAccount = useCallback(async () => {
    await runCodexOAuthAction({
      action: { kind: "add" },
      busyToken: "add-account",
      startErrorMessage: "Unable to start Codex OAuth sign-in.",
    });
  }, [runCodexOAuthAction]);

  return {
    handleAddCodexAccount,
    handleReauthenticateAccount,
  };
}
