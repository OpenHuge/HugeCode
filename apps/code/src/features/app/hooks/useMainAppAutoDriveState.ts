import type { AccessMode, ConversationItem, WorkspaceInfo } from "../../../types";
import type { AutoDriveRunRecord } from "../../../application/runtime/types/autoDrive";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../utils/runtimeWorkspaceIds";
import { normalizeLifecycleStatus } from "../../../utils/lifecycleStatus";
import { useAutoDriveController } from "../../autodrive/hooks/useAutoDriveController";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";
import type { useThreadCodexControls } from "./useThreadCodexControls";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import {
  summarizeLatestAutoDriveTurn,
  useMainAppAutoDriveContinuation,
} from "./useMainAppAutoDriveContinuation";

type AutoDriveFallbackSummary = {
  userMessageId: string;
  userText: string;
  assistantText: string | null;
  changedPaths: string[];
  failedToolDetails: string[];
};

function dedupeTrimmed(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function summarizeLatestAutoDriveFallbackOutcome(
  items: ConversationItem[]
): AutoDriveFallbackSummary | null {
  const latestAssistantIndex = [...items]
    .reverse()
    .findIndex(
      (item) => item.kind === "message" && item.role === "assistant" && item.text.trim().length > 0
    );
  if (latestAssistantIndex < 0) {
    return null;
  }

  const resolvedAssistantIndex = items.length - 1 - latestAssistantIndex;
  const assistantItem = items[resolvedAssistantIndex];
  if (!assistantItem || assistantItem.kind !== "message" || assistantItem.role !== "assistant") {
    return null;
  }

  let precedingUserIndex = -1;
  for (let index = resolvedAssistantIndex - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      precedingUserIndex = index;
      break;
    }
  }

  let previousAssistantIndex = -1;
  for (let index = resolvedAssistantIndex - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "assistant") {
      previousAssistantIndex = index;
      break;
    }
  }

  const sliceStart = Math.max(previousAssistantIndex, precedingUserIndex) + 1;
  const turnItems = items.slice(sliceStart, resolvedAssistantIndex);
  const toolItems = turnItems.filter(
    (item): item is Extract<ConversationItem, { kind: "tool" }> => item.kind === "tool"
  );
  const candidatePrecedingUserItem = precedingUserIndex >= 0 ? items[precedingUserIndex] : null;
  const precedingUserItem =
    candidatePrecedingUserItem?.kind === "message" && candidatePrecedingUserItem.role === "user"
      ? candidatePrecedingUserItem
      : null;

  return {
    userMessageId: precedingUserItem?.id ?? `autodrive-fallback:${assistantItem.id}`,
    userText: precedingUserItem?.text ?? "AutoDrive continuation",
    assistantText: assistantItem.text.trim() || null,
    changedPaths: dedupeTrimmed(
      toolItems.flatMap((item) => item.changes?.map((change) => change.path) ?? [])
    ),
    failedToolDetails: dedupeTrimmed(
      toolItems
        .filter((item) => normalizeLifecycleStatus(item.status) === "failed")
        .map((item) => {
          const base = item.title.trim() || item.detail.trim() || "Tool step failed";
          const detail = item.output?.trim() || item.detail.trim();
          return detail.length > 0 && detail !== base ? `${base}: ${detail}` : base;
        })
    ),
  };
}

function resolveThreadAutoDriveFallbackRun(params: {
  workspace: WorkspaceInfo | null;
  threadId: string | null;
  draft: ReturnType<typeof useAutoDriveController>["draft"];
  runtimeRun: ReturnType<typeof useAutoDriveController>["run"];
  activeItems: ConversationItem[];
  isProcessing: boolean;
}): AutoDriveRunRecord | null {
  const { workspace, threadId, draft, runtimeRun, activeItems, isProcessing } = params;
  if (runtimeRun || !workspace || !threadId || !draft.enabled) {
    return null;
  }

  const latestTurn =
    summarizeLatestAutoDriveTurn(activeItems) ??
    summarizeLatestAutoDriveFallbackOutcome(activeItems);
  if (!latestTurn) {
    return null;
  }

  const assistantText = latestTurn.assistantText?.trim() ?? "";
  const passDetected =
    /validation passed|goal reached|final state:\s*pass|最终状态：\s*pass|结论：[\s\S]*pass|已补齐|已完成最窄相关真实验证|route is complete/i.test(
      assistantText
    );
  const hasFailure = latestTurn.failedToolDetails.length > 0;
  const status: AutoDriveRunRecord["status"] = isProcessing
    ? "running"
    : hasFailure
      ? "failed"
      : passDetected
        ? "completed"
        : "paused";
  const stage: AutoDriveRunRecord["stage"] = isProcessing
    ? "executing_task"
    : status === "completed"
      ? "completed"
      : status === "failed"
        ? "failed"
        : "paused";
  const progress = status === "completed" ? 100 : status === "failed" ? 72 : isProcessing ? 48 : 84;
  const summaryText =
    assistantText ||
    latestTurn.failedToolDetails[0] ||
    latestTurn.userText.trim() ||
    "AutoDrive continuation is tracking the current thread.";
  const stopReason =
    status === "failed"
      ? (latestTurn.failedToolDetails[0] ?? summaryText)
      : status === "completed"
        ? "The continuation route closed the remaining validation gap."
        : status === "paused"
          ? "AutoDrive is waiting on the next thread event."
          : null;
  const now = Date.now();

  return {
    schemaVersion: "autodrive-run/v2",
    runId: `thread-fallback:${threadId}`,
    workspaceId: workspace.id,
    workspacePath: workspace.path,
    threadId,
    status,
    stage,
    destination: {
      title: draft.destination.title.trim() || "AutoDrive continuation",
      desiredEndState: draft.destination.endState
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      doneDefinition: {
        arrivalCriteria: draft.destination.doneDefinition
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
        requiredValidation: [],
        waypointIndicators: [],
      },
      hardBoundaries: draft.destination.avoid
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      routePreference: draft.destination.routePreference,
    },
    budget: {
      maxTokens: draft.budget.maxTokens,
      maxIterations: draft.budget.maxIterations,
      maxDurationMs: draft.budget.maxDurationMinutes * 60 * 1000,
      maxFilesPerIteration: draft.budget.maxFilesPerIteration,
      maxNoProgressIterations: draft.budget.maxNoProgressIterations,
      maxValidationFailures: draft.budget.maxValidationFailures,
      maxReroutes: draft.budget.maxReroutes,
    },
    riskPolicy: draft.riskPolicy,
    continuationPolicy: draft.continuation,
    continuationState: {
      automaticFollowUpCount: activeItems.filter(
        (item) =>
          item.kind === "message" &&
          item.role === "user" &&
          item.text.trim().startsWith("AutoDrive continuation")
      ).length,
      status: isProcessing ? "continuing" : status === "completed" ? "stopped" : "idle",
      lastContinuationAt: null,
      lastContinuationReason:
        latestTurn.failedToolDetails[0] ?? (assistantText.length > 0 ? assistantText : null),
    },
    execution: {
      accessMode: "full-access",
      modelId: null,
      reasoningEffort: null,
    },
    iteration: Math.max(
      1,
      activeItems.filter(
        (item) =>
          item.kind === "message" &&
          item.role === "user" &&
          item.text.trim().startsWith("AutoDrive continuation")
      ).length + 1
    ),
    totals: {
      consumedTokensEstimate: 0,
      elapsedMs: 0,
      validationFailureCount: hasFailure ? 1 : 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: latestTurn.failedToolDetails,
    completedSubgoals: latestTurn.changedPaths,
    summaries: [],
    navigation: {
      destinationSummary: draft.destination.title.trim() || "AutoDrive continuation",
      startStateSummary: null,
      routeSummary: summaryText,
      currentWaypointTitle: isProcessing ? "Continue current route" : null,
      currentWaypointObjective: isProcessing ? "Close the remaining validation gap." : null,
      currentWaypointArrivalCriteria: [],
      waypointStatus:
        status === "completed" ? "arrived" : status === "failed" ? "blocked" : "active",
      remainingMilestones: status === "completed" ? [] : ["Close the remaining validation gap"],
      currentMilestone: status === "completed" ? null : "Close the remaining validation gap",
      overallProgress: progress,
      waypointCompletion: progress,
      offRoute: status === "failed",
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: latestTurn.failedToolDetails,
      arrivalConfidence: passDetected ? "high" : hasFailure ? "low" : "medium",
      stopRisk: hasFailure ? "high" : "medium",
      remainingTokens: null,
      remainingIterations: Math.max(0, draft.budget.maxIterations - 1),
      remainingDurationMs: null,
      lastDecision: assistantText.length > 0 ? assistantText : null,
    },
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: isProcessing ? null : now,
    lastStopReason: stopReason
      ? {
          code: status === "failed" ? "execution_failed" : "goal_reached",
          detail: stopReason,
        }
      : null,
    sessionId: null,
    lastValidationSummary:
      passDetected || hasFailure ? summaryText : assistantText.length > 0 ? assistantText : null,
    currentBlocker: latestTurn.failedToolDetails[0] ?? null,
    latestReroute: null,
    latestPublishOutcome: null,
    runtimeScenarioProfile: null,
    runtimeDecisionTrace: null,
    runtimeOutcomeFeedback:
      assistantText.length > 0
        ? {
            status,
            summary: assistantText,
            failureClass: hasFailure ? "thread_tool_failure" : null,
            validationCommands: [],
            humanInterventionRequired: status === "failed",
            heldOutPreserved: null,
            at: now,
          }
        : null,
    runtimeAutonomyState: null,
    runtimeContinuationState: null,
    lastChatgptDecisionLab: null,
  };
}

export function useMainAppAutoDriveState(
  activeWorkspace: WorkspaceInfo | null,
  activeThreadId: string | null,
  missionControlProjection: HugeCodeMissionControlSnapshot | null,
  threadCodexState: Pick<
    ReturnType<typeof useThreadCodexControls>,
    "accessMode" | "selectedModelId" | "selectedEffort"
  >,
  threadCodexParamsVersion: number,
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => { autoDriveDraft?: ReturnType<typeof useAutoDriveController>["draft"] | null } | null,
  activeItems: ConversationItem[],
  threadStatusById: Record<string, { isProcessing: boolean } | undefined>,
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { skipPromptExpansion?: boolean }
  ) => Promise<void>,
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void,
  preferredBackendIds?: string[] | null,
  refreshMissionControl?: (() => Promise<void> | void) | null
) {
  const runtimeControl = useWorkspaceRuntimeAgentControl(
    (activeWorkspace?.id ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );
  const autoDriveController = useAutoDriveController({
    activeWorkspace,
    activeThreadId,
    accessMode: threadCodexState.accessMode as AccessMode,
    selectedModelId: threadCodexState.selectedModelId,
    selectedEffort: threadCodexState.selectedEffort,
    preferredBackendIds,
    missionControlProjection,
    runtimeControl,
    onRefreshMissionControl: refreshMissionControl ?? null,
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
  });

  useMainAppAutoDriveContinuation({
    activeWorkspace,
    activeThreadId,
    activeItems,
    threadStatusById,
    getThreadCodexParams,
    sendUserMessageToThread,
  });

  const fallbackRun = resolveThreadAutoDriveFallbackRun({
    workspace: activeWorkspace,
    threadId: activeThreadId,
    draft: autoDriveController.draft,
    runtimeRun: autoDriveController.run,
    activeItems,
    isProcessing: activeThreadId
      ? (threadStatusById[activeThreadId]?.isProcessing ?? false)
      : false,
  });

  return {
    ...autoDriveController,
    run: autoDriveController.run ?? fallbackRun,
  };
}
