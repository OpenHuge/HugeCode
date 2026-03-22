import {
  isChatCollaborationMode,
  isPlanCollaborationMode,
} from "../../../application/runtime/ports/runtimeCollaborationModes";
import type { CollaborationModeOption } from "../../../types";

export function resolveComposerCollaborationModes(
  collaborationModes: CollaborationModeOption[],
  selectedCollaborationModeId: string | null
) {
  const chatMode =
    collaborationModes.find(
      (mode) => isChatCollaborationMode(mode.id) || isChatCollaborationMode(mode.label || mode.id)
    ) ?? null;
  const planMode =
    collaborationModes.find(
      (mode) => isPlanCollaborationMode(mode.id) || isPlanCollaborationMode(mode.label || mode.id)
    ) ?? null;
  return {
    chatMode,
    planMode,
    activeModeId: selectedCollaborationModeId ?? chatMode?.id ?? null,
  };
}

export function resolveComposerInteractionState(input: {
  collaborationModes: CollaborationModeOption[];
  selectedCollaborationModeId: string | null;
  pendingPlanFollowup: unknown;
  onPendingPlanAccept?: (() => void) | null;
  onPendingPlanSubmitChanges?: ((changes: string) => void) | null;
  pendingUserInputActive: boolean;
  pendingApprovalActive: boolean;
  pendingToolCallActive: boolean;
  reviewPromptOpen: boolean;
  isAutocompleteOpen: boolean;
}) {
  const { activeModeId, planMode } = resolveComposerCollaborationModes(
    input.collaborationModes,
    input.selectedCollaborationModeId
  );
  const pendingPlanReviewActive = Boolean(
    planMode &&
    activeModeId === planMode.id &&
    input.pendingPlanFollowup &&
    input.onPendingPlanAccept &&
    input.onPendingPlanSubmitChanges
  );
  return {
    pendingPlanReviewActive,
    suggestionsOpen:
      !(
        input.pendingUserInputActive ||
        input.pendingApprovalActive ||
        input.pendingToolCallActive ||
        pendingPlanReviewActive
      ) &&
      (input.reviewPromptOpen || input.isAutocompleteOpen),
  };
}
