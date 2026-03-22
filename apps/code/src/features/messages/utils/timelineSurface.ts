import type { ApprovalRequest, ConversationItem } from "../../../types";
import { getApprovalRequestThreadId } from "./approvalPresentation";

export type TimelineStatusBanner = {
  title: string;
  body: string;
  tone: "runtime" | "error";
  actionLabel?: string;
};

const PROVIDER_STREAM_INTERRUPTED_BODY =
  "The provider response stream broke while output was being decoded. Resend the request from the composer. If it keeps happening, check runtime connectivity or provider health.";

function isProviderStreamInterrupted(detail: string): boolean {
  return (
    /runtime\.turn\.provider\.stream_read_failed/i.test(detail) ||
    /failed to read chatgpt codex response stream/i.test(detail) ||
    /error decoding response body/i.test(detail)
  );
}

export function partitionApprovalsForTimeline({
  approvals,
  threadId,
  workspaceId,
}: {
  approvals: ApprovalRequest[];
  threadId: string | null;
  workspaceId?: string | null;
}) {
  if (!threadId || !workspaceId) {
    return { timelineApprovals: [] as ApprovalRequest[], floatingApprovals: approvals };
  }

  const timelineApprovals: ApprovalRequest[] = [];
  const floatingApprovals: ApprovalRequest[] = [];

  for (const approval of approvals) {
    if (approval.workspace_id !== workspaceId) {
      floatingApprovals.push(approval);
      continue;
    }
    const approvalThreadId = getApprovalRequestThreadId(approval);
    if (approvalThreadId !== threadId) {
      floatingApprovals.push(approval);
      continue;
    }
    timelineApprovals.push(approval);
  }

  return { timelineApprovals, floatingApprovals };
}

export function resolveTimelineStatusBanner(
  workspaceLoadError?: string | null
): TimelineStatusBanner | null {
  if (!workspaceLoadError) {
    return null;
  }
  if (/runtime unavailable|code runtime is unavailable/i.test(workspaceLoadError)) {
    return {
      title: "Runtime offline",
      body: "Reconnect the runtime from settings, or choose another workspace from the sidebar while this one is unavailable.",
      tone: "runtime",
      actionLabel: "Open settings",
    };
  }
  return {
    title: "Connection issue",
    body: workspaceLoadError,
    tone: "error",
    actionLabel: "Open settings",
  };
}

export function resolveTimelineMessageBanner(
  item: Extract<ConversationItem, { kind: "message" }>
): TimelineStatusBanner | null {
  if (item.role !== "assistant") {
    return null;
  }
  const text = item.text.trim();
  if (!text) {
    return null;
  }
  if (/^No available model route in current runtime\./i.test(text)) {
    return {
      title: "Provider setup required",
      body: text,
      tone: "runtime",
      actionLabel: "Open settings",
    };
  }
  if (/^Turn completed without any visible response/i.test(text)) {
    return {
      title: "No visible response",
      body: text,
      tone: "error",
    };
  }
  const turnFailedToStartMatch = /^Turn failed to start:\s*(.+)$/i.exec(text);
  if (turnFailedToStartMatch) {
    return {
      title: "Turn failed to start",
      body: turnFailedToStartMatch[1]?.trim() || text,
      tone: "error",
    };
  }
  const turnFailedMatch = /^Turn failed:\s*(.+)$/i.exec(text);
  if (!turnFailedMatch) {
    return null;
  }
  const detail = turnFailedMatch[1]?.trim() || text;
  if (/runtime\.turn\.provider\.rejected|provider rejected|rejected by provider/i.test(detail)) {
    return {
      title: "Provider rejected request",
      body: detail,
      tone: "error",
    };
  }
  if (isProviderStreamInterrupted(detail)) {
    return {
      title: "Provider stream interrupted",
      body: PROVIDER_STREAM_INTERRUPTED_BODY,
      tone: "error",
    };
  }
  return {
    title: "Turn failed",
    body: detail,
    tone: "error",
  };
}

export function buildTurnDiffTimelineItem(
  threadId: string | null,
  turnDiff: string | null | undefined
): Extract<ConversationItem, { kind: "diff" }> | null {
  const trimmed = turnDiff?.trim();
  if (!threadId || !trimmed) {
    return null;
  }
  return {
    id: `thread-turn-diff-${threadId}`,
    kind: "diff",
    title: "Turn diff",
    diff: trimmed,
    status: "modified",
  };
}

export type TimelineDiffFile = {
  path: string;
  status: "added" | "deleted" | "renamed" | "modified";
};

export function extractTimelineDiffFiles(diff: string): TimelineDiffFile[] {
  if (!diff.trim()) {
    return [];
  }
  const lines = diff.split(/\r?\n/);
  const results: TimelineDiffFile[] = [];
  let pendingPath: string | null = null;
  let pendingStatus: TimelineDiffFile["status"] = "modified";

  const pushPending = () => {
    if (!pendingPath) {
      return;
    }
    const exists = results.some((entry) => entry.path === pendingPath);
    if (!exists) {
      results.push({ path: pendingPath, status: pendingStatus });
    }
  };

  for (const line of lines) {
    const diffMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (diffMatch) {
      pushPending();
      const beforePath = diffMatch[1]?.trim();
      const afterPath = diffMatch[2]?.trim();
      pendingPath = afterPath || beforePath || null;
      pendingStatus = beforePath === afterPath ? "modified" : "renamed";
      continue;
    }
    if (line.startsWith("new file mode ")) {
      pendingStatus = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      pendingStatus = "deleted";
      continue;
    }
    const renameToMatch = /^rename to (.+)$/.exec(line);
    if (renameToMatch) {
      pendingPath = renameToMatch[1]?.trim() || pendingPath;
      pendingStatus = "renamed";
    }
  }

  pushPending();
  return results;
}
