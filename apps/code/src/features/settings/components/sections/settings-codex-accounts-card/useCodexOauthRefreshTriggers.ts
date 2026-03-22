import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  useOauthPopupRefresh,
  useRuntimeOauthRefresh,
} from "../../../hooks/useRuntimeOauthRefresh";

type RuntimeOauthRefreshOptions = {
  lastRuntimeUpdatedRevisionRef: MutableRefObject<string | null>;
  refreshOAuthState: () => void | Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
};

type PopupOauthRefreshOptions = {
  refreshOAuthState: () => void | Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useCodexRuntimeOauthRefresh({
  lastRuntimeUpdatedRevisionRef,
  refreshOAuthState,
  setError,
}: RuntimeOauthRefreshOptions) {
  useRuntimeOauthRefresh({
    lastRuntimeUpdatedRevisionRef,
    refreshOAuthState,
    setError,
  });
}

export function useCodexOauthPopupRefresh({
  refreshOAuthState,
  setError,
}: PopupOauthRefreshOptions) {
  useOauthPopupRefresh({
    refreshOAuthState,
    setError,
  });
}
