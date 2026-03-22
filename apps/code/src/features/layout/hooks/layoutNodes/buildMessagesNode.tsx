import { Suspense, lazy } from "react";
import { partitionApprovalsForTimeline } from "../../../messages/utils/timelineSurface";
import { isPlanCollaborationMode } from "../../../../application/runtime/facades/runtimeCollaborationModes";
import type { LayoutNodesOptions, LayoutNodesResult } from "./types";
import {
  resolveActiveComposerApprovalRequest,
  resolveActiveComposerPlanFollowup,
  resolveActiveComposerToolCallRequest,
  resolveActiveComposerUserInputRequest,
} from "./primaryNodeHelpers";
import { flattenLayoutNodesOptions } from "./types";

type MessagesLayoutNodes = Pick<LayoutNodesResult, "messagesNode">;

const LazyMessages = lazy(async () => {
  const module = await import("../../../messages/components/Messages");
  return { default: module.Messages };
});

export function buildMessagesNode(
  options: LayoutNodesOptions
): MessagesLayoutNodes["messagesNode"] {
  const input = flattenLayoutNodesOptions(options);
  const activeThreadStatus = input.activeThreadId
    ? (input.threadStatusById[input.activeThreadId] ?? null)
    : null;
  const isActiveThreadProcessing = activeThreadStatus?.isProcessing ?? input.isProcessing;
  const isRestoringThreadHistory = Boolean(
    input.activeWorkspace?.id &&
    !input.activeThreadId &&
    (!input.threadSnapshotsReady || input.threadListLoadingByWorkspace[input.activeWorkspace.id])
  );
  const composerUserInputRequest = resolveActiveComposerUserInputRequest(input);
  const composerApprovalRequest = resolveActiveComposerApprovalRequest(input);
  const composerPlanFollowup = resolveActiveComposerPlanFollowup(input);
  const selectedCollaborationMode = input.collaborationModes.find(
    (mode) => mode.id === input.selectedCollaborationModeId
  );
  const isPlanModeActive = Boolean(
    isPlanCollaborationMode(input.selectedCollaborationModeId) ||
    (selectedCollaborationMode &&
      (isPlanCollaborationMode(selectedCollaborationMode.id) ||
        isPlanCollaborationMode(selectedCollaborationMode.mode) ||
        isPlanCollaborationMode(selectedCollaborationMode.label)))
  );
  const { timelineApprovals } = partitionApprovalsForTimeline({
    approvals: input.approvals,
    threadId: input.activeThreadId,
    workspaceId: input.activeWorkspace?.id ?? null,
  });

  return (
    <Suspense fallback={null}>
      <LazyMessages
        items={input.activeItems}
        threadId={input.activeThreadId ?? null}
        activeTurnId={
          input.activeThreadId ? (input.activeTurnIdByThread?.[input.activeThreadId] ?? null) : null
        }
        workspaceId={input.activeWorkspace?.id ?? null}
        skills={input.skills}
        workspaceLoadError={input.workspaceLoadError ?? null}
        workspacePath={input.activeWorkspace?.path ?? null}
        isRestoringThreadHistory={isRestoringThreadHistory}
        openTargets={input.openAppTargets}
        selectedOpenAppId={input.selectedOpenAppId}
        codeBlockCopyUseModifier={input.codeBlockCopyUseModifier}
        showMessageFilePath={input.showMessageFilePath}
        approvals={timelineApprovals}
        enablePrimaryApprovalHotkey
        composerApprovalRequestId={
          input.showComposer ? (composerApprovalRequest?.request_id ?? null) : null
        }
        userInputRequests={input.userInputRequests}
        toolCallRequests={input.toolCallRequests}
        onApprovalDecision={input.handleApprovalDecision}
        onApprovalRemember={input.handleApprovalRemember}
        onUserInputSubmit={input.handleUserInputSubmit}
        onToolCallSubmit={input.handleToolCallSubmit}
        embedActiveUserInputInComposer={Boolean(input.showComposer && composerUserInputRequest)}
        embedToolCallRequestInComposer={Boolean(
          input.showComposer && resolveActiveComposerToolCallRequest(input)
        )}
        embedPlanFollowupInComposer={Boolean(input.showComposer && composerPlanFollowup)}
        onPlanAccept={input.onPlanAccept}
        onPlanSubmitChanges={input.onPlanSubmitChanges}
        onOpenSettings={input.onOpenSettings}
        onRevertAllGitChanges={input.onRevertAllGitChanges}
        onOpenThreadLink={input.onOpenThreadLink}
        onEditMessage={input.onEditMessage}
        isThinking={isActiveThreadProcessing}
        isPlanModeActive={isPlanModeActive}
        showInternalRuntimeDiagnostics={input.showInternalRuntimeDiagnostics}
        turnDiff={
          input.activeThreadId
            ? ((input.turnDiffByThread?.[input.activeThreadId] ?? null) as string | null)
            : null
        }
        isLoadingMessages={
          input.activeThreadId
            ? (input.threadResumeLoadingById[input.activeThreadId] ?? false)
            : false
        }
        processingStartedAt={activeThreadStatus?.processingStartedAt ?? null}
        lastDurationMs={activeThreadStatus?.lastDurationMs ?? null}
        showPollingFetchStatus={input.showPollingFetchStatus}
        pollingIntervalMs={input.pollingIntervalMs}
      />
    </Suspense>
  );
}
