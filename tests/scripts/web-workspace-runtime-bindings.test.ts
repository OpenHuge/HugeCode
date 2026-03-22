// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY,
  saveStoredWebRuntimeGatewayProfile,
} from "../../packages/shared/src/runtimeGatewayBrowser";
import {
  createBrowserWorkspaceClientHostBindings,
  createBrowserWorkspaceClientRuntimeBindings,
} from "../../packages/code-workspace-client/src/workspace/browserBindings";
import { CODE_RUNTIME_RPC_METHODS } from "../../packages/code-runtime-host-contract/src/codeRuntimeRpc";

describe("web workspace runtime bindings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveStoredWebRuntimeGatewayProfile(
      {
        httpBaseUrl: "http://127.0.0.1:8788/rpc",
        wsBaseUrl: "ws://127.0.0.1:8788/ws",
        authToken: "secret",
        enabled: true,
      },
      MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY
    );
    vi.restoreAllMocks();
  });

  it("exposes the shared runtime and host domain slices", () => {
    const runtime = createBrowserWorkspaceClientRuntimeBindings();
    const host = createBrowserWorkspaceClientHostBindings();

    expect(runtime).toHaveProperty("missionControl");
    expect(runtime).toHaveProperty("agentControl");
    expect(runtime).toHaveProperty("threads");
    expect(runtime).toHaveProperty("git");
    expect(runtime).toHaveProperty("workspaceFiles");
    expect(runtime).toHaveProperty("review");
    expect(host).toHaveProperty("intents");
    expect(host).toHaveProperty("notifications");
    expect(host).toHaveProperty("shell");
  });

  it("routes mission control, review, and workspace-file reads through canonical runtime RPC methods", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
      };

      switch (body.method) {
        case CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1:
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                source: "runtime",
                generatedAt: 42,
                workspaces: [],
                tasks: [],
                runs: [],
                reviewPacks: [
                  { id: "rp-1", runId: "run-1", taskId: "task-1", workspaceId: "ws-1" },
                ],
              },
            })
          );
        case CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST:
          return new Response(
            JSON.stringify({
              ok: true,
              result: [{ id: "file-1", path: "src/main.ts" }],
            })
          );
        case CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ:
          return new Response(
            JSON.stringify({
              ok: true,
              result: { path: "src/main.ts", content: "console.log('hi');" },
            })
          );
        default:
          return new Response(JSON.stringify({ ok: false, error: { message: "unexpected" } }), {
            status: 500,
          });
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();
    const snapshot = await runtime.missionControl.readMissionControlSnapshot();
    const reviewPacks = await runtime.review.listReviewPacks();
    const files = await runtime.workspaceFiles.listWorkspaceFileEntries({ workspaceId: "ws-1" });
    const file = await runtime.workspaceFiles.readWorkspaceFile({
      workspaceId: "ws-1",
      fileId: "src/main.ts",
    });

    expect(snapshot.reviewPacks).toHaveLength(1);
    expect(reviewPacks).toEqual(snapshot.reviewPacks);
    expect(files).toEqual([{ id: "file-1", path: "src/main.ts" }]);
    expect(file).toEqual({ path: "src/main.ts", content: "console.log('hi');" });
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String(init?.body)).method as string
    );

    expect(
      calledMethods.filter(
        (method) => method === CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3
      )
    ).toHaveLength(2);
    expect(
      calledMethods.filter(
        (method) => method === CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1
      )
    ).toHaveLength(2);
    expect(calledMethods).toContain(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST);
    expect(calledMethods).toContain(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ);
    expect(calledMethods.at(-2)).toBe(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST);
    expect(calledMethods.at(-1)).toBe(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ);
  });
});
