import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from "react";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import { useScopedRuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { getAppServerParams, getAppServerRawMethod } from "../../../utils/appServerEvents";
import {
  clearActiveOauthPopupLoginId,
  OAUTH_POPUP_MESSAGE_TYPE,
  readActiveOauthPopupLoginId,
  resolveAllowedOauthPopupOrigins,
} from "../components/sections/settings-codex-accounts-card/oauthHelpers";

type UseRuntimeOauthRefreshOptions = {
  lastRuntimeUpdatedRevisionRef?: MutableRefObject<string | null>;
  refreshOAuthState: () => void | Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
};

function normalizeRuntimeUpdatedRevision(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return null;
}

export function useRuntimeOauthRefresh({
  lastRuntimeUpdatedRevisionRef,
  refreshOAuthState,
  setError,
}: UseRuntimeOauthRefreshOptions) {
  const runtimeUpdatedEvent = useScopedRuntimeUpdatedEvent({
    scopes: ["oauth"],
  });

  useEffect(() => {
    const params = runtimeUpdatedEvent.lastEvent?.params;
    if (!params) {
      return;
    }

    if (lastRuntimeUpdatedRevisionRef) {
      const revision = normalizeRuntimeUpdatedRevision(params.revision);
      if (revision && revision === lastRuntimeUpdatedRevisionRef.current) {
        return;
      }
      if (revision) {
        lastRuntimeUpdatedRevisionRef.current = revision;
      }
    }

    const oauthLoginSuccessRaw = params.oauthLoginSuccess ?? params.oauth_login_success;
    const oauthLoginSuccess =
      typeof oauthLoginSuccessRaw === "boolean" ? oauthLoginSuccessRaw : null;
    const oauthLoginErrorRaw = params.oauthLoginError ?? params.oauth_login_error;
    const oauthLoginError = typeof oauthLoginErrorRaw === "string" ? oauthLoginErrorRaw.trim() : "";
    if (oauthLoginSuccess === false) {
      if (oauthLoginError.length > 0) {
        setError(oauthLoginError);
      }
      return;
    }

    void refreshOAuthState();
  }, [lastRuntimeUpdatedRevisionRef, refreshOAuthState, runtimeUpdatedEvent, setError]);

  useEffect(() => {
    const unlistenAccountLogin = subscribeAppServerEvents((event) => {
      const method = getAppServerRawMethod(event);
      if (!method) {
        return;
      }
      const params = getAppServerParams(event);
      if (method === "account/login/completed" && params.success === true) {
        void refreshOAuthState();
      }
    });

    return () => {
      unlistenAccountLogin();
    };
  }, [refreshOAuthState]);
}

export function useOauthPopupRefresh({
  refreshOAuthState,
  setError,
}: Omit<UseRuntimeOauthRefreshOptions, "lastRuntimeUpdatedRevisionRef">) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOauthPopupMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }
      const allowedOrigins = resolveAllowedOauthPopupOrigins();
      const messageOrigin = event.origin || window.location.origin;
      if (!allowedOrigins.has(messageOrigin)) {
        return;
      }
      const record = payload as Record<string, unknown>;
      if (record.type !== OAUTH_POPUP_MESSAGE_TYPE) {
        return;
      }
      const activeLoginId = readActiveOauthPopupLoginId();
      if (
        typeof record.loginId !== "string" ||
        record.loginId.length === 0 ||
        record.loginId !== activeLoginId
      ) {
        return;
      }
      clearActiveOauthPopupLoginId();
      if (record.success === true) {
        void refreshOAuthState();
        return;
      }
      setError(
        "Codex OAuth failed during callback verification. Check the OAuth popup for details."
      );
    };

    window.addEventListener("message", handleOauthPopupMessage);
    return () => {
      window.removeEventListener("message", handleOauthPopupMessage);
    };
  }, [refreshOAuthState, setError]);
}
