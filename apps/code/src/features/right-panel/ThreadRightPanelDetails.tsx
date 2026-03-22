import { useEffect } from "react";
import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RequestUserInputRequest,
} from "../../types";
import { useRightPanelInspector } from "./RightPanelInspectorContext";
import { RightPanelDetailView, RightPanelInterruptView } from "./RightPanelDetailViews";
import { resolveRightPanelModel, type RightPanelGitDiff } from "./rightPanelModels";

type ThreadRightPanelDetailsProps = {
  section: "interrupt" | "detail";
  items: ConversationItem[];
  threadId: string | null;
  workspaceLoadError: string | null;
  selectedDiffPath: string | null;
  gitDiffs: RightPanelGitDiff[];
  turnDiff: string | null;
  approvalRequests: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
};

export function ThreadRightPanelDetails({
  items,
  threadId,
  workspaceLoadError,
  selectedDiffPath,
  gitDiffs,
  turnDiff,
  approvalRequests,
  userInputRequests,
  toolCallRequests,
  section,
}: ThreadRightPanelDetailsProps) {
  const { clearSelection, selectItem, selection } = useRightPanelInspector();
  const { detailModel, interruptModel, selectionSync } = resolveRightPanelModel({
    selection,
    items,
    threadId,
    workspaceLoadError,
    selectedDiffPath,
    gitDiffs,
    turnDiff,
    approvalRequests,
    userInputRequests,
    toolCallRequests,
  });

  useEffect(() => {
    if (section !== "detail" || !selection) {
      return;
    }
    if (selectionSync.mode === "replace") {
      if (
        selection.kind !== selectionSync.selection.kind ||
        selection.itemId !== selectionSync.selection.itemId
      ) {
        selectItem(selectionSync.selection.kind, selectionSync.selection.itemId);
      }
      return;
    }
    if (selectionSync.mode === "clear") {
      clearSelection();
    }
  }, [clearSelection, section, selectItem, selection, selectionSync]);

  if (section === "interrupt") {
    return <RightPanelInterruptView model={interruptModel} />;
  }

  if (!detailModel) {
    return null;
  }

  return (
    <RightPanelDetailView
      clearSelection={clearSelection}
      detailModel={detailModel}
      hasSelection={Boolean(selection)}
    />
  );
}
