import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RequestUserInputRequest,
} from "../../types";
import {
  getApprovalPresentationEntries,
  renderApprovalParamValue,
} from "../messages/utils/approvalPresentation";
import {
  buildToolSummary,
  extractToolPlannerDiagnostics,
  formatDurationMs,
  formatToolDetail,
} from "../messages/utils/messageRenderUtils";
import {
  extractTimelineDiffFiles,
  resolveTimelineMessageBanner,
} from "../messages/utils/timelineSurface";
import type { RightPanelSelection } from "./RightPanelInspectorContext";

export type RightPanelDiffFile = {
  path: string;
  status: string;
};

export type RightPanelGitDiff = {
  path: string;
  status: string;
  diff: string;
};

type BaseModel = {
  title: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: string }>;
};

type RightPanelStatusModel = {
  kind: "status";
  tone: "warning" | "error";
  description: string;
  metadata: Array<{ label: string; value: string }>;
} & BaseModel;

type RightPanelApprovalModel = {
  kind: "approval";
  entries: Array<{ label: string; value: string; isCode: boolean }>;
} & BaseModel;

type RightPanelUserInputModel = {
  kind: "user-input";
  questions: Array<{ header: string; question: string; options: string[] }>;
} & BaseModel;

type RightPanelToolCallModel = {
  kind: "tool-call";
  toolType: string;
  callId: string;
  detail: string;
} & BaseModel;

type RightPanelFileModel = {
  kind: "file";
  path: string;
  fileStatus: string;
  diff?: string | null;
  metadata: Array<{ label: string; value: string }>;
} & BaseModel;

type RightPanelDiffModel = {
  kind: "diff";
  diff: string;
  files: RightPanelDiffFile[];
  status: string | null;
} & BaseModel;

type RightPanelToolModel = {
  kind: "tool";
  toolType: string;
  status: string | null;
  detail: string;
  output: string | null;
  changes: NonNullable<Extract<ConversationItem, { kind: "tool" }>["changes"]>;
  diagnostics: string[];
} & BaseModel;

type RightPanelReasoningModel = {
  kind: "reasoning";
  content: string;
} & BaseModel;

type RightPanelExploreModel = {
  kind: "explore";
  status: string;
  entries: Extract<ConversationItem, { kind: "explore" }>["entries"];
} & BaseModel;

type RightPanelReviewModel = {
  kind: "review";
  state: string;
  text: string;
} & BaseModel;

type RightPanelMessageModel = {
  kind: "message";
  role: "user" | "assistant";
  text: string;
} & BaseModel;

export type RightPanelInterruptModel =
  | RightPanelStatusModel
  | RightPanelApprovalModel
  | RightPanelUserInputModel
  | RightPanelToolCallModel;

export type RightPanelDetailModel =
  | RightPanelStatusModel
  | RightPanelFileModel
  | RightPanelDiffModel
  | RightPanelToolModel
  | RightPanelReasoningModel
  | RightPanelExploreModel
  | RightPanelReviewModel
  | RightPanelMessageModel;

export type ResolvedRightPanelModel = {
  interruptModel: RightPanelInterruptModel | null;
  detailModel: RightPanelDetailModel | null;
  selectionSync:
    | { mode: "idle" }
    | {
        mode: "replace";
        selection: Exclude<RightPanelSelection, null>;
      }
    | { mode: "clear" };
};

type ResolveRightPanelModelArgs = {
  selection: RightPanelSelection;
  items: ConversationItem[];
  threadId: string | null;
  workspaceLoadError: string | null;
  selectedDiffPath: string | null;
  gitDiffs: RightPanelGitDiff[];
  turnDiff: string | null;
  approvalRequests: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
};

type InspectableDetailItem = Extract<
  ConversationItem,
  { kind: "tool" | "reasoning" | "explore" | "review" | "diff" }
>;

type SyntheticTurnDiffItem = Extract<ConversationItem, { kind: "diff" }> & {
  source: "turn";
};

export function isInspectableRightPanelDetailItem(
  item: ConversationItem | SyntheticTurnDiffItem
): item is InspectableDetailItem | SyntheticTurnDiffItem {
  return (
    item.kind === "tool" ||
    item.kind === "reasoning" ||
    item.kind === "explore" ||
    item.kind === "review" ||
    item.kind === "diff"
  );
}

function findLatestInspectableRightPanelDetailItem(
  items: Array<ConversationItem | SyntheticTurnDiffItem>
) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (isInspectableRightPanelDetailItem(item)) {
      return item;
    }
  }
  return null;
}

function prettyStatus(status?: string | null) {
  if (!status) {
    return "Idle";
  }
  const normalized = status.trim();
  if (!normalized) {
    return "Idle";
  }
  return normalized
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeText(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function buildMessageModel(
  item: Extract<ConversationItem, { kind: "message" }>
): RightPanelMessageModel | RightPanelStatusModel {
  const banner = resolveTimelineMessageBanner(item);
  if (banner) {
    return {
      kind: "status",
      tone: banner.tone === "runtime" ? "warning" : "error",
      title: banner.title,
      subtitle: item.role === "assistant" ? "Assistant message" : "Message",
      description: banner.body,
      metadata: [{ label: "Role", value: item.role }],
    };
  }
  return {
    kind: "message",
    title: item.role === "assistant" ? "Assistant message" : "User message",
    subtitle: "Message captured in the active thread",
    role: item.role,
    text: item.text,
  };
}

function buildToolModel(item: Extract<ConversationItem, { kind: "tool" }>): RightPanelToolModel {
  const summary = buildToolSummary(item, item.title);
  const diagnostics = extractToolPlannerDiagnostics(item);
  const detail = formatToolDetail(item);
  return {
    kind: "tool",
    title: item.title,
    subtitle: summarizeText(detail || item.detail, "Structured execution detail"),
    toolType: item.toolType,
    status: item.status ?? null,
    detail,
    output: summary.output ?? null,
    changes: item.changes ?? [],
    diagnostics:
      diagnostics?.diagnostics.map(
        (entry) => `${entry.severity.toUpperCase()} ${entry.code}: ${entry.message}`
      ) ?? [],
    metrics: [
      { label: "Type", value: item.toolType || "tool" },
      ...(item.changes && item.changes.length > 0
        ? [{ label: "Changes", value: String(item.changes.length) }]
        : []),
      ...(diagnostics?.diagnostics.length
        ? [{ label: "Diagnostics", value: String(diagnostics.diagnostics.length) }]
        : []),
      ...(typeof item.durationMs === "number"
        ? [{ label: "Duration", value: formatDurationMs(item.durationMs) }]
        : []),
      ...(item.attempt ? [{ label: "Attempt", value: String(item.attempt) }] : []),
    ],
  };
}

function buildReasoningModel(
  item: Extract<ConversationItem, { kind: "reasoning" }>
): RightPanelReasoningModel {
  return {
    kind: "reasoning",
    title: item.summary || "Reasoning step",
    subtitle: summarizeText(item.content, "Reasoning recorded for this turn"),
    content: item.content,
  };
}

function buildExploreModel(
  item: Extract<ConversationItem, { kind: "explore" }>
): RightPanelExploreModel {
  return {
    kind: "explore",
    title: item.status === "exploring" ? "Exploration in progress" : "Exploration summary",
    subtitle: `${item.entries.length} recorded actions`,
    status: item.status,
    entries: item.entries,
    metrics: [{ label: "Entries", value: String(item.entries.length) }],
  };
}

function buildReviewModel(
  item: Extract<ConversationItem, { kind: "review" }>
): RightPanelReviewModel {
  return {
    kind: "review",
    title: "Diff review",
    subtitle: summarizeText(item.text, "Reviewer note attached to the current diff"),
    state: item.state,
    text: item.text,
  };
}

function buildDiffModel(item: Extract<ConversationItem, { kind: "diff" }>): RightPanelDiffModel {
  const files = extractTimelineDiffFiles(item.diff);
  return {
    kind: "diff",
    title: item.title || "Diff detail",
    subtitle: files.length > 0 ? `${files.length} changed files` : "No changed file summary",
    diff: item.diff,
    files,
    status: item.status ?? null,
    metrics: [{ label: "Files", value: String(files.length) }],
  };
}

function buildSyntheticTurnDiffItem(
  threadId: string | null,
  turnDiff: string | null
): SyntheticTurnDiffItem | null {
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
    source: "turn",
  };
}

function buildInspectableDetailModel(
  item: InspectableDetailItem | SyntheticTurnDiffItem
): RightPanelDetailModel {
  if (item.kind === "tool") {
    return buildToolModel(item);
  }
  if (item.kind === "reasoning") {
    return buildReasoningModel(item);
  }
  if (item.kind === "explore") {
    return buildExploreModel(item);
  }
  if (item.kind === "review") {
    return buildReviewModel(item);
  }
  return buildDiffModel(item);
}

function buildSelectionFromItem(
  item: ConversationItem | SyntheticTurnDiffItem
): Exclude<RightPanelSelection, null> | null {
  if ("source" in item && item.source === "turn") {
    return null;
  }
  if (
    item.kind === "message" ||
    item.kind === "reasoning" ||
    item.kind === "tool" ||
    item.kind === "explore" ||
    item.kind === "review" ||
    item.kind === "diff"
  ) {
    return {
      kind: item.kind,
      itemId: item.id,
    };
  }
  return null;
}

function buildApprovalModel(request: ApprovalRequest): RightPanelApprovalModel {
  const entries = getApprovalPresentationEntries(request).map(([key, value]) => {
    const rendered = renderApprovalParamValue(key, value);
    return {
      label: key,
      value: rendered.text,
      isCode: rendered.isCode,
    };
  });

  return {
    kind: "approval",
    title: "Permission required",
    subtitle: "Execution is paused until this approval request is resolved.",
    entries,
  };
}

function buildUserInputModel(request: RequestUserInputRequest): RightPanelUserInputModel {
  return {
    kind: "user-input",
    title: "Input required",
    subtitle: "The active turn is blocked on a structured response.",
    questions: request.params.questions.map((question) => ({
      header: question.header,
      question: question.question,
      options: question.options?.map((option) => option.label) ?? [],
    })),
  };
}

function buildToolCallRequestModel(request: DynamicToolCallRequest): RightPanelToolCallModel {
  return {
    kind: "tool-call",
    title: request.params.tool,
    subtitle: "The runtime has prepared the next tool invocation and is waiting to proceed.",
    toolType: request.params.tool,
    callId: request.params.call_id,
    detail: JSON.stringify(request.params.arguments, null, 2),
  };
}

function buildFileModel(
  selectedDiffPath: string,
  gitDiffs: RightPanelGitDiff[]
): RightPanelFileModel {
  const diffEntry = gitDiffs.find((entry) => entry.path === selectedDiffPath) ?? null;
  return {
    kind: "file",
    title: selectedDiffPath.split("/").pop() || selectedDiffPath,
    subtitle: selectedDiffPath,
    path: selectedDiffPath,
    fileStatus: diffEntry?.status ?? "selected",
    diff: diffEntry?.diff ?? null,
    metadata: [
      { label: "Status", value: prettyStatus(diffEntry?.status ?? "selected") },
      { label: "Source", value: "Context diff selection" },
    ],
  };
}

function buildWorkspaceStatusModel(workspaceLoadError: string): RightPanelStatusModel {
  return {
    kind: "status",
    tone: /runtime unavailable|offline/i.test(workspaceLoadError) ? "warning" : "error",
    title: /runtime unavailable|offline/i.test(workspaceLoadError)
      ? "Runtime offline"
      : "Workspace connection issue",
    subtitle: "The right rail is reflecting degraded workspace state.",
    description: workspaceLoadError,
    metadata: [
      { label: "Impact", value: "The active thread cannot continue until the issue is resolved." },
    ],
  };
}

export function resolveRightPanelModel({
  selection,
  items,
  threadId,
  workspaceLoadError,
  selectedDiffPath,
  gitDiffs,
  turnDiff,
  approvalRequests,
  userInputRequests,
  toolCallRequests,
}: ResolveRightPanelModelArgs): ResolvedRightPanelModel {
  const turnDiffItem = buildSyntheticTurnDiffItem(threadId, turnDiff);
  const detailItems = turnDiffItem ? [...items, turnDiffItem] : items;
  let detailModel: RightPanelDetailModel | null = null;
  let selectionSync: ResolvedRightPanelModel["selectionSync"] = { mode: "idle" };

  if (selection) {
    const selectedItem = detailItems.find((item) => item.id === selection.itemId) ?? null;
    if (selectedItem) {
      switch (selectedItem.kind) {
        case "message":
          detailModel = buildMessageModel(selectedItem);
          break;
        case "reasoning":
          detailModel = buildReasoningModel(selectedItem);
          break;
        case "tool":
          detailModel = buildToolModel(selectedItem);
          break;
        case "explore":
          detailModel = buildExploreModel(selectedItem);
          break;
        case "review":
          detailModel = buildReviewModel(selectedItem);
          break;
        case "diff":
          detailModel = buildDiffModel(selectedItem);
          break;
      }
    } else {
      selectionSync = { mode: "clear" };
    }
  }

  if (!detailModel && selectedDiffPath) {
    detailModel = buildFileModel(selectedDiffPath, gitDiffs);
  }

  if (!detailModel) {
    const latestInspectableItem = findLatestInspectableRightPanelDetailItem(detailItems);
    if (latestInspectableItem) {
      detailModel = buildInspectableDetailModel(latestInspectableItem);
      if (selection?.itemId && selectionSync.mode === "clear") {
        const fallbackSelection = buildSelectionFromItem(latestInspectableItem);
        selectionSync = fallbackSelection
          ? {
              mode: "replace",
              selection: fallbackSelection,
            }
          : { mode: "clear" };
      }
    }
  }

  if (approvalRequests.length > 0) {
    return {
      interruptModel: buildApprovalModel(approvalRequests[approvalRequests.length - 1]),
      detailModel,
      selectionSync,
    };
  }

  if (userInputRequests.length > 0) {
    return {
      interruptModel: buildUserInputModel(userInputRequests[userInputRequests.length - 1]),
      detailModel,
      selectionSync,
    };
  }

  if (workspaceLoadError) {
    return {
      interruptModel: buildWorkspaceStatusModel(workspaceLoadError),
      detailModel,
      selectionSync,
    };
  }

  if (toolCallRequests.length > 0) {
    return {
      interruptModel: buildToolCallRequestModel(toolCallRequests[toolCallRequests.length - 1]),
      detailModel,
      selectionSync,
    };
  }

  return { interruptModel: null, detailModel, selectionSync };
}
