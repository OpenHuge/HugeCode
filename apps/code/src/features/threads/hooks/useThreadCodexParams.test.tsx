// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY_THREAD_CODEX_PARAMS } from "../utils/threadStorage";
import { useThreadCodexParams } from "./useThreadCodexParams";

describe("useThreadCodexParams", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("patches and retrieves thread-scoped Codex params", () => {
    const { result } = renderHook(() => useThreadCodexParams());

    act(() => {
      result.current.patchThreadCodexParams("ws-1", "thread-1", {
        modelId: "gpt-5.1",
        effort: "high",
        accessMode: "full-access",
        collaborationModeId: "plan",
        executionMode: "local-cli",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
      });
    });

    expect(result.current.getThreadCodexParams("ws-1", "thread-1")).toEqual(
      expect.objectContaining({
        modelId: "gpt-5.1",
        effort: "high",
        accessMode: "full-access",
        collaborationModeId: "plan",
        executionMode: "local-cli",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
        providerFamilyId: null,
        selectionMode: null,
      })
    );

    const persisted = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY_THREAD_CODEX_PARAMS) ?? "{}"
    ) as Record<string, unknown>;
    expect(persisted["ws-1:thread-1"]).toBeTruthy();
  });

  it("sanitizes malformed persisted entries", () => {
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_CODEX_PARAMS,
      JSON.stringify({
        "ws-1:thread-1": {
          modelId: "gpt-4.1",
          effort: "medium",
          accessMode: "nope",
          collaborationModeId: 99,
          executionMode: "unknown",
          missionMode: "swarm",
          executionProfileId: 123,
          preferredBackendIds: ["backend-a", "", 42, "backend-a"],
          updatedAt: "never",
        },
      })
    );

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.getThreadCodexParams("ws-1", "thread-1")).toEqual({
      modelId: "gpt-4.1",
      effort: "medium",
      fastMode: null,
      accessMode: null,
      collaborationModeId: null,
      executionMode: null,
      missionMode: null,
      executionProfileId: null,
      preferredBackendIds: ["backend-a"],
      providerFamilyId: null,
      selectionMode: null,
      autoDriveDraft: null,
      updatedAt: 0,
    });
  });

  it("syncs from storage events", async () => {
    const { result } = renderHook(() => useThreadCodexParams());

    window.localStorage.setItem(
      STORAGE_KEY_THREAD_CODEX_PARAMS,
      JSON.stringify({
        "ws-1:thread-2": {
          modelId: "gpt-5",
          effort: "low",
          fastMode: true,
          accessMode: "current",
          collaborationModeId: "default",
          executionMode: "local_cli",
          missionMode: "pair",
          executionProfileId: "operator-review",
          preferredBackendIds: ["backend-c", "backend-c"],
          updatedAt: 1,
        },
      })
    );

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_THREAD_CODEX_PARAMS }));
    });

    await waitFor(() => {
      expect(result.current.version).toBe(1);
    });

    expect(result.current.getThreadCodexParams("ws-1", "thread-2")).toEqual({
      modelId: "gpt-5",
      effort: "low",
      fastMode: true,
      accessMode: "on-request",
      collaborationModeId: "default",
      executionMode: "local-cli",
      missionMode: "pair",
      executionProfileId: "operator-review",
      preferredBackendIds: ["backend-c"],
      providerFamilyId: null,
      selectionMode: null,
      autoDriveDraft: null,
      updatedAt: 1,
    });
  });

  it("deletes per-thread overrides", () => {
    const { result } = renderHook(() => useThreadCodexParams());

    act(() => {
      result.current.patchThreadCodexParams("ws-1", "thread-3", {
        modelId: "gpt-5",
      });
    });
    expect(result.current.getThreadCodexParams("ws-1", "thread-3")).not.toBeNull();

    act(() => {
      result.current.deleteThreadCodexParams("ws-1", "thread-3");
    });

    expect(result.current.getThreadCodexParams("ws-1", "thread-3")).toBeNull();
  });

  it("restores ChatGPT decision lab defaults in persisted autodrive drafts", () => {
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_CODEX_PARAMS,
      JSON.stringify({
        "ws-1:thread-4": {
          autoDriveDraft: {
            enabled: true,
            destination: {
              title: "Ship AutoDrive",
              endState: "Decision lab auto-runs",
              doneDefinition: "Runtime uses ChatGPT when routes are close",
              avoid: "No silent destructive changes",
              routePreference: "stability_first",
            },
            budget: {
              maxTokens: 4000,
              maxIterations: 2,
              maxDurationMinutes: 5,
              maxFilesPerIteration: 4,
              maxNoProgressIterations: 1,
              maxValidationFailures: 1,
              maxReroutes: 1,
            },
            riskPolicy: {
              pauseOnDestructiveChange: true,
              allowNetworkAnalysis: true,
              allowValidationCommands: true,
              minimumConfidence: "medium",
            },
          },
          updatedAt: 2,
        },
      })
    );

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.getThreadCodexParams("ws-1", "thread-4")).toEqual(
      expect.objectContaining({
        autoDriveDraft: expect.objectContaining({
          continuation: expect.objectContaining({
            enabled: true,
            maxAutomaticFollowUps: 2,
            requireValidationSuccessToStop: true,
            minimumConfidenceToStop: "high",
          }),
          riskPolicy: expect.objectContaining({
            allowChatgptDecisionLab: true,
            autoRunChatgptDecisionLab: true,
            chatgptDecisionLabMinConfidence: "medium",
            chatgptDecisionLabMaxScoreGap: 8,
          }),
        }),
      })
    );
  });
});
