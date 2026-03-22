import { describe, expect, it } from "vitest";
import type { ApprovalRequest, ConversationItem } from "../../../types";
import { partitionApprovalsForTimeline, resolveTimelineMessageBanner } from "./timelineSurface";

describe("partitionApprovalsForTimeline", () => {
  const approvals: ApprovalRequest[] = [
    {
      workspace_id: "ws-1",
      request_id: "inline",
      method: "runtime/requestApproval/shell",
      params: {
        threadId: "thread-1",
        command: "pnpm validate:fast",
      },
    },
    {
      workspace_id: "ws-1",
      request_id: "missing-thread",
      method: "runtime/requestApproval/shell",
      params: {
        command: "pnpm lint",
      },
    },
    {
      workspace_id: "ws-2",
      request_id: "other-workspace",
      method: "runtime/requestApproval/shell",
      params: {
        threadId: "thread-1",
        command: "pnpm test",
      },
    },
  ];

  it("keeps only matching thread approvals inline", () => {
    const result = partitionApprovalsForTimeline({
      approvals,
      threadId: "thread-1",
      workspaceId: "ws-1",
    });

    expect(result.timelineApprovals).toHaveLength(1);
    expect(result.timelineApprovals[0]?.request_id).toBe("inline");
    expect(result.floatingApprovals.map((approval) => approval.request_id)).toEqual([
      "missing-thread",
      "other-workspace",
    ]);
  });

  it("floats everything when there is no active thread context", () => {
    const result = partitionApprovalsForTimeline({
      approvals,
      threadId: null,
      workspaceId: "ws-1",
    });

    expect(result.timelineApprovals).toHaveLength(0);
    expect(result.floatingApprovals).toHaveLength(3);
  });
});

describe("resolveTimelineMessageBanner", () => {
  function buildAssistantMessage(text: string): Extract<ConversationItem, { kind: "message" }> {
    return {
      id: "assistant-message",
      kind: "message",
      role: "assistant",
      text,
    };
  }

  it("maps raw provider stream decode failures to retry guidance", () => {
    const banner = resolveTimelineMessageBanner(
      buildAssistantMessage(
        "Turn failed: Failed to read ChatGPT Codex response stream: error decoding response body"
      )
    );

    expect(banner).toEqual({
      title: "Provider stream interrupted",
      body: "The provider response stream broke while output was being decoded. Resend the request from the composer. If it keeps happening, check runtime connectivity or provider health.",
      tone: "error",
    });
  });

  it("maps structured provider stream failure codes to retry guidance", () => {
    const banner = resolveTimelineMessageBanner(
      buildAssistantMessage("Turn failed: runtime.turn.provider.stream_read_failed")
    );

    expect(banner).toEqual({
      title: "Provider stream interrupted",
      body: "The provider response stream broke while output was being decoded. Resend the request from the composer. If it keeps happening, check runtime connectivity or provider health.",
      tone: "error",
    });
  });
});
