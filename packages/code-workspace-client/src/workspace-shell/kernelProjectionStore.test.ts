import { describe, expect, it, vi } from "vitest";
import type {
  HugeCodeMissionControlSnapshot,
  KernelProjectionDelta,
  KernelProjectionSubscriptionRequest,
  OAuthPrimaryAccountSummary,
} from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeBindings } from "../workspace/bindings";
import {
  getKernelProjectionStore,
  readContinuityProjectionSlice,
  readDiagnosticsProjectionSlice,
} from "./kernelProjectionStore";

type KernelProjectionBindings = NonNullable<WorkspaceClientRuntimeBindings["kernelProjection"]>;

function createMissionControlSnapshot(): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  };
}

function createRuntimeBindings(input?: {
  bootstrap?: KernelProjectionBindings["bootstrap"];
  subscribe?: KernelProjectionBindings["subscribe"];
}): WorkspaceClientRuntimeBindings {
  const primaryAccountSummary: OAuthPrimaryAccountSummary = {
    provider: "codex",
    accountId: null,
    account: null,
    defaultPoolId: "default",
    routeAccountId: null,
    inSync: true,
    createdAt: 0,
    updatedAt: 0,
  };

  return {
    surface: "shared-workspace-client",
    settings: {
      getAppSettings: async () => ({}),
      updateAppSettings: async (settings) => settings,
      syncRuntimeGatewayProfileFromAppSettings: () => undefined,
    },
    oauth: {
      listAccounts: async () => [],
      listPools: async () => [],
      listPoolMembers: async () => [],
      getPrimaryAccount: async () => null,
      setPrimaryAccount: async () => primaryAccountSummary,
      applyPool: async () => undefined,
      bindPoolAccount: async () => undefined,
      runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
      getAccountInfo: async () => null,
      getProvidersCatalog: async () => [],
    },
    models: {
      getModelList: async () => [],
      getConfigModel: async () => null,
    },
    workspaceCatalog: {
      listWorkspaces: async () => [],
    },
    missionControl: {
      readMissionControlSnapshot: async () => createMissionControlSnapshot(),
    },
    kernelProjection: {
      bootstrap:
        input?.bootstrap ??
        (async () => ({
          revision: 0,
          sliceRevisions: {},
          slices: {},
        })),
      subscribe: input?.subscribe ?? (() => () => undefined),
    },
    runtimeUpdated: {
      subscribeScopedRuntimeUpdatedEvents: () => () => undefined,
    },
    agentControl: {
      startRuntimeJob: async () => {
        throw new Error("not implemented");
      },
      cancelRuntimeJob: async () => {
        throw new Error("not implemented");
      },
      resumeRuntimeJob: async () => {
        throw new Error("not implemented");
      },
      interveneRuntimeJob: async () => {
        throw new Error("not implemented");
      },
      subscribeRuntimeJob: async () => null,
      listRuntimeJobs: async () => [],
      submitRuntimeJobApprovalDecision: async () => {
        throw new Error("not implemented");
      },
    },
    threads: {
      listThreads: async () => [],
      createThread: async () => {
        throw new Error("not implemented");
      },
      resumeThread: async () => null,
      archiveThread: async () => true,
    },
    git: {
      listChanges: async () => ({ staged: [], unstaged: [] }),
      readDiff: async () => null,
      listBranches: async () => ({ currentBranch: "main", branches: [] }),
      createBranch: async () => ({ ok: true, error: null }),
      checkoutBranch: async () => ({ ok: true, error: null }),
      readLog: async () => ({
        total: 0,
        entries: [],
        ahead: 0,
        behind: 0,
        aheadEntries: [],
        behindEntries: [],
        upstream: null,
      }),
      stageChange: async () => ({ ok: true, error: null }),
      stageAll: async () => ({ ok: true, error: null }),
      unstageChange: async () => ({ ok: true, error: null }),
      revertChange: async () => ({ ok: true, error: null }),
      commit: async () => ({ committed: false, committedCount: 0, error: null }),
    },
    workspaceFiles: {
      listWorkspaceFileEntries: async () => [],
      readWorkspaceFile: async () => null,
    },
    review: {
      listReviewPacks: async () => [],
    },
  };
}

describe("KernelProjectionStore", () => {
  it("subscribes with the bootstrapped revision to avoid replaying a full replace frame", async () => {
    const bootstrap = vi.fn(async () => ({
      revision: 7,
      sliceRevisions: {
        mission_control: 7,
      },
      slices: {
        mission_control: createMissionControlSnapshot(),
      },
    }));
    const subscribe = vi.fn(
      (
        _request: KernelProjectionSubscriptionRequest,
        _listener: (delta: KernelProjectionDelta) => void
      ) =>
        () =>
          undefined
    );
    const runtime = createRuntimeBindings({ bootstrap, subscribe });
    const store = getKernelProjectionStore(runtime);

    store.ensureScopes(["mission_control"]);
    const unsubscribe = store.subscribe(() => undefined);

    await vi.waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });

    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ["mission_control"],
        lastRevision: 7,
      }),
      expect.any(Function)
    );

    unsubscribe();
  });

  it("exposes typed continuity and diagnostics slices after bootstrap and delta updates", async () => {
    const subscribe = vi.fn(
      (
        _request: KernelProjectionSubscriptionRequest,
        listener: (delta: KernelProjectionDelta) => void
      ) => {
        listener({
          revision: 12,
          scopes: ["continuity", "diagnostics"],
          ops: [
            {
              type: "replace",
              scope: "continuity",
              value: {
                summary: {
                  recoverableRunCount: 1,
                  reviewBlockedCount: 0,
                  itemCount: 1,
                },
                items: [
                  {
                    taskId: "task-1",
                    runId: "run-1",
                    takeoverBundle: {
                      state: "ready",
                      pathKind: "resume",
                      primaryAction: "resume_run",
                      summary: "Resume available.",
                      recommendedAction: "Resume the run.",
                    },
                  },
                ],
              },
              revision: 12,
            },
            {
              type: "replace",
              scope: "diagnostics",
              value: {
                revision: 12,
                latestEvent: null,
                runtime: {
                  status: "ok",
                },
                toolMetrics: {
                  totals: {
                    attemptedTotal: 1,
                    startedTotal: 1,
                    completedTotal: 1,
                    successTotal: 1,
                    validationFailedTotal: 0,
                    runtimeFailedTotal: 0,
                    timeoutTotal: 0,
                    blockedTotal: 0,
                  },
                  byTool: {},
                  recent: [],
                  updatedAt: 12,
                  windowSize: 50,
                  channelHealth: {
                    status: "healthy",
                    reason: null,
                    lastErrorCode: null,
                    updatedAt: 12,
                  },
                  circuitBreakers: [],
                },
                toolGuardrails: {
                  windowSize: 50,
                  payloadLimitBytes: 1024,
                  computerObserveRateLimitPerMinute: 6,
                  circuitWindowSize: 20,
                  circuitMinCompleted: 10,
                  circuitOpenMs: 60000,
                  halfOpenMaxProbes: 2,
                  halfOpenRequiredSuccesses: 2,
                  channelHealth: {
                    status: "healthy",
                    reason: null,
                    lastErrorCode: null,
                    updatedAt: 12,
                  },
                  circuitBreakers: [],
                  updatedAt: 12,
                },
              },
              revision: 12,
            },
          ],
        });
        return () => undefined;
      }
    );
    const runtime = createRuntimeBindings({
      bootstrap: async () => ({
        revision: 11,
        sliceRevisions: {
          mission_control: 11,
        },
        slices: {
          mission_control: createMissionControlSnapshot(),
        },
      }),
      subscribe,
    });
    const store = getKernelProjectionStore(runtime);

    store.ensureScopes(["mission_control", "continuity", "diagnostics"]);
    const unsubscribe = store.subscribe(() => undefined);

    await vi.waitFor(() => {
      const continuity = readContinuityProjectionSlice(store.getSnapshot());
      expect(continuity?.items[0]?.takeoverBundle?.pathKind).toBe("resume");
      const diagnostics = readDiagnosticsProjectionSlice(store.getSnapshot());
      expect(diagnostics?.toolMetrics.updatedAt).toBe(12);
    });

    unsubscribe();
  });
});
