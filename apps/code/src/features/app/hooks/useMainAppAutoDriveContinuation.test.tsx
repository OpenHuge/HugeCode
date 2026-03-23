// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationItem, WorkspaceInfo } from "../../../types";
import { useMainAppAutoDriveContinuation } from "./useMainAppAutoDriveContinuation";

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/repo",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function createProps(overrides?: {
  activeItems?: ConversationItem[];
  maxAutomaticFollowUps?: number;
  sendUserMessageToThread?: ReturnType<typeof vi.fn>;
  threadStatusById?: Record<string, { isProcessing: boolean } | undefined>;
}) {
  const sendUserMessageToThread =
    overrides?.sendUserMessageToThread ?? vi.fn(async () => undefined);

  return {
    activeWorkspace: WORKSPACE,
    activeThreadId: "thread-1",
    activeItems: overrides?.activeItems ?? [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "Fix the broken validation path.",
      },
    ],
    threadStatusById: overrides?.threadStatusById ?? {
      "thread-1": {
        isProcessing: true,
      },
    },
    getThreadCodexParams: vi.fn(() => ({
      autoDriveDraft: {
        enabled: true,
        destination: {
          title: "Fix runtime validation",
          endState: "",
          doneDefinition: "",
          avoid: "",
          routePreference: "stability_first" as const,
        },
        budget: {
          maxTokens: 12000,
          maxIterations: 3,
          maxDurationMinutes: 30,
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
          maxAutomaticFollowUps: overrides?.maxAutomaticFollowUps ?? 2,
          requireValidationSuccessToStop: true,
          minimumConfidenceToStop: "high" as const,
        },
      },
    })),
    sendUserMessageToThread,
  };
}

describe("useMainAppAutoDriveContinuation", () => {
  it("sends a focused follow-up when the active thread completes with a failure gap", async () => {
    const sendUserMessageToThread = vi.fn(async () => undefined);
    const { rerender } = renderHook((props) => useMainAppAutoDriveContinuation(props), {
      initialProps: createProps({ sendUserMessageToThread }),
    });

    rerender(
      createProps({
        sendUserMessageToThread,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
          },
        },
        activeItems: [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Fix the broken validation path.",
          },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "bash",
            title: "bash failed",
            detail: "Command failed with exit code 1",
            status: "failed",
            output: "test -f missing-file && exit 0",
            changes: [{ path: "autodrive-thread-chain-probe.txt" }],
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "Validation failed and the route is still pending.",
          },
        ],
      })
    );

    await waitFor(() => {
      expect(sendUserMessageToThread).toHaveBeenCalledTimes(1);
    });
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      WORKSPACE,
      "thread-1",
      expect.stringContaining("AutoDrive continuation"),
      [],
      {
        skipPromptExpansion: true,
      }
    );
  });

  it("does not send a follow-up when the completed turn has no unresolved failure signal", async () => {
    const sendUserMessageToThread = vi.fn(async () => undefined);
    const { rerender } = renderHook((props) => useMainAppAutoDriveContinuation(props), {
      initialProps: createProps({ sendUserMessageToThread }),
    });

    rerender(
      createProps({
        sendUserMessageToThread,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
          },
        },
        activeItems: [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Fix the broken validation path.",
          },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "bash",
            title: "bash",
            detail: "Validation passed",
            status: "completed",
            output: "pnpm validate:fast",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "Validation passed. Goal reached.",
          },
        ],
      })
    );

    await waitFor(() => {
      expect(sendUserMessageToThread).not.toHaveBeenCalled();
    });
  });

  it("respects the automatic follow-up budget across repeated continuation turns", async () => {
    const sendUserMessageToThread = vi.fn(async () => undefined);
    const { rerender } = renderHook((props) => useMainAppAutoDriveContinuation(props), {
      initialProps: createProps({ sendUserMessageToThread, maxAutomaticFollowUps: 1 }),
    });

    const failedTurnItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "Fix the broken validation path.",
      },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "bash",
        title: "bash failed",
        detail: "Command failed with exit code 1",
        status: "failed",
        output: "test -f missing-file && exit 0",
      },
      {
        id: "assistant-1",
        kind: "message",
        role: "assistant",
        text: "Validation failed and the route is still pending.",
      },
    ];

    rerender(
      createProps({
        sendUserMessageToThread,
        maxAutomaticFollowUps: 1,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
          },
        },
        activeItems: failedTurnItems,
      })
    );

    await waitFor(() => {
      expect(sendUserMessageToThread).toHaveBeenCalledTimes(1);
    });

    const autoPromptText = sendUserMessageToThread.mock.calls[0]?.[2];
    expect(typeof autoPromptText).toBe("string");

    rerender(
      createProps({
        sendUserMessageToThread,
        maxAutomaticFollowUps: 1,
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
          },
        },
        activeItems: [
          ...failedTurnItems,
          {
            id: "user-2",
            kind: "message",
            role: "user",
            text: autoPromptText,
          },
        ],
      })
    );

    rerender(
      createProps({
        sendUserMessageToThread,
        maxAutomaticFollowUps: 1,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
          },
        },
        activeItems: [
          ...failedTurnItems,
          {
            id: "user-2",
            kind: "message",
            role: "user",
            text: autoPromptText,
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "bash",
            title: "bash failed again",
            detail: "Command failed with exit code 1",
            status: "failed",
            output: "pnpm validate:fast",
          },
          {
            id: "assistant-2",
            kind: "message",
            role: "assistant",
            text: "Validation is still pending.",
          },
        ],
      })
    );

    await waitFor(() => {
      expect(sendUserMessageToThread).toHaveBeenCalledTimes(1);
    });
  });
});
