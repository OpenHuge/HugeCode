import { convertFileSrc } from "../../../application/runtime/ports/desktopFiles";
import type { ConversationItem } from "../../../types";
import { lifecycleStatusTone, normalizeLifecycleStatus } from "../../../utils/lifecycleStatus";
import { resolveActivePlanArtifact } from "./planArtifact";
import { resolveTimelineMessageBanner } from "./timelineSurface";
export type { MetaNotice, MetaNoticeType } from "./metaNotices";
export { resolveMetaNotice } from "./metaNotices";

export type ToolSummary = {
  label: string;
  value?: string;
  detail?: string;
  output?: string;
};

export type StatusTone = "completed" | "processing" | "failed" | "unknown";

export type ParsedReasoning = {
  summaryTitle: string;
  bodyText: string;
  hasBody: boolean;
  workingLabel: string | null;
};

export type MessageImage = {
  src: string;
  label: string;
};

export type PlannerDiagnosticSeverity = "warning" | "fatal";

export type PlannerDiagnostic = {
  code: string;
  severity: PlannerDiagnosticSeverity;
  message: string;
  stepIndex?: number;
};

export type PlannerDiagnostics = {
  diagnostics: PlannerDiagnostic[];
  warningCount: number;
  fatalCount: number;
  hasFatal: boolean;
};

export type ToolGroupItem = Extract<ConversationItem, { kind: "tool" | "reasoning" | "explore" }>;

export type ToolGroup = {
  id: string;
  items: ToolGroupItem[];
  updateCount: number;
  toolCallCount: number;
  exploreStepCount: number;
  reasoningStepCount: number;
};

export type CurrentTurnActivitySummary = {
  label: string;
  detail: string | null;
  tone: StatusTone;
};

export type CurrentTurnArtifactSummary = {
  changedFiles: {
    path: string;
    label: string;
  }[];
  diffCount: number;
  reviewCount: number;
};

export type MessageListEntry =
  | { kind: "item"; item: ConversationItem }
  | { kind: "toolGroup"; group: ToolGroup };

export const SCROLL_THRESHOLD_PX = 120;
export const MAX_COMMAND_OUTPUT_LINES = 200;

function isPlanValidationTool(item: Extract<ConversationItem, { kind: "tool" }>) {
  return /runtime(?:\s*\/\s*|\s+|[-_])runtime[-_ ]plan[-_ ]validation/i.test(item.title);
}

export function shouldHideInternalToolItem(
  item: ConversationItem,
  options?: { isPlanModeActive?: boolean; showInternalRuntimeDiagnostics?: boolean }
) {
  if (
    item.kind !== "tool" ||
    options?.isPlanModeActive ||
    options?.showInternalRuntimeDiagnostics
  ) {
    return false;
  }
  if (item.toolType !== "mcpToolCall" || !isPlanValidationTool(item)) {
    return false;
  }
  const diagnostics = extractToolPlannerDiagnostics(item);
  if (diagnostics?.hasFatal) {
    return false;
  }
  return normalizeLifecycleStatus(item.status) !== "failed";
}

export function basename(path: string) {
  if (!path) {
    return "";
  }
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function parseToolArgs(detail: string) {
  if (!detail) {
    return null;
  }
  const trimmed = detail.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const firstBrace = detail.indexOf("{");
    const lastBrace = detail.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }
    const candidate = detail.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function firstStringField(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return "";
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstBooleanField(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function firstNumberField(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const TOOL_DETAIL_OMIT_KEYS = new Set([
  "plannerDiagnostics",
  "batchId",
  "batch_id",
  "attempt",
  "attempt_count",
  "checkpointId",
  "checkpoint_id",
  "traceId",
  "trace_id",
  "errorClass",
  "error_class",
  "recovered",
  "recovered_state",
  "durationMs",
  "duration_ms",
]);

function sanitizeToolDetailValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => sanitizeToolDetailValue(entry))
      .filter((entry) => entry !== null);
    return entries.length > 0 ? entries : null;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).flatMap(([key, entryValue]) => {
      if (TOOL_DETAIL_OMIT_KEYS.has(key)) {
        return [];
      }
      const sanitizedValue = sanitizeToolDetailValue(entryValue);
      if (sanitizedValue === null) {
        return [];
      }
      return [[key, sanitizedValue] as const];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

function sanitizeToolDetailRecord(
  source: Record<string, unknown>,
  extraOmitKeys: string[] = []
): unknown {
  const omitKeys = new Set([...TOOL_DETAIL_OMIT_KEYS, ...extraOmitKeys]);
  const entries = Object.entries(source).flatMap(([key, entryValue]) => {
    if (omitKeys.has(key)) {
      return [];
    }
    const sanitizedValue = sanitizeToolDetailValue(entryValue);
    if (sanitizedValue === null) {
      return [];
    }
    return [[key, sanitizedValue] as const];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function extractToolDetailMetadata(detail: string) {
  const trimmed = detail.trim();
  if (!trimmed) {
    return "";
  }
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBrace < 0 || lastBrace >= trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastBrace + 1).trim();
}

function normalizePlannerDiagnosticSeverity(value: unknown): PlannerDiagnosticSeverity {
  return value === "fatal" ? "fatal" : "warning";
}

function parsePlannerDiagnostics(value: unknown): PlannerDiagnostics | null {
  const source = isRecord(value) ? value : null;
  if (!source) {
    return null;
  }
  const diagnosticsRaw = Array.isArray(source.diagnostics) ? source.diagnostics : [];
  const diagnostics: PlannerDiagnostic[] = diagnosticsRaw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const code = typeof entry.code === "string" ? entry.code.trim() : "";
      const message = typeof entry.message === "string" ? entry.message.trim() : "";
      if (!code || !message) {
        return null;
      }
      const stepIndexRaw = entry.stepIndex;
      const stepIndex =
        typeof stepIndexRaw === "number" && Number.isFinite(stepIndexRaw)
          ? Math.floor(stepIndexRaw)
          : undefined;
      return {
        code,
        severity: normalizePlannerDiagnosticSeverity(entry.severity),
        message,
        ...(stepIndex !== undefined ? { stepIndex } : {}),
      };
    })
    .filter((entry): entry is PlannerDiagnostic => entry !== null);
  if (diagnostics.length === 0) {
    return null;
  }
  const warningCount = diagnostics.filter((entry) => entry.severity === "warning").length;
  const fatalCount = diagnostics.length - warningCount;
  const hasFatal = fatalCount > 0;
  return {
    diagnostics,
    warningCount,
    fatalCount,
    hasFatal,
  };
}

export function extractToolPlannerDiagnostics(
  item: Extract<ConversationItem, { kind: "tool" }>
): PlannerDiagnostics | null {
  if (item.toolType !== "mcpToolCall" || !isPlanValidationTool(item)) {
    return null;
  }
  if (toolNameFromTitle(item.title) !== "runtime-plan-validation") {
    return null;
  }
  const args = parseToolArgs(item.detail);
  if (!args) {
    return null;
  }
  return parsePlannerDiagnostics(args.plannerDiagnostics);
}

export function formatToolDetail(item: Extract<ConversationItem, { kind: "tool" }>) {
  const trimmedDetail = item.detail.trim();
  if (!trimmedDetail) {
    return "";
  }
  if (item.toolType !== "mcpToolCall") {
    return trimmedDetail;
  }
  const args = parseToolArgs(item.detail);
  if (!args) {
    return trimmedDetail;
  }
  const toolName = toolNameFromTitle(item.title);
  if (toolName === "bash") {
    const shellFamily = firstStringField(args, ["shellFamily"]);
    const accessMode = firstStringField(args, ["effectiveAccessMode"]);
    const errorCode = firstStringField(args, ["errorCode"]);
    const exitCode = firstNumberField(args, ["exitCode"]);
    const sandboxed = firstBooleanField(args, ["sandboxed"]);
    const runtimeBashLines = [
      shellFamily ? `shell: ${shellFamily}` : "",
      accessMode ? `access: ${accessMode}` : "",
      sandboxed !== null ? `sandbox: ${sandboxed ? "on" : "off"}` : "",
      exitCode !== null ? `exit code: ${exitCode}` : "",
      errorCode ? `code: ${errorCode}` : "",
    ].filter(Boolean);
    const remainingArgs = sanitizeToolDetailRecord(args, [
      "command",
      "shellFamily",
      "shellExecutable",
      "effectiveAccessMode",
      "sandboxed",
      "exitCode",
      "errorCode",
      "workspaceId",
      "timeoutMs",
      "stdoutBytes",
      "stderrBytes",
      "noMatches",
    ]);
    const remainingText =
      remainingArgs === null
        ? ""
        : typeof remainingArgs === "string"
          ? remainingArgs
          : JSON.stringify(remainingArgs, null, 2);
    return [...runtimeBashLines, remainingText].filter(Boolean).join("\n");
  }
  const sanitizedArgs = sanitizeToolDetailValue(args);
  const metadata = extractToolDetailMetadata(item.detail);
  const formattedArgs =
    sanitizedArgs === null
      ? ""
      : typeof sanitizedArgs === "string"
        ? sanitizedArgs
        : JSON.stringify(sanitizedArgs, null, 2);
  return [formattedArgs, metadata].filter(Boolean).join("\n");
}

export function toolNameFromTitle(title: string) {
  if (!title.toLowerCase().startsWith("tool:")) {
    return "";
  }
  const [, toolPart = ""] = title.split(":");
  const segments = toolPart.split("/").map((segment) => segment.trim());
  return segments.length ? segments[segments.length - 1] : "";
}

export function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function sanitizeReasoningTitle(title: string) {
  return title
    .replace(/[`*_~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

export function parseReasoning(
  item: Extract<ConversationItem, { kind: "reasoning" }>
): ParsedReasoning {
  const summary = item.summary ?? "";
  const content = item.content ?? "";
  const hasSummary = summary.trim().length > 0;
  const titleSource = hasSummary ? summary : content;
  const titleLines = titleSource.split("\n");
  const trimmedLines = titleLines.map((line) => line.trim());
  const titleLineIndex = trimmedLines.findIndex(Boolean);
  const rawTitle = titleLineIndex >= 0 ? trimmedLines[titleLineIndex] : "";
  const cleanTitle = sanitizeReasoningTitle(rawTitle);
  const summaryTitle = cleanTitle
    ? cleanTitle.length > 80
      ? `${cleanTitle.slice(0, 80)}…`
      : cleanTitle
    : "Reasoning";
  const summaryLines = summary.split("\n");
  const contentLines = content.split("\n");
  const summaryBody =
    hasSummary && titleLineIndex >= 0
      ? summaryLines
          .filter((_, index) => index !== titleLineIndex)
          .join("\n")
          .trim()
      : "";
  const contentBody = hasSummary
    ? content.trim()
    : titleLineIndex >= 0
      ? contentLines
          .filter((_, index) => index !== titleLineIndex)
          .join("\n")
          .trim()
      : content.trim();
  const bodyParts = [summaryBody, contentBody].filter(Boolean);
  const bodyText = bodyParts.join("\n\n").trim();
  const hasBody = bodyText.length > 0;
  const hasAnyText = titleSource.trim().length > 0;
  const workingLabel = hasAnyText ? summaryTitle : null;
  return {
    summaryTitle,
    bodyText,
    hasBody,
    workingLabel,
  };
}

export function normalizeMessageImageSrc(path: string) {
  if (!path) {
    return "";
  }
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("file://")) {
    return path;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return "";
  }
}

function isToolGroupItem(item: ConversationItem): item is ToolGroupItem {
  return item.kind === "tool" || item.kind === "reasoning" || item.kind === "explore";
}

function mergeExploreItems(
  items: Extract<ConversationItem, { kind: "explore" }>[]
): Extract<ConversationItem, { kind: "explore" }> {
  const first = items[0];
  const last = items[items.length - 1];
  const status = last?.status ?? "explored";
  const entries = items.flatMap((item) => item.entries);
  return {
    id: first.id,
    kind: "explore",
    status,
    entries,
  };
}

function mergeConsecutiveExploreRuns(items: ToolGroupItem[]): ToolGroupItem[] {
  const result: ToolGroupItem[] = [];
  let run: Extract<ConversationItem, { kind: "explore" }>[] = [];

  const flushRun = () => {
    if (run.length === 0) {
      return;
    }
    if (run.length === 1) {
      result.push(run[0]);
    } else {
      result.push(mergeExploreItems(run));
    }
    run = [];
  };

  items.forEach((item) => {
    if (item.kind === "explore") {
      run.push(item);
      return;
    }
    flushRun();
    result.push(item);
  });
  flushRun();
  return result;
}

export function buildToolGroups(items: ConversationItem[]): MessageListEntry[] {
  const entries: MessageListEntry[] = [];
  let buffer: ToolGroupItem[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    const normalizedBuffer = mergeConsecutiveExploreRuns(buffer);
    const toolCallCount = normalizedBuffer.filter((item) => item.kind === "tool").length;
    const exploreStepCount = normalizedBuffer.reduce((total, item) => {
      if (item.kind !== "explore") {
        return total;
      }
      return total + item.entries.length;
    }, 0);
    const reasoningStepCount = normalizedBuffer.filter((item) => item.kind === "reasoning").length;
    const updateCount = toolCallCount + exploreStepCount + reasoningStepCount;
    if (updateCount === 0 || normalizedBuffer.length === 1) {
      normalizedBuffer.forEach((item) => {
        entries.push({ kind: "item", item });
      });
    } else {
      entries.push({
        kind: "toolGroup",
        group: {
          id: normalizedBuffer[0].id,
          items: normalizedBuffer,
          updateCount,
          toolCallCount,
          exploreStepCount,
          reasoningStepCount,
        },
      });
    }
    buffer = [];
  };

  items.forEach((item) => {
    if (isToolGroupItem(item)) {
      buffer.push(item);
    } else {
      flush();
      entries.push({ kind: "item", item });
    }
  });
  flush();
  return entries;
}

export function cleanCommandText(commandText: string) {
  if (!commandText) {
    return "";
  }
  const trimmed = commandText.trim();
  const shellMatch = trimmed.match(
    /^(?:\/\S+\/)?(?:bash|zsh|sh|fish)(?:\.exe)?\s+-lc\s+(['"])([\s\S]+)\1$/
  );
  const inner = shellMatch ? shellMatch[2] : trimmed;
  const cdMatch = inner.match(/^\s*cd\s+[^&;]+(?:\s*&&\s*|\s*;\s*)([\s\S]+)$/i);
  const stripped = cdMatch ? cdMatch[1] : inner;
  return stripped.trim();
}

export function buildToolSummary(
  item: Extract<ConversationItem, { kind: "tool" }>,
  commandText: string
): ToolSummary {
  if (item.toolType === "commandExecution") {
    const cleanedCommand = cleanCommandText(commandText);
    return {
      label: "command",
      value: cleanedCommand || "Command",
      detail: "",
      output: item.output || "",
    };
  }

  if (item.toolType === "webSearch") {
    return {
      label: "searched",
      value: item.detail || "",
    };
  }

  if (item.toolType === "imageView") {
    const file = basename(item.detail || "");
    return {
      label: "read",
      value: file || "image",
    };
  }

  if (item.toolType === "mcpToolCall") {
    const toolName = toolNameFromTitle(item.title);
    const args = parseToolArgs(item.detail);
    const formattedDetail = formatToolDetail(item);
    if (toolName === "bash") {
      const command =
        cleanCommandText(firstStringField(args, ["command", "input"])) || "Shell command";
      return {
        label: "tool",
        value: command,
        detail: formattedDetail,
        output: item.output || "",
      };
    }
    if (toolName === "runtime-plan-validation") {
      return {
        label: "tool",
        value: "Planner diagnostics",
        detail: formattedDetail,
      };
    }
    if (toolName.toLowerCase().includes("search")) {
      return {
        label: "searched",
        value: firstStringField(args, ["query", "pattern", "text"]) || item.detail,
      };
    }
    if (toolName.toLowerCase().includes("read")) {
      const targetPath = firstStringField(args, ["path", "file", "filename"]) || item.detail;
      return {
        label: "read",
        value: basename(targetPath),
        detail: targetPath && targetPath !== basename(targetPath) ? targetPath : "",
      };
    }
    if (toolName) {
      return {
        label: "tool",
        value: toolName,
        detail: formattedDetail,
      };
    }
  }

  return {
    label: "tool",
    value: item.title || "",
    detail: formatToolDetail(item),
    output: item.output || "",
  };
}

export function formatDurationMs(durationMs: number) {
  const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainder = durationSeconds % 60;
  return `${durationMinutes}:${String(durationRemainder).padStart(2, "0")}`;
}

export function statusToneFromText(status?: string): StatusTone {
  return lifecycleStatusTone(status);
}

export function toolStatusTone(
  item: Extract<ConversationItem, { kind: "tool" }>,
  hasChanges: boolean
): StatusTone {
  const fromStatus = statusToneFromText(item.status);
  if (fromStatus !== "unknown") {
    return fromStatus;
  }
  if (item.output || hasChanges) {
    return "completed";
  }
  return "processing";
}

export type PlanFollowupState = {
  shouldShow: boolean;
  planItemId: string | null;
};

export function computePlanFollowupState({
  threadId,
  items,
  isThinking,
  hasVisibleUserInputRequest,
}: {
  threadId: string | null;
  items: ConversationItem[];
  isThinking: boolean;
  hasVisibleUserInputRequest: boolean;
}): PlanFollowupState {
  const artifact = resolveActivePlanArtifact({
    threadId,
    items,
    isThinking,
    hasBlockingSurface: hasVisibleUserInputRequest,
  });
  return { shouldShow: Boolean(artifact), planItemId: artifact?.planItemId ?? null };
}

export function scrollKeyForItems(items: ConversationItem[]) {
  if (!items.length) {
    return "empty";
  }
  const last = items[items.length - 1];
  switch (last.kind) {
    case "message":
      return `${last.id}-${last.text.length}`;
    case "reasoning":
      return `${last.id}-${last.summary.length}-${last.content.length}`;
    case "explore":
      return `${last.id}-${last.status}-${last.entries.length}`;
    case "tool":
      return `${last.id}-${last.status ?? ""}-${last.output?.length ?? 0}`;
    case "diff":
      return `${last.id}-${last.status ?? ""}-${last.diff.length}`;
    case "review":
      return `${last.id}-${last.state}-${last.text.length}`;
    default: {
      const _exhaustive: never = last;
      return _exhaustive;
    }
  }
}

export function exploreKindLabel(
  kind: Extract<ConversationItem, { kind: "explore" }>["entries"][number]["kind"]
) {
  return kind[0].toUpperCase() + kind.slice(1);
}

function truncateActivityDetail(value: string, maxLength = 88) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function toneLabel(
  tone: StatusTone,
  labels: { processing: string; completed: string; failed: string; unknown?: string }
) {
  if (tone === "processing") {
    return labels.processing;
  }
  if (tone === "completed") {
    return labels.completed;
  }
  if (tone === "failed") {
    return labels.failed;
  }
  return labels.unknown ?? labels.processing;
}

function summarizeToolActivity(
  item: Extract<ConversationItem, { kind: "tool" }>
): CurrentTurnActivitySummary {
  const commandText =
    item.toolType === "commandExecution" ? item.title.replace(/^Command:\s*/i, "").trim() : "";
  const summary = buildToolSummary(item, commandText);
  const hasChanges = (item.changes?.length ?? 0) > 0;
  const tone = toolStatusTone(item, hasChanges);

  if (item.toolType === "commandExecution") {
    return {
      label: toneLabel(tone, {
        processing: "Running command",
        completed: "Command finished",
        failed: "Command failed",
      }),
      detail: truncateActivityDetail(summary.value || commandText),
      tone,
    };
  }

  if (item.toolType === "fileChange") {
    const fileChanges = item.changes ?? [];
    const primaryFile = basename(fileChanges[0]?.path ?? "");
    const detail =
      fileChanges.length > 1
        ? `${primaryFile || "files"} +${fileChanges.length - 1}`
        : primaryFile || null;
    return {
      label: toneLabel(tone, {
        processing: fileChanges.length > 1 ? "Editing files" : "Editing file",
        completed: fileChanges.length > 1 ? "Files edited" : "File edited",
        failed: fileChanges.length > 1 ? "File edits failed" : "File edit failed",
      }),
      detail,
      tone,
    };
  }

  if (item.toolType === "plan") {
    return {
      label: toneLabel(tone, {
        processing: "Drafting plan",
        completed: "Plan ready",
        failed: "Plan failed",
      }),
      detail: truncateActivityDetail((item.output ?? "").split(/\r?\n/)[0] ?? ""),
      tone,
    };
  }

  if (summary.label === "read") {
    return {
      label: toneLabel(tone, {
        processing: "Reading file",
        completed: "Read file",
        failed: "Read failed",
      }),
      detail: truncateActivityDetail(summary.detail || summary.value || item.detail),
      tone,
    };
  }

  if (summary.label === "searched" || item.toolType === "webSearch") {
    return {
      label: toneLabel(tone, {
        processing: "Searching workspace",
        completed: "Search finished",
        failed: "Search failed",
      }),
      detail: truncateActivityDetail(summary.value || item.detail),
      tone,
    };
  }

  return {
    label: toneLabel(tone, {
      processing: "Running tool",
      completed: "Tool finished",
      failed: "Tool failed",
    }),
    detail: truncateActivityDetail(summary.value || item.title),
    tone,
  };
}

export function summarizeCurrentTurnActivity(
  items: ConversationItem[],
  isThinking: boolean
): CurrentTurnActivitySummary | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message") {
      if (item.role !== "assistant") {
        continue;
      }
      const firstLine =
        item.text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) ?? "";
      return {
        label: isThinking ? "Drafting reply" : "Reply ready",
        detail: truncateActivityDetail(firstLine),
        tone: isThinking ? "processing" : "completed",
      };
    }
    if (item.kind === "reasoning") {
      const parsed = parseReasoning(item);
      return {
        label: parsed.workingLabel || "Reasoning",
        detail: parsed.hasBody
          ? truncateActivityDetail(parsed.bodyText.split(/\r?\n/)[0] ?? "")
          : null,
        tone: isThinking ? "processing" : "completed",
      };
    }
    if (item.kind === "explore") {
      const latestEntry = item.entries[item.entries.length - 1];
      const tone = item.status === "explored" ? "completed" : "processing";
      return {
        label: toneLabel(tone, {
          processing: "Exploring workspace",
          completed: "Explore step finished",
          failed: "Explore failed",
          unknown: "Exploring workspace",
        }),
        detail: truncateActivityDetail(latestEntry?.label ?? ""),
        tone,
      };
    }
    if (item.kind === "tool") {
      return summarizeToolActivity(item);
    }
    if (item.kind === "diff") {
      const tone = statusToneFromText(item.status);
      return {
        label: toneLabel(tone, {
          processing: "Updating diff",
          completed: "Diff ready",
          failed: "Diff failed",
          unknown: "Updating diff",
        }),
        detail: truncateActivityDetail(item.title),
        tone,
      };
    }
    if (item.kind === "review") {
      const tone = item.state === "completed" ? "completed" : "processing";
      return {
        label: tone === "completed" ? "Review ready" : "Preparing review",
        detail: truncateActivityDetail(item.text.split(/\r?\n/)[0] ?? ""),
        tone,
      };
    }
  }
  return null;
}

export function summarizeCurrentTurnArtifacts(
  items: ConversationItem[]
): CurrentTurnArtifactSummary {
  const changedFiles = new Map<
    string,
    {
      path: string;
      label: string;
    }
  >();
  let diffCount = 0;
  let reviewCount = 0;

  for (const item of items) {
    if (item.kind === "tool" && item.toolType === "fileChange") {
      for (const change of item.changes ?? []) {
        const fileName = basename(change.path);
        const filePath = change.path?.trim() ?? "";
        if (fileName && filePath && !changedFiles.has(filePath)) {
          changedFiles.set(filePath, { path: filePath, label: fileName });
        }
      }
      continue;
    }
    if (item.kind === "diff") {
      diffCount += 1;
      continue;
    }
    if (item.kind === "review") {
      reviewCount += 1;
    }
  }

  return {
    changedFiles: [...changedFiles.values()],
    diffCount,
    reviewCount,
  };
}

export function currentTurnHasVisibleNonToolResponse(items: ConversationItem[]): boolean {
  return items.some((item) => {
    if (item.kind === "message") {
      return (
        item.role === "assistant" &&
        !resolveTimelineMessageBanner(item) &&
        item.text.trim().length > 0
      );
    }
    if (item.kind === "reasoning") {
      return parseReasoning(item).hasBody;
    }
    if (item.kind === "review") {
      return item.text.trim().length > 0;
    }
    if (item.kind === "diff") {
      return item.diff.trim().length > 0;
    }
    if (item.kind === "explore") {
      return item.entries.length > 0;
    }
    return false;
  });
}

export function resolveCurrentTurnItems(params: {
  items: ConversationItem[];
  lastUserMessageIndex: number;
  isThinking: boolean;
  lastDurationMs: number | null;
  isPlanModeActive?: boolean;
  showInternalRuntimeDiagnostics?: boolean;
}): ConversationItem[] {
  const currentTurnItems = params.items.slice(params.lastUserMessageIndex + 1).filter(
    (item) =>
      !shouldHideInternalToolItem(item, {
        isPlanModeActive: params.isPlanModeActive,
        showInternalRuntimeDiagnostics: params.showInternalRuntimeDiagnostics,
      })
  );
  if (currentTurnItems.length === 0) {
    return [];
  }
  if (params.lastUserMessageIndex < 0 && !params.isThinking && params.lastDurationMs === null) {
    return [];
  }
  // Preserve the latest post-user segment even when duration metadata is missing so
  // restored threads keep their turn summary and execution rail context.
  return currentTurnItems;
}

export function currentTurnHasRunningTool(items: ConversationItem[]): boolean {
  return items.some(
    (item) => item.kind === "tool" && normalizeLifecycleStatus(item.status) === "inProgress"
  );
}

export function resolveCurrentTurnProjectionFlags(params: {
  items: ConversationItem[];
  activeTurnId?: string | null;
  isThinking: boolean;
}) {
  const hasNoVisibleResponse = params.items.some(
    (item) =>
      item.kind === "message" && resolveTimelineMessageBanner(item)?.title === "No visible response"
  );
  const hasTerminalFailure = params.items.some((item) => {
    if (item.kind !== "message" || item.role !== "assistant") {
      return false;
    }
    if (/^Session stopped\.$/i.test(item.text.trim())) {
      return true;
    }
    const banner = resolveTimelineMessageBanner(item);
    return banner !== null && banner.title !== "No visible response";
  });
  const hasAgentResponse = currentTurnHasVisibleNonToolResponse(params.items);
  const hasRunningToolChrome = currentTurnHasRunningTool(params.items);
  const hasProjectedItems = params.items.length > 0;
  const hasActiveTurn = Boolean(params.activeTurnId?.trim());
  const hasToolOnlyCompletion =
    !hasNoVisibleResponse && !hasAgentResponse && params.items.some((item) => item.kind === "tool");
  const showCompleteFooter = !hasRunningToolChrome && !hasTerminalFailure;
  const shouldHoldWorkingState =
    hasActiveTurn &&
    !params.isThinking &&
    !hasProjectedItems &&
    !hasTerminalFailure &&
    !hasNoVisibleResponse;
  return {
    hasNoVisibleResponse,
    hasTerminalFailure,
    hasAgentResponse,
    hasRunningToolChrome,
    hasProjectedItems,
    hasActiveTurn,
    hasToolOnlyCompletion,
    showCompleteFooter,
    shouldHoldWorkingState,
  };
}

export type CurrentTurnFooterKind = "complete" | "warning" | "tool-only";

export function resolveCurrentTurnFooterKind(params: {
  hasNoVisibleResponse: boolean;
  hasToolOnlyCompletion: boolean;
  hasTimelineFollowups: boolean;
}): CurrentTurnFooterKind {
  if (params.hasNoVisibleResponse) return "warning";
  if (params.hasToolOnlyCompletion && !params.hasTimelineFollowups) return "tool-only";
  return "complete";
}

export type CurrentTurnDiagnosticState =
  | "working"
  | "failed"
  | "no-visible-response"
  | "tool-only"
  | "complete"
  | "empty"
  | "projected"
  | "idle";

export function resolveCurrentTurnDiagnosticState(params: {
  isThinking: boolean;
  hasTerminalFailure: boolean;
  hasNoVisibleResponse: boolean;
  hasToolOnlyCompletion: boolean;
  hasTimelineFollowups: boolean;
  lastDurationMs: number | null;
  showCompleteFooter: boolean;
  hasProjectedItems: boolean;
}): CurrentTurnDiagnosticState {
  if (params.isThinking) return "working";
  if (params.hasTerminalFailure) return "failed";
  if (params.hasNoVisibleResponse) return "no-visible-response";
  if (
    params.hasToolOnlyCompletion &&
    !params.hasTimelineFollowups &&
    params.lastDurationMs !== null
  )
    return "tool-only";
  if (params.lastDurationMs !== null && params.showCompleteFooter && params.hasProjectedItems)
    return "complete";
  if (params.lastDurationMs !== null && !params.hasProjectedItems) return "empty";
  return params.hasProjectedItems ? "projected" : "idle";
}

export function resolveCurrentTurnChromeState(params: {
  isThinking: boolean;
  hasTerminalFailure: boolean;
  hasNoVisibleResponse: boolean;
  hasToolOnlyCompletion: boolean;
  hasTimelineFollowups: boolean;
  lastDurationMs: number | null;
  showCompleteFooter: boolean;
  hasProjectedItems: boolean;
}): { footerKind: CurrentTurnFooterKind; diagnosticState: CurrentTurnDiagnosticState } {
  return {
    footerKind: resolveCurrentTurnFooterKind(params),
    diagnosticState: resolveCurrentTurnDiagnosticState(params),
  };
}

export type CurrentTurnProgress = {
  updates: number;
  toolCalls: number;
  reasoningSteps: number;
  exploreSteps: number;
  reviewCount: number;
  diffCount: number;
  fileEdits: number;
  replies: number;
};

export function buildToolGroupBreakdownLabels(
  group: Pick<ToolGroup, "toolCallCount" | "exploreStepCount" | "reasoningStepCount">
) {
  const labels: string[] = [];
  if (group.toolCallCount > 0) {
    labels.push(formatCount(group.toolCallCount, "tool call", "tool calls"));
  }
  if (group.exploreStepCount > 0) {
    labels.push(formatCount(group.exploreStepCount, "explore step", "explore steps"));
  }
  if (group.reasoningStepCount > 0) {
    labels.push(formatCount(group.reasoningStepCount, "reasoning step", "reasoning steps"));
  }
  return labels;
}

export function buildCurrentTurnBreakdownLabels(
  progress: Pick<
    CurrentTurnProgress,
    "toolCalls" | "exploreSteps" | "reasoningSteps" | "replies" | "reviewCount" | "diffCount"
  >
) {
  const labels: string[] = [];
  if (progress.toolCalls > 0) {
    labels.push(formatCount(progress.toolCalls, "tool call", "tool calls"));
  }
  if (progress.exploreSteps > 0) {
    labels.push(formatCount(progress.exploreSteps, "explore step", "explore steps"));
  }
  if (progress.reasoningSteps > 0) {
    labels.push(formatCount(progress.reasoningSteps, "reasoning step", "reasoning steps"));
  }
  if (progress.replies > 0) {
    labels.push(formatCount(progress.replies, "reply", "replies"));
  }
  if (progress.reviewCount > 0) {
    labels.push(formatCount(progress.reviewCount, "review", "reviews"));
  }
  if (progress.diffCount > 0) {
    labels.push(formatCount(progress.diffCount, "diff", "diffs"));
  }
  return labels;
}

export function summarizeCurrentTurnProgress(
  items: ConversationItem[],
  lastUserMessageIndex: number,
  options?: { isPlanModeActive?: boolean; showInternalRuntimeDiagnostics?: boolean }
): CurrentTurnProgress {
  let updates = 0;
  let toolCalls = 0;
  let reasoningSteps = 0;
  let exploreSteps = 0;
  let reviewCount = 0;
  let diffCount = 0;
  let fileEdits = 0;
  let replies = 0;
  for (const item of items.slice(lastUserMessageIndex + 1)) {
    if (shouldHideInternalToolItem(item, options)) {
      continue;
    }
    if (item.kind === "tool") {
      updates += 1;
      toolCalls += 1;
      if (item.toolType === "fileChange") {
        fileEdits += item.changes?.length ?? 0;
      }
    } else if (item.kind === "reasoning") {
      updates += 1;
      reasoningSteps += 1;
    } else if (item.kind === "explore") {
      updates += 1;
      exploreSteps += item.entries.length;
    } else if (item.kind === "message" && item.role === "assistant") {
      updates += 1;
      replies += 1;
    } else if (item.kind === "review") {
      updates += 1;
      reviewCount += 1;
    } else if (item.kind === "diff") {
      updates += 1;
      diffCount += 1;
    }
  }
  return {
    updates,
    toolCalls,
    reasoningSteps,
    exploreSteps,
    reviewCount,
    diffCount,
    fileEdits,
    replies,
  };
}

export type CurrentTurnMeta = {
  lastUserMessageIndex: number;
  currentTurnStartVisibleItemId: string | null;
};

export function resolveCurrentTurnMeta(
  items: ConversationItem[],
  lastUserMessageIndex: number,
  visibleItemIndexById: Map<string, number>
): CurrentTurnMeta {
  let currentTurnStartVisibleItemId: string | null = null;
  let hasEarlierVisibleHistory = false;
  if (lastUserMessageIndex >= 0) {
    for (let index = 0; index < lastUserMessageIndex; index += 1) {
      if (visibleItemIndexById.has(items[index]!.id)) {
        hasEarlierVisibleHistory = true;
        break;
      }
    }
    for (let index = lastUserMessageIndex + 1; index < items.length; index += 1) {
      const item = items[index]!;
      if (visibleItemIndexById.has(item.id)) {
        currentTurnStartVisibleItemId = item.id;
        break;
      }
    }
  }

  if (currentTurnStartVisibleItemId) {
    const visibleIndex = visibleItemIndexById.get(currentTurnStartVisibleItemId) ?? 0;
    if (visibleIndex === 0 || !hasEarlierVisibleHistory) {
      currentTurnStartVisibleItemId = null;
    }
  }

  return {
    lastUserMessageIndex,
    currentTurnStartVisibleItemId,
  };
}
