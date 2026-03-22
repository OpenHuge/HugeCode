// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCollaborationModeSelection } from "./useCollaborationModeSelection";

describe("useCollaborationModeSelection", () => {
  it("builds a minimal collaboration payload without synthetic model or effort settings", () => {
    const { result } = renderHook(() =>
      useCollaborationModeSelection({
        selectedCollaborationMode: {
          id: "plan",
          label: "Plan",
          mode: "plan",
          model: "gpt-5.4",
          reasoningEffort: "low",
          developerInstructions: "Return a full plan first.",
          value: {},
        },
        selectedCollaborationModeId: "plan",
      })
    );

    expect(result.current.collaborationModePayload).toEqual({
      mode: "plan",
      settings: {
        id: "plan",
      },
    });
  });
});
