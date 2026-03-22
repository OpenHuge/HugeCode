import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
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

  it("routes browser agent control through kernel job v3 rpc methods", async () => {
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

    await runtime.agentControl.startRuntimeJob(
      {} as Parameters<typeof runtime.agentControl.startRuntimeJob>[0]
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      method?: string;
    };
    expect(request.method).toBe(CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_START_V3);
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
});
