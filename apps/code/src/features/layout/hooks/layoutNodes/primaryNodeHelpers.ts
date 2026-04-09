import type { RecentThreadStatus } from "../../../app/components/RecentThreadStrip";
import { getApprovalRequestThreadId } from "../../../messages/utils/approvalPresentation";
import { resolveActivePlanArtifact } from "../../../messages/utils/planArtifact";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { resolveThreadVisualState } from "../../../threads/utils/threadExecutionState";
import type { LayoutNodesFieldRegistry } from "./types";

export function normalizeRecentThreadStatus(
  status: ReturnType<typeof resolveThreadVisualState>
): RecentThreadStatus {
  return status === "needsAttention" ? "awaitingInput" : status;
}

export function resolveActiveComposerUserInputRequest(options: LayoutNodesFieldRegistry) {
  if (!options.activeThreadId) {
    return null;
  }
  const activeRequest =
    options.userInputRequests.find(
      (request) =>
        request.params.thread_id === options.activeThreadId &&
        (!options.activeWorkspace?.id || request.workspace_id === options.activeWorkspace.id)
    ) ?? null;
  if (!activeRequest) {
    return null;
  }
  if (activeRequest.params.questions.some((question) => question.isSecret)) {
    return null;
  }
  return activeRequest;
}

export function resolveActiveComposerApprovalRequest(options: LayoutNodesFieldRegistry) {
  if (!options.activeThreadId || !options.activeWorkspace?.id) {
    return null;
  }
  const threadApprovals = options.approvals.filter(
    (request) =>
      request.workspace_id === options.activeWorkspace?.id &&
      getApprovalRequestThreadId(request) === options.activeThreadId
  );
  return threadApprovals[threadApprovals.length - 1] ?? null;
}

export function resolveActiveComposerToolCallRequest(options: LayoutNodesFieldRegistry) {
  if (!options.activeThreadId) {
    return null;
  }
  return (
    options.toolCallRequests.find(
      (request) =>
        request.params.thread_id === options.activeThreadId &&
        (!options.activeWorkspace?.id || request.workspace_id === options.activeWorkspace.id)
    ) ?? null
  );
}

export function resolveActiveComposerPlanFollowup(options: LayoutNodesFieldRegistry) {
  const artifact = resolveActivePlanArtifact({
    threadId: options.activeThreadId,
    items: options.activeItems,
    isThinking: options.isProcessing,
    hasBlockingSurface: Boolean(
      resolveActiveComposerUserInputRequest(options) ||
      resolveActiveComposerToolCallRequest(options)
    ),
  });

  if (!artifact) {
    return null;
  }
  if (!options.onPlanAccept || !options.onPlanSubmitChanges) {
    return null;
  }
  return artifact;
}

export function resolveApprovalMissionTarget(
  request: LayoutNodesFieldRegistry["approvals"][number],
  projection: LayoutNodesFieldRegistry["missionControlProjection"]
): MissionNavigationTarget | null {
  if (!projection) {
    return null;
  }
  const threadId = getApprovalRequestThreadId(request);
  if (!threadId) {
    return null;
  }

  const runById = new Map(projection.runs.map((run) => [run.id, run]));
  const reviewPackIdByRunId = new Map(
    projection.reviewPacks.map((reviewPack) => [reviewPack.runId, reviewPack.id])
  );

  const matchingTasks = projection.tasks
    .filter(
      (task) => task.workspaceId === request.workspace_id && task.origin.threadId === threadId
    )
    .map((task) => {
      const currentRun = task.currentRunId ? (runById.get(task.currentRunId) ?? null) : null;
      const latestRun = task.latestRunId ? (runById.get(task.latestRunId) ?? null) : null;
      const approvalRun =
        currentRun?.approval?.status === "pending_decision"
          ? currentRun
          : latestRun?.approval?.status === "pending_decision"
            ? latestRun
            : null;
      const run = approvalRun ?? currentRun ?? latestRun ?? null;
      const updatedAt = run?.updatedAt ?? task.updatedAt;
      const priority = approvalRun ? 2 : currentRun ? 1 : 0;
      return {
        task,
        run,
        updatedAt,
        priority,
      };
    })
    .sort((left, right) => right.priority - left.priority || right.updatedAt - left.updatedAt);

  const bestMatch = matchingTasks[0];
  if (!bestMatch) {
    return null;
  }

  return {
    kind: "mission",
    workspaceId: bestMatch.task.workspaceId,
    taskId: bestMatch.task.id,
    runId: bestMatch.run?.id ?? bestMatch.task.currentRunId ?? bestMatch.task.latestRunId ?? null,
    reviewPackId:
      bestMatch.run?.reviewPackId ??
      (bestMatch.run ? (reviewPackIdByRunId.get(bestMatch.run.id) ?? null) : null),
    threadId,
    limitation: null,
  };
}
