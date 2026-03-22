import { useCallback, useMemo, useState } from "react";
import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RequestUserInputRequest,
} from "../../../types";
import { getApprovalRequestThreadId } from "../utils/approvalPresentation";
import { resolveActivePlanArtifact } from "../utils/planArtifact";

export type TimelinePanelDescriptor =
  | {
      kind: "approval";
      key: string;
      anchorItemId: string | null;
      request: ApprovalRequest;
      isPrimary: boolean;
      interactive: boolean;
    }
  | {
      kind: "plan_followup";
      key: string;
      anchorItemId: string | null;
      artifact: NonNullable<ReturnType<typeof resolveActivePlanArtifact>>;
      interactive: boolean;
    }
  | {
      kind: "tool_call_request";
      key: string;
      anchorItemId: string | null;
      request: DynamicToolCallRequest;
      interactive: boolean;
    }
  | {
      kind: "user_input_request";
      key: string;
      anchorItemId: string | null;
      request: RequestUserInputRequest;
      interactive: boolean;
    };

type UseTimelinePanelsStateParams = {
  items: ConversationItem[];
  threadId: string | null;
  workspaceId: string | null;
  isThinking: boolean;
  userInputRequests?: RequestUserInputRequest[];
  approvals?: ApprovalRequest[];
  toolCallRequests?: DynamicToolCallRequest[];
  currentTurnTerminalItemId: string | null;
  visibleTimelineItemIds: string[];
  onUserInputSubmit?: unknown;
  onApprovalDecision?: unknown;
  onPlanAccept?: unknown;
  onPlanSubmitChanges?: unknown;
  onToolCallSubmit?: unknown;
  composerApprovalRequestId?: ApprovalRequest["request_id"] | null;
  embedActiveUserInputInComposer?: boolean;
  embedToolCallRequestInComposer?: boolean;
  embedPlanFollowupInComposer?: boolean;
  enablePrimaryApprovalHotkey?: boolean;
};

export function useTimelinePanelsState({
  items,
  threadId,
  workspaceId,
  isThinking,
  userInputRequests = [],
  approvals = [],
  toolCallRequests = [],
  currentTurnTerminalItemId,
  visibleTimelineItemIds,
  onUserInputSubmit,
  onApprovalDecision,
  onPlanAccept,
  onPlanSubmitChanges,
  onToolCallSubmit,
  composerApprovalRequestId = null,
  embedActiveUserInputInComposer = false,
  embedToolCallRequestInComposer = false,
  embedPlanFollowupInComposer = false,
}: UseTimelinePanelsStateParams) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedToolGroups, setCollapsedToolGroups] = useState<Set<string>>(new Set());
  const [dismissedPlanFollowupByThread, setDismissedPlanFollowupByThread] = useState<
    Record<string, string>
  >({});

  const activeUserInputRequests = useMemo(
    () =>
      threadId
        ? userInputRequests.filter(
            (request) =>
              request.params.thread_id === threadId &&
              (!workspaceId || request.workspace_id === workspaceId)
          )
        : [],
    [threadId, userInputRequests, workspaceId]
  );
  const activeUserInputRequest = activeUserInputRequests[0] ?? null;
  const activeUserInputRequestId = activeUserInputRequest?.request_id ?? null;

  const activeToolCallRequests = useMemo(
    () =>
      threadId
        ? toolCallRequests.filter(
            (request) =>
              request.params.thread_id === threadId &&
              (!workspaceId || request.workspace_id === workspaceId)
          )
        : [],
    [threadId, toolCallRequests, workspaceId]
  );
  const activeToolCallRequest = activeToolCallRequests[0] ?? null;
  const activeToolCallRequestId = activeToolCallRequest?.request_id ?? null;

  const timelineApprovals = useMemo(
    () =>
      approvals.filter((request) => {
        if (!workspaceId || request.workspace_id !== workspaceId) {
          return false;
        }
        if (!threadId) {
          return false;
        }
        return getApprovalRequestThreadId(request) === threadId;
      }),
    [approvals, threadId, workspaceId]
  );

  const hasVisibleUserInputRequest =
    activeUserInputRequestId !== null && Boolean(onUserInputSubmit);
  const hasVisibleToolCallRequest = activeToolCallRequestId !== null && Boolean(onToolCallSubmit);
  const hasVisibleApprovalRequests = timelineApprovals.length > 0 && Boolean(onApprovalDecision);

  const planFollowup = useMemo(() => {
    if (!threadId) {
      return { shouldShow: false, artifact: null };
    }
    const artifact = resolveActivePlanArtifact({
      threadId,
      items,
      isThinking,
      hasBlockingSurface: hasVisibleUserInputRequest || hasVisibleToolCallRequest,
    });
    if (!artifact) {
      return { shouldShow: false, artifact: null };
    }
    if (!onPlanAccept || !onPlanSubmitChanges) {
      return { shouldShow: false, artifact };
    }
    if (dismissedPlanFollowupByThread[threadId] === artifact.planItemId) {
      return { shouldShow: false, artifact };
    }
    return { shouldShow: true, artifact };
  }, [
    dismissedPlanFollowupByThread,
    hasVisibleToolCallRequest,
    hasVisibleUserInputRequest,
    isThinking,
    items,
    onPlanAccept,
    onPlanSubmitChanges,
    threadId,
  ]);

  const timelinePanels = useMemo<TimelinePanelDescriptor[]>(() => {
    const panels: TimelinePanelDescriptor[] = [];

    if (hasVisibleApprovalRequests && onApprovalDecision) {
      timelineApprovals.forEach((request, index) => {
        panels.push({
          kind: "approval",
          key: `approval-${request.workspace_id}-${request.request_id}`,
          anchorItemId: currentTurnTerminalItemId,
          request,
          isPrimary: index === timelineApprovals.length - 1,
          interactive: request.request_id !== composerApprovalRequestId,
        });
      });
    }

    if (planFollowup.shouldShow && planFollowup.artifact) {
      panels.push({
        kind: "plan_followup",
        key: `plan-followup-${planFollowup.artifact.planItemId}`,
        anchorItemId: planFollowup.artifact.planItemId ?? currentTurnTerminalItemId,
        artifact: planFollowup.artifact,
        interactive: !embedPlanFollowupInComposer,
      });
    }

    if (activeToolCallRequest && onToolCallSubmit) {
      panels.push({
        kind: "tool_call_request",
        key: `tool-call-request-${activeToolCallRequest.request_id}`,
        anchorItemId: activeToolCallRequest.params.call_id ?? currentTurnTerminalItemId,
        request: activeToolCallRequest,
        interactive: !embedToolCallRequestInComposer,
      });
    }

    if (activeUserInputRequest && onUserInputSubmit) {
      panels.push({
        kind: "user_input_request",
        key: `user-input-request-${activeUserInputRequest.request_id}`,
        anchorItemId: activeUserInputRequest.params.item_id ?? currentTurnTerminalItemId,
        request: activeUserInputRequest,
        interactive: !embedActiveUserInputInComposer,
      });
    }

    return panels;
  }, [
    activeToolCallRequest,
    activeUserInputRequest,
    composerApprovalRequestId,
    currentTurnTerminalItemId,
    embedActiveUserInputInComposer,
    embedPlanFollowupInComposer,
    embedToolCallRequestInComposer,
    hasVisibleApprovalRequests,
    onApprovalDecision,
    onToolCallSubmit,
    onUserInputSubmit,
    planFollowup,
    timelineApprovals,
  ]);

  const trailingTimelinePanels = useMemo(() => {
    const timelineItemIds = new Set(visibleTimelineItemIds);
    return timelinePanels.filter(
      (panel) => !panel.anchorItemId || !timelineItemIds.has(panel.anchorItemId)
    );
  }, [timelinePanels, visibleTimelineItemIds]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const ensureExpanded = useCallback((id: string) => {
    setExpandedItems((previous) => {
      if (previous.has(id)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  const toggleToolGroup = useCallback((id: string) => {
    setCollapsedToolGroups((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const dismissPlanFollowup = useCallback(
    (planItemId: string) => {
      if (!threadId) {
        return;
      }
      setDismissedPlanFollowupByThread((previous) => ({
        ...previous,
        [threadId]: planItemId,
      }));
    },
    [threadId]
  );

  return {
    expandedItems,
    collapsedToolGroups,
    activeUserInputRequests,
    activeUserInputRequest,
    activeUserInputRequestId,
    activeToolCallRequests,
    activeToolCallRequest,
    activeToolCallRequestId,
    timelineApprovals,
    hasVisibleUserInputRequest,
    hasVisibleToolCallRequest,
    hasVisibleApprovalRequests,
    planFollowup,
    timelinePanels,
    trailingTimelinePanels,
    toggleExpanded,
    ensureExpanded,
    toggleToolGroup,
    dismissPlanFollowup,
  };
}
