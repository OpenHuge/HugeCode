import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { buildTimelineArtifactActions } from "./artifactActions";
import { summarizeCurrentTurnArtifacts } from "./messageRenderUtils";

describe("buildTimelineArtifactActions", () => {
  it("builds actions in the shared changed-files, review, diff order", () => {
    const items: ConversationItem[] = [
      {
        id: "file-change",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }],
      },
      {
        id: "review",
        kind: "review",
        state: "completed",
        text: "Looks good",
      },
      {
        id: "diff",
        kind: "diff",
        title: "Turn diff",
        diff: "@@",
        status: "completed",
      },
    ];

    expect(
      buildTimelineArtifactActions({
        items,
        artifactSummary: summarizeCurrentTurnArtifacts(items),
      })
    ).toEqual([
      {
        key: "files-file-change",
        itemId: "file-change",
        kind: "changed-files",
        label: "Inspect files",
        expandsTarget: true,
      },
      {
        key: "review-review",
        itemId: "review",
        kind: "review",
        label: "Read review",
        expandsTarget: false,
      },
      {
        key: "diff-diff",
        itemId: "diff",
        kind: "diff",
        label: "Jump to diff",
        expandsTarget: true,
      },
    ]);
  });

  it("omits actions for artifact kinds that are not present", () => {
    const items: ConversationItem[] = [
      {
        id: "assistant",
        kind: "message",
        role: "assistant",
        text: "Done",
      },
    ];

    expect(
      buildTimelineArtifactActions({
        items,
        artifactSummary: summarizeCurrentTurnArtifacts(items),
      })
    ).toEqual([]);
  });
});
