// @vitest-environment jsdom

import { act } from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openUrl } from "../../../application/runtime/facades/desktopHostFacade";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type ScopedRuntimeUpdatedEventSnapshot,
  type RuntimeUpdatedEvent,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  runCodexLogin,
} from "../../../application/runtime/ports/oauth";
import { listWorkspaces } from "../../../application/runtime/ports/workspaceCatalog";
import { useAccountPools } from "./useAccountPools";

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/oauth", async () => {
  const actual = await vi.importActual<typeof import("../../../application/runtime/ports/oauth")>(
    "../../../application/runtime/ports/oauth"
  );
  return {
    ...actual,
    getProvidersCatalog: vi.fn(),
    listOAuthAccounts: vi.fn(),
    listOAuthPoolMembers: vi.fn(),
    listOAuthPools: vi.fn(),
    runCodexLogin: vi.fn(),
  };
});

vi.mock("../../../application/runtime/ports/workspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

type HookResult = ReturnType<typeof useAccountPools>;

function Harness(props: { onChange: (value: HookResult) => void }) {
  const result = useAccountPools();
  props.onChange(result);
  return null;
}

let latest: HookResult | null = null;
let appServerListener: ((event: { workspace_id?: string; message?: unknown }) => void) | null =
  null;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const unlisten = vi.fn();
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

beforeEach(() => {
  latest = null;
  appServerListener = null;
  runtimeUpdatedListener = null;
  runtimeUpdatedRevisionCounter = 0;
  unlisten.mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((callback) => {
    appServerListener = callback as typeof appServerListener;
    return unlisten;
  });
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, callback) => {
    runtimeUpdatedListener = callback;
    return unlisten;
  });
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
  vi.mocked(listOAuthAccounts).mockResolvedValue([]);
  vi.mocked(listOAuthPools).mockResolvedValue([]);
  vi.mocked(getProvidersCatalog).mockResolvedValue([]);
  vi.mocked(listOAuthPoolMembers).mockResolvedValue([]);
  vi.mocked(listWorkspaces).mockResolvedValue([]);
  vi.mocked(runCodexLogin).mockResolvedValue({
    loginId: "login-1",
    authUrl: "",
    immediateSuccess: true,
  });
  vi.mocked(openUrl).mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function mount() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <Harness
        onChange={(value) => {
          latest = value;
        }}
      />
    );
  });
  return { root };
}

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

describe("useAccountPools", () => {
  it("refreshes on runtime updated oauth events", async () => {
    const { root } = await mount();

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      emitRuntimeUpdatedOauth({
        revision: "11",
        scope: ["oauth", "workspaces"],
        reason: "code_oauth_pool_upsert",
      });
    });

    expect(listOAuthAccounts).toHaveBeenCalledTimes(2);
    expect(listOAuthPools).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it("surfaces runtime oauth failures without refreshing", async () => {
    const { root } = await mount();

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      emitRuntimeUpdatedOauth({
        revision: "12",
        scope: ["oauth"],
        oauthLoginSuccess: false,
        oauthLoginError: "Failed to exchange OAuth id_token for API key.",
      });
    });

    expect(latest?.error).toBe("Failed to exchange OAuth id_token for API key.");
    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("refreshes on runtime-updated oauth login success", async () => {
    const { root } = await mount();

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      emitRuntimeUpdatedOauth({
        revision: "13",
        scope: ["oauth"],
        reason: "code_oauth_login_completed",
        oauthLoginSuccess: true,
      });
    });

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);
    expect(subscribeAppServerEvents).not.toHaveBeenCalled();

    await act(async () => {
      appServerListener?.({
        workspace_id: "workspace-1",
        message: {
          method: "account/login/completed",
          params: {
            loginId: "login-1",
            success: true,
          },
        },
      });
    });

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("starts codex login for the connected workspace and refreshes on immediate success", async () => {
    const { root } = await mount();
    vi.mocked(listWorkspaces).mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
    ]);
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-codex-1",
      authUrl: "",
      immediateSuccess: true,
    });

    expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    expect(listOAuthPools).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latest?.handleAddAccount();
    });

    expect(runCodexLogin).toHaveBeenCalledWith("workspace-1", { forceOAuth: true });
    expect(listOAuthAccounts).toHaveBeenCalledTimes(2);
    expect(listOAuthPools).toHaveBeenCalledTimes(2);
    expect(openUrl).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
