import { describe, expect, it } from "vitest";
import {
  resolveComposerCollaborationModes,
  resolveComposerInteractionState,
} from "./collaborationModes";

const collaborationModes = [
  {
    id: "plan",
    label: "Plan",
    mode: "plan",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
  {
    id: "review",
    label: "Review",
    mode: "review",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
  {
    id: "default",
    label: "Default",
    mode: "default",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
];

describe("composer collaboration modes", () => {
  it("uses the explicit plan mode instead of treating every non-chat mode as plan", () => {
    expect(resolveComposerCollaborationModes(collaborationModes, "review")).toMatchObject({
      chatMode: { id: "default" },
      planMode: { id: "plan" },
      activeModeId: "review",
    });
  });

  it("only enables pending plan review when the selected mode is the plan mode", () => {
    expect(
      resolveComposerInteractionState({
        collaborationModes,
        selectedCollaborationModeId: "review",
        pendingPlanFollowup: { id: "pending-plan" },
        onPendingPlanAccept: () => undefined,
        onPendingPlanSubmitChanges: () => undefined,
        pendingUserInputActive: false,
        pendingApprovalActive: false,
        pendingToolCallActive: false,
        reviewPromptOpen: false,
        isAutocompleteOpen: true,
      })
    ).toEqual({
      pendingPlanReviewActive: false,
      suggestionsOpen: true,
    });
  });
});
