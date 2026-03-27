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

  it("routes browser agent control resume, intervene, and subscribe through runtime kernel v2 methods", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method?: string };
      if (request.method === CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              run: {
                taskId: "run-1",
                workspaceId: "workspace-1",
                threadId: "thread-1",
                requestId: null,
                title: "Resume task",
                status: "running",
                accessMode: "on-request",
                executionMode: "single",
                provider: "openai",
                modelId: "gpt-5.4",
                routedProvider: "openai",
                routedModelId: "gpt-5.4",
                routedPool: "auto",
                routedSource: "workspace-default",
                currentStep: 2,
                createdAt: 10,
                updatedAt: 20,
                startedAt: 15,
                completedAt: null,
                errorCode: null,
                errorMessage: null,
                pendingApprovalId: null,
                checkpointId: "checkpoint-1",
                traceId: "trace-1",
                recovered: true,
                checkpointState: {
                  state: "running",
                  checkpointId: "checkpoint-1",
                  traceId: "trace-1",
                  resumeReady: true,
                },
                preferredBackendIds: ["backend-a"],
                backendId: "backend-a",
                steps: [],
              },
              missionRun: {
                id: "run-1",
                taskId: "task-1",
                workspaceId: "workspace-1",
                state: "running",
                title: "Resume task",
                summary: "Resumed",
                startedAt: 15,
                updatedAt: 20,
              },
              reviewPack: null,
            },
          }),
        };
      }

      if (request.method === CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              run: {
                taskId: "run-2",
                workspaceId: "workspace-1",
                threadId: "thread-1",
                requestId: null,
                title: "Retry task",
                status: "queued",
                accessMode: "on-request",
                executionMode: "distributed",
                provider: "openai",
                modelId: "gpt-5.4",
                routedProvider: "openai",
                routedModelId: "gpt-5.4",
                routedPool: "auto",
                routedSource: "workspace-default",
                currentStep: null,
                createdAt: 30,
                updatedAt: 40,
                startedAt: null,
                completedAt: null,
                errorCode: null,
                errorMessage: null,
                pendingApprovalId: null,
                checkpointId: "checkpoint-2",
                traceId: "trace-2",
                recovered: null,
                preferredBackendIds: ["backend-b"],
                backendId: "backend-b",
                steps: [],
              },
              missionRun: {
                id: "run-2",
                taskId: "task-1",
                workspaceId: "workspace-1",
                state: "queued",
                title: "Retry task",
                summary: "Queued retry",
                updatedAt: 40,
                placement: {
                  lifecycleState: "confirmed",
                  resolutionSource: "runtime_confirmed",
                  resolvedBackendId: "backend-b",
                  requestedBackendIds: ["backend-b"],
                  readiness: "ready",
                  summary: "Backend ready",
                  rationale: null,
                  failureReasonCode: null,
                },
              },
              reviewPack: null,
            },
          }),
        };
      }

      if (request.method === CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              run: {
                taskId: "run-1",
                workspaceId: "workspace-1",
                threadId: "thread-1",
                requestId: null,
                title: "Resume task",
                status: "running",
                accessMode: "on-request",
                executionMode: "distributed",
                provider: "openai",
                modelId: "gpt-5.4",
                routedProvider: "openai",
                routedModelId: "gpt-5.4",
                routedPool: "auto",
                routedSource: "workspace-default",
                currentStep: 2,
                createdAt: 10,
                updatedAt: 25,
                startedAt: 15,
                completedAt: null,
                errorCode: null,
                errorMessage: null,
                pendingApprovalId: null,
                checkpointId: "checkpoint-1",
                traceId: "trace-1",
                recovered: true,
                checkpointState: {
                  state: "running",
                  checkpointId: "checkpoint-1",
                  traceId: "trace-1",
                  resumeReady: true,
                },
                preferredBackendIds: ["backend-a"],
                backendId: "backend-a",
                steps: [],
              },
              missionRun: {
                id: "run-1",
                taskId: "task-1",
                workspaceId: "workspace-1",
                state: "running",
                title: "Resume task",
                summary: "Runtime truth",
                startedAt: 15,
                updatedAt: 25,
                continuation: {
                  state: "ready",
                  pathKind: "resume",
                  source: "takeover_bundle",
                  summary: "Ready to resume.",
                  detail: null,
                  recommendedAction: "Resume run",
                  sessionBoundary: {
                    workspaceId: "workspace-1",
                    taskId: "task-1",
                    runId: "run-1",
                    reviewPackId: null,
                  },
                },
                placement: {
                  lifecycleState: "confirmed",
                  resolutionSource: "runtime_confirmed",
                  resolvedBackendId: "backend-a",
                  requestedBackendIds: ["backend-a"],
                  readiness: "ready",
                  summary: "Backend ready",
                  rationale: null,
                  failureReasonCode: null,
                },
                checkpoint: {
                  checkpointId: "checkpoint-1",
                  traceId: "trace-1",
                  recovered: true,
                },
              },
              reviewPack: null,
            },
          }),
        };
      }

      if (request.method === CODE_RUNTIME_RPC_METHODS.RUN_CANCEL) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              accepted: true,
              runId: "run-1",
              status: "interrupted",
              message: "Interrupted",
            },
          }),
        };
      }

      if (request.method === CODE_RUNTIME_RPC_METHODS.RUNS_LIST) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: [
              {
                taskId: "run-1",
                workspaceId: "workspace-1",
                threadId: "thread-1",
                requestId: null,
                title: "Resume task",
                status: "running",
                accessMode: "on-request",
                executionMode: "distributed",
                provider: "openai",
                modelId: "gpt-5.4",
                routedProvider: "openai",
                routedModelId: "gpt-5.4",
                routedPool: "auto",
                routedSource: "workspace-default",
                currentStep: 2,
                createdAt: 10,
                updatedAt: 25,
                startedAt: 15,
                completedAt: null,
                errorCode: null,
                errorMessage: null,
                pendingApprovalId: null,
                checkpointId: "checkpoint-1",
                recovered: true,
                preferredBackendIds: ["backend-a"],
                backendId: "backend-a",
                continuation: {
                  summary: "Ready to resume.",
                },
                reviewPackId: null,
                steps: [],
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected method: ${request.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();

    await expect(
      runtime.agentControl.cancelRuntimeJob({ runId: "run-1", reason: "User stop" })
    ).resolves.toEqual({
      accepted: true,
      runId: "run-1",
      status: "interrupted",
      message: "Interrupted",
    });

    await expect(runtime.agentControl.resumeRuntimeJob({ runId: "run-1" })).resolves.toEqual({
      accepted: true,
      runId: "run-1",
      status: "running",
      code: null,
      message: "Runtime run resumed.",
      recovered: true,
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      updatedAt: 20,
    });

    await expect(
      runtime.agentControl.interveneRuntimeJob({
        runId: "run-1",
        action: "retry",
        reason: "Try again",
      })
    ).resolves.toEqual({
      accepted: true,
      action: "retry",
      runId: "run-2",
      status: "queued",
      outcome: "spawned",
      spawnedRunId: "run-2",
      checkpointId: "checkpoint-2",
    });

    await expect(runtime.agentControl.subscribeRuntimeJob({ runId: "run-1" })).resolves.toEqual({
      id: "run-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      title: "Resume task",
      status: "running",
      provider: "openai",
      modelId: "gpt-5.4",
      backendId: "backend-a",
      preferredBackendIds: ["backend-a"],
      executionProfile: {
        placement: "remote",
        interactivity: "background",
        isolation: "container_sandbox",
        network: "default",
        authority: "service",
      },
      createdAt: 10,
      updatedAt: 25,
      startedAt: 15,
      completedAt: null,
      continuation: {
        checkpointId: "checkpoint-1",
        resumeSupported: true,
        recovered: true,
        reviewActionability: null,
        takeover: null,
        missionLinkage: null,
        publishHandoff: null,
        summary: "Ready to resume.",
      },
      metadata: {
        canonicalMethod: "code_runtime_run_subscribe_v2",
        runId: "run-1",
        reviewPackId: null,
      },
    });

    await expect(
      runtime.agentControl.listRuntimeJobs({ workspaceId: "workspace-1", status: "running" })
    ).resolves.toEqual([
      {
        id: "run-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "Resume task",
        status: "running",
        provider: "openai",
        modelId: "gpt-5.4",
        backendId: "backend-a",
        preferredBackendIds: ["backend-a"],
        executionProfile: {
          placement: "remote",
          interactivity: "background",
          isolation: "container_sandbox",
          network: "default",
          authority: "service",
        },
        createdAt: 10,
        updatedAt: 25,
        startedAt: 15,
        completedAt: null,
        continuation: {
          checkpointId: "checkpoint-1",
          resumeSupported: true,
          recovered: true,
          reviewActionability: null,
          takeover: null,
          missionLinkage: null,
          publishHandoff: null,
          summary: "Ready to resume.",
        },
        metadata: {
          canonicalMethod: "code_runtime_runs_list",
          runId: "run-1",
          reviewPackId: null,
        },
      },
    ]);

    const methods = fetchMock.mock.calls.map((call) => {
      const request = JSON.parse(String(call[1]?.body)) as { method?: string };
      return request.method;
    });
    expect(methods).toEqual([
      CODE_RUNTIME_RPC_METHODS.RUN_CANCEL,
      CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2,
      CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2,
      CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2,
      CODE_RUNTIME_RPC_METHODS.RUNS_LIST,
    ]);
  });

  it("projects subscribe continuation from canonical review takeover truth", async () => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "http://127.0.0.1:8788/rpc";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method?: string };
      if (request.method !== CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2) {
        throw new Error(`Unexpected method: ${request.method}`);
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            run: {
              taskId: "run-review-1",
              workspaceId: "workspace-1",
              threadId: "thread-1",
              requestId: null,
              title: "Review follow-up",
              status: "needs_input",
              accessMode: "on-request",
              executionMode: "distributed",
              provider: "openai",
              modelId: "gpt-5.4",
              routedProvider: "openai",
              routedModelId: "gpt-5.4",
              routedPool: "auto",
              routedSource: "workspace-default",
              currentStep: 4,
              createdAt: 10,
              updatedAt: 25,
              startedAt: 15,
              completedAt: null,
              errorCode: null,
              errorMessage: null,
              pendingApprovalId: null,
              checkpointId: "checkpoint-review-1",
              traceId: "trace-review-1",
              recovered: false,
              checkpointState: {
                state: "paused",
                checkpointId: "checkpoint-review-1",
                traceId: "trace-review-1",
                resumeReady: false,
              },
              preferredBackendIds: ["backend-a"],
              backendId: "backend-a",
              steps: [],
            },
            missionRun: {
              id: "run-review-1",
              taskId: "task-review-1",
              workspaceId: "workspace-1",
              state: "needs_input",
              title: "Review follow-up",
              summary: "Mission is waiting for follow-up.",
              startedAt: 15,
              updatedAt: 25,
              continuation: {
                state: "blocked",
                pathKind: "review",
                source: "review_actionability",
                summary: null,
                detail: null,
                recommendedAction: "Inspect blocked review follow-up",
                sessionBoundary: {
                  workspaceId: "workspace-1",
                  taskId: "task-review-1",
                  runId: "run-review-1",
                  reviewPackId: "review-pack-1",
                },
              },
              checkpoint: {
                checkpointId: "checkpoint-review-1",
                traceId: "trace-review-1",
                recovered: false,
                resumeReady: false,
              },
              takeoverBundle: {
                state: "blocked",
                pathKind: "review",
                primaryAction: "open_review_pack",
                summary: "Take over the review pack.",
                blockingReason: "Resolve review issues before continuing.",
                recommendedAction: "Open the review pack and resolve the blocked follow-up.",
                reviewPackId: "review-pack-1",
                target: {
                  kind: "review_pack",
                  workspaceId: "workspace-1",
                  taskId: "task-review-1",
                  runId: "run-review-1",
                  reviewPackId: "review-pack-1",
                },
                reviewActionability: {
                  state: "blocked",
                  summary: "Review pack is blocked on unresolved findings.",
                  degradedReasons: [],
                  actions: [],
                },
              },
            },
            reviewPack: {
              id: "review-pack-1",
              workspaceId: "workspace-1",
              taskId: "task-review-1",
              runId: "run-review-1",
              reviewStatus: "blocked",
              title: "Review pack",
              summary: "Review pack summary",
              createdAt: 20,
              updatedAt: 25,
              actionability: {
                state: "ready",
                summary: "Fallback review truth",
                degradedReasons: [],
                actions: [],
              },
              takeoverBundle: {
                state: "blocked",
                pathKind: "review",
                primaryAction: "open_review_pack",
                summary: "Take over the review pack.",
                blockingReason: "Resolve review issues before continuing.",
                recommendedAction: "Open the review pack and resolve the blocked follow-up.",
                reviewPackId: "review-pack-1",
                target: {
                  kind: "review_pack",
                  workspaceId: "workspace-1",
                  taskId: "task-review-1",
                  runId: "run-review-1",
                  reviewPackId: "review-pack-1",
                },
                reviewActionability: {
                  state: "blocked",
                  summary: "Review pack is blocked on unresolved findings.",
                  degradedReasons: [],
                  actions: [],
                },
              },
            },
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createBrowserWorkspaceClientRuntimeBindings();

    await expect(
      runtime.agentControl.subscribeRuntimeJob({ runId: "run-review-1" })
    ).resolves.toMatchObject({
      continuation: {
        reviewActionability: {
          state: "blocked",
          summary: "Review pack is blocked on unresolved findings.",
        },
        takeover: {
          state: "blocked",
          pathKind: "review",
        },
        summary: "Review pack is blocked on unresolved findings.",
      },
    });
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
