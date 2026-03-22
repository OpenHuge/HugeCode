import type { ConversationItem } from "../../../types";
import { lifecycleStatusTone } from "../../../utils/lifecycleStatus";

export type ResolvedPlanArtifact = {
  planItemId: string;
  threadId: string;
  title: string;
  preview: string;
  body: string;
  awaitingFollowup: boolean;
};

const PLAN_PREVIEW_MAX_LINES = 5;
const PLAN_PREVIEW_MAX_CHARS = 400;

function resolvePlanStatusTone(item: Extract<ConversationItem, { kind: "tool" }>) {
  const tone = lifecycleStatusTone(item.status);
  if (tone === "failed") {
    return "failed";
  }
  if (tone === "processing") {
    return "processing";
  }
  if (tone === "completed") {
    return "completed";
  }
  if ((item.output ?? "").trim().length > 0) {
    return "completed";
  }
  return "processing";
}

function stripPlanTitleDecorators(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function truncatePreview(text: string) {
  if (text.length <= PLAN_PREVIEW_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, PLAN_PREVIEW_MAX_CHARS).trimEnd()}…`;
}

function buildPlanPreview(lines: string[]) {
  if (!lines.length) {
    return "";
  }
  const previewLines = lines.slice(0, PLAN_PREVIEW_MAX_LINES);
  return truncatePreview(previewLines.join("\n"));
}

function shouldPromoteFirstLineToTitle(firstLine: string, lineCount: number) {
  const trimmed = firstLine.trim();
  if (!trimmed) {
    return false;
  }
  if (/^#{1,6}\s+/.test(trimmed)) {
    return true;
  }
  if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
    return false;
  }
  return lineCount > 1 && trimmed.length <= 72;
}

export function resolveActivePlanArtifact({
  threadId,
  items,
  isThinking,
  hasBlockingSurface,
}: {
  threadId: string | null;
  items: ConversationItem[];
  isThinking: boolean;
  hasBlockingSurface: boolean;
}): ResolvedPlanArtifact | null {
  if (!threadId || hasBlockingSurface) {
    return null;
  }

  let planIndex = -1;
  let planItem: Extract<ConversationItem, { kind: "tool" }> | null = null;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "tool" && item.toolType === "plan") {
      planIndex = index;
      planItem = item;
      break;
    }
  }

  if (!planItem) {
    return null;
  }

  const body = (planItem.output ?? "").trim();
  if (!body) {
    return null;
  }

  const tone = resolvePlanStatusTone(planItem);
  if (tone === "failed" || (isThinking && tone !== "completed")) {
    return null;
  }

  for (let index = planIndex + 1; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      return null;
    }
  }

  const bodyLines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (bodyLines.length === 0) {
    return null;
  }

  const firstLine = bodyLines[0] ?? "";
  const hasTitleLine = shouldPromoteFirstLineToTitle(firstLine, bodyLines.length);
  const title = hasTitleLine ? stripPlanTitleDecorators(firstLine) || "Plan ready" : "Plan ready";
  const previewLines = hasTitleLine && bodyLines.length > 1 ? bodyLines.slice(1) : bodyLines;
  const preview = buildPlanPreview(previewLines);

  return {
    planItemId: planItem.id,
    threadId,
    title,
    preview,
    body,
    awaitingFollowup: true,
  };
}
