import type { AgentTaskStartRequest } from "@ku0/code-runtime-host-contract";
import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { createHugeCodeT3RuntimeBridgeFromInvoker } from "./hugeCodeRuntimeBridge";

describe("hugeCodeRuntimeBridge", () => {
  it("maps shell and gateway invokers through one runtime bridge contract", async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const responses: Record<string, unknown> = {
      [CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2]: { accepted: true },
      [CODE_RUNTIME_RPC_METHODS.HUGEROUTER_COMMERCIAL_SERVICE_READ]: null,
      [CODE_RUNTIME_RPC_METHODS.HUGEROUTER_ROUTE_TOKEN_ISSUE]: {
        summary: {
          envKey: "HUGEROUTER_ROUTE_TOKEN",
          expiresAt: null,
          lastFour: "t3v1",
          lastIssuedAt: null,
          scopes: ["route:codex"],
          status: "active",
          tokenId: "runtime-managed",
        },
        token: "runtime_managed_route_token_redacted",
      },
      [CODE_RUNTIME_RPC_METHODS.MODELS_POOL]: [],
      [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST]: [],
      [CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]: {
        plan: {
          planVersion: "plan-v1",
        },
      },
      [CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT]: { accepted: true },
      [CODE_RUNTIME_RPC_METHODS.TURN_SEND]: { accepted: true },
    };
    const bridge = createHugeCodeT3RuntimeBridgeFromInvoker(
      <Result>(method: string, params: Record<string, unknown>) => {
        calls.push({ method, params });
        return Promise.resolve(responses[method] as Result);
      }
    );

    await expect(bridge.listModels()).resolves.toEqual([]);
    await expect(bridge.listBackends()).resolves.toEqual([]);
    await expect(bridge.readHugeRouterCommercialService?.()).resolves.toBeNull();
    await expect(
      bridge.issueHugeRouterRouteToken?.({
        envKey: "HUGEROUTER_ROUTE_TOKEN",
        scopes: ["route:codex"],
      })
    ).resolves.toEqual(
      expect.objectContaining({
        token: "runtime_managed_route_token_redacted",
      })
    );

    const startRequest: AgentTaskStartRequest = {
      accessMode: "read-only",
      provider: "codex",
      requestId: "request-1",
      steps: [{ input: "run tests", kind: "diagnostics" }],
      threadId: "thread-1",
      title: "Run tests",
      workspaceId: "workspace-1",
    };
    await bridge.startAgentTask(startRequest);
    await bridge.interruptTurn("turn-1", "user");
    await bridge.approveRequest("approval-1", true);

    expect(calls.map((call) => call.method)).toEqual([
      CODE_RUNTIME_RPC_METHODS.MODELS_POOL,
      CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST,
      CODE_RUNTIME_RPC_METHODS.HUGEROUTER_COMMERCIAL_SERVICE_READ,
      CODE_RUNTIME_RPC_METHODS.HUGEROUTER_ROUTE_TOKEN_ISSUE,
      CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
      CODE_RUNTIME_RPC_METHODS.TURN_SEND,
      CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT,
      CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2,
    ]);
    expect(calls[0]?.params).toEqual(CODE_RUNTIME_RPC_EMPTY_PARAMS);
    expect(calls[4]?.params).toEqual(
      expect.objectContaining({
        accessMode: "read-only",
        provider: "codex",
        requestId: "request-1",
        steps: [{ input: "run tests", kind: "diagnostics" }],
        threadId: "thread-1",
        title: "Run tests",
        workspaceId: "workspace-1",
      })
    );
    expect(calls[5]?.params).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          accessMode: "read-only",
          content: "run tests",
          executionMode: "local-cli",
          provider: "codex",
          requestId: "request-1",
          threadId: "thread-1",
        }),
      })
    );
    expect(calls[6]?.params).toEqual({
      payload: {
        reason: "user",
        turnId: "turn-1",
      },
    });
    expect(calls[7]?.params).toEqual({
      kind: null,
      reason: null,
      requestId: "approval-1",
      status: "approved",
    });
  });

  it("keeps the same mapper usable for future built-in Codex app-server shells", async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const invoke = <Result>(method: string, params: Record<string, unknown>) => {
      calls.push({ method, params });
      if (method === CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2) {
        return Promise.resolve({
          plan: {
            planVersion: "plan-v2",
          },
        } as Result);
      }
      return Promise.resolve({ accepted: true, source: "embedded-codex-app-server" } as Result);
    };
    const bridge = createHugeCodeT3RuntimeBridgeFromInvoker(invoke);

    await expect(
      bridge.startAgentTask({
        accessMode: "read-only",
        requestId: "request-2",
        steps: [{ input: "summarize", kind: "read" }],
        title: "Summarize",
        workspaceId: "workspace-1",
      })
    ).resolves.toEqual({
      accepted: true,
      source: "embedded-codex-app-server",
    });

    expect(calls).toEqual([
      {
        method: CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
        params: expect.objectContaining({
          accessMode: "read-only",
          requestId: "request-2",
          steps: [{ input: "summarize", kind: "read" }],
          title: "Summarize",
          workspaceId: "workspace-1",
        }),
      },
      {
        method: CODE_RUNTIME_RPC_METHODS.TURN_SEND,
        params: expect.objectContaining({
          payload: expect.objectContaining({
            accessMode: "read-only",
            content: "summarize",
            requestId: "request-2",
            threadId: expect.any(String),
            executionProfileId: "runtime-default",
            workspaceId: "workspace-1",
          }),
        }),
      },
    ]);
  });

  it("treats missing HugeRouter commercial service RPC support as optional", async () => {
    const bridge = createHugeCodeT3RuntimeBridgeFromInvoker(
      <Result>(method: string, _params: Record<string, unknown>) => {
        if (method === CODE_RUNTIME_RPC_METHODS.HUGEROUTER_COMMERCIAL_SERVICE_READ) {
          return Promise.reject(
            new Error(
              "Error invoking remote method 'hugecode:runtime:invoke': Error: Unsupported RPC method: code_hugerouter_commercial_service_read"
            )
          );
        }
        return Promise.resolve([] as Result);
      }
    );

    await expect(bridge.readHugeRouterCommercialService?.()).resolves.toBeNull();
    await expect(bridge.listModels()).resolves.toEqual([]);
  });
});
