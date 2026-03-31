import { getDefaultPrimaryPoolIdForProvider } from "../../../application/runtime/facades/runtimeOauthPrimaryPool";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  bindOAuthPoolAccount,
  cancelCodexLogin,
  runCodexLogin,
} from "../../../application/runtime/ports/oauth";
import type { AccountSnapshot } from "../../../types";
import {
  openOAuthPopupWindow,
  openOAuthUrl,
  shouldUseWebOAuthPopup,
} from "../../settings/components/sections/settings-codex-accounts-card/oauthHelpers";

type UseAccountSwitchingArgs = {
  activeWorkspaceId: string | null;
  fallbackWorkspaceId?: string | null;
  accountByWorkspace: Record<string, AccountSnapshot | null | undefined>;
  refreshAccountInfo: (workspaceId: string) => Promise<void> | void;
  refreshAccountRateLimits: (workspaceId: string) => Promise<void> | void;
  alertError: (error: unknown) => void;
};

type UseAccountSwitchingResult = {
  activeAccount: AccountSnapshot | null;
  accountSwitching: boolean;
  accountSwitchError: string | null;
  handleSwitchAccount: () => Promise<void>;
  handleSelectLoggedInCodexAccount: (accountId: string) => Promise<void>;
  handleCancelSwitchAccount: () => Promise<void>;
};

export function useAccountSwitching({
  activeWorkspaceId,
  fallbackWorkspaceId = null,
  accountByWorkspace,
  refreshAccountInfo,
  refreshAccountRateLimits,
  alertError,
}: UseAccountSwitchingArgs): UseAccountSwitchingResult {
  const [accountSwitching, setAccountSwitching] = useState(false);
  const [accountSwitchError, setAccountSwitchError] = useState<string | null>(null);
  const accountSwitchCanceledRef = useRef(false);
  const loginIdRef = useRef<string | null>(null);
  const loginWorkspaceIdRef = useRef<string | null>(null);
  const accountSwitchingRef = useRef(false);
  const activeWorkspaceIdRef = useRef<string | null>(activeWorkspaceId);
  const fallbackWorkspaceIdRef = useRef<string | null>(fallbackWorkspaceId);
  const homeRefreshWorkspaceIdRef = useRef<string | null>(null);
  const refreshAccountInfoRef = useRef(refreshAccountInfo);
  const refreshAccountRateLimitsRef = useRef(refreshAccountRateLimits);
  const alertErrorRef = useRef(alertError);

  const activeAccount = useMemo(() => {
    // These ids are local project workspace ids. They intentionally do not
    // carry ChatGPT workspace identity, which is modeled separately through
    // `chatgptWorkspaceId` in runtime OAuth RPCs.
    const projectWorkspaceId = activeWorkspaceId ?? fallbackWorkspaceId;
    if (!projectWorkspaceId) {
      return null;
    }
    return accountByWorkspace[projectWorkspaceId] ?? null;
  }, [activeWorkspaceId, accountByWorkspace, fallbackWorkspaceId]);

  const isCodexLoginCanceled = useCallback((error: unknown) => {
    const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    return (
      normalized.includes("codex login canceled") ||
      normalized.includes("codex login cancelled") ||
      normalized.includes("request canceled")
    );
  }, []);

  useEffect(() => {
    accountSwitchingRef.current = accountSwitching;
  }, [accountSwitching]);

  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  useEffect(() => {
    fallbackWorkspaceIdRef.current = fallbackWorkspaceId;
  }, [fallbackWorkspaceId]);

  useEffect(() => {
    refreshAccountInfoRef.current = refreshAccountInfo;
  }, [refreshAccountInfo]);

  useEffect(() => {
    refreshAccountRateLimitsRef.current = refreshAccountRateLimits;
  }, [refreshAccountRateLimits]);

  useEffect(() => {
    alertErrorRef.current = alertError;
  }, [alertError]);

  useEffect(() => {
    if (activeWorkspaceId || !fallbackWorkspaceId || accountByWorkspace[fallbackWorkspaceId]) {
      homeRefreshWorkspaceIdRef.current = null;
      return;
    }
    if (homeRefreshWorkspaceIdRef.current === fallbackWorkspaceId) {
      return;
    }
    homeRefreshWorkspaceIdRef.current = fallbackWorkspaceId;
    void refreshAccountInfoRef.current(fallbackWorkspaceId);
    void refreshAccountRateLimitsRef.current(fallbackWorkspaceId);
  }, [activeWorkspaceId, accountByWorkspace, fallbackWorkspaceId]);

  useEffect(() => {
    const currentWorkspaceId = activeWorkspaceId;
    const inFlightWorkspaceId = loginWorkspaceIdRef.current;
    if (
      accountSwitchingRef.current &&
      inFlightWorkspaceId &&
      currentWorkspaceId &&
      inFlightWorkspaceId !== currentWorkspaceId
    ) {
      // The user navigated away from the workspace that initiated the login.
      // Keep tracking the in-flight login, but clear the switching indicator.
      setAccountSwitching(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const unlistenRuntimeUpdated = subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: () =>
          loginWorkspaceIdRef.current ??
          activeWorkspaceIdRef.current ??
          fallbackWorkspaceIdRef.current,
        scopes: ["oauth"],
      },
      ({ params }) => {
        const resolvedWorkspaceId =
          loginWorkspaceIdRef.current ??
          activeWorkspaceIdRef.current ??
          fallbackWorkspaceIdRef.current;
        if (!resolvedWorkspaceId) {
          return;
        }
        const hasTrackedLogin = Boolean(loginWorkspaceIdRef.current);
        if (
          (!accountSwitchingRef.current && !hasTrackedLogin) ||
          accountSwitchCanceledRef.current
        ) {
          return;
        }
        const reason = String(params.reason ?? "").trim();
        if (reason === "stream_reconnected") {
          return;
        }
        const oauthLoginId = String(params.oauthLoginId ?? params.oauth_login_id ?? "").trim();
        if (loginIdRef.current && oauthLoginId && loginIdRef.current !== oauthLoginId) {
          return;
        }
        const oauthLoginSuccessRaw = params.oauthLoginSuccess ?? params.oauth_login_success;
        const oauthLoginSuccess =
          typeof oauthLoginSuccessRaw === "boolean" ? oauthLoginSuccessRaw : null;
        const oauthLoginError = String(
          params.oauthLoginError ?? params.oauth_login_error ?? ""
        ).trim();
        if (oauthLoginSuccess === false) {
          if (oauthLoginError) {
            setAccountSwitchError(oauthLoginError);
            alertErrorRef.current(oauthLoginError);
          }
          setAccountSwitching(false);
          accountSwitchCanceledRef.current = false;
          loginIdRef.current = null;
          loginWorkspaceIdRef.current = null;
          return;
        }
        setAccountSwitchError(null);
        void refreshAccountInfoRef.current(resolvedWorkspaceId);
        void refreshAccountRateLimitsRef.current(resolvedWorkspaceId);
        setAccountSwitching(false);
        accountSwitchCanceledRef.current = false;
        loginIdRef.current = null;
        loginWorkspaceIdRef.current = null;
      }
    );

    return () => {
      unlistenRuntimeUpdated();
    };
  }, []);

  const handleSwitchAccount = useCallback(async () => {
    const projectWorkspaceId = activeWorkspaceId ?? fallbackWorkspaceId;
    if (!projectWorkspaceId || accountSwitching) {
      return;
    }
    accountSwitchCanceledRef.current = false;
    setAccountSwitchError(null);
    setAccountSwitching(true);
    loginIdRef.current = null;
    loginWorkspaceIdRef.current = projectWorkspaceId;
    const oauthPopup = shouldUseWebOAuthPopup() ? openOAuthPopupWindow() : null;
    if (shouldUseWebOAuthPopup() && !oauthPopup) {
      setAccountSwitching(false);
      setAccountSwitchError(
        "OAuth popup was blocked. Please allow pop-ups for this site and try again."
      );
      alertError("OAuth popup was blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    try {
      // `runCodexLogin` still accepts the project workspace id because the
      // login/session flow is initiated from the local workspace context.
      const { loginId, authUrl, immediateSuccess } = await runCodexLogin(projectWorkspaceId, {
        forceOAuth: true,
      });

      if (immediateSuccess) {
        if (oauthPopup && !oauthPopup.closed) {
          oauthPopup.close();
        }
        loginIdRef.current = null;
        loginWorkspaceIdRef.current = null;
        setAccountSwitching(false);
        accountSwitchCanceledRef.current = false;
        setAccountSwitchError(null);
        await Promise.resolve(refreshAccountInfoRef.current(projectWorkspaceId));
        await Promise.resolve(refreshAccountRateLimitsRef.current(projectWorkspaceId));
        return;
      }

      if (accountSwitchCanceledRef.current) {
        if (oauthPopup && !oauthPopup.closed) {
          oauthPopup.close();
        }
        loginIdRef.current = loginId;
        try {
          await cancelCodexLogin(projectWorkspaceId);
        } catch {
          // Best effort: the user already canceled.
        }
        setAccountSwitching(false);
        accountSwitchCanceledRef.current = false;
        loginIdRef.current = null;
        loginWorkspaceIdRef.current = null;
        setAccountSwitchError(null);
        return;
      }

      loginIdRef.current = loginId;
      if (authUrl.trim().length > 0) {
        try {
          await openOAuthUrl(authUrl, oauthPopup);
        } catch (openError) {
          alertErrorRef.current(openError);
          throw openError;
        }
      } else if (oauthPopup && !oauthPopup.closed) {
        oauthPopup.close();
      }
    } catch (error) {
      if (oauthPopup && !oauthPopup.closed) {
        oauthPopup.close();
      }
      if (accountSwitchCanceledRef.current || isCodexLoginCanceled(error)) {
        setAccountSwitching(false);
        accountSwitchCanceledRef.current = false;
        loginIdRef.current = null;
        loginWorkspaceIdRef.current = null;
        setAccountSwitchError(null);
        return;
      }
      setAccountSwitchError(
        typeof error === "string"
          ? error
          : error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to switch Codex account."
      );
      alertError(error);
      if (loginIdRef.current) {
        try {
          await cancelCodexLogin(projectWorkspaceId);
        } catch {
          // Ignore cancel errors here; we already surfaced the primary failure.
        }
      }
      setAccountSwitching(false);
      accountSwitchCanceledRef.current = false;
      loginIdRef.current = null;
      loginWorkspaceIdRef.current = null;
    } finally {
      // Completion is now driven by app-server events.
    }
  }, [
    activeWorkspaceId,
    fallbackWorkspaceId,
    accountSwitching,
    alertError,
    isCodexLoginCanceled,
    openOAuthPopupWindow,
  ]);

  const handleSelectLoggedInCodexAccount = useCallback(
    async (accountId: string) => {
      const projectWorkspaceId = activeWorkspaceId ?? fallbackWorkspaceId;
      const normalizedAccountId = accountId.trim();
      if (!projectWorkspaceId || !normalizedAccountId || accountSwitching) {
        return;
      }
      accountSwitchCanceledRef.current = false;
      setAccountSwitchError(null);
      setAccountSwitching(true);
      try {
        await bindOAuthPoolAccount({
          poolId: getDefaultPrimaryPoolIdForProvider("codex"),
          sessionId: projectWorkspaceId,
          accountId: normalizedAccountId,
        });
        await Promise.resolve(refreshAccountInfoRef.current(projectWorkspaceId));
        await Promise.resolve(refreshAccountRateLimitsRef.current(projectWorkspaceId));
      } catch (error) {
        setAccountSwitchError(
          typeof error === "string"
            ? error
            : error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Unable to bind the selected Codex account to this project workspace."
        );
        alertError(error);
      } finally {
        setAccountSwitching(false);
      }
    },
    [activeWorkspaceId, alertError, accountSwitching, fallbackWorkspaceId]
  );

  const handleCancelSwitchAccount = useCallback(async () => {
    const targetWorkspaceId =
      loginWorkspaceIdRef.current ?? activeWorkspaceId ?? fallbackWorkspaceId;
    if (!targetWorkspaceId || (!accountSwitchingRef.current && !loginWorkspaceIdRef.current)) {
      return;
    }
    accountSwitchCanceledRef.current = true;
    try {
      await cancelCodexLogin(targetWorkspaceId);
    } catch (error) {
      setAccountSwitchError(
        typeof error === "string"
          ? error
          : error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to cancel Codex account switch."
      );
      alertError(error);
    } finally {
      setAccountSwitching(false);
      loginIdRef.current = null;
      loginWorkspaceIdRef.current = null;
    }
  }, [activeWorkspaceId, alertError, fallbackWorkspaceId]);

  return {
    activeAccount,
    accountSwitching,
    accountSwitchError,
    handleSwitchAccount,
    handleSelectLoggedInCodexAccount,
    handleCancelSwitchAccount,
  };
}
