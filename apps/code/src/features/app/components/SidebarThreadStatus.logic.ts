import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RequestUserInputRequest,
  ThreadSummary,
} from "../../../types";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { resolveTimelineMessageBanner } from "../../messages/utils/timelineSurface";
import { getApprovalRequestThreadId } from "../../messages/utils/approvalPresentation";
import { resolveActivePlanArtifact } from "../../messages/utils/planArtifact";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";

const COMPLETED_THREAD_PILL_WINDOW_MS = 15 * 60 * 1000;

type SidebarThreadStatusArgs = {
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  baseStatusById: Record<string, ThreadStatusSummary>;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
  itemsByThread: Record<string, ConversationItem[]>;
  missionControlProjection?: MissionControlProjection | null;
  now?: number;
};

function buildMissionThreadStatusMap(
  projection: MissionControlProjection | null | undefined
): Record<
  string,
  Pick<ThreadStatusSummary, "isProcessing" | "isReviewing" | "timelineState" | "executionState">
> {
  type MissionThreadStatusEntry = [
    string,
    Pick<ThreadStatusSummary, "isProcessing" | "isReviewing" | "timelineState" | "executionState">,
  ];
  if (!projection) {
    return {};
  }

  const runById = new Map(projection.runs.map((run) => [run.id, run]));
  const reviewPackByRunId = new Map(
    projection.reviewPacks.map((reviewPack) => [reviewPack.runId, reviewPack])
  );

  return Object.fromEntries(
    projection.tasks.flatMap<MissionThreadStatusEntry>((task) => {
      if (task.origin.kind !== "thread" || !task.origin.threadId || !task.latestRunId) {
        return [];
      }
      const run = runById.get(task.latestRunId);
      if (!run) {
        return [];
      }
      const reviewPack = reviewPackByRunId.get(run.id) ?? null;
      const governanceState = run.governance?.state ?? null;

      if (governanceState === "awaiting_approval") {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: false,
              isReviewing: false,
              executionState: "awaitingApproval" as const,
              timelineState: "awaitingApproval" as const,
            },
          ],
        ];
      }

      if (run.approval?.status === "pending_decision") {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: false,
              isReviewing: false,
              executionState: "awaitingApproval" as const,
              timelineState: "awaitingApproval" as const,
            },
          ],
        ];
      }

      if (governanceState === "awaiting_review") {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: false,
              isReviewing: true,
              executionState: "completed" as const,
              timelineState: "reviewReady" as const,
            },
          ],
        ];
      }

      if (
        governanceState === "action_required" ||
        reviewPack?.reviewStatus === "action_required" ||
        reviewPack?.reviewStatus === "incomplete_evidence"
      ) {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: false,
              isReviewing: false,
              executionState: "error" as const,
              timelineState: "needsAttention" as const,
            },
          ],
        ];
      }

      if (governanceState === "completed") {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: false,
              isReviewing: false,
              executionState: "completed" as const,
              timelineState: "completed" as const,
            },
          ],
        ];
      }

      if (
        run.state === "queued" ||
        run.state === "preparing" ||
        run.state === "running" ||
        run.state === "validating"
      ) {
        return [
          [
            task.origin.threadId,
            {
              isProcessing: true,
              isReviewing: false,
              executionState: "running" as const,
              timelineState: null,
            },
          ],
        ];
      }

      return [];
    })
  );
}

function shouldShowCompletedPill(
  status: ThreadStatusSummary | undefined,
  thread: ThreadSummary,
  now: number,
  items: ConversationItem[]
) {
  if (!status?.lastDurationMs || status.lastDurationMs <= 0) {
    return false;
  }
  if (status.isProcessing || status.isReviewing || status.hasUnread) {
    return false;
  }
  if (status.executionState === "awaitingApproval") {
    return false;
  }
  const latestAssistantMessage = [...items]
    .reverse()
    .find(
      (
        item
      ): item is Extract<ConversationItem, { kind: "message"; role: "assistant"; text: string }> =>
        item.kind === "message" && item.role === "assistant" && item.text.trim().length > 0
    );
  if (
    latestAssistantMessage &&
    resolveTimelineMessageBanner(latestAssistantMessage)?.tone === "error"
  ) {
    return false;
  }
  return now - thread.updatedAt <= COMPLETED_THREAD_PILL_WINDOW_MS;
}

export function deriveSidebarThreadStatusMap({
  threadsByWorkspace,
  baseStatusById,
  approvals,
  userInputRequests,
  toolCallRequests,
  itemsByThread,
  missionControlProjection = null,
  now = Date.now(),
}: SidebarThreadStatusArgs): Record<string, ThreadStatusSummary> {
  const threads = Object.values(threadsByWorkspace).flat();
  const missionStatusByThread = buildMissionThreadStatusMap(missionControlProjection);
  const approvalsByThread = new Set(
    approvals
      .map((request) => getApprovalRequestThreadId(request))
      .filter((threadId): threadId is string => Boolean(threadId))
  );
  const inputRequestsByThread = new Set(
    userInputRequests.map((request) => request.params.thread_id).filter(Boolean)
  );
  const toolRequestsByThread = new Set(
    toolCallRequests.map((request) => request.params.thread_id).filter(Boolean)
  );

  return Object.fromEntries(
    threads.map((thread) => {
      const missionStatus = missionStatusByThread[thread.id];
      const baseStatus = {
        ...baseStatusById[thread.id],
        ...missionStatus,
      };
      const hasBlockingInput =
        inputRequestsByThread.has(thread.id) || toolRequestsByThread.has(thread.id);
      const planReady =
        resolveActivePlanArtifact({
          threadId: thread.id,
          items: itemsByThread[thread.id] ?? [],
          isThinking: baseStatus?.isProcessing === true || baseStatus?.executionState === "running",
          hasBlockingSurface: hasBlockingInput,
        }) !== null;

      let timelineState: ThreadStatusSummary["timelineState"] = null;
      if (hasBlockingInput) {
        timelineState = "awaitingInput";
      } else if (missionStatus?.timelineState === "reviewReady") {
        timelineState = "reviewReady";
      } else if (missionStatus?.timelineState === "needsAttention") {
        timelineState = "needsAttention";
      } else if (
        baseStatus?.executionState === "awaitingApproval" ||
        approvalsByThread.has(thread.id)
      ) {
        timelineState = "awaitingApproval";
      } else if (planReady) {
        timelineState = "planReady";
      } else if (shouldShowCompletedPill(baseStatus, thread, now, itemsByThread[thread.id] ?? [])) {
        timelineState = "completed";
      }

      return [
        thread.id,
        {
          ...baseStatus,
          isProcessing: baseStatus?.isProcessing ?? false,
          hasUnread: baseStatus?.hasUnread ?? false,
          isReviewing: baseStatus?.isReviewing ?? false,
          executionState: baseStatus?.executionState ?? null,
          timelineState,
        } satisfies ThreadStatusSummary,
      ];
    })
  );
}
