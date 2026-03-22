import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { resolveActivePlanArtifact } from "./planArtifact";

describe("resolveActivePlanArtifact", () => {
  it("extracts a title and preview from the latest active plan output", () => {
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: [
          "# Stabilize the workspace shell",
          "",
          "1. Fix boot-shell timing in smoke tests.",
          "2. Unify timeline action ownership.",
          "3. Tighten composer alignment.",
        ].join("\n"),
      },
    ];

    expect(
      resolveActivePlanArtifact({
        threadId: "thread-1",
        items,
        isThinking: false,
        hasBlockingSurface: false,
      })
    ).toMatchObject({
      planItemId: "plan-1",
      title: "Stabilize the workspace shell",
      preview: [
        "1. Fix boot-shell timing in smoke tests.",
        "2. Unify timeline action ownership.",
        "3. Tighten composer alignment.",
      ].join("\n"),
      body: items[0].output,
      awaitingFollowup: true,
    });
  });

  it("prefers the latest eligible plan and truncates long preview text", () => {
    const items: ConversationItem[] = [
      {
        id: "plan-old",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Old plan",
      },
      {
        id: "plan-new",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: ["Ship the sidecar", "", "A".repeat(220), "B".repeat(220), "C".repeat(220)].join(
          "\n"
        ),
      },
    ];

    const artifact = resolveActivePlanArtifact({
      threadId: "thread-1",
      items,
      isThinking: false,
      hasBlockingSurface: false,
    });

    expect(artifact?.planItemId).toBe("plan-new");
    expect(artifact?.title).toBe("Ship the sidecar");
    expect(artifact?.preview.length).toBeLessThanOrEqual(401);
    expect(artifact?.preview.endsWith("…")).toBe(true);
  });

  it("returns null when the latest plan is blocked by later user input or another blocking surface", () => {
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan body",
      },
      {
        id: "user-after-plan",
        kind: "message",
        role: "user",
        text: "Please revise it",
      },
    ];

    expect(
      resolveActivePlanArtifact({
        threadId: "thread-1",
        items,
        isThinking: false,
        hasBlockingSurface: false,
      })
    ).toBeNull();

    expect(
      resolveActivePlanArtifact({
        threadId: "thread-1",
        items: items.slice(0, 1),
        isThinking: false,
        hasBlockingSurface: true,
      })
    ).toBeNull();
  });
});
