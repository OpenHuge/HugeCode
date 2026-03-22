import { describe, expect, it } from "vitest";
import { resolveMissionControlDraftProfileId } from "./runtimeMissionControlDraftState";

describe("runtimeMissionControlDraftState", () => {
  it("prefers repository launch defaults until the draft is user-touched", () => {
    expect(
      resolveMissionControlDraftProfileId({
        currentProfileId: "balanced-delegate",
        repositoryExecutionProfileId: "review-first",
        sourceDraft: null,
        draftProfileTouched: false,
      })
    ).toBe("review-first");
  });

  it("keeps source-draft and user-touched profile choices ahead of repository defaults", () => {
    expect(
      resolveMissionControlDraftProfileId({
        currentProfileId: "balanced-delegate",
        repositoryExecutionProfileId: "review-first",
        sourceDraft: {
          taskId: "task-1",
          title: "Retry",
          instruction: "Retry",
          intent: "retry",
          fieldOrigins: {
            executionProfileId: "runtime_fallback",
            preferredBackendIds: "runtime_fallback",
            accessMode: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
            validationPresetId: "runtime_fallback",
          },
        },
        draftProfileTouched: false,
      })
    ).toBe("balanced-delegate");

    expect(
      resolveMissionControlDraftProfileId({
        currentProfileId: "narrow-follow-up",
        repositoryExecutionProfileId: "review-first",
        sourceDraft: null,
        draftProfileTouched: true,
      })
    ).toBe("narrow-follow-up");
  });
});
