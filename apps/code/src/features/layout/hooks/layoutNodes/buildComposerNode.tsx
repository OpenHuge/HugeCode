import { Suspense, lazy } from "react";
import { ComposerSurface } from "../../../composer/components/ComposerSurface";
import type { ComposerWorkspaceControls } from "../../../composer/components/ComposerWorkspaceControls";
import { resolveGitWorkflowRepositoryWorkspace } from "../../../../application/runtime/facades/gitWorkflowFacade";
import { resolveCurrentBranchName } from "../../../git/utils/branchLabels";
import type { LayoutNodesOptions, LayoutNodesResult } from "./types";
import {
  resolveActiveComposerApprovalRequest,
  resolveActiveComposerPlanFollowup,
  resolveActiveComposerToolCallRequest,
  resolveActiveComposerUserInputRequest,
} from "./primaryNodeHelpers";
import { flattenLayoutNodesOptions } from "./types";

type ComposerLayoutNodes = Pick<LayoutNodesResult, "composerNode">;

const LazyComposer = lazy(async () => {
  const module = await import("../../../composer/components/Composer");
  return { default: module.Composer };
});

export function buildComposerNode(
  options: LayoutNodesOptions
): ComposerLayoutNodes["composerNode"] {
  const input = flattenLayoutNodesOptions(options);
  if (!input.showComposer) {
    return null;
  }

  const composerUserInputRequest = resolveActiveComposerUserInputRequest(input);
  const composerApprovalRequest = resolveActiveComposerApprovalRequest(input);
  const composerToolCallRequest = resolveActiveComposerToolCallRequest(input);
  const composerPlanFollowup = resolveActiveComposerPlanFollowup(input);
  const composerThreadUserInputRequests = composerUserInputRequest
    ? input.userInputRequests.filter(
        (request) =>
          request.params.thread_id === input.activeThreadId &&
          (!input.activeWorkspace?.id || request.workspace_id === input.activeWorkspace.id)
      )
    : [];
  const composerUserInputRequestCount = composerThreadUserInputRequests.length;
  const composerUserInputRequestIndex = composerUserInputRequest
    ? Math.max(
        1,
        composerThreadUserInputRequests.findIndex(
          (request) => request.request_id === composerUserInputRequest.request_id
        ) + 1
      )
    : 1;
  const activeWorkspace = input.activeWorkspace;
  const repositoryWorkspace = resolveGitWorkflowRepositoryWorkspace(
    activeWorkspace,
    input.workspaces
  );
  const workspaceControls: ComposerWorkspaceControls | null = activeWorkspace
    ? {
        mode: activeWorkspace.kind === "worktree" ? "worktree" : "local",
        branchLabel:
          activeWorkspace.kind === "worktree"
            ? (resolveCurrentBranchName(
                activeWorkspace.worktree?.branch ?? input.gitStatus.branchName
              ) ??
              input.worktreeLabel ??
              activeWorkspace.name)
            : resolveCurrentBranchName(input.gitStatus.branchName),
        currentBranch: resolveCurrentBranchName(input.gitStatus.branchName),
        branchTriggerLabel:
          activeWorkspace.kind === "worktree"
            ? (resolveCurrentBranchName(
                activeWorkspace.worktree?.branch ?? input.gitStatus.branchName
              ) ?? "Current worktree")
            : (resolveCurrentBranchName(input.gitStatus.branchName) ?? "Select branch"),
        repositoryWorkspace: repositoryWorkspace?.connected ? repositoryWorkspace : null,
        activeWorkspace,
        workspaces: input.workspaces,
        onSelectGitWorkflowSelection: activeWorkspace.connected
          ? input.onSelectBranchWorkflowSelection
          : undefined,
      }
    : null;

  return (
    <ComposerSurface surface="workspace">
      <Suspense fallback={null}>
        <LazyComposer
          variant="workspace"
          onSend={input.onSend}
          onQueue={input.onQueue}
          onStop={input.onStop}
          canStop={input.canStop}
          disabled={input.isReviewing}
          onFileAutocompleteActiveChange={input.onFileAutocompleteActiveChange}
          contextUsage={input.activeTokenUsage}
          queuedMessages={input.activeQueue}
          queuePausedReason={input.queuePausedReason}
          sendLabel={
            input.composerSendLabel ??
            (input.isProcessing && !input.steerEnabled ? "Queue" : "Send")
          }
          steerEnabled={input.steerEnabled}
          isProcessing={input.isProcessing}
          draftText={input.draftText}
          onDraftChange={input.onDraftChange}
          attachedImages={input.activeImages}
          onPickImages={input.onPickImages}
          onAttachImages={input.onAttachImages}
          onRemoveImage={input.onRemoveImage}
          prefillDraft={input.prefillDraft}
          onPrefillHandled={input.onPrefillHandled}
          insertText={input.insertText}
          onInsertHandled={input.onInsertHandled}
          onEditQueued={input.onEditQueued}
          onDeleteQueued={input.onDeleteQueued}
          collaborationModes={input.collaborationModes}
          selectedCollaborationModeId={input.selectedCollaborationModeId}
          onSelectCollaborationMode={input.onSelectCollaborationMode}
          accountOptions={input.composerAccountOptions}
          selectedAccountIds={input.selectedAccountIds}
          onSelectAccountIds={input.onSelectAccountIds}
          modelSelectionMode={input.modelSelectionMode}
          selectedProviderId={input.selectedProviderId}
          onSelectProvider={input.onSelectProvider}
          onSelectAutoRoute={input.onSelectAutoRoute}
          onSelectModelSelectionMode={input.onSelectModelSelectionMode}
          models={input.models}
          selectedModelId={input.selectedModelId}
          onSelectModel={input.onSelectModel}
          reasoningOptions={input.reasoningOptions}
          selectedEffort={input.selectedEffort}
          onSelectEffort={input.onSelectEffort}
          fastModeEnabled={input.fastModeEnabled}
          onToggleFastMode={input.onToggleFastMode}
          reasoningSupported={input.reasoningSupported}
          accessMode={input.accessMode}
          onSelectAccessMode={input.onSelectAccessMode}
          executionOptions={input.executionOptions}
          selectedExecutionMode={input.selectedExecutionMode}
          onSelectExecutionMode={input.onSelectExecutionMode}
          remoteBackendOptions={input.remoteBackendOptions}
          selectedRemoteBackendId={input.selectedRemoteBackendId}
          onSelectRemoteBackendId={input.onSelectRemoteBackendId}
          resolvedRemotePlacement={input.resolvedRemotePlacement}
          autoDrive={input.autoDrive ?? null}
          skills={input.skills}
          prompts={input.prompts}
          slashInvocationItems={input.slashInvocationItems}
          files={input.files}
          textareaRef={input.textareaRef}
          historyKey={input.activeWorkspace?.id ?? null}
          editorSettings={input.composerEditorSettings}
          editorExpanded={input.composerEditorExpanded}
          onToggleEditorExpanded={input.onToggleComposerEditorExpanded}
          reviewPrompt={input.reviewPrompt}
          onReviewPromptClose={input.onReviewPromptClose}
          onReviewPromptShowPreset={input.onReviewPromptShowPreset}
          onReviewPromptChoosePreset={input.onReviewPromptChoosePreset}
          highlightedPresetIndex={input.highlightedPresetIndex}
          onReviewPromptHighlightPreset={input.onReviewPromptHighlightPreset}
          highlightedBranchIndex={input.highlightedBranchIndex}
          onReviewPromptHighlightBranch={input.onReviewPromptHighlightBranch}
          highlightedCommitIndex={input.highlightedCommitIndex}
          onReviewPromptHighlightCommit={input.onReviewPromptHighlightCommit}
          onReviewPromptKeyDown={input.onReviewPromptKeyDown}
          onReviewPromptSelectBranch={input.onReviewPromptSelectBranch}
          onReviewPromptSelectBranchAtIndex={input.onReviewPromptSelectBranchAtIndex}
          onReviewPromptConfirmBranch={input.onReviewPromptConfirmBranch}
          onReviewPromptSelectCommit={input.onReviewPromptSelectCommit}
          onReviewPromptSelectCommitAtIndex={input.onReviewPromptSelectCommitAtIndex}
          onReviewPromptConfirmCommit={input.onReviewPromptConfirmCommit}
          onReviewPromptUpdateCustomInstructions={input.onReviewPromptUpdateCustomInstructions}
          onReviewPromptConfirmCustom={input.onReviewPromptConfirmCustom}
          pendingUserInputRequest={composerUserInputRequest}
          pendingUserInputRequestIndex={composerUserInputRequestIndex}
          pendingUserInputRequestCount={composerUserInputRequestCount}
          onPendingUserInputSubmit={input.handleUserInputSubmit}
          pendingApprovalRequest={composerApprovalRequest}
          onPendingApprovalDecision={input.handleApprovalDecision}
          onPendingApprovalRemember={input.handleApprovalRemember}
          pendingToolCallRequest={composerToolCallRequest}
          onPendingToolCallSubmit={input.handleToolCallSubmit}
          pendingPlanFollowup={composerPlanFollowup}
          onPendingPlanAccept={input.onPlanAccept}
          onPendingPlanSubmitChanges={input.onPlanSubmitChanges}
          workspaceControls={workspaceControls}
        />
      </Suspense>
    </ComposerSurface>
  );
}
