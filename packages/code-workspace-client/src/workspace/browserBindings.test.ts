import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY } from "@ku0/code-platform-interfaces";
import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";
import {
  createBrowserWorkspaceClientRuntimeBindings,
  createBrowserWorkspaceClientRuntimeGatewayBindings,
} from "./browserBindings";

const originalRuntimeGatewayEndpoint = process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY];

describe("browser workspace bindings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalRuntimeGatewayEndpoint) {
      process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = originalRuntimeGatewayEndpoint;
    } else {
      delete process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY];
    }
    window.localStorage.clear();
  });

  it("updates browser runtime mode when a manual gateway target is configured", () => {
    const runtimeGateway = createBrowserWorkspaceClientRuntimeGatewayBindings();
    const listener = vi.fn();
    const unsubscribe = runtimeGateway.subscribeRuntimeMode(listener);

    expect(runtimeGateway.readRuntimeMode()).toBe("discoverable");

    runtimeGateway.configureManualWebRuntimeGatewayTarget({
      host: "127.0.0.1",
      port: 8788,
    });

    expect(runtimeGateway.readRuntimeMode()).toBe("connected");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("routes browser agent control launch through canonical runtime run v2 rpc methods", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          id: "job-1",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();

    await runtime.agentControl.prepareRuntimeRun(
      {} as Parameters<typeof runtime.agentControl.prepareRuntimeRun>[0]
    );
    await runtime.agentControl.startRuntimeRun(
      {} as Parameters<typeof runtime.agentControl.startRuntimeRun>[0]
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const prepareRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      method?: string;
    };
    const startRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      method?: string;
    };
    expect(prepareRequest.method).toBe(CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2);
    expect(startRequest.method).toBe(CODE_RUNTIME_RPC_METHODS.RUN_START_V2);
  });

  it("routes browser sub-agent control through canonical runtime sub-agent rpc methods", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          sessionId: "session-1",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();

    await runtime.subAgents.spawn({ workspaceId: "workspace-1" });
    await runtime.subAgents.send({ sessionId: "session-1", instruction: "Inspect runtime truth." });
    await runtime.subAgents.wait({ sessionId: "session-1" });
    await runtime.subAgents.status({ sessionId: "session-1" });
    await runtime.subAgents.interrupt({ sessionId: "session-1" });
    await runtime.subAgents.close({ sessionId: "session-1" });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const methods = fetchMock.mock.calls.map((call) => {
      const request = JSON.parse(String(call[1]?.body)) as { method?: string };
      return request.method;
    });
    expect(methods).toEqual([
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN,
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SEND,
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT,
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS,
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT,
      CODE_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE,
    ]);
  });

  it("prefers kernel projection bootstrap truth for mission control", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method?: string };
      if (request.method === CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              revision: 4,
              sliceRevisions: { mission_control: 4 },
              slices: {
                mission_control: {
                  source: "runtime_snapshot_v1",
                  generatedAt: 1,
                  workspaces: [],
                  tasks: [],
                  runs: [],
                  reviewPacks: [
                    {
                      id: "review-pack-1",
                      workspaceId: "workspace-1",
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            source: "runtime_snapshot_v1",
            generatedAt: 2,
            workspaces: [],
            tasks: [],
            runs: [],
            reviewPacks: [],
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();
    const snapshot = await runtime.missionControl.readMissionControlSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.reviewPacks).toHaveLength(1);
    expect(snapshot.reviewPacks[0]?.id).toBe("review-pack-1");
  });

  it("routes review packs through the mission control surface bindings", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method?: string };
      if (request.method === CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              revision: 6,
              sliceRevisions: { mission_control: 6 },
              slices: {
                mission_control: {
                  source: "runtime_snapshot_v1",
                  generatedAt: 4,
                  workspaces: [],
                  tasks: [],
                  runs: [],
                  reviewPacks: [
                    {
                      id: "review-pack-2",
                      workspaceId: "workspace-2",
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      throw new Error(`Unexpected method ${request.method ?? "unknown"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();
    const reviewPacks = await runtime.review.listReviewPacks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reviewPacks).toHaveLength(1);
    expect(reviewPacks[0]?.id).toBe("review-pack-2");
  });

  it("reads and writes composition settings through app settings compatibility storage", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    let appSettings: Record<string, unknown> = {
      defaultRemoteExecutionBackendId: "backend-default",
    };
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        method?: string;
        params?: { payload?: Record<string, unknown> };
      };
      if (request.method === CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: appSettings,
          }),
        };
      }
      if (request.method === CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE) {
        appSettings = request.params?.payload ?? {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: appSettings,
          }),
        };
      }
      throw new Error(`Unexpected method ${request.method ?? "unknown"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();
    const before = await runtime.composition?.getSettings("workspace-1");
    expect(before?.selection.preferredBackendIds).toEqual(["backend-default"]);

    await runtime.composition?.updateSettings("workspace-1", {
      selection: {
        profileId: "workspace-default",
        preferredBackendIds: ["backend-primary"],
      },
      launchOverride: null,
      persistence: {
        publisherSessionId: "session-1",
        lastAcceptedAuthorityRevision: 3,
        lastPublishAttemptAt: 5,
        lastPublishedAt: 6,
      },
    });

    expect(appSettings.defaultRemoteExecutionBackendId).toBe("backend-default");
    expect(appSettings[RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY]).toEqual(
      expect.objectContaining({
        "workspace-1": expect.objectContaining({
          selection: expect.objectContaining({
            profileId: "workspace-default",
          }),
        }),
      })
    );
    expect(
      (await runtime.composition?.getSettings("workspace-2"))?.selection.preferredBackendIds
    ).toEqual(["backend-default"]);
  });
});
