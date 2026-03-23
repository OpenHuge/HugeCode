// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useMainAppAutoDriveState } from "./useMainAppAutoDriveState";

vi.mock("../../../application/runtime/ports/runtimeAgentControl", () => ({
  useWorkspaceRuntimeAgentControl: vi.fn(() => null),
}));

vi.mock("../../autodrive/hooks/useAutoDriveController", () => ({
  useAutoDriveController: vi.fn((params) => ({
    enabled: params.getThreadCodexParams("ws-1", "thread-1")?.autoDriveDraft?.enabled ?? false,
    draft: params.getThreadCodexParams("ws-1", "thread-1")?.autoDriveDraft ?? {
      enabled: false,
      destination: {
        title: "",
        endState: "",
        doneDefinition: "",
        avoid: "",
        routePreference: "stability_first",
      },
      budget: {
        maxTokens: 6000,
        maxIterations: 3,
        maxDurationMinutes: 10,
        maxFilesPerIteration: 6,
        maxNoProgressIterations: 2,
        maxValidationFailures: 2,
        maxReroutes: 2,
      },
      riskPolicy: {
        pauseOnDestructiveChange: true,
        pauseOnDependencyChange: true,
        pauseOnLowConfidence: true,
        pauseOnHumanCheckpoint: true,
        allowNetworkAnalysis: true,
        allowValidationCommands: true,
        allowChatgptDecisionLab: true,
        autoRunChatgptDecisionLab: true,
        chatgptDecisionLabMinConfidence: "medium",
        chatgptDecisionLabMaxScoreGap: 8,
        minimumConfidence: "medium",
      },
      continuation: {
        enabled: true,
        maxAutomaticFollowUps: 2,
        requireValidationSuccessToStop: true,
        minimumConfidenceToStop: "high",
      },
    },
    activity: [],
    recovering: false,
    recoverySummary: null,
    run: null,
    setEnabled: vi.fn(),
    setDestinationValue: vi.fn(),
    setBudgetValue: vi.fn(),
    setRiskPolicyValue: vi.fn(),
    preset: {
      active: "safe_default",
      apply: vi.fn(),
    },
    controls: {
      canStart: false,
      canPause: false,
      canResume: false,
      canStop: false,
      busyAction: null,
      onStart: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn(),
      onStop: vi.fn(),
    },
    readiness: {
      readyToLaunch: false,
      issues: ["Define a destination before launch."],
      warnings: [],
      checklist: [],
      setupProgress: 0,
    },
  })),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/repo",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createDraft() {
  return {
    enabled: true,
    destination: {
      title: "",
      endState: "",
      doneDefinition: "",
      avoid: "",
      routePreference: "stability_first" as const,
    },
    budget: {
      maxTokens: 6000,
      maxIterations: 3,
      maxDurationMinutes: 10,
      maxFilesPerIteration: 6,
      maxNoProgressIterations: 2,
      maxValidationFailures: 2,
      maxReroutes: 2,
    },
    riskPolicy: {
      pauseOnDestructiveChange: true,
      pauseOnDependencyChange: true,
      pauseOnLowConfidence: true,
      pauseOnHumanCheckpoint: true,
      allowNetworkAnalysis: true,
      allowValidationCommands: true,
      allowChatgptDecisionLab: true,
      autoRunChatgptDecisionLab: true,
      chatgptDecisionLabMinConfidence: "medium" as const,
      chatgptDecisionLabMaxScoreGap: 8,
      minimumConfidence: "medium" as const,
    },
    continuation: {
      enabled: true,
      maxAutomaticFollowUps: 2,
      requireValidationSuccessToStop: true,
      minimumConfidenceToStop: "high" as const,
    },
  };
}

describe("useMainAppAutoDriveState", () => {
  it("derives a completed fallback run from a successful thread-only continuation", () => {
    const { result } = renderHook(() =>
      useMainAppAutoDriveState(
        WORKSPACE,
        "thread-1",
        null,
        {
          accessMode: "full-access",
          selectedModelId: "gpt-5.4",
          selectedEffort: "low",
        },
        1,
        () => ({ autoDriveDraft: createDraft() }),
        [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "AutoDrive continuation\nclose the validation gap",
          },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "bash",
            title: "validate",
            detail: "Command completed with exit code 0",
            status: "completed",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "已继续当前路线。结论：当前这条路线的最终状态：pass",
          },
        ],
        { "thread-1": { isProcessing: false } },
        vi.fn(async () => undefined),
        vi.fn(),
        null,
        null
      )
    );

    expect(result.current.run?.status).toBe("completed");
    expect(result.current.run?.navigation.overallProgress).toBe(100);
    expect(result.current.run?.lastValidationSummary).toContain("最终状态：pass");
  });

  it("derives a completed fallback run even when only the assistant completion remains visible", () => {
    const { result } = renderHook(() =>
      useMainAppAutoDriveState(
        WORKSPACE,
        "thread-1",
        null,
        {
          accessMode: "full-access",
          selectedModelId: "gpt-5.4",
          selectedEffort: "low",
        },
        1,
        () => ({ autoDriveDraft: createDraft() }),
        [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "read",
            title: "autodrive-playground-chain-2.txt",
            detail: "Read",
            status: "completed",
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "bash",
            title: "validate-created-file",
            detail: "Command completed with exit code 0",
            status: "completed",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "已继续当前路线，结论：当前这条路线的最终状态：pass",
          },
        ],
        { "thread-1": { isProcessing: false } },
        vi.fn(async () => undefined),
        vi.fn(),
        null,
        null
      )
    );

    expect(result.current.run?.status).toBe("completed");
    expect(result.current.run?.lastValidationSummary).toContain("最终状态：pass");
  });
});
