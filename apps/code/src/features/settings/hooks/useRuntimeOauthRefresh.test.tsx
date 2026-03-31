// @vitest-environment jsdom

import { useEffect, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readActiveOauthPopupLoginId,
  setActiveOauthPopupLoginId,
} from "../components/sections/settings-codex-accounts-card/oauthHelpers";
import {
  type RuntimeUpdatedEvent,
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { useOauthPopupRefresh, useRuntimeOauthRefresh } from "./useRuntimeOauthRefresh";

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

beforeEach(() => {
  runtimeUpdatedListener = null;
  runtimeUpdatedRevisionCounter = 0;
  vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation(() => {
    const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
      EMPTY_RUNTIME_UPDATED_SNAPSHOT
    );

    useEffect(() => {
      const currentListener = (event: RuntimeUpdatedEvent) => {
        runtimeUpdatedRevisionCounter += 1;
        setSnapshot({
          revision: runtimeUpdatedRevisionCounter,
          lastEvent: event,
        });
      };
      runtimeUpdatedListener = currentListener;
      return () => {
        if (runtimeUpdatedListener === currentListener) {
          runtimeUpdatedListener = null;
        }
      };
    }, []);

    return snapshot;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setActiveOauthPopupLoginId(null);
});

function emitRuntimeUpdatedOauth(params: Record<string, unknown>) {
  runtimeUpdatedListener?.({
    event: {
      workspace_id: "workspace-1",
      message: {
        method: "runtime/updated",
        params,
      },
    },
    params,
    scope: Array.isArray(params.scope)
      ? params.scope.filter((entry): entry is string => typeof entry === "string")
      : ["oauth"],
    reason: typeof params.reason === "string" ? params.reason : "",
    eventWorkspaceId: "workspace-1",
    paramsWorkspaceId: null,
    isWorkspaceLocalEvent: false,
  });
}

describe("useRuntimeOauthRefresh", () => {
  it("dedupes runtime updates by revision when a revision ref is provided", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();
    const lastRuntimeUpdatedRevisionRef = { current: null as string | null };

    renderHook(() =>
      useRuntimeOauthRefresh({
        lastRuntimeUpdatedRevisionRef,
        refreshOAuthState,
        setError,
      })
    );

    await act(async () => {
      emitRuntimeUpdatedOauth({ revision: "41", scope: ["oauth"] });
    });
    await act(async () => {
      emitRuntimeUpdatedOauth({ revision: "41", scope: ["oauth"] });
    });
    await act(async () => {
      emitRuntimeUpdatedOauth({ revision: "42", scope: ["oauth"] });
    });

    expect(refreshOAuthState).toHaveBeenCalledTimes(2);
    expect(lastRuntimeUpdatedRevisionRef.current).toBe("42");
  });

  it("surfaces oauth failures without refreshing", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();

    renderHook(() =>
      useRuntimeOauthRefresh({
        refreshOAuthState,
        setError,
      })
    );

    await act(async () => {
      emitRuntimeUpdatedOauth({
        oauthLoginSuccess: false,
        oauthLoginError: "Failed to exchange OAuth id_token for API key.",
      });
    });

    expect(setError).toHaveBeenCalledWith("Failed to exchange OAuth id_token for API key.");
    expect(refreshOAuthState).not.toHaveBeenCalled();
  });

  it("refreshes when runtime/updated oauth reports success", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();

    renderHook(() =>
      useRuntimeOauthRefresh({
        refreshOAuthState,
        setError,
      })
    );

    await act(async () => {
      emitRuntimeUpdatedOauth({
        scope: ["oauth"],
        reason: "oauth_codex_login_completed",
        oauthLoginId: "login-1",
        oauthLoginSuccess: true,
      });
    });

    expect(refreshOAuthState).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe("useOauthPopupRefresh", () => {
  it("refreshes on successful OAuth popup callback", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();
    setActiveOauthPopupLoginId("login-1");

    renderHook(() =>
      useOauthPopupRefresh({
        refreshOAuthState,
        setError,
      })
    );
    expect(readActiveOauthPopupLoginId()).toBe("login-1");

    await act(async () => {
      window.dispatchEvent(
        new window.MessageEvent("message", {
          data: {
            type: "fastcode:oauth:codex",
            success: true,
            loginId: "login-1",
          },
          origin: window.location.origin,
        })
      );
    });

    expect(refreshOAuthState).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it("surfaces popup callback failures without refreshing", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();
    setActiveOauthPopupLoginId("login-1");

    renderHook(() =>
      useOauthPopupRefresh({
        refreshOAuthState,
        setError,
      })
    );

    await act(async () => {
      window.dispatchEvent(
        new window.MessageEvent("message", {
          data: {
            type: "fastcode:oauth:codex",
            success: false,
            loginId: "login-1",
          },
          origin: window.location.origin,
        })
      );
    });

    expect(setError).toHaveBeenCalledWith(
      "Codex OAuth failed during callback verification. Check the OAuth popup for details."
    );
    expect(refreshOAuthState).not.toHaveBeenCalled();
  });

  it("ignores popup messages from unexpected origins or login ids", async () => {
    const refreshOAuthState = vi.fn();
    const setError = vi.fn();
    setActiveOauthPopupLoginId("login-expected");

    renderHook(() =>
      useOauthPopupRefresh({
        refreshOAuthState,
        setError,
      })
    );

    await act(async () => {
      window.dispatchEvent(
        new window.MessageEvent("message", {
          data: {
            type: "fastcode:oauth:codex",
            success: true,
            loginId: "login-expected",
          },
          origin: "https://evil.example",
        })
      );
    });

    await act(async () => {
      window.dispatchEvent(
        new window.MessageEvent("message", {
          data: {
            type: "fastcode:oauth:codex",
            success: true,
            loginId: "login-other",
          },
          origin: window.location.origin,
        })
      );
    });

    expect(refreshOAuthState).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });
});
