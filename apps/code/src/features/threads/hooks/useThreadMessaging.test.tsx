/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareRuntimeRunV2 as prepareRuntimeRunV2Service } from "../../../application/runtime/ports/tauriRuntimeJobs";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { WorkspaceInfo } from "../../../types";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import { recordSentryMetric } from "../../shared/sentry";
import type { ThreadCodexParams } from "../utils/threadStorage";
import { useThreadMessaging } from "./useThreadMessaging";

const runtimeSessionCommandMocks = vi.hoisted(() => ({
  sendUserMessage: vi.fn(),
  steerTurn: vi.fn(),
  startReview: vi.fn(),
  interruptTurn: vi.fn(),
  listMcpServerStatus: vi.fn(),
  compactThread: vi.fn(),
  canStartReviewInCurrentHost: vi.fn(() => true),
}));

const sendUserMessageService = runtimeSessionCommandMocks.sendUserMessage;
const steerTurnService = runtimeSessionCommandMocks.steerTurn;
const startReviewService = runtimeSessionCommandMocks.startReview;
const interruptTurnService = runtimeSessionCommandMocks.interruptTurn;
const listMcpServerStatusService = runtimeSessionCommandMocks.listMcpServerStatus;
const compactThreadService = runtimeSessionCommandMocks.compactThread;
const canStartReviewInCurrentHost = runtimeSessionCommandMocks.canStartReviewInCurrentHost;
const REVIEW_START_DESKTOP_ONLY_MESSAGE = "Review start is only available in the desktop app.";

const openReviewPromptMock = vi.fn();
const closeReviewPromptMock = vi.fn();
const showPresetStepMock = vi.fn();
const choosePresetMock = vi.fn();
const setHighlightedPresetIndexMock = vi.fn();
const setHighlightedBranchIndexMock = vi.fn();
const setHighlightedCommitIndexMock = vi.fn();
const handleReviewPromptKeyDownMock = vi.fn(() => false);
const confirmBranchMock = vi.fn();
const selectBranchMock = vi.fn();
const selectBranchAtIndexMock = vi.fn();
const selectCommitMock = vi.fn();
const selectCommitAtIndexMock = vi.fn();
const confirmCommitMock = vi.fn();
const updateCustomInstructionsMock = vi.fn();
const confirmCustomMock = vi.fn();

vi.mock("../../shared/sentry", () => ({
  recordSentryMetric: vi.fn(),
}));

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

vi.mock("../../../application/runtime/ports/tauriRuntimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
}));
vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeSessionCommands", () => ({
  useRuntimeSessionCommandsResolver: () => (workspaceId: string) => ({
    sendMessage: ({ threadId, text, options }: Record<string, unknown>) =>
      runtimeSessionCommandMocks.sendUserMessage(workspaceId, threadId, text, options),
    steerTurn: ({
      threadId,
      turnId,
      text,
      images,
      contextPrefix,
      options,
    }: Record<string, unknown>) =>
      runtimeSessionCommandMocks.steerTurn(
        workspaceId,
        threadId,
        turnId,
        text,
        images,
        contextPrefix,
        options
      ),
    interruptTurn: ({ threadId, turnId }: Record<string, unknown>) =>
      runtimeSessionCommandMocks.interruptTurn(workspaceId, threadId, turnId),
    startReview: ({ threadId, target, delivery }: Record<string, unknown>) =>
      runtimeSessionCommandMocks.startReview(workspaceId, threadId, target, delivery),
    compactThread: ({ threadId }: Record<string, unknown>) =>
      runtimeSessionCommandMocks.compactThread(workspaceId, threadId),
    listMcpServerStatus: (input?: { cursor?: string | null; limit?: number | null }) =>
      runtimeSessionCommandMocks.listMcpServerStatus(
        workspaceId,
        input?.cursor ?? null,
        input?.limit ?? null
      ),
    canStartReviewInCurrentHost: runtimeSessionCommandMocks.canStartReviewInCurrentHost,
    reviewStartDesktopOnlyMessage: REVIEW_START_DESKTOP_ONLY_MESSAGE,
  }),
}));

vi.mock("./useReviewPrompt", () => ({
  useReviewPrompt: () => ({
    reviewPrompt: null,
    openReviewPrompt: openReviewPromptMock,
    closeReviewPrompt: closeReviewPromptMock,
    showPresetStep: showPresetStepMock,
    choosePreset: choosePresetMock,
    highlightedPresetIndex: 0,
    setHighlightedPresetIndex: setHighlightedPresetIndexMock,
    highlightedBranchIndex: 0,
    setHighlightedBranchIndex: setHighlightedBranchIndexMock,
    highlightedCommitIndex: 0,
    setHighlightedCommitIndex: setHighlightedCommitIndexMock,
    handleReviewPromptKeyDown: handleReviewPromptKeyDownMock,
    confirmBranch: confirmBranchMock,
    selectBranch: selectBranchMock,
    selectBranchAtIndex: selectBranchAtIndexMock,
    selectCommit: selectCommitMock,
    selectCommitAtIndex: selectCommitAtIndexMock,
    confirmCommit: confirmCommitMock,
    updateCustomInstructions: updateCustomInstructionsMock,
    confirmCustom: confirmCustomMock,
  }),
}));

describe("useThreadMessaging telemetry", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canStartReviewInCurrentHost).mockReturnValue(true);
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(steerTurnService).mockResolvedValue({
      result: {
        turnId: "turn-1",
      },
    } as unknown as Awaited<ReturnType<typeof steerTurnService>>);
    vi.mocked(startReviewService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startReviewService>>
    );
    vi.mocked(interruptTurnService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof interruptTurnService>>
    );
    vi.mocked(listMcpServerStatusService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof listMcpServerStatusService>>
    );
    vi.mocked(prepareRuntimeRunV2Service).mockRejectedValue(
      new Error("runtime context unavailable")
    );
    vi.mocked(compactThreadService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof compactThreadService>>
    );
  });

  describe("slash review routing", () => {
    function createReviewMessagingHarness() {
      const ensureThreadForActiveWorkspace = vi.fn(async () => "thread-1");
      const ensureThreadForWorkspace = vi.fn(async () => "thread-1");
      const pushThreadErrorMessage = vi.fn();

      const hook = renderHook(() =>
        useThreadMessaging({
          activeWorkspace: workspace,
          activeThreadId: "thread-1",
          accessMode: "on-request",
          model: null,
          effort: null,
          collaborationMode: null,
          reviewDeliveryMode: "inline",
          steerEnabled: false,
          customPrompts: [],
          threadStatusById: {},
          activeTurnIdByThread: {},
          rateLimitsByWorkspace: {},
          pendingInterruptsRef: { current: new Set<string>() },
          dispatch: vi.fn(),
          getCustomName: vi.fn(() => undefined),
          markProcessing: vi.fn(),
          markReviewing: vi.fn(),
          setActiveTurnId: vi.fn(),
          recordThreadActivity: vi.fn(),
          safeMessageActivity: vi.fn(),
          onDebug: vi.fn(),
          pushThreadErrorMessage,
          ensureThreadForActiveWorkspace,
          ensureThreadForWorkspace,
          refreshThread: vi.fn(async () => null),
          forkThreadForWorkspace: vi.fn(async () => null),
          updateThreadParent: vi.fn(),
        })
      );

      return {
        ...hook,
        ensureThreadForActiveWorkspace,
        ensureThreadForWorkspace,
        pushThreadErrorMessage,
      };
    }

    it("opens the review prompt instead of sending a message when /review has no target", async () => {
      const { result, ensureThreadForActiveWorkspace } = createReviewMessagingHarness();

      await act(async () => {
        await result.current.startReview("/review");
      });

      expect(openReviewPromptMock).toHaveBeenCalledTimes(1);
      expect(ensureThreadForActiveWorkspace).not.toHaveBeenCalled();
      expect(startReviewService).not.toHaveBeenCalled();
      expect(sendUserMessageService).not.toHaveBeenCalled();
    });

    it("starts a direct review when /review includes an explicit target", async () => {
      const { result, ensureThreadForActiveWorkspace } = createReviewMessagingHarness();

      await act(async () => {
        await result.current.startReview("/review base main");
      });

      expect(openReviewPromptMock).not.toHaveBeenCalled();
      expect(ensureThreadForActiveWorkspace).toHaveBeenCalledTimes(1);
      expect(startReviewService).toHaveBeenCalledWith(
        workspace.id,
        "thread-1",
        {
          type: "baseBranch",
          branch: "main",
        },
        "inline"
      );
      expect(sendUserMessageService).not.toHaveBeenCalled();
    });

    it("surfaces a thread error instead of opening review prompt in web mode", async () => {
      vi.mocked(canStartReviewInCurrentHost).mockReturnValue(false);
      const { result, ensureThreadForActiveWorkspace, pushThreadErrorMessage } =
        createReviewMessagingHarness();
      let reviewResult: Awaited<ReturnType<typeof result.current.startReview>> | undefined;

      await act(async () => {
        reviewResult = await result.current.startReview("/review base main");
      });

      expect(reviewResult).toBe(false);
      expect(openReviewPromptMock).not.toHaveBeenCalled();
      expect(ensureThreadForActiveWorkspace).not.toHaveBeenCalled();
      expect(startReviewService).not.toHaveBeenCalled();
      expect(pushThreadErrorMessage).toHaveBeenCalledWith(
        "thread-1",
        REVIEW_START_DESKTOP_ONLY_MESSAGE
      );
      expect(pushErrorToast).not.toHaveBeenCalled();
    });

    it("shows a toast instead of navigating into review prompt in web mode when no thread is active", async () => {
      vi.mocked(canStartReviewInCurrentHost).mockReturnValue(false);

      const ensureThreadForActiveWorkspace = vi.fn(async () => "thread-1");
      const ensureThreadForWorkspace = vi.fn(async () => "thread-1");
      const pushThreadErrorMessage = vi.fn();

      const { result } = renderHook(() =>
        useThreadMessaging({
          activeWorkspace: workspace,
          activeThreadId: null,
          accessMode: "on-request",
          model: null,
          effort: null,
          collaborationMode: null,
          reviewDeliveryMode: "inline",
          steerEnabled: false,
          customPrompts: [],
          threadStatusById: {},
          activeTurnIdByThread: {},
          rateLimitsByWorkspace: {},
          pendingInterruptsRef: { current: new Set<string>() },
          dispatch: vi.fn(),
          getCustomName: vi.fn(() => undefined),
          markProcessing: vi.fn(),
          markReviewing: vi.fn(),
          setActiveTurnId: vi.fn(),
          recordThreadActivity: vi.fn(),
          safeMessageActivity: vi.fn(),
          onDebug: vi.fn(),
          pushThreadErrorMessage,
          ensureThreadForActiveWorkspace,
          ensureThreadForWorkspace,
          refreshThread: vi.fn(async () => null),
          forkThreadForWorkspace: vi.fn(async () => null),
          updateThreadParent: vi.fn(),
        })
      );
      let reviewResult: Awaited<ReturnType<typeof result.current.startReview>> | undefined;

      await act(async () => {
        reviewResult = await result.current.startReview("/review");
      });

      expect(reviewResult).toBe(false);
      expect(openReviewPromptMock).not.toHaveBeenCalled();
      expect(ensureThreadForActiveWorkspace).not.toHaveBeenCalled();
      expect(startReviewService).not.toHaveBeenCalled();
      expect(pushThreadErrorMessage).not.toHaveBeenCalled();
      expect(pushErrorToast).toHaveBeenCalledWith({
        title: "Desktop review only",
        message: REVIEW_START_DESKTOP_ONLY_MESSAGE,
      });
    });
  });

  it("emits a pending draft user message immediately before first thread is created", async () => {
    let resolveThreadId: (threadId: string | null) => void = () => undefined;
    const ensureThreadForActiveWorkspace = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveThreadId = (threadId) => resolve(threadId);
        })
    );
    const setPendingDraftUserMessage = vi.fn();
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: null,
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace,
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        setPendingDraftUserMessage,
      })
    );

    let sendPromise: Promise<void> | null = null;
    await act(async () => {
      sendPromise = result.current.sendUserMessage("hello", []);
      await Promise.resolve();
    });

    expect(setPendingDraftUserMessage).toHaveBeenNthCalledWith(
      1,
      workspace.id,
      expect.objectContaining({
        kind: "message",
        role: "user",
        text: "hello",
      }),
      "add"
    );

    resolveThreadId("thread-1");
    if (!sendPromise) {
      throw new Error("Expected send promise to be initialized.");
    }
    await act(async () => {
      await sendPromise;
    });

    const pendingId = String(setPendingDraftUserMessage.mock.calls[0]?.[1]?.id ?? "");
    const optimisticAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(
        (action) =>
          action &&
          typeof action === "object" &&
          "type" in action &&
          action.type === "upsertItem" &&
          "item" in action &&
          action.item?.kind === "message" &&
          action.item?.role === "user"
      );
    expect(optimisticAction?.item?.id).toBe(pendingId);
    expect(setPendingDraftUserMessage).toHaveBeenLastCalledWith(
      workspace.id,
      expect.objectContaining({ id: pendingId }),
      "remove"
    );
  });

  it("records prompt_sent once for one message send", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(recordSentryMetric).toHaveBeenCalledTimes(2);
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "prompt_sent",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          workspace_id: "ws-1",
          thread_id: "thread-1",
          has_images: "false",
          text_length: "5",
        }),
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      "define_started",
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestMode: "start",
        eventSource: "thread_messaging",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      "delegate_started",
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestMode: "start",
        eventSource: "thread_messaging",
      })
    );
  });

  it("notifies thread title autogeneration from the optimistic first user message", async () => {
    const onUserMessageCreated = vi.fn();

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        onUserMessageCreated,
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "first prompt", []);
    });

    expect(onUserMessageCreated).toHaveBeenCalledWith("ws-1", "thread-1", "first prompt");
  });

  it("forwards selected execution mode to turn/start payload", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "local-cli",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        executionMode: "local-cli",
      })
    );
  });

  it("skips atlas context injection for explicit local-cli sends", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "local-cli",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        itemsByThreadRef: {
          current: {
            "thread-1": [
              {
                id: "msg-1",
                kind: "message",
                role: "user",
                text: "hello atlas",
              },
            ],
          },
        },
        planByThreadRef: {
          current: {
            "thread-1": null,
          },
        },
        tokenUsageByThreadRef: {
          current: {},
        },
        getAtlasDriverOrder: vi.fn(() => [
          "recent_messages",
          "plan",
          "context_compaction",
          "token_budget",
          "execution_state",
        ]),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        executionMode: "local-cli",
        contextPrefix: null,
      })
    );
  });

  it("forwards the explicit provider route for local Claude turns", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        provider: "claude_code_local",
        model: "claude-sonnet-4-5",
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        provider: "claude_code_local",
        model: "claude-sonnet-4-5",
      })
    );
  });

  it("forwards enabled autodrive draft into the runtime turn payload", async () => {
    const getThreadCodexParams = vi.fn<
      (workspaceId: string, threadId: string) => ThreadCodexParams | null
    >(() => ({
      modelId: null,
      effort: null,
      fastMode: null,
      accessMode: null,
      collaborationModeId: null,
      executionMode: null,
      missionMode: null,
      executionProfileId: null,
      preferredBackendIds: null,
      autoDriveDraft: {
        enabled: true,
        destination: {
          title: "Ship runtime truth",
          endState: "Runtime-backed controls",
          doneDefinition: "pnpm validate:fast passes",
          avoid: "Do not widen scope",
          routePreference: "validation_first" as const,
        },
        budget: {
          maxTokens: 2800,
          maxIterations: 3,
          maxDurationMinutes: 10,
          maxFilesPerIteration: 5,
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
      },
      updatedAt: 0,
    }));

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "runtime",
        model: "gpt-5.4",
        effort: "medium",
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        getThreadCodexParams,
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "continue", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "continue",
      expect.objectContaining({
        autoDrive: expect.objectContaining({
          destination: expect.objectContaining({
            title: "Ship runtime truth",
          }),
          continuationPolicy: expect.objectContaining({
            enabled: true,
            maxAutomaticFollowUps: 2,
          }),
        }),
      })
    );
  });

  it("forwards effective codex overrides for local-cli sends", async () => {
    const workspaceWithOverrides: WorkspaceInfo = {
      ...workspace,
      codex_bin: "/opt/custom/codex",
      settings: {
        ...workspace.settings,
        codexArgs: "--profile workspace --verbose",
      },
    };

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspaceWithOverrides,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "local-cli",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        defaultCodexBin: "codex",
        defaultCodexArgs: "--profile personal",
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspaceWithOverrides, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        executionMode: "local-cli",
        codexBin: "/opt/custom/codex",
        codexArgs: ["--profile", "workspace", "--verbose"],
      })
    );
  });

  it("adds an optimistic user message immediately for turn/start sends", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    const optimisticAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(
        (action) =>
          action &&
          typeof action === "object" &&
          "type" in action &&
          action.type === "upsertItem" &&
          "item" in action &&
          typeof action.item === "object" &&
          action.item?.kind === "message" &&
          action.item?.role === "user"
      );

    expect(optimisticAction).toMatchObject({
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      item: {
        kind: "message",
        role: "user",
        text: "hello",
      },
    });
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.any(Object)
    );
  });

  it("blocks send attempts when no model route is available", async () => {
    const pushThreadErrorMessage = vi.fn();
    const markProcessing = vi.fn();

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        hasAvailableModel: false,
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "No available model route in current runtime. Sign in with a provider account or configure API keys."
    );
    expect(markProcessing).not.toHaveBeenCalled();
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("allows explicit model sends even when runtime marks catalog unavailable", async () => {
    const pushThreadErrorMessage = vi.fn();

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        hasAvailableModel: false,
        accessMode: "on-request",
        model: "gpt-5.3-codex",
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(pushThreadErrorMessage).not.toHaveBeenCalledWith(
      "thread-1",
      "No available model route in current runtime. Sign in with a provider account or configure API keys."
    );
    expect(sendUserMessageService).toHaveBeenCalled();
  });

  it("forwards explicit app mentions to turn/start", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessage("hello $calendar", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello $calendar",
      expect.any(Object)
    );
  });

  it("uses turn/steer when steer mode is enabled and an active turn is present", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer this", []);
    });

    expect(steerTurnService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "steer this",
      [],
      undefined,
      {
        accessMode: "on-request",
        collaborationMode: null,
        codexArgs: null,
        codexBin: null,
        effort: null,
        executionMode: "runtime",
        executionProfileId: null,
        missionMode: null,
        model: null,
        preferredBackendIds: null,
        serviceTier: null,
      }
    );
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("forwards composer options through turn/steer when an active turn is present", async () => {
    const collaborationMode = {
      mode: "plan",
      settings: {
        id: "plan",
        developer_instructions: "Stay in planning mode.",
      },
    };
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "full-access",
        model: "gpt-5.3-codex",
        effort: "high",
        fastMode: true,
        collaborationMode,
        executionMode: "hybrid",
        defaultCodexBin: "/opt/codex",
        defaultCodexArgs: '--profile "fast lane" --sandbox workspace-write',
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer this", []);
    });

    expect(steerTurnService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "steer this",
      [],
      undefined,
      {
        accessMode: "full-access",
        collaborationMode: {
          id: "plan",
          mode: "plan",
          settings: {
            id: "plan",
          },
        },
        codexArgs: ["--profile", "fast lane", "--sandbox", "workspace-write"],
        codexBin: "/opt/codex",
        effort: "high",
        executionMode: "hybrid",
        executionProfileId: null,
        missionMode: null,
        model: "gpt-5.3-codex",
        preferredBackendIds: null,
        serviceTier: "fast",
      }
    );
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("falls back to turn/start when steer mode is enabled but active turn id is missing", async () => {
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug,
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer without turn id",
        []
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "steer without turn id",
      expect.any(Object)
    );
    expect(steerTurnService).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "turn/start",
        payload: expect.objectContaining({
          routeReason: "fallback_to_start_missing_turn_id",
        }),
      })
    );
  });

  it("does not fall back to turn/start when steer request fails", async () => {
    const pushThreadErrorMessage = vi.fn();
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: {
        message: "unknown method: turn_steer",
      },
    } as unknown as Awaited<ReturnType<typeof steerTurnService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer should fail", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: unknown method: turn_steer"
    );
  });

  it("injects atlas context prefix into turn/start payload when resolver is available", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        itemsByThreadRef: {
          current: {
            "thread-1": [
              {
                id: "msg-1",
                kind: "message",
                role: "user",
                text: "hello atlas",
              },
            ],
          },
        },
        planByThreadRef: {
          current: {
            "thread-1": null,
          },
        },
        tokenUsageByThreadRef: {
          current: {},
        },
        getAtlasDriverOrder: vi.fn(() => [
          "recent_messages",
          "plan",
          "context_compaction",
          "token_budget",
        ]),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        contextPrefix: expect.stringContaining("execution_state"),
      })
    );
  });

  it("prefers runtime-owned context prefixes when runtime prepare succeeds", async () => {
    vi.mocked(prepareRuntimeRunV2Service).mockResolvedValue({
      preparedAt: 1_700_000_000_000,
      runIntent: {
        title: "hello",
        objective: "hello",
        summary: "runtime plan",
        taskSource: null,
        accessMode: "on-request",
        executionMode: "single",
        executionProfileId: null,
        reviewProfileId: null,
        validationPresetId: null,
        preferredBackendIds: [],
        requiredCapabilities: [],
        riskLevel: "low",
        clarified: true,
        missingContext: [],
      },
      contextWorkingSet: {
        summary: "Runtime prepared a compact working set.",
        workspaceRoot: "/tmp/workspace",
        selectionPolicy: {
          strategy: "balanced",
          tokenBudgetTarget: 1500,
          toolExposureProfile: "slim",
          preferColdFetch: true,
        },
        contextFingerprint: "work-123",
        stablePrefixFingerprint: "stable-123",
        layers: [
          {
            tier: "hot",
            summary: "Immediate context",
            entries: [
              {
                id: "workspace-root",
                label: "Workspace root",
                kind: "workspace",
                detail: "/tmp/workspace",
                source: "/tmp/workspace",
              },
            ],
          },
        ],
      },
      executionGraph: {
        graphId: "graph-1",
        summary: "graph",
        nodes: [],
      },
      approvalBatches: [],
      validationPlan: {
        required: false,
        summary: "none",
        commands: [],
      },
      reviewFocus: [],
      autonomyProfile: "night_operator",
      wakePolicy: {
        mode: "auto_queue",
        safeFollowUp: true,
        allowAutomaticContinuation: true,
        allowedActions: ["continue"],
        stopGates: [],
        queueBudget: null,
      },
      intentSnapshot: {
        summary: "intent",
        primaryGoal: "hello",
        dominantDirection: "hello",
        confidence: "high",
        signals: [],
      },
      opportunityQueue: {
        selectedOpportunityId: null,
        selectionSummary: "none",
        candidates: [],
      },
      researchTrace: {
        mode: "repository_only",
        stage: "repository",
        summary: "repo only",
        citations: [],
        sensitiveContextMixed: false,
      },
      executionEligibility: {
        eligible: true,
        summary: "ready",
        wakeState: "ready",
        nextEligibleAction: "continue",
        blockingReasons: [],
      },
      wakePolicySummary: {
        summary: "summary",
        safeFollowUp: true,
        allowedActions: ["continue"],
        queueBudget: null,
      },
    });

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => "Thread title"),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(prepareRuntimeRunV2Service).toHaveBeenCalled();
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "runtime_context_prepare",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          result: "runtime",
          strategy: "balanced",
          tool_profile: "slim",
        }),
      })
    );
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        contextPrefix: expect.stringContaining("[RUNTIME_CONTEXT v2]"),
      })
    );
  });

  it("injects atlas long-term memory digest when atlas resolver provides it", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        itemsByThreadRef: { current: { "thread-1": [] } },
        planByThreadRef: { current: { "thread-1": null } },
        tokenUsageByThreadRef: { current: {} },
        getAtlasDriverOrder: vi.fn(() => ["long_term_memory"]),
        getAtlasDetailLevel: vi.fn(() => "detailed"),
        getAtlasLongTermMemoryDigest: vi.fn(() => ({
          summary: "Persisted long-term memory summary.",
          updatedAt: 1_737_000_000_000,
        })),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        contextPrefix: expect.stringContaining("Memory digest"),
      })
    );
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "runtime_context_prepare",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          result: "fallback",
        }),
      })
    );
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "runtime_context_prepare",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          result: "atlas_fallback",
        }),
      })
    );
  });

  it("injects local attachment paths into turn/start context prefix", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "review this file", [
        "C:\\tmp\\brief.pdf",
        "data:image/png;base64,AAAA",
      ]);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "review this file",
      expect.objectContaining({
        contextPrefix: expect.stringContaining("[ATTACHMENTS v1]"),
        images: ["C:\\tmp\\brief.pdf", "data:image/png;base64,AAAA"],
      })
    );
    expect(vi.mocked(sendUserMessageService).mock.calls.at(-1)?.[3]?.contextPrefix).toContain(
      "brief.pdf :: C:\\tmp\\brief.pdf"
    );
    expect(vi.mocked(sendUserMessageService).mock.calls.at(-1)?.[3]?.contextPrefix).not.toContain(
      "data:image/png"
    );
  });

  it("skips atlas context injection when thread atlas toggle is disabled", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        itemsByThreadRef: {
          current: {
            "thread-1": [
              {
                id: "msg-off",
                kind: "message",
                role: "user",
                text: "atlas off",
              },
            ],
          },
        },
        planByThreadRef: {
          current: {
            "thread-1": null,
          },
        },
        tokenUsageByThreadRef: {
          current: {},
        },
        getAtlasDriverOrder: vi.fn(() => [
          "recent_messages",
          "plan",
          "context_compaction",
          "token_budget",
          "execution_state",
        ]),
        getAtlasEnabled: vi.fn(() => false),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        contextPrefix: null,
      })
    );
  });

  it("injects atlas context prefix into turn/steer payload when steering", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        itemsByThreadRef: {
          current: {
            "thread-1": [
              {
                id: "msg-2",
                kind: "message",
                role: "assistant",
                text: "draft",
              },
            ],
          },
        },
        planByThreadRef: {
          current: {
            "thread-1": null,
          },
        },
        tokenUsageByThreadRef: {
          current: {},
        },
        getAtlasDriverOrder: vi.fn(() => [
          "plan",
          "recent_messages",
          "context_compaction",
          "token_budget",
        ]),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer this", []);
    });

    expect(steerTurnService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "steer this",
      [],
      expect.stringContaining("execution_state"),
      {
        accessMode: "on-request",
        collaborationMode: null,
        codexArgs: null,
        codexBin: null,
        effort: null,
        executionMode: "runtime",
        executionProfileId: null,
        missionMode: null,
        model: null,
        preferredBackendIds: null,
        serviceTier: null,
      }
    );
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });
  it("shows the stable collaboration mode id in session status even without settings.id", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "runtime",
        model: null,
        effort: null,
        collaborationMode: {
          id: "pair-programming",
          mode: "default",
          label: "Pair Programming",
        },
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.startStatus("");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "addAssistantMessage",
      threadId: "thread-1",
      text: expect.stringContaining("- Collaboration: pair-programming"),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "markImmediateCompletion",
      threadId: "thread-1",
    });
  });

  it("normalizes minimal chat collaboration mode before sending the turn", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        executionMode: "runtime",
        model: null,
        effort: null,
        collaborationMode: {
          mode: "default",
        },
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "continue in chat", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith("ws-1", "thread-1", "continue in chat", {
      accessMode: "on-request",
      codexArgs: null,
      codexBin: null,
      collaborationMode: {
        id: "default",
        mode: "default",
        settings: { id: "default" },
      },
      contextPrefix: null,
      effort: null,
      executionMode: "runtime",
      executionProfileId: null,
      images: [],
      missionMode: null,
      model: null,
      preferredBackendIds: null,
      serviceTier: null,
    });
  });

  describe("interrupt turn routing", () => {
    function createInterruptHarness(options?: {
      activeTurnIdByThread?: Record<string, string>;
      pendingInterrupts?: string[];
    }) {
      const dispatch = vi.fn();
      const markProcessing = vi.fn();
      const setActiveTurnId = vi.fn();
      const pushThreadErrorMessage = vi.fn();
      const pendingInterruptsRef = {
        current: new Set(options?.pendingInterrupts ?? []),
      };

      const hook = renderHook(() =>
        useThreadMessaging({
          activeWorkspace: workspace,
          activeThreadId: "thread-1",
          accessMode: "on-request",
          model: null,
          effort: null,
          collaborationMode: null,
          reviewDeliveryMode: "inline",
          steerEnabled: false,
          customPrompts: [],
          threadStatusById: {},
          activeTurnIdByThread: options?.activeTurnIdByThread ?? {},
          rateLimitsByWorkspace: {},
          pendingInterruptsRef,
          dispatch,
          getCustomName: vi.fn(() => undefined),
          markProcessing,
          markReviewing: vi.fn(),
          setActiveTurnId,
          recordThreadActivity: vi.fn(),
          safeMessageActivity: vi.fn(),
          onDebug: vi.fn(),
          pushThreadErrorMessage,
          ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
          ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
          refreshThread: vi.fn(async () => null),
          forkThreadForWorkspace: vi.fn(async () => null),
          updateThreadParent: vi.fn(),
        })
      );

      return {
        ...hook,
        dispatch,
        markProcessing,
        setActiveTurnId,
        pushThreadErrorMessage,
        pendingInterruptsRef,
      };
    }

    it("keeps the active turn intact when the interrupt request is not accepted", async () => {
      vi.mocked(interruptTurnService).mockResolvedValue({
        result: {
          interrupted: false,
        },
      } as unknown as Awaited<ReturnType<typeof interruptTurnService>>);

      const { result, dispatch, markProcessing, setActiveTurnId, pushThreadErrorMessage } =
        createInterruptHarness({
          activeTurnIdByThread: {
            "thread-1": "turn-1",
          },
        });

      await act(async () => {
        await result.current.interruptTurn();
      });

      expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
      expect(markProcessing).not.toHaveBeenCalledWith("thread-1", false);
      expect(setActiveTurnId).not.toHaveBeenCalledWith("thread-1", null);
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "addAssistantMessage",
          threadId: "thread-1",
          text: "Session stopped.",
        })
      );
      expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "Failed to stop session.");
    });

    it("does not leave a stopped message behind when the pending interrupt request fails", async () => {
      vi.mocked(interruptTurnService).mockRejectedValueOnce(new Error("interrupt unavailable"));

      const { result, dispatch, pendingInterruptsRef, pushThreadErrorMessage } =
        createInterruptHarness();

      await act(async () => {
        await result.current.interruptTurn();
      });

      expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
      expect(pendingInterruptsRef.current.has("thread-1")).toBe(false);
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "addAssistantMessage",
          threadId: "thread-1",
          text: "Session stopped.",
        })
      );
      expect(pushThreadErrorMessage).toHaveBeenCalledWith(
        "thread-1",
        "Failed to stop session: interrupt unavailable"
      );
    });
  });
});
