import type { ConversationItem } from "../../../types";
import type { CurrentTurnArtifactSummary } from "./messageRenderUtils";

export type TimelineArtifactActionKind = "changed-files" | "review" | "diff";

export type TimelineArtifactAction = {
  key: string;
  itemId: string;
  kind: TimelineArtifactActionKind;
  label: string;
  expandsTarget: boolean;
};

type BuildTimelineArtifactActionsParams = {
  items: ConversationItem[];
  artifactSummary: CurrentTurnArtifactSummary;
  turnDiffItem?: Extract<ConversationItem, { kind: "diff" }> | null;
};

function artifactActionLabel(kind: TimelineArtifactActionKind) {
  switch (kind) {
    case "changed-files":
      return "Inspect files";
    case "review":
      return "Read review";
    case "diff":
      return "Jump to diff";
  }
}

export function buildTimelineArtifactActions({
  items,
  artifactSummary,
  turnDiffItem = null,
}: BuildTimelineArtifactActionsParams): TimelineArtifactAction[] {
  const actions: TimelineArtifactAction[] = [];
  const firstChangedFilesItem = items.find(
    (item): item is Extract<ConversationItem, { kind: "tool" }> =>
      item.kind === "tool" && item.toolType === "fileChange"
  );
  const firstReviewItem = items.find(
    (item): item is Extract<ConversationItem, { kind: "review" }> => item.kind === "review"
  );
  const firstDiffItem =
    turnDiffItem ??
    items.find(
      (item): item is Extract<ConversationItem, { kind: "diff" }> => item.kind === "diff"
    ) ??
    null;

  if (firstChangedFilesItem && artifactSummary.changedFiles.length > 0) {
    actions.push({
      key: `files-${firstChangedFilesItem.id}`,
      itemId: firstChangedFilesItem.id,
      kind: "changed-files",
      label: artifactActionLabel("changed-files"),
      expandsTarget: true,
    });
  }

  if (firstReviewItem && artifactSummary.reviewCount > 0) {
    actions.push({
      key: `review-${firstReviewItem.id}`,
      itemId: firstReviewItem.id,
      kind: "review",
      label: artifactActionLabel("review"),
      expandsTarget: false,
    });
  }

  if (firstDiffItem && artifactSummary.diffCount > 0) {
    actions.push({
      key: `diff-${firstDiffItem.id}`,
      itemId: firstDiffItem.id,
      kind: "diff",
      label: artifactActionLabel("diff"),
      expandsTarget: true,
    });
  }

  return actions;
}
