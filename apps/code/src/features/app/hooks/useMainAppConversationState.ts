import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RequestUserInputRequest,
} from "../../../types";
import { getApprovalRequestThreadId } from "../../messages/utils/approvalPresentation";
import { resolveActivePlanArtifact } from "../../messages/utils/planArtifact";
import { useComposerController } from "./useComposerController";
import { useComposerInsert } from "./useComposerInsert";
import { useMainAppHomeState } from "./useMainAppHomeState";
import { useWorkspaceFileListing } from "./useWorkspaceFileListing";

type UseMainAppHomeStateParams = Parameters<typeof useMainAppHomeState>[0];
type UseWorkspaceFileListingParams = Parameters<typeof useWorkspaceFileListing>[0];
type UseComposerControllerParams = Parameters<typeof useComposerController>[0];
type UseComposerInsertParams = Parameters<typeof useComposerInsert>[0];

type UseMainAppConversationStateParams = {
  homeStateParams: UseMainAppHomeStateParams;
  fileListingParams: Omit<UseWorkspaceFileListingParams, "hasComposerSurface">;
  activeItems: ConversationItem[];
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
  activeTurnIdByThread: Record<string, string | null | undefined>;
  composerParams: Omit<
    UseComposerControllerParams,
    "activeTurnId" | "isProcessing" | "isReviewing" | "queueFlushPaused"
  >;
  composerInputRef: UseComposerInsertParams["textareaRef"];
};

export function useMainAppConversationState({
  homeStateParams,
  fileListingParams,
  activeItems,
  approvals,
  userInputRequests,
  toolCallRequests,
  activeTurnIdByThread,
  composerParams,
  composerInputRef,
}: UseMainAppConversationStateParams) {
  const homeState = useMainAppHomeState(homeStateParams);

  const {
    files,
    isLoading: isFilesLoading,
    setFileAutocompleteActive,
  } = useWorkspaceFileListing({
    ...fileListingParams,
    hasComposerSurface: homeState.showComposer,
  });

  const isProcessing =
    (composerParams.activeThreadId
      ? (homeStateParams.threadStatusById[composerParams.activeThreadId]?.isProcessing ?? false)
      : false) || homeState.isStartingDraftThread;

  const isReviewing = composerParams.activeThreadId
    ? (homeStateParams.threadStatusById[composerParams.activeThreadId]?.isReviewing ?? false)
    : false;

  const activeTurnId = composerParams.activeThreadId
    ? (activeTurnIdByThread[composerParams.activeThreadId] ?? null)
    : null;

  const hasUserInputRequestForActiveThread = Boolean(
    composerParams.activeThreadId &&
    userInputRequests.some(
      (request) =>
        request.params.thread_id === composerParams.activeThreadId &&
        (!composerParams.activeWorkspaceId ||
          request.workspace_id === composerParams.activeWorkspaceId)
    )
  );

  const hasToolCallRequestForActiveThread = Boolean(
    composerParams.activeThreadId &&
    toolCallRequests.some(
      (request) =>
        request.params.thread_id === composerParams.activeThreadId &&
        (!composerParams.activeWorkspaceId ||
          request.workspace_id === composerParams.activeWorkspaceId)
    )
  );
  const hasApprovalRequestForActiveThread = Boolean(
    composerParams.activeThreadId &&
    approvals.some((request) => {
      if (
        composerParams.activeWorkspaceId &&
        request.workspace_id !== composerParams.activeWorkspaceId
      ) {
        return false;
      }
      const requestThreadId = getApprovalRequestThreadId(request);
      if (requestThreadId) {
        return requestThreadId === composerParams.activeThreadId;
      }
      return true;
    })
  );

  const isPlanReadyAwaitingResponse =
    resolveActivePlanArtifact({
      threadId: composerParams.activeThreadId,
      items: activeItems,
      isThinking: isProcessing,
      hasBlockingSurface:
        hasUserInputRequestForActiveThread ||
        hasToolCallRequestForActiveThread ||
        hasApprovalRequestForActiveThread,
    }) !== null;

  const queueFlushPaused = Boolean(
    composerParams.activeThreadId &&
    (hasUserInputRequestForActiveThread ||
      hasToolCallRequestForActiveThread ||
      hasApprovalRequestForActiveThread ||
      isPlanReadyAwaitingResponse)
  );

  const queuePausedReason =
    queueFlushPaused && hasUserInputRequestForActiveThread
      ? "Paused - waiting for your answers."
      : queueFlushPaused && hasToolCallRequestForActiveThread
        ? "Paused - waiting for tool call output."
        : queueFlushPaused && hasApprovalRequestForActiveThread
          ? "Paused - waiting for approval."
          : queueFlushPaused && isPlanReadyAwaitingResponse
            ? "Paused - waiting for plan accept/changes."
            : null;

  const composerState = useComposerController({
    ...composerParams,
    activeTurnId,
    isProcessing,
    isReviewing,
    queueFlushPaused,
  });

  const canInsertComposerText = Boolean(composerParams.activeThreadId);

  const handleInsertComposerText = useComposerInsert({
    isEnabled: canInsertComposerText,
    draftText: composerState.activeDraft,
    onDraftChange: composerState.handleDraftChange,
    textareaRef: composerInputRef,
  });

  return {
    homeState,
    fileListingState: {
      files,
      isFilesLoading,
      setFileAutocompleteActive,
    },
    processingState: {
      isProcessing,
      isReviewing,
      hasApprovalRequestForActiveThread,
      hasUserInputRequestForActiveThread,
      hasToolCallRequestForActiveThread,
      isPlanReadyAwaitingResponse,
      queueFlushPaused,
      queuePausedReason,
    },
    composerState,
    canInsertComposerText,
    handleInsertComposerText,
  };
}
