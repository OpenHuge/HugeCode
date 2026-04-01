// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION } from "@ku0/code-platform-interfaces";
import type { WorkspaceDiagnosticsListResponse } from "@ku0/code-runtime-host-contract";
import type { AgentIntentState } from "../types/webMcpBridge";
import { useWorkspacePersistentFlowState } from "./runtimePersistentFlowState";

const {
  getAppSettingsMock,
  updateAppSettingsMock,
  listWorkspaceDiagnosticsMock,
  runtimeUpdatedListeners,
  subscribeScopedRuntimeUpdatedEventsMock,
} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  updateAppSettingsMock: vi.fn(),
  listWorkspaceDiagnosticsMock: vi.fn(),
  runtimeUpdatedListeners: new Set<(event: unknown) => void>(),
  subscribeScopedRuntimeUpdatedEventsMock: vi.fn((_options, listener) => {
    runtimeUpdatedListeners.add(listener);
    return () => runtimeUpdatedListeners.delete(listener);
  }),
}));

vi.mock("../ports/desktopAppSettings", () => ({
  getAppSettings: getAppSettingsMock,
  updateAppSettings: updateAppSettingsMock,
}));

vi.mock("../ports/runtimeDiagnostics", () => ({
  listWorkspaceDiagnostics: listWorkspaceDiagnosticsMock,
}));

vi.mock("../ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
}));

const blankIntent: AgentIntentState = {
  objective: "",
  constraints: "",
  successCriteria: "",
  deadline: null,
  priority: "medium",
  managerNotes: "",
};

function createDiagnosticsResponse(): WorkspaceDiagnosticsListResponse {
  return {
    workspaceId: "workspace-1",
    available: true,
    summary: {
      errorCount: 1,
      warningCount: 1,
      infoCount: 0,
      hintCount: 0,
      total: 2,
    },
    items: [
      {
        path: "apps/code/src/types.ts",
        severity: "error",
        message: "Property does not exist.",
        source: "tsc",
        code: "TS2339",
        startLine: 278,
        startColumn: 3,
        endLine: 278,
        endColumn: 35,
      },
      {
        path: "apps/code/src/application/runtime/facades/runtimePersistentFlowState.ts",
        severity: "warning",
        message: "Unused helper.",
        source: "oxlint",
        code: "unused_import",
        startLine: 12,
        startColumn: 1,
        endLine: 12,
        endColumn: 12,
      },
    ],
    providers: [],
    generatedAtMs: 44,
    reason: null,
  };
}

describe("useWorkspacePersistentFlowState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeUpdatedListeners.clear();
    updateAppSettingsMock.mockImplementation(async (settings) => settings);
    listWorkspaceDiagnosticsMock.mockResolvedValue(createDiagnosticsResponse());
  });

  it("prefers host-backed active intent context over legacy cache and republishes refreshed runtime evidence", async () => {
    getAppSettingsMock.mockResolvedValue({
      activeIntentContextByWorkspaceId: {
        "workspace-1": {
          schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
          intent: {
            objective: "Host-backed objective",
            constraints: "Keep runtime truth authoritative",
            successCriteria: "Restart into recovered flow",
            deadline: null,
            priority: "high",
            managerNotes: "Use host data first",
          },
          focusedFiles: [],
          unresolvedErrors: [],
          history: {
            latestRunId: "run-0",
            latestRunTitle: "Old flow",
            latestReviewPackId: null,
            lastUpdatedAt: 1,
            recentChangedPaths: [],
            validationSummaries: [],
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: blankIntent,
        runs: [
          {
            id: "run-1",
            title: "Persist flow state",
            updatedAt: 40,
            changedPaths: ["apps/code/src/types.ts"],
            validations: [
              {
                id: "validation-1",
                label: "TypeScript",
                outcome: "failed",
                summary: "TypeScript failed after host-backed hydration.",
              },
            ],
            reviewPackId: "review-pack-1",
          },
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.source).toBe("host");
    expect(result.current.hydratedIntent?.objective).toBe("Host-backed objective");
    expect(result.current.indicator.label).toBe("Recovered flow state");

    await waitFor(() => {
      expect(updateAppSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          activeIntentContextByWorkspaceId: expect.objectContaining({
            "workspace-1": expect.objectContaining({
              focusedFiles: expect.arrayContaining([
                { path: "apps/code/src/types.ts", reason: "recent_change" },
              ]),
              unresolvedErrors: expect.arrayContaining([
                expect.objectContaining({ source: "tsc", code: "TS2339" }),
              ]),
            }),
          }),
        })
      );
    });
  });

  it("returns refreshed runtime evidence immediately instead of waiting for host persistence to finish", async () => {
    getAppSettingsMock.mockResolvedValue({
      activeIntentContextByWorkspaceId: {
        "workspace-1": {
          schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
          intent: {
            objective: "Host-backed objective",
            constraints: "Keep runtime truth authoritative",
            successCriteria: "Restart into recovered flow",
            deadline: null,
            priority: "high",
            managerNotes: "Use host data first",
          },
          focusedFiles: [],
          unresolvedErrors: [],
          history: {
            latestRunId: "run-0",
            latestRunTitle: "Older flow",
            latestReviewPackId: null,
            lastUpdatedAt: 1,
            recentChangedPaths: [],
            validationSummaries: [],
          },
        },
      },
    });
    updateAppSettingsMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: blankIntent,
        runs: [
          {
            id: "run-1",
            title: "Persist flow state",
            updatedAt: 40,
            changedPaths: ["apps/code/src/types.ts"],
            validations: [
              {
                id: "validation-1",
                label: "TypeScript",
                outcome: "failed",
                summary: "TypeScript failed after host-backed hydration.",
              },
            ],
            reviewPackId: "review-pack-1",
          },
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.context?.history.latestRunId).toBe("run-1");
    expect(result.current.context?.history.latestReviewPackId).toBe("review-pack-1");
    expect(result.current.context?.focusedFiles).toEqual(
      expect.arrayContaining([{ path: "apps/code/src/types.ts", reason: "recent_change" }])
    );
    expect(result.current.context?.unresolvedErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "tsc", code: "TS2339" })])
    );
  });

  it("does not recover persistent flow state from legacy local cache when host-backed state is missing", async () => {
    getAppSettingsMock.mockResolvedValue({});
    listWorkspaceDiagnosticsMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: blankIntent,
        runs: [],
      })
    );

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.source).toBe("none");
    expect(result.current.hydratedIntent).toBeNull();
    expect(result.current.indicator.label).toBe("Persistent flow state");
    expect(result.current.indicator.detail).toContain(
      "Persistent flow state will appear once the workspace has intent or runtime evidence."
    );
  });

  it("preserves persisted run history when startup hydration has intent but no fresh runs yet", async () => {
    getAppSettingsMock.mockResolvedValue({
      activeIntentContextByWorkspaceId: {
        "workspace-1": {
          schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
          intent: {
            objective: "Recovered host-backed objective",
            constraints: "Keep runtime truth authoritative",
            successCriteria: "Restart into recovered flow",
            deadline: null,
            priority: "high",
            managerNotes: "Use host data first",
          },
          focusedFiles: [
            { path: "packages/code-platform-interfaces/src/index.ts", reason: "recent_change" },
          ],
          unresolvedErrors: [],
          history: {
            latestRunId: "run-123",
            latestRunTitle: "Persist flow state",
            latestReviewPackId: "review-pack-123",
            lastUpdatedAt: 99,
            recentChangedPaths: ["packages/code-platform-interfaces/src/index.ts"],
            validationSummaries: ["TypeScript failed after adding persistent flow state fields."],
          },
        },
      },
    });
    listWorkspaceDiagnosticsMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: blankIntent,
        runs: [],
      })
    );

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.context?.history.latestRunId).toBe("run-123");
    expect(result.current.context?.history.recentChangedPaths).toEqual([
      "packages/code-platform-interfaces/src/index.ts",
    ]);
    expect(updateAppSettingsMock).not.toHaveBeenCalled();
  });

  it("treats non-objective intent fields as meaningful persistent flow state", async () => {
    getAppSettingsMock.mockResolvedValue({});
    listWorkspaceDiagnosticsMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: {
          ...blankIntent,
          constraints: "Keep continuity state across restarts",
        },
        runs: [],
      })
    );

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
      expect(result.current.context?.intent.constraints).toBe(
        "Keep continuity state across restarts"
      );
    });

    await waitFor(() => {
      expect(updateAppSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          activeIntentContextByWorkspaceId: expect.objectContaining({
            "workspace-1": expect.objectContaining({
              intent: expect.objectContaining({
                constraints: "Keep continuity state across restarts",
              }),
            }),
          }),
        })
      );
    });
  });

  it("preserves newer host-backed run history when saving from a stale mounted hook instance", async () => {
    const freshHostContext = {
      schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
      intent: {
        objective: "Recovered objective",
        constraints: "Keep runtime truth authoritative",
        successCriteria: "Restart into recovered flow",
        deadline: null,
        priority: "high",
        managerNotes: "Use host data first",
      },
      focusedFiles: [
        {
          path: "packages/code-platform-interfaces/src/index.ts",
          reason: "recent_change" as const,
        },
      ],
      unresolvedErrors: [],
      history: {
        latestRunId: "run-fresh",
        latestRunTitle: "Fresh flow",
        latestReviewPackId: "review-pack-1",
        lastUpdatedAt: 20,
        recentChangedPaths: ["packages/code-platform-interfaces/src/index.ts"],
        validationSummaries: ["TypeScript failed after adding persistent flow state fields."],
      },
    };

    getAppSettingsMock
      .mockResolvedValueOnce({
        activeIntentContextByWorkspaceId: {
          "workspace-1": {
            schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
            intent: {
              objective: "Recovered objective",
              constraints: "Keep runtime truth authoritative",
              successCriteria: "Restart into recovered flow",
              deadline: null,
              priority: "high",
              managerNotes: "Use host data first",
            },
            focusedFiles: [],
            unresolvedErrors: [],
            history: {
              latestRunId: "run-stale",
              latestRunTitle: "Older flow",
              latestReviewPackId: null,
              lastUpdatedAt: 10,
              recentChangedPaths: [],
              validationSummaries: [],
            },
          },
        },
      })
      .mockResolvedValue({
        activeIntentContextByWorkspaceId: {
          "workspace-1": freshHostContext,
        },
      });
    listWorkspaceDiagnosticsMock.mockResolvedValue(null);

    renderHook(() =>
      useWorkspacePersistentFlowState({
        workspaceId: "workspace-1",
        intent: {
          ...blankIntent,
          managerNotes: "Update intent without losing recovered run history",
        },
        runs: [],
      })
    );

    await waitFor(() => {
      expect(updateAppSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          activeIntentContextByWorkspaceId: expect.objectContaining({
            "workspace-1": expect.objectContaining({
              history: expect.objectContaining({
                latestRunId: "run-fresh",
                latestReviewPackId: "review-pack-1",
                recentChangedPaths: ["packages/code-platform-interfaces/src/index.ts"],
              }),
            }),
          }),
        })
      );
    });
  });
});
